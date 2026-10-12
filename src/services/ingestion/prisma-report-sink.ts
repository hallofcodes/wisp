import type { PrismaClient } from "@/generated/prisma/client";
import type {
  NormalizedOutbreakReport,
  ReportSink,
  SyncWarning,
  WriteStats,
} from "@/providers/base/types";
import { groupReports } from "@/services/aggregation/outbreak-grouping";

const WRITE_CHUNK = 500;

export class PrismaReportSink implements ReportSink {
  constructor(
    private readonly db: PrismaClient,
    private readonly sourceId: string,
  ) {}

  async writeReports(
    reports: NormalizedOutbreakReport[],
    options: { complete: boolean },
  ): Promise<WriteStats> {
    const warnings: SyncWarning[] = [];
    const existing = await this.db.outbreakReport.findMany({
      where: { sourceId: this.sourceId },
      select: {
        id: true,
        externalId: true,
        title: true,
        sourceUrl: true,
        updatedAt: true,
        contentSummary: true,
        countryIso3s: true,
      },
    });
    const byExternalId = new Map(existing.map((r) => [r.externalId, r]));

    const toCreate: NormalizedOutbreakReport[] = [];
    const toUpdate: { id: string; report: NormalizedOutbreakReport }[] = [];
    let unchanged = 0;
    const seen = new Set<string>();
    
    for (const report of reports) {
      if (seen.has(report.externalId)) continue;
      seen.add(report.externalId);
      const stored = byExternalId.get(report.externalId);
      if (!stored) toCreate.push(report);
      else if (
        stored.title !== report.title ||
        stored.sourceUrl !== report.sourceUrl ||
        stored.contentSummary !== report.contentSummary ||
        stored.countryIso3s.join() !== report.countryIso3s.join() ||
        (stored.updatedAt?.getTime() ?? null) !==
          (report.updatedAt?.getTime() ?? null)
      )
        toUpdate.push({ id: stored.id, report });
      else unchanged++;
    }

    const fields = (r: NormalizedOutbreakReport) => ({
      title: r.title,
      sourceUrl: r.sourceUrl,
      publishedAt: r.publishedAt,
      updatedAt: r.updatedAt,
      contentSummary: r.contentSummary,
      displayId: r.displayId,
      scopeLabel: r.countryIso3s.length === 0 ? r.scopeLabel : null,
      countryIso3s: r.countryIso3s,
    });

    for (let i = 0; i < toCreate.length; i += WRITE_CHUNK) {
      await this.db.outbreakReport.createMany({
        data: toCreate.slice(i, i + WRITE_CHUNK).map((r) => ({
          sourceId: this.sourceId,
          externalId: r.externalId,
          ...fields(r),
        })),
        skipDuplicates: true,
      });
    }
    
    for (const { id, report } of toUpdate) {
      await this.db.outbreakReport.update({
        where: { id },
        data: fields(report),
      });
    }
    
    if (toUpdate.length > 0) {
      await this.db.auditLog.create({
        data: {
          action: "outbreakReport.updatedFromSource",
          entityType: "DataSource",
          entityId: this.sourceId,
          metadata: {
            externalIds: toUpdate.slice(0, 100).map((u) => u.report.externalId),
            count: toUpdate.length,
          },
        },
      });
    }

    if (options.complete) {
      await this.rebuildOutbreaks(reports, warnings);
    } else {
      warnings.push({
        code: "INCOMPLETE_FETCH",
        message:
          "Report history was incomplete; outbreak records were left unchanged.",
      });
    }

    return {
      inserted: toCreate.length,
      revised: toUpdate.length,
      unchanged,
      skipped: 0,
      warnings,
    };
  }

  private async rebuildOutbreaks(
    reports: NormalizedOutbreakReport[],
    warnings: SyncWarning[],
  ): Promise<void> {
    const [diseases, countries] = await Promise.all([
      this.db.disease.findMany({ select: { id: true, slug: true } }),
      this.db.country.findMany({ select: { id: true, iso3: true } }),
    ]);
    const diseaseIds = new Map(diseases.map((d) => [d.slug, d.id]));
    const countryIds = new Map(countries.map((c) => [c.iso3, c.id]));

    const groups = groupReports(
      reports.filter((r) => r.diseaseSlug && diseaseIds.has(r.diseaseSlug)),
    );
    const unknownCountries = new Set<string>();

    for (const group of groups) {
      const data = {
        diseaseId: diseaseIds.get(group.diseaseSlug)!,
        title: group.title,
        status: group.suspected
          ? ("SUSPECTED" as const)
          : ("REPORTED" as const),
        firstReportedAt: group.firstReportedAt,
        lastReportedAt: group.lastReportedAt,
        sourceId: this.sourceId,
      };
      const outbreak = await this.db.outbreak.upsert({
        where: { slug: group.slug },
        create: { slug: group.slug, ...data },
        update: data,
        select: { id: true },
      });

      const locations = group.countryIso3s.length
        ? group.countryIso3s.map((iso3) => {
            const countryId = countryIds.get(iso3) ?? null;
            if (!countryId) unknownCountries.add(iso3);
            // Country-level only: coordinates are never derived from a country.
            return {
              outbreakId: outbreak.id,
              countryId,
              regionName: countryId ? null : iso3,
              locationPrecision: "COUNTRY" as const,
            };
          })
        : [
            {
              outbreakId: outbreak.id,
              countryId: null,
              regionName: group.scopeLabel,
              locationPrecision: "REGION" as const,
            },
          ];

      await this.db.$transaction([
        this.db.outbreakLocation.deleteMany({
          where: { outbreakId: outbreak.id },
        }),
        this.db.outbreakLocation.createMany({ data: locations }),
        this.db.outbreakReport.updateMany({
          where: {
            sourceId: this.sourceId,
            externalId: { in: group.reportExternalIds },
          },
          data: { outbreakId: outbreak.id },
        }),
      ]);
    }

    // Groupings that no longer exist (e.g. a report was retitled) are removed;
    // their reports are unlinked by the foreign key's SET NULL.
    const removed = await this.db.outbreak.deleteMany({
      where: {
        sourceId: this.sourceId,
        slug: { notIn: groups.map((g) => g.slug) },
      },
    });
    if (removed.count > 0) {
      await this.db.auditLog.create({
        data: {
          action: "outbreak.regrouped",
          entityType: "DataSource",
          entityId: this.sourceId,
          metadata: { removedOutbreaks: removed.count },
        },
      });
    }

    if (unknownCountries.size > 0) {
      warnings.push({
        code: "UNMATCHED_COUNTRY",
        message: `${unknownCountries.size} country code(s) from report titles are not in the country table.`,
        context: { codes: [...unknownCountries] },
      });
    }
  }
}
