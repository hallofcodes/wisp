import type { NormalizedOutbreakReport } from "@/providers/base/types";

/** Reports more than this far apart start a new outbreak record. */
export const OUTBREAK_REPORT_GAP_DAYS = 90;

export interface OutbreakGroup {
  slug: string;
  diseaseSlug: string;
  /** Title of the most recent report, in the source's wording. */
  title: string;
  countryIso3s: string[];
  scopeLabel: string | null;
  firstReportedAt: Date;
  lastReportedAt: Date;
  /** True when every report in the group describes the event as suspected. */
  suspected: boolean;
  reportExternalIds: string[];
}

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizedScope(report: NormalizedOutbreakReport): string {
  return report.scope === "GLOBAL"
    ? "global"
    : slugify(report.scopeLabel ?? report.scope);
}

export function groupReports(
  reports: NormalizedOutbreakReport[],
): OutbreakGroup[] {
  const gapMs = OUTBREAK_REPORT_GAP_DAYS * 86_400_000;
  const sorted = reports
    .filter(
      (r): r is NormalizedOutbreakReport & { diseaseSlug: string } =>
        r.diseaseSlug !== null,
    )
    .sort(
      (a, b) =>
        a.publishedAt.getTime() - b.publishedAt.getTime() ||
        a.externalId.localeCompare(b.externalId),
    );

  const groups: (OutbreakGroup & {
    scopeKey: string | null;
    variant: string | null;
  })[] = [];

  for (const report of sorted) {
    const scopeKey =
      report.countryIso3s.length === 0 ? normalizedScope(report) : null;
    let target: (typeof groups)[number] | undefined;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g.diseaseSlug !== report.diseaseSlug) continue;
      if (report.publishedAt.getTime() - g.lastReportedAt.getTime() > gapMs)
        continue;
      if (g.variant && report.variant && g.variant !== report.variant) continue;
      const overlaps =
        scopeKey === null
          ? report.countryIso3s.some((c) => g.countryIso3s.includes(c))
          : g.scopeKey === scopeKey;
      if (overlaps) {
        target = g;
        break;
      }
    }

    if (!target) {
      const place =
        report.countryIso3s.length > 0
          ? report.countryIso3s.join("-").toLowerCase()
          : scopeKey || "unspecified";
      target = {
        slug: [
          report.diseaseSlug,
          report.variant ? slugify(report.variant) : null,
          place,
          report.publishedAt.toISOString().slice(0, 10),
        ]
          .filter(Boolean)
          .join("-"),
        diseaseSlug: report.diseaseSlug,
        title: report.title,
        countryIso3s: [],
        scopeLabel: report.scopeLabel,
        scopeKey,
        variant: report.variant,
        firstReportedAt: report.publishedAt,
        lastReportedAt: report.publishedAt,
        suspected: true,
        reportExternalIds: [],
      };
      groups.push(target);
    }

    target.title = report.title;
    target.variant ??= report.variant;
    target.lastReportedAt = report.publishedAt;
    target.suspected &&= report.suspected;
    target.countryIso3s = [
      ...new Set([...target.countryIso3s, ...report.countryIso3s]),
    ].sort();
    target.reportExternalIds.push(report.externalId);
  }

  // Disambiguate the rare case of two groups starting the same day in the same place.
  const seen = new Map<string, number>();
  return groups.map((group) => {
    const g: OutbreakGroup = {
      slug: group.slug,
      diseaseSlug: group.diseaseSlug,
      title: group.title,
      countryIso3s: group.countryIso3s,
      scopeLabel: group.scopeLabel,
      firstReportedAt: group.firstReportedAt,
      lastReportedAt: group.lastReportedAt,
      suspected: group.suspected,
      reportExternalIds: group.reportExternalIds,
    };
    const n = (seen.get(g.slug) ?? 0) + 1;
    seen.set(g.slug, n);
    return n === 1 ? g : { ...g, slug: `${g.slug}-${n}` };
  });
}
