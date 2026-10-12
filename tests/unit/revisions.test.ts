import { describe, expect, it } from "vitest";
import type { NormalizedRecord } from "@/providers/base/types";
import { planRevisions, type StoredRevision } from "@/services/ingestion/revisions";
import { contentHash } from "@/services/normalization/values";

function record(key: string, value: string | null): NormalizedRecord {
  return {
    sourceRecordId: key,
    sourceIndicatorCode: "WHS3_62",
    diseaseSlug: "measles",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    value,
    lowerBound: null,
    upperBound: null,
    rawValue: value,
    geoScope: "COUNTRY",
    geoCode: "NGA",
    countryIso3: "NGA",
    periodStart: "2024-01-01",
    periodEnd: "2024-12-31",
    reportedAt: null,
    metadata: {},
  };
}

function stored(r: NormalizedRecord, revision = 1, id = `id-${r.sourceRecordId}`): [string, StoredRevision] {
  return [r.sourceRecordId, { id, revision, contentHash: contentHash(r) }];
}

describe("planRevisions", () => {
  it("inserts unseen records as revision 1", () => {
    const plan = planRevisions([record("a", "1"), record("b", null)], new Map());
    expect(plan.inserts.map((p) => [p.record.sourceRecordId, p.revision])).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
    expect(plan.revisions).toHaveLength(0);
  });

  it("is idempotent: identical content is a no-op", () => {
    const a = record("a", "1");
    const plan = planRevisions([a], new Map([stored(a)]));
    expect(plan.unchanged).toBe(1);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.revisions).toHaveLength(0);
  });

  it("creates a new revision that supersedes the stored one when values change", () => {
    const old = record("a", "1");
    const plan = planRevisions([record("a", "2")], new Map([stored(old, 3, "row-3")]));
    expect(plan.revisions).toHaveLength(1);
    expect(plan.revisions[0]).toMatchObject({ revision: 4, supersedesId: "row-3" });
  });

  it("treats a value becoming unavailable as a revision, not a deletion or zero", () => {
    const plan = planRevisions([record("a", null)], new Map([stored(record("a", "5"))]));
    expect(plan.revisions[0].record.value).toBeNull();
  });

  it("collapses identical duplicates within a batch", () => {
    const plan = planRevisions([record("a", "1"), record("a", "1")], new Map());
    expect(plan.inserts).toHaveLength(1);
    expect(plan.conflicts).toBe(0);
  });

  it("skips and reports conflicting duplicates instead of guessing", () => {
    const plan = planRevisions([record("a", "1"), record("a", "2"), record("a", "1"), record("b", "3")], new Map());
    expect(plan.inserts.map((p) => p.record.sourceRecordId)).toEqual(["b"]);
    expect(plan.conflicts).toBe(3);
    expect(plan.warnings[0].code).toBe("CONFLICTING_DUPLICATES");
  });

  it("leaves stored records that are absent from the batch untouched", () => {
    const plan = planRevisions([], new Map([stored(record("a", "1"))]));
    expect(plan).toMatchObject({ inserts: [], revisions: [], unchanged: 0 });
  });
});
