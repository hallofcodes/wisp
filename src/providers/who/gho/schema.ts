import { z } from "zod";

/** GET /api/Indicator */
export const ghoIndicatorListSchema = z.object({
  value: z.array(
    z.looseObject({
      IndicatorCode: z.string().min(1),
      IndicatorName: z.string(),
    }),
  ),
  "@odata.nextLink": z.string().optional(),
});

/** One row of GET /api/{IndicatorCode}. Unknown fields are retained. */
export const ghoObservationSchema = z.looseObject({
  Id: z.number().int(),
  IndicatorCode: z.string().min(1),
  SpatialDimType: z.string().nullable(),
  SpatialDim: z.string().nullable(),
  ParentLocationCode: z.string().nullable().optional(),
  TimeDimType: z.string().nullable(),
  TimeDim: z.number().int().nullable(),
  Dim1Type: z.string().nullable().optional(),
  Dim1: z.string().nullable().optional(),
  Dim2Type: z.string().nullable().optional(),
  Dim2: z.string().nullable().optional(),
  Dim3Type: z.string().nullable().optional(),
  Dim3: z.string().nullable().optional(),
  DataSourceDimType: z.string().nullable().optional(),
  DataSourceDim: z.string().nullable().optional(),
  Value: z.string().nullable(),
  NumericValue: z.number().nullable(),
  Low: z.number().nullable().optional(),
  High: z.number().nullable().optional(),
  Comments: z.string().nullable().optional(),
  Date: z.string().nullable().optional(),
  TimeDimensionBegin: z.string().nullable().optional(),
  TimeDimensionEnd: z.string().nullable().optional(),
});

export type GhoObservation = z.infer<typeof ghoObservationSchema>;

/** One page of GET /api/{IndicatorCode}; rows are validated individually. */
export const ghoObservationPageSchema = z.object({
  value: z.array(z.unknown()),
  "@odata.nextLink": z.string().optional(),
});
