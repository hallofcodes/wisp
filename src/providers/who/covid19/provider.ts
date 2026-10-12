import { z } from "zod";
import { HttpClient, type HttpClientOptions } from "@/providers/base/http";
import { buildSyncResult } from "@/providers/base/result";
import type {
  DiscoveredIndicator,
  DiseaseDataProvider,
  IndicatorDefinition,
  NormalizedRecord,
  ObservationSink,
  SourceDescriptor,
  SyncResult,
  SyncWarning,
} from "@/providers/base/types";
import { parseCsvRecords } from "@/services/normalization/csv";
import { isIsoDate } from "@/services/normalization/values";

export const COVID19_DATA_URL =
  "https://srhdpeuwpubsa.blob.core.windows.net/whdh/COVID/WHO-COVID-19-global-data.csv";

export const WHO_COVID19_SOURCE: SourceDescriptor = {
  id: "who-covid19",
  name: "WHO COVID-19 dashboard",
  organization: "World Health Organization",
  homepageUrl: "https://data.who.int/dashboards/covid19",
  documentationUrl: "https://data.who.int/dashboards/covid19/data",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  attributionRequirements:
    "WHO COVID-19 dashboard. Geneva: World Health Organization; 2020. Available online: https://data.who.int/dashboards/covid19/. Data reproduced without endorsement by WHO.",
};

export const COVID19_HTTP_DEFAULTS: Omit<HttpClientOptions, "userAgent"> = {
  allowedHosts: [new URL(COVID19_DATA_URL).hostname],
  minIntervalMs: 1_000,
  timeoutMs: 180_000,
  retry: { maxAttempts: 5, baseDelayMs: 2_000, maxDelayMs: 60_000 },
};

const SHARED_DEFINITION =
  "Counts reported to WHO by date of reporting (not date of onset), for the 7 days ending on the reporting date. Since August 2023 WHO no longer requires countries to report, so many countries report irregularly or not at all; a blank means not reported. Counts are primarily laboratory-confirmed cases per national definitions, and WHO revises earlier weeks retrospectively. Negative values are corrections published by WHO.";

export const COVID19_INDICATORS: IndicatorDefinition[] = [
  {
    code: "New_cases",
    diseaseSlug: "covid-19",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition: `New COVID-19 cases reported to WHO in the week. ${SHARED_DEFINITION}`,
  },
  {
    code: "New_deaths",
    diseaseSlug: "covid-19",
    indicator: "DEATHS",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "deaths",
    definition: `New COVID-19 deaths reported to WHO in the week. ${SHARED_DEFINITION}`,
  },
];

const INDICATOR_NAMES: Record<string, string> = {
  New_cases: "New COVID-19 cases reported to WHO (weekly)",
  New_deaths: "New COVID-19 deaths reported to WHO (weekly)",
};

const REQUIRED_COLUMNS = [
  "Date_reported",
  "Country_code",
  "Country",
  "WHO_region",
  "New_cases",
  "New_deaths",
];

const countValue = z.string().regex(/^-?\d+$|^$/);
const covidRowSchema = z.object({
  Date_reported: z.string().refine(isIsoDate),
  Country_code: z.string().regex(/^[A-Z]{2,3}$/),
  Country: z.string(),
  WHO_region: z.string(),
  New_cases: countValue,
  New_deaths: countValue,
});

type CovidRow = z.infer<typeof covidRowSchema>;

export interface CovidValidBundle {
  rows: CovidRow[];
  skipped: number;
  warnings: SyncWarning[];
}

/** The 7-day period ending on `date` (inclusive), as calendar dates. */
export function weekEnding(date: string): { start: string; end: string } {
  const end = new Date(`${date}T00:00:00.000Z`);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  return { start: start.toISOString().slice(0, 10), end: date };
}

export function normalizeCovidRows(rows: CovidRow[]): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];
  for (const row of rows) {
    const period = weekEnding(row.Date_reported);
    const isCountry = row.Country_code.length === 2;
    for (const definition of COVID19_INDICATORS) {
      const raw = row[definition.code as "New_cases" | "New_deaths"];
      records.push({
        sourceRecordId: `${definition.code}|${row.Country_code}|${row.Date_reported}`,
        sourceIndicatorCode: definition.code,
        diseaseSlug: definition.diseaseSlug,
        indicator: definition.indicator,
        caseClassification: definition.caseClassification,
        aggregation: definition.aggregation,
        unit: definition.unit,
        // Blank means "not reported" and stays null.
        value: raw === "" ? null : String(Number(raw)),
        lowerBound: null,
        upperBound: null,
        rawValue: raw === "" ? null : raw,
        // WHO uses XX* codes for international conveyances, which are not countries.
        geoScope: isCountry ? "COUNTRY" : "OTHER",
        geoCode: row.Country_code,
        countryIso3: null,
        countryIso2: isCountry ? row.Country_code : null,
        periodStart: period.start,
        periodEnd: period.end,
        reportedAt: new Date(`${row.Date_reported}T00:00:00.000Z`),
        metadata: { country: row.Country, whoRegion: row.WHO_region || null },
      });
    }
  }
  return records;
}

export interface WhoCovid19ProviderDeps {
  http: HttpClient;
  sink: ObservationSink;
  url?: string;
}

export class WhoCovid19Provider implements DiseaseDataProvider<
  string,
  CovidValidBundle
> {
  readonly id = WHO_COVID19_SOURCE.id;
  readonly descriptor = WHO_COVID19_SOURCE;

  constructor(private readonly deps: WhoCovid19ProviderDeps) {}

  async fetch(): Promise<string> {
    return this.deps.http.getText(this.deps.url ?? COVID19_DATA_URL);
  }

  async validate(input: string): Promise<CovidValidBundle> {
    const { header, records } = parseCsvRecords(input);
    const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      throw new Error(
        `COVID-19 CSV is missing expected columns: ${missing.join(", ")}`,
      );
    }
    const rows: CovidRow[] = [];
    let skipped = 0;
    for (const record of records) {
      const parsed = covidRowSchema.safeParse(record);
      if (parsed.success) rows.push(parsed.data);
      else skipped++;
    }
    if (rows.length === 0)
      throw new Error("COVID-19 CSV contained no valid rows.");
    const warnings: SyncWarning[] =
      skipped > 0
        ? [
            {
              code: "INVALID_ROWS",
              message: `${skipped} COVID-19 row(s) failed validation and were skipped.`,
            },
          ]
        : [];
    return { rows, skipped, warnings };
  }

  async normalize(input: CovidValidBundle): Promise<NormalizedRecord[]> {
    return normalizeCovidRows(input.rows);
  }

  async sync(): Promise<SyncResult> {
    try {
      const valid = await this.validate(await this.fetch());
      const records = await this.normalize(valid);
      const indicators: DiscoveredIndicator[] = COVID19_INDICATORS.map((d) => ({
        ...d,
        upstreamName: INDICATOR_NAMES[d.code],
        available: true,
      }));
      await this.deps.sink.registerIndicators(indicators);
      const stats = await this.deps.sink.writeObservations(records);
      await this.deps.sink.markIndicatorsSynced(
        COVID19_INDICATORS.map((d) => d.code),
      );
      return buildSyncResult(this.id, {
        status: "SUCCEEDED",
        recordsProcessed: records.length + valid.skipped,
        stats,
        skipped: valid.skipped,
        warnings: valid.warnings,
      });
    } catch (error) {
      return buildSyncResult(this.id, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
