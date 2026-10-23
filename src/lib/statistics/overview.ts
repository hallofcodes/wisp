import type { PrismaClient } from "@/generated/prisma/client";
import type { CaseClassification, Indicator, SyncStatus } from "@/generated/prisma/enums";

export interface IndicatorCoverage {
  code: string;
  name: string;
  unit: string;
  indicator: Indicator;
  caseClassification: CaseClassification;
  available: boolean;
  lastSuccessfulSync: Date | null;
  diseaseName: string;
  diseaseSlug: string;
  sourceName: string;
  /** Most recent period with at least one country-level value. */
  latestPeriodStart: Date | null;
  latestPeriodEnd: Date | null;
  /** Geographies with a country-level value for that latest period. */
  countriesInLatestPeriod: number;
}

export interface SourceStatus {
  slug: string;
  name: string;
  organization: string;
  homepageUrl: string;
  license: string;
  licenseUrl: string | null;
  attributionRequirements: string;
  enabled: boolean;
  lastSuccessfulSync: Date | null;
  lastJob: { status: SyncStatus; startedAt: Date; completedAt: Date | null } | null;
}

export interface RecentReport {
  title: string;
  url: string;
  displayId: string | null;
  publishedAt: Date;
  sourceName: string;
}

export interface Overview {
  diseaseCount: number;
  recentReports: RecentReport[];
  indicatorsWithData: number;
  countriesWithData: number;
  indicators: IndicatorCoverage[];
  sources: SourceStatus[];
}

export async function getOverview(db: PrismaClient): Promise<Overview> {
  const [diseaseCount, recentReports, coverage, countries, sources] = await Promise.all([
    db.disease.count(),
    db.outbreakReport.findMany({
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: { title: true, sourceUrl: true, displayId: true, publishedAt: true, source: { select: { name: true } } },
    }),
    db.$queryRaw<
      {
        code: string;
        name: string;
        unit: string;
        indicator: Indicator;
        caseClassification: CaseClassification;
        available: boolean;
        lastSuccessfulSync: Date | null;
        diseaseName: string;
        diseaseSlug: string;
        sourceName: string;
        latestPeriodStart: Date | null;
        latestPeriodEnd: Date | null;
        countriesInLatestPeriod: bigint;
      }[]
    >`
      SELECT si.code, si.name, si.unit, si.indicator, si."caseClassification", si.available,
             si."lastSuccessfulSync", d.name AS "diseaseName", d.slug AS "diseaseSlug", ds.name AS "sourceName",
             lp.start AS "latestPeriodStart", lp.latest AS "latestPeriodEnd",
             (SELECT count(DISTINCT o."geoCode") FROM "DiseaseObservation" o
               WHERE o."sourceIndicatorId" = si.id AND o."isLatest" AND o.value IS NOT NULL
                 AND o."geoScope" = 'COUNTRY' AND o."periodEnd" = lp.latest) AS "countriesInLatestPeriod"
      FROM "SourceIndicator" si
      JOIN "Disease" d ON d.id = si."diseaseId"
      JOIN "DataSource" ds ON ds.id = si."sourceId"
      LEFT JOIN LATERAL (
        SELECT o."periodStart" AS start, o."periodEnd" AS latest FROM "DiseaseObservation" o
        WHERE o."sourceIndicatorId" = si.id AND o."isLatest" AND o.value IS NOT NULL AND o."geoScope" = 'COUNTRY'
        ORDER BY o."periodEnd" DESC, o."periodStart" DESC
        LIMIT 1
      ) lp ON true
      ORDER BY d.name, si.indicator, si."caseClassification", si.code`,
    db.diseaseObservation.findMany({
      where: { isLatest: true, value: { not: null }, countryId: { not: null } },
      distinct: ["countryId"],
      select: { countryId: true },
    }),
    db.dataSource.findMany({
      orderBy: { name: "asc" },
      include: { syncJobs: { orderBy: { startedAt: "desc" }, take: 1 } },
    }),
  ]);

  const indicators = coverage.map((row) => ({
    ...row,
    countriesInLatestPeriod: Number(row.countriesInLatestPeriod),
  }));

  return {
    diseaseCount,
    recentReports: recentReports.map((r) => ({
      title: r.title,
      url: r.sourceUrl,
      displayId: r.displayId,
      publishedAt: r.publishedAt,
      sourceName: r.source.name,
    })),
    indicatorsWithData: indicators.filter((i) => i.latestPeriodEnd !== null).length,
    countriesWithData: countries.length,
    indicators,
    sources: sources.map(({ syncJobs, ...s }) => ({
      slug: s.slug,
      name: s.name,
      organization: s.organization,
      homepageUrl: s.homepageUrl,
      license: s.license,
      licenseUrl: s.licenseUrl,
      attributionRequirements: s.attributionRequirements,
      enabled: s.enabled,
      lastSuccessfulSync: s.lastSuccessfulSync,
      lastJob: syncJobs[0]
        ? { status: syncJobs[0].status, startedAt: syncJobs[0].startedAt, completedAt: syncJobs[0].completedAt }
        : null,
    })),
  };
}
