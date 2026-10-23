import { describe, expect, it } from "vitest";
import { classBreaks, recencyTier, valueClass } from "@/lib/map/data";

describe("map classes", () => {
  it("keeps missing, zero and positive values in distinct classes", () => {
    const breaks = classBreaks([1, 2, 3, 10, 50, 100, 1000]);
    expect(valueClass(null, breaks)).toBeNull();
    expect(valueClass(0, breaks)).toBe(0);
    expect(valueClass(-5, breaks)).toBe(0);
    expect(valueClass(1, breaks)).toBe(1);
    expect(valueClass(1000, breaks)).toBe(breaks.length);
  });

  it("produces ascending breaks ending at the maximum", () => {
    const breaks = classBreaks([5, 5, 5, 5, 12345]);
    expect([...breaks].sort((a, b) => a - b)).toEqual(breaks);
    expect(new Set(breaks).size).toBe(breaks.length);
    expect(breaks.at(-1)).toBe(12345);
    expect(classBreaks([])).toEqual([]);
  });
});

describe("recencyTier", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  it("buckets by days since publication", () => {
    expect(recencyTier(daysAgo(2), now)).toBe(1);
    expect(recencyTier(daysAgo(30), now)).toBe(2);
    expect(recencyTier(daysAgo(200), now)).toBe(3);
    expect(recencyTier(daysAgo(1800), now)).toBe(4);
  });
});
