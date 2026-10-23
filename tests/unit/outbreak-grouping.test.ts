import { describe, expect, it } from "vitest";
import type { NormalizedOutbreakReport } from "@/providers/base/types";
import { groupReports } from "@/services/aggregation/outbreak-grouping";

let n = 0;
function report(date: string, disease: string | null, countries: string[], extra: Partial<NormalizedOutbreakReport> = {}): NormalizedOutbreakReport {
  n++;
  return {
    externalId: `r${n}`,
    displayId: null,
    title: `${disease} ${countries.join(" & ")} ${date}`,
    sourceUrl: `https://www.who.int/x/${n}`,
    publishedAt: new Date(`${date}T00:00:00Z`),
    updatedAt: null,
    contentSummary: null,
    diseaseSlug: disease,
    countryIso3s: countries,
    scope: countries.length > 1 ? "MULTI_COUNTRY" : countries.length ? "COUNTRY" : "GLOBAL",
    scopeLabel: countries.length ? null : "Global situation",
    suspected: false,
    variant: null,
    ...extra,
  };
}

describe("groupReports", () => {
  it("chains reports that share a country within the gap and unions countries", () => {
    const groups = groupReports([
      report("2026-05-16", "ebola-virus-disease", ["COD", "UGA"]),
      report("2026-06-08", "ebola-virus-disease", ["COD", "UGA"]),
      report("2026-08-01", "ebola-virus-disease", ["COD"]),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ countryIso3s: ["COD", "UGA"], slug: "ebola-virus-disease-cod-uga-2026-05-16" });
    expect(groups[0].lastReportedAt.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(groups[0].reportExternalIds).toHaveLength(3);
  });

  it("starts a new outbreak after a long gap", () => {
    const groups = groupReports([report("2021-10-01", "plague", ["MDG"]), report("2017-11-27", "plague", ["MDG"])]);
    expect(groups).toHaveLength(2);
  });

  it("never merges different strains of the same disease", () => {
    const groups = groupReports([
      report("2025-12-01", "ebola-virus-disease", ["COD"]),
      report("2026-01-10", "ebola-virus-disease", ["COD"], { variant: "bundibugyo" }),
      report("2026-01-20", "ebola-virus-disease", ["COD"], { variant: "sudan" }),
    ]);
    // The unnamed-strain report may join the first named strain, never both.
    expect(groups).toHaveLength(2);
  });

  it("does not group different diseases or non-overlapping countries", () => {
    const groups = groupReports([
      report("2026-01-01", "cholera", ["NGA"]),
      report("2026-01-05", "cholera", ["NER"]),
      report("2026-01-06", "measles", ["NGA"]),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("groups country-less reports by scope wording and ignores unmatched diseases", () => {
    const groups = groupReports([
      report("2025-12-05", "mpox", []),
      report("2026-02-14", "mpox", []),
      report("2026-02-14", null, ["FRA"]),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].slug).toBe("mpox-global-2025-12-05");
  });

  it("marks a group suspected only when every report is suspected", () => {
    const [a] = groupReports([report("2017-10-15", "plague", ["SYC"], { suspected: true })]);
    expect(a.suspected).toBe(true);
    const [b] = groupReports([
      report("2017-10-15", "plague", ["SYC"], { suspected: true }),
      report("2017-10-20", "plague", ["SYC"]),
    ]);
    expect(b.suspected).toBe(false);
  });

  it("is deterministic regardless of input order", () => {
    const reports = [report("2026-01-01", "cholera", ["NGA"]), report("2026-02-01", "cholera", ["NGA"])];
    expect(groupReports([...reports].reverse())).toEqual(groupReports(reports));
  });
});
