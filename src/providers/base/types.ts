import type {
  Aggregation,
  CaseClassification,
  GeoScope,
  Indicator,
} from "@/generated/prisma/enums";

/** Static description of a data source, mirrored into the DataSource table. */
export interface SourceDescriptor {
  /** Stable provider id, e.g. "who-gho". Used as DataSource.slug. */
  id: string;
  name: string;
  organization: string;
  homepageUrl: string;
  documentationUrl: string | null;
  license: string;
  licenseUrl: string | null;
  attributionRequirements: string;
}

/** Curated semantics for one upstream indicator. */
export interface IndicatorDefinition {
  /** Upstream indicator code. */
  code: string;
  diseaseSlug: string;
  indicator: Indicator;
  caseClassification: CaseClassification;
  aggregation: Aggregation;
  unit: string;
  definition: string;
}

/** An indicator definition enriched with what upstream discovery reported. */
export interface DiscoveredIndicator extends IndicatorDefinition {
  /** Upstream display name; null when the indicator was not found upstream. */
  upstreamName: string | null;
  available: boolean;
}

/**
 * A single source value normalized into WIDSP's vocabulary. Decimal values
 * are strings to avoid floating point drift; null means "not reported".
 */
export interface NormalizedRecord {
  /** Stable natural key within the source. Used for deduplication. */
  sourceRecordId: string;
  sourceIndicatorCode: string;
  diseaseSlug: string;
  indicator: Indicator;
  caseClassification: CaseClassification;
  aggregation: Aggregation;
  unit: string;
  value: string | null;
  lowerBound: string | null;
  upperBound: string | null;
  rawValue: string | null;
  geoScope: GeoScope;
  geoCode: string;
  /** ISO 3166-1 alpha-3 code when geoScope is COUNTRY (or use countryIso2). */
  countryIso3: string | null;
  /** ISO 3166-1 alpha-2 code, for sources that publish alpha-2 codes. */
  countryIso2?: string | null;
  /** Inclusive reporting period, as calendar dates (YYYY-MM-DD). */
  periodStart: string;
  periodEnd: string;
  /** Timestamp the source attaches to the record. Not an onset date. */
  reportedAt: Date | null;
  metadata: Record<string, unknown>;
}

/** Geographic reach of a report, as far as it can be determined. */
export type ReportScope =
  "COUNTRY" | "MULTI_COUNTRY" | "REGION" | "GLOBAL" | "UNKNOWN";

/** An official outbreak publication (e.g. a WHO Disease Outbreak News item). */
export interface NormalizedOutbreakReport {
  /** Stable upstream identifier (dedup key). */
  externalId: string;
  /** Identifier shown to readers, if the source has one. */
  displayId: string | null;
  title: string;
  sourceUrl: string;
  publishedAt: Date;
  updatedAt: Date | null;
  /** Short plain-text summary; never the full article. */
  contentSummary: string | null;
  /** Catalog disease identified from the title, or null if not identified. */
  diseaseSlug: string | null;
  /** ISO 3166-1 alpha-3 codes of countries named in the title. */
  countryIso3s: string[];
  scope: ReportScope;
  /** Wording of the geographic scope when no country was identified. */
  scopeLabel: string | null;
  /** The source itself describes the event as suspected. */
  suspected: boolean;
  /** Pathogen strain/subtype named in the title (e.g. "bundibugyo", "h5n1"), if any. */
  variant: string | null;
}

export type SyncWarningCode =
  | "INDICATOR_UNAVAILABLE"
  | "INDICATOR_FETCH_FAILED"
  | "INVALID_ROWS"
  | "UNSUPPORTED_DIMENSIONS"
  | "CONFLICTING_DUPLICATES"
  | "UNMATCHED_COUNTRY"
  | "UNMATCHED_DISEASE"
  | "INCOMPLETE_FETCH";

export interface SyncWarning {
  code: SyncWarningCode;
  message: string;
  context?: Record<string, unknown>;
}

/** Counts reported by an ObservationSink after writing. */
export interface WriteStats {
  inserted: number;
  revised: number;
  unchanged: number;
  skipped: number;
  warnings: SyncWarning[];
}

export type ProviderSyncStatus = "SUCCEEDED" | "PARTIAL" | "FAILED";

export interface SyncResult {
  providerId: string;
  status: ProviderSyncStatus;
  recordsProcessed: number;
  recordsInserted: number;
  /** New revisions of records that already existed. */
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsSkipped: number;
  warnings: SyncWarning[];
  errorMessage: string | null;
}

/** Persistence boundary for report-type providers. */
export interface ReportSink {
  /** Stores reports and, when `complete`, rebuilds outbreaks derived from them. */
  writeReports(
    reports: NormalizedOutbreakReport[],
    options: { complete: boolean },
  ): Promise<WriteStats>;
}

/** Persistence boundary used by providers during sync. */
export interface ObservationSink {
  registerIndicators(indicators: DiscoveredIndicator[]): Promise<void>;
  writeObservations(records: NormalizedRecord[]): Promise<WriteStats>;
  /** Records that these indicators were fetched and written successfully. */
  markIndicatorsSynced(codes: string[]): Promise<void>;
}

export interface DiseaseDataProvider<
  TRaw = unknown,
  TValid = unknown,
  TRecord extends NormalizedRecord | NormalizedOutbreakReport =
    NormalizedRecord,
> {
  readonly id: string;
  readonly descriptor: SourceDescriptor;

  fetch(): Promise<TRaw>;

  validate(input: TRaw): Promise<TValid>;

  normalize(input: TValid): Promise<TRecord[]>;

  sync(): Promise<SyncResult>;
}
