import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type {
  DiscoveredIndicator,
  NormalizedRecord,
  ObservationSink,
  SyncWarning,
  WriteStats,
} from "@/providers/base/types";
import { dateOnlyToUtc } from "@/services/normalization/values";
import {
  type PlannedRecord,
  type StoredRevision,
  planRevisions,
} from "./revisions";

const WRITE_CHUNK = 1_000;

/** Persists normalized records as append-only observation revisions. */
export class PrismaObservationSink implements ObservationSink {
  constructor(
    private readonly db: PrismaClient,
    private readonly sourceId: string,
    private readonly syncJobId: string | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async registerIndicators(indicators: DiscoveredIndicator[]): Promise<void> {
    const slugs = [...new Set(indicators.map((i) => i.diseaseSlug))];
    const diseases = await this.db.disease.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const diseaseIds = new Map(diseases.map((d) => [d.slug, d.id]));
    const seenAt = this.now();

    for (const indicator of indicators) {
      const diseaseId = diseaseIds.get(indicator.diseaseSlug);
      if (!diseaseId) {
        throw new Error(
          `Indicator ${indicator.code} references unknown disease "${indicator.diseaseSlug}". Run the database seed first.`,
        );
      }
      const semantics = {
        diseaseId,
        indicator: indicator.indicator,
        caseClassification: indicator.caseClassification,
        aggregation: indicator.aggregation,
        unit: indicator.unit,
        definition: indicator.definition,
        available: indicator.available,
      };
      await this.db.sourceIndicator.upsert({
        where: {
          sourceId_code: { sourceId: this.sourceId, code: indicator.code },
        },
        create: {
          ...semantics,
          sourceId: this.sourceId,
          code: indicator.code,
          name: indicator.upstreamName ?? indicator.code,
          lastSeenAt: indicator.upstreamName ? seenAt : null,
        },
        update: {
          ...semantics,
          // Keep the last known upstream name if discovery could not run.
          ...(indicator.upstreamName
            ? { name: indicator.upstreamName, lastSeenAt: seenAt }
            : {}),
        },
      });
    }
  }

  async markIndicatorsSynced(codes: string[]): Promise<void> {
    if (codes.length === 0) return;
    await this.db.sourceIndicator.updateMany({
      where: { sourceId: this.sourceId, code: { in: codes } },
      data: { lastSuccessfulSync: this.now() },
    });
  }

  async writeObservations(records: NormalizedRecord[]): Promise<WriteStats> {
    const warnings: SyncWarning[] = [];
    if (records.length === 0)
      return { inserted: 0, revised: 0, unchanged: 0, skipped: 0, warnings };

    const indicatorRows = await this.db.sourceIndicator.findMany({
      where: {
        sourceId: this.sourceId,
        code: { in: [...new Set(records.map((r) => r.sourceIndicatorCode))] },
      },
      select: { id: true, code: true, diseaseId: true },
    });
    const indicators = new Map(indicatorRows.map((i) => [i.code, i]));

    const missingIndicator = records.filter(
      (r) => !indicators.has(r.sourceIndicatorCode),
    );
    if (missingIndicator.length > 0) {
      throw new Error(
        `Records reference unregistered indicators: ${[...new Set(missingIndicator.map((r) => r.sourceIndicatorCode))].join(", ")}`,
      );
    }

    const countries = await this.db.country.findMany({
      select: { id: true, iso2: true, iso3: true },
    });
    const countryIds = new Map(countries.map((c) => [c.iso3, c.id]));
    const countryIdsByIso2 = new Map(countries.map((c) => [c.iso2, c.id]));

    const latest = await this.loadLatest(indicatorRows.map((i) => i.id));
    const plan = planRevisions(records, latest);
    warnings.push(...plan.warnings);

    const unmatched = new Set<string>();
    const toRow = (
      planned: PlannedRecord,
    ): Prisma.DiseaseObservationCreateManyInput => {
      const { record } = planned;
      const indicator = indicators.get(record.sourceIndicatorCode)!;
      let countryId: string | null = null;
      if (record.countryIso3) {
        countryId = countryIds.get(record.countryIso3) ?? null;
        if (!countryId) unmatched.add(record.countryIso3);
      } else if (record.countryIso2) {
        countryId = countryIdsByIso2.get(record.countryIso2) ?? null;
        if (!countryId) unmatched.add(record.countryIso2);
      }
      return {
        diseaseId: indicator.diseaseId,
        countryId,
        sourceId: this.sourceId,
        sourceIndicatorId: indicator.id,
        indicator: record.indicator,
        value: record.value,
        lowerBound: record.lowerBound,
        upperBound: record.upperBound,
        rawValue: record.rawValue,
        unit: record.unit,
        caseClassification: record.caseClassification,
        aggregation: record.aggregation,
        geoScope: record.geoScope,
        geoCode: record.geoCode,
        periodStart: dateOnlyToUtc(record.periodStart),
        periodEnd: dateOnlyToUtc(record.periodEnd),
        reportedAt: record.reportedAt,
        sourceRecordId: record.sourceRecordId,
        revision: planned.revision,
        isLatest: true,
        contentHash: planned.hash,
        syncJobId: this.syncJobId,
        sourceMetadata: record.metadata as Prisma.InputJsonValue,
      };
    };

    const all = [...plan.inserts, ...plan.revisions];
    for (let i = 0; i < all.length; i += WRITE_CHUNK) {
      const chunk = all.slice(i, i + WRITE_CHUNK);
      const supersedeIds = chunk.flatMap((p) =>
        p.supersedesId ? [p.supersedesId] : [],
      );
      const supersededAt = this.now();
      await this.db.$transaction([
        this.db.diseaseObservation.updateMany({
          where: { id: { in: supersedeIds }, isLatest: true },
          data: { isLatest: false, supersededAt },
        }),
        this.db.diseaseObservation.createMany({ data: chunk.map(toRow) }),
      ]);
    }

    if (unmatched.size > 0) {
      warnings.push({
        code: "UNMATCHED_COUNTRY",
        message: `${unmatched.size} country code(s) did not match an ISO 3166-1 country; stored without a country link.`,
        context: { codes: [...unmatched].sort() },
      });
    }

    return {
      inserted: plan.inserts.length,
      revised: plan.revisions.length,
      unchanged: plan.unchanged,
      skipped: plan.conflicts,
      warnings,
    };
  }

  private async loadLatest(
    sourceIndicatorIds: string[],
  ): Promise<Map<string, StoredRevision>> {
    const rows = await this.db.diseaseObservation.findMany({
      where: {
        sourceId: this.sourceId,
        sourceIndicatorId: { in: sourceIndicatorIds },
        isLatest: true,
      },
      select: {
        id: true,
        sourceRecordId: true,
        revision: true,
        contentHash: true,
      },
    });
    return new Map(
      rows.map((r) => [
        r.sourceRecordId,
        { id: r.id, revision: r.revision, contentHash: r.contentHash },
      ]),
    );
  }
}
