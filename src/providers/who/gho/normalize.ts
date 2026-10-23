import type { GeoScope } from "@/generated/prisma/enums";
import type {
  IndicatorDefinition,
  NormalizedRecord,
  SyncWarning,
} from "@/providers/base/types";
import {
  calendarDateOf,
  toDecimalString,
} from "@/services/normalization/values";
import type { GhoObservation } from "./schema";

const SPATIAL_SCOPE: Record<string, GeoScope> = {
  COUNTRY: "COUNTRY",
  REGION: "REGION",
  WHOREGION: "REGION",
  WORLDBANKINCOMEGROUP: "INCOME_GROUP",
  GLOBAL: "GLOBAL",
};

export interface GhoNormalizeResult {
  records: NormalizedRecord[];
  skipped: number;
  warnings: SyncWarning[];
}

function hasBreakdownDimension(row: GhoObservation): boolean {
  return Boolean(row.Dim1 || row.Dim2 || row.Dim3);
}

/** Resolves the inclusive reporting period of a row as calendar dates. */
export function ghoPeriod(
  row: GhoObservation,
): { start: string; end: string } | null {
  if (row.TimeDimType === "YEAR" && row.TimeDim !== null) {
    return { start: `${row.TimeDim}-01-01`, end: `${row.TimeDim}-12-31` };
  }
  const start = row.TimeDimensionBegin
    ? calendarDateOf(row.TimeDimensionBegin)
    : null;
  const end = row.TimeDimensionEnd
    ? calendarDateOf(row.TimeDimensionEnd)
    : null;
  return start && end && start <= end ? { start, end } : null;
}

/**
 * Natural key for a GHO row: everything that identifies *what* is measured
 * and *where/when*, but not the value. GHO's numeric `Id` is kept in metadata
 * only, because it is not guaranteed to survive republication.
 */
export function ghoRecordKey(row: GhoObservation): string {
  return [
    row.IndicatorCode,
    row.SpatialDimType ?? "",
    row.SpatialDim ?? "",
    row.TimeDimType ?? "",
    row.TimeDim ?? "",
    row.Dim1 ?? "",
    row.Dim2 ?? "",
    row.Dim3 ?? "",
    row.DataSourceDim ?? "",
  ].join("|");
}

export function normalizeGhoRows(
  definition: IndicatorDefinition,
  rows: GhoObservation[],
): GhoNormalizeResult {
  const records: NormalizedRecord[] = [];
  const warnings: SyncWarning[] = [];
  let withDimensions = 0;
  let unusable = 0;

  for (const row of rows) {
    // Curated indicators are totals. Rows broken down by sex, age, etc. would
    // double count if stored alongside totals, so they are excluded.
    if (hasBreakdownDimension(row)) {
      withDimensions++;
      continue;
    }

    const period = ghoPeriod(row);
    const geoScope = row.SpatialDimType
      ? (SPATIAL_SCOPE[row.SpatialDimType] ?? "OTHER")
      : null;
    const geoCode = row.SpatialDim ?? (geoScope === "GLOBAL" ? "GLOBAL" : null);
    if (!period || !geoScope || !geoCode) {
      unusable++;
      continue;
    }

    // Missing stays missing: a null NumericValue is stored as null, never 0.
    const value = toDecimalString(row.NumericValue);
    const reportedAt = row.Date ? new Date(row.Date) : null;

    records.push({
      sourceRecordId: ghoRecordKey(row),
      sourceIndicatorCode: definition.code,
      diseaseSlug: definition.diseaseSlug,
      indicator: definition.indicator,
      caseClassification: definition.caseClassification,
      aggregation: definition.aggregation,
      unit: definition.unit,
      value,
      lowerBound: toDecimalString(row.Low),
      upperBound: toDecimalString(row.High),
      rawValue: row.Value,
      geoScope,
      geoCode,
      countryIso3: geoScope === "COUNTRY" ? geoCode.toUpperCase() : null,
      periodStart: period.start,
      periodEnd: period.end,
      reportedAt:
        reportedAt && !Number.isNaN(reportedAt.getTime()) ? reportedAt : null,
      metadata: {
        ghoId: row.Id,
        parentLocationCode: row.ParentLocationCode ?? null,
        comments: row.Comments ?? null,
        timeDimType: row.TimeDimType,
        dataSourceDim: row.DataSourceDim ?? null,
      },
    });
  }

  if (withDimensions > 0) {
    warnings.push({
      code: "UNSUPPORTED_DIMENSIONS",
      message: `${definition.code}: skipped ${withDimensions} row(s) broken down by additional dimensions.`,
      context: { indicator: definition.code, rows: withDimensions },
    });
  }
  if (unusable > 0) {
    warnings.push({
      code: "INVALID_ROWS",
      message: `${definition.code}: skipped ${unusable} row(s) without a usable period or geography.`,
      context: { indicator: definition.code, rows: unusable },
    });
  }

  return { records, skipped: withDimensions + unusable, warnings };
}
