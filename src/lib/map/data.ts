import type { PrismaClient } from "@/generated/prisma/client";
import type { CaseClassification, Indicator } from "@/generated/prisma/enums";

/** Recency tiers for countries named in official reports. */
export const RECENCY_TIERS = [
  { tier: 1, maxDays: 14, label: "Last 14 days" },
  { tier: 2, maxDays: 45, label: "15–45 days ago" },
  { tier: 3, maxDays: 365, label: "46 days to 1 year ago" },
  { tier: 4, maxDays: Number.POSITIVE_INFINITY, label: "More than 1 year ago (no pulse)" },
] as const;

export type RecencyTier = (typeof RECENCY_TIERS)[number]["tier"];

export function recencyTier(publishedAt: Date, now: Date): RecencyTier {
  const days = (now.getTime() - publishedAt.getTime()) / 86_400_000;
  return RECENCY_TIERS.find((t) => days <= t.maxDays)!.tier;
}

export interface ReportSummary {
  title: string;
  url: string;
  displayId: string | null;
  publishedAt: string;
  diseaseName: string | null;
  diseaseSlug: string | null;
  sourceName: string;
  /** Countries or scope wording, for reports listed outside the map. */
  place: string | null;
}

export interface CountryReportActivity {
  iso3: string;
  name: string;
  tier: RecencyTier;
  reportCount: number;
  diseases: string[];
  latest: ReportSummary;
}

export interface ReportActivity {
  windowDays: number;
  since: string;
  countries: CountryReportActivity[];
  /** Reports in the window that name no country (global, regional, multi-location). */
  otherReports: ReportSummary[];
  sources: string[];
}

export async function getReportActivity(
  db: PrismaClient,
  windowDays: number,
  diseaseSlug?: string,
  now = new Date(),
): Promise<ReportActivity> {
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  const reports = await db.outbreakReport.findMany({
    where: {
      publishedAt: { gte: since },
      ...(diseaseSlug ? { outbreak: { disease: { slug: diseaseSlug } } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    select: {
      title: true,
      sourceUrl: true,
      displayId: true,
      publishedAt: true,
      scopeLabel: true,
      countryIso3s: true,
      source: { select: { name: true } },
      outbreak: {
        select: {
          disease: { select: { slug: true, name: true } },
        },
      },
    },
  });

  const countryNames = new Map(
    (await db.country.findMany({ select: { iso3: true, name: true } })).map((c) => [c.iso3, c.name]),
  );
  const byCountry = new Map<string, CountryReportActivity>();
  const otherReports: ReportSummary[] = [];

  for (const r of reports) {
    // Only the countries named in this report are attributed to it; an
    // outbreak's other countries keep the dates of their own reports.
    const countries = r.countryIso3s.flatMap((iso3) => {
      const name = countryNames.get(iso3);
      return name ? [{ iso3, name }] : [];
    });
    const summary: ReportSummary = {
      title: r.title,
      url: r.sourceUrl,
      displayId: r.displayId,
      publishedAt: r.publishedAt.toISOString(),
      diseaseName: r.outbreak?.disease.name ?? null,
      diseaseSlug: r.outbreak?.disease.slug ?? null,
      sourceName: r.source.name,
      place: countries.length ? countries.map((c) => c.name).join(", ") : r.scopeLabel,
    };

    if (countries.length === 0) {
      otherReports.push(summary);
      continue;
    }
    for (const country of countries) {
      const entry = byCountry.get(country.iso3);
      if (!entry) {
        byCountry.set(country.iso3, {
          iso3: country.iso3,
          name: country.name,
          tier: recencyTier(r.publishedAt, now),
          reportCount: 1,
          diseases: summary.diseaseName ? [summary.diseaseName] : [],
          latest: summary,
        });
      } else {
        entry.reportCount++;
        if (summary.diseaseName && !entry.diseases.includes(summary.diseaseName)) entry.diseases.push(summary.diseaseName);
      }
    }
  }

  return {
    windowDays,
    since: since.toISOString(),
    countries: [...byCountry.values()].sort((a, b) => b.latest.publishedAt.localeCompare(a.latest.publishedAt)),
    otherReports,
    sources: [...new Set(reports.map((r) => r.source.name))],
  };
}

export interface IndicatorOption {
  id: string;
  label: string;
  diseaseName: string;
  sourceName: string;
  unit: string;
  indicator: Indicator;
  caseClassification: CaseClassification;
  definition: string | null;
}

export async function getIndicatorOptions(db: PrismaClient): Promise<IndicatorOption[]> {
  const rows = await db.sourceIndicator.findMany({
    where: { observations: { some: { isLatest: true, geoScope: "COUNTRY", value: { not: null } } } },
    select: {
      id: true,
      name: true,
      unit: true,
      indicator: true,
      caseClassification: true,
      definition: true,
      disease: { select: { name: true } },
      source: { select: { name: true } },
    },
    orderBy: [{ disease: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    label: `${r.disease.name}: ${r.name}`,
    diseaseName: r.disease.name,
    sourceName: r.source.name,
    unit: r.unit,
    indicator: r.indicator,
    caseClassification: r.caseClassification,
    definition: r.definition,
  }));
}

export interface IndicatorValue {
  iso3: string;
  name: string;
  /** Null when the source published the record without a value. */
  value: number | null;
  rawValue: string | null;
  reportedAt: string | null;
}

export interface IndicatorMap {
  indicator: IndicatorOption;
  periods: { start: string; end: string }[];
  period: { start: string; end: string };
  values: IndicatorValue[];
  /** Upper bounds of the positive classes (ascending). */
  breaks: number[];
}

/** Recent reporting periods with at least one country-level value, newest first. */
async function recentPeriods(db: PrismaClient, sourceIndicatorId: string, limit: number) {
  return db.$queryRaw<{ start: Date; end: Date }[]>`
    SELECT "periodStart" AS start, "periodEnd" AS end
    FROM "DiseaseObservation"
    WHERE "sourceIndicatorId" = ${sourceIndicatorId} AND "isLatest" AND "geoScope" = 'COUNTRY' AND value IS NOT NULL
    GROUP BY "periodStart", "periodEnd"
    ORDER BY "periodEnd" DESC
    LIMIT ${limit}`;
}

export async function getIndicatorMap(
  db: PrismaClient,
  options: IndicatorOption[],
  indicatorId: string | undefined,
  periodEnd: string | undefined,
): Promise<IndicatorMap | null> {
  const indicator = options.find((o) => o.id === indicatorId) ?? options[0];
  if (!indicator) return null;

  const periods = (await recentPeriods(db, indicator.id, 52)).map((p) => ({
    start: p.start.toISOString().slice(0, 10),
    end: p.end.toISOString().slice(0, 10),
  }));
  if (periods.length === 0) return null;
  const period = periods.find((p) => p.end === periodEnd) ?? periods[0];

  const rows = await db.diseaseObservation.findMany({
    where: {
      sourceIndicatorId: indicator.id,
      isLatest: true,
      geoScope: "COUNTRY",
      countryId: { not: null },
      periodStart: new Date(`${period.start}T00:00:00Z`),
      periodEnd: new Date(`${period.end}T00:00:00Z`),
    },
    select: {
      value: true,
      rawValue: true,
      reportedAt: true,
      country: { select: { iso3: true, name: true } },
    },
  });

  const values: IndicatorValue[] = rows.map((r) => ({
    iso3: r.country!.iso3,
    name: r.country!.name,
    value: r.value === null ? null : Number(r.value),
    rawValue: r.rawValue,
    reportedAt: r.reportedAt?.toISOString() ?? null,
  }));

  return { indicator, periods, period, values, breaks: classBreaks(values.flatMap((v) => (v.value && v.value > 0 ? [v.value] : []))) };
}

/**
 * Upper bounds for up to five quantile classes of positive values, rounded to
 * two significant figures. Zero and negative values are classed separately.
 */
export function classBreaks(positive: number[], classes = 5): number[] {
  if (positive.length === 0) return [];
  const sorted = [...positive].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i <= classes; i++) {
    const q = sorted[Math.min(sorted.length - 1, Math.ceil((i / classes) * sorted.length) - 1)];
    const rounded = i === classes ? sorted[sorted.length - 1] : Number(q.toPrecision(2));
    if (breaks.length === 0 || rounded > breaks[breaks.length - 1]) breaks.push(rounded);
  }
  return breaks;
}

/** Class index for a value: null = no value, 0 = zero or negative, 1..n = positive classes. */
export function valueClass(value: number | null, breaks: number[]): number | null {
  if (value === null) return null;
  if (value <= 0) return 0;
  const index = breaks.findIndex((b) => value <= b);
  return (index === -1 ? breaks.length - 1 : index) + 1;
}
