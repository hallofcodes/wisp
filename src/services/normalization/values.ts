import { createHash } from "node:crypto";
import type { NormalizedRecord } from "@/providers/base/types";

/**
 * Converts a finite number into a canonical decimal string ("1666", "0.5").
 * Returns null for null/undefined/NaN/Infinity: missing stays missing.
 */
export function toDecimalString(
  value: number | null | undefined,
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null;
  // toString() is exact for the doubles we receive and avoids exponent
  // notation below 1e21; normalise "-0" which would otherwise hash apart.
  if (Object.is(value, -0)) return "0";
  const text = value.toString();
  if (/e/i.test(text)) {
    return value.toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: 20,
    });
  }
  return text;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

/**
 * Extracts the calendar date written in an ISO timestamp *as published*,
 * ignoring its offset. "2022-01-01T00:00:00+01:00" is the 1 January 2022 even
 * though it is 31 December 2021 in UTC.
 */
export function calendarDateOf(timestamp: string): string | null {
  const candidate = timestamp.slice(0, 10);
  return isIsoDate(candidate) ? candidate : null;
}

/** Converts a YYYY-MM-DD calendar date to a UTC-midnight Date for @db.Date columns. */
export function dateOnlyToUtc(value: string): Date {
  if (!isIsoDate(value)) throw new RangeError(`Not a calendar date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Hash of the fields that define what a record says. A change in any of them
 * produces a new revision. Source timestamps and free-text metadata are
 * deliberately excluded so that republishing an unchanged value is a no-op.
 */
export function contentHash(record: NormalizedRecord): string {
  const payload = [
    record.indicator,
    record.caseClassification,
    record.aggregation,
    record.unit,
    record.value,
    record.lowerBound,
    record.upperBound,
    record.geoScope,
    record.geoCode,
    record.periodStart,
    record.periodEnd,
  ];
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
