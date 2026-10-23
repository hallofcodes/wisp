import { describe, expect, it } from "vitest";
import type { NormalizedRecord } from "@/providers/base/types";
import { calendarDateOf, contentHash, dateOnlyToUtc, isIsoDate, toDecimalString } from "@/services/normalization/values";

const base: NormalizedRecord = {
  sourceRecordId: "k",
  sourceIndicatorCode: "X",
  diseaseSlug: "measles",
  indicator: "CASES",
  caseClassification: "REPORTED_UNSPECIFIED",
  aggregation: "PERIOD_TOTAL",
  unit: "cases",
  value: "10",
  lowerBound: null,
  upperBound: null,
  rawValue: "10",
  geoScope: "COUNTRY",
  geoCode: "NGA",
  countryIso3: "NGA",
  periodStart: "2024-01-01",
  periodEnd: "2024-12-31",
  reportedAt: new Date("2025-01-01T00:00:00Z"),
  metadata: {},
};

describe("toDecimalString (missing data)", () => {
  it("keeps missing values missing instead of zero", () => {
    expect(toDecimalString(null)).toBeNull();
    expect(toDecimalString(undefined)).toBeNull();
    expect(toDecimalString(Number.NaN)).toBeNull();
    expect(toDecimalString(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("preserves real zeros", () => {
    expect(toDecimalString(0)).toBe("0");
    expect(toDecimalString(-0)).toBe("0");
  });

  it("produces canonical decimal strings", () => {
    expect(toDecimalString(1666.0)).toBe("1666");
    expect(toDecimalString(12.5)).toBe("12.5");
    expect(toDecimalString(2007280)).toBe("2007280");
    expect(toDecimalString(1e21)).toBe("1000000000000000000000");
    expect(toDecimalString(1e-7)).toBe("0.0000001");
  });
});

describe("date handling", () => {
  it("reads the published calendar date, ignoring the UTC offset", () => {
    // In UTC this instant is 2021-12-31T23:00Z; the period still starts on 1 January 2022.
    expect(calendarDateOf("2022-01-01T00:00:00+01:00")).toBe("2022-01-01");
    expect(calendarDateOf("2022-12-31T00:00:00+01:00")).toBe("2022-12-31");
  });

  it("rejects invalid calendar dates", () => {
    expect(isIsoDate("2023-02-29")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2024-13-01")).toBe(false);
    expect(calendarDateOf("not a date")).toBeNull();
    expect(() => dateOnlyToUtc("2024-02-30")).toThrow(RangeError);
  });

  it("maps calendar dates to UTC midnight for date columns", () => {
    expect(dateOnlyToUtc("2024-01-01").toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("contentHash", () => {
  it("ignores source timestamps and metadata", () => {
    const republished = { ...base, reportedAt: new Date("2026-01-01T00:00:00Z"), metadata: { ghoId: 2 } };
    expect(contentHash(republished)).toBe(contentHash(base));
  });

  it("changes when the value or its definition changes", () => {
    expect(contentHash({ ...base, value: "11" })).not.toBe(contentHash(base));
    expect(contentHash({ ...base, value: null })).not.toBe(contentHash({ ...base, value: "0" }));
    expect(contentHash({ ...base, caseClassification: "CONFIRMED" })).not.toBe(contentHash(base));
    expect(contentHash({ ...base, upperBound: "20" })).not.toBe(contentHash(base));
  });
});
