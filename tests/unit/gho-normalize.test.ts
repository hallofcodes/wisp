import { describe, expect, it } from "vitest";
import { ghoRecordKey, normalizeGhoRows } from "@/providers/who/gho/normalize";
import { definitionFor, ghoRows } from "../helpers/gho-fixtures";

describe("normalizeGhoRows", () => {
  const tb = normalizeGhoRows(definitionFor("TB_e_inc_num"), ghoRows("TB_e_inc_num"));
  const yf = normalizeGhoRows(definitionFor("WHS3_50"), ghoRows("WHS3_50"));

  it("normalizes every usable row", () => {
    expect(tb.records).toHaveLength(7);
    expect(yf.records).toHaveLength(10);
    expect(tb.skipped).toBe(0);
  });

  it("keeps estimates, bounds and the raw published value", () => {
    const ind2024 = tb.records.find((r) => r.geoCode === "IND" && r.periodStart === "2024-01-01");
    expect(ind2024).toMatchObject({
      caseClassification: "ESTIMATED",
      indicator: "CASES",
      aggregation: "PERIOD_TOTAL",
      unit: "cases",
      geoScope: "COUNTRY",
      countryIso3: "IND",
      periodEnd: "2024-12-31",
    });
    expect(ind2024?.value).not.toBeNull();
    expect(ind2024?.lowerBound).not.toBeNull();
    expect(ind2024?.upperBound).not.toBeNull();
    expect(ind2024?.rawValue).toContain("[");
  });

  it("stores missing values as null and real zeros as zero", () => {
    const missing = yf.records.filter((r) => r.geoCode === "EST" && r.value === null);
    expect(missing).toHaveLength(2);
    expect(missing.every((r) => r.rawValue === null)).toBe(true);
    const zero = yf.records.find((r) => r.geoCode === "EST" && r.periodStart === "2018-01-01");
    expect(zero?.value).toBe("0");
  });

  it("separates country, regional, income-group and global scopes", () => {
    const scopes = Object.fromEntries(tb.records.map((r) => [r.geoScope, r]));
    expect(Object.keys(scopes).sort()).toEqual(["COUNTRY", "GLOBAL", "INCOME_GROUP", "REGION"]);
    expect(scopes.REGION.countryIso3).toBeNull();
    expect(scopes.GLOBAL.countryIso3).toBeNull();
  });

  it("uses the source timestamp as reportedAt, not as a period date", () => {
    const record = yf.records.find((r) => r.geoCode === "NGA" && r.periodStart === "2024-01-01");
    expect(record?.reportedAt).toBeInstanceOf(Date);
    expect(record?.periodEnd).toBe("2024-12-31");
  });

  it("skips rows broken down by extra dimensions to avoid double counting", () => {
    const rows = ghoRows("WHS3_50");
    const bySex = { ...rows[1], Dim1Type: "SEX", Dim1: "SEX_FMLE" };
    const result = normalizeGhoRows(definitionFor("WHS3_50"), [rows[1], bySex]);
    expect(result.records).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.warnings.map((w) => w.code)).toContain("UNSUPPORTED_DIMENSIONS");
  });

  it("builds a dedup key that ignores GHO's row id and value", () => {
    const [row] = ghoRows("WHS3_50");
    const republished = { ...row, Id: row.Id + 1, NumericValue: 99, Value: "99" };
    expect(ghoRecordKey(republished)).toBe(ghoRecordKey(row));
    expect(ghoRecordKey({ ...row, TimeDim: (row.TimeDim ?? 0) + 1 })).not.toBe(ghoRecordKey(row));
  });

  it("falls back to TimeDimensionBegin/End for non-annual periods", () => {
    const [row] = ghoRows("WHS3_50");
    const monthly = {
      ...row,
      TimeDimType: "MONTH",
      TimeDimensionBegin: "2024-03-01T00:00:00+01:00",
      TimeDimensionEnd: "2024-03-31T00:00:00+01:00",
    };
    const [record] = normalizeGhoRows(definitionFor("WHS3_50"), [monthly]).records;
    expect(record).toMatchObject({ periodStart: "2024-03-01", periodEnd: "2024-03-31" });
  });
});
