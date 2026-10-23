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
import { GHO_INDICATORS } from "./indicators";
import { normalizeGhoRows } from "./normalize";
import {
  type GhoObservation,
  ghoIndicatorListSchema,
  ghoObservationPageSchema,
  ghoObservationSchema,
} from "./schema";

export const GHO_BASE_URL = "https://ghoapi.azureedge.net/api";

export const WHO_GHO_SOURCE: SourceDescriptor = {
  id: "who-gho",
  name: "WHO Global Health Observatory",
  organization: "World Health Organization",
  homepageUrl: "https://www.who.int/data/gho",
  documentationUrl: "https://www.who.int/data/gho/info/gho-odata-api",
  license: "CC BY-NC-SA 3.0 IGO",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/3.0/igo/",
  attributionRequirements:
    "Source: World Health Organization, Global Health Observatory (https://www.who.int/data/gho). Data are reproduced without endorsement by WHO; WIDSP is responsible for any transformation.",
};

export const GHO_HTTP_DEFAULTS: Omit<HttpClientOptions, "userAgent"> = {
  allowedHosts: [new URL(GHO_BASE_URL).hostname],
  // GHO publishes no rate limit; stay well below anything abusive.
  minIntervalMs: 1_000,
  timeoutMs: 120_000,
  retry: { maxAttempts: 6, baseDelayMs: 2_000, maxDelayMs: 60_000 },
};

const MAX_PAGES = 500;

export interface GhoRawBundle {
  /** Raw indicator list pages, or null if discovery failed. */
  indicatorList: unknown[] | null;
  datasets: { code: string; pages: unknown[] }[];
  warnings: SyncWarning[];
}

export interface GhoValidBundle {
  indicators: DiscoveredIndicator[];
  datasets: { definition: IndicatorDefinition; rows: GhoObservation[] }[];
  warnings: SyncWarning[];
  skipped: number;
}

export interface WhoGhoProviderDeps {
  http: HttpClient;
  sink: ObservationSink;
  indicators?: IndicatorDefinition[];
  baseUrl?: string;
}

export class WhoGhoProvider implements DiseaseDataProvider<
  GhoRawBundle,
  GhoValidBundle
> {
  readonly id = WHO_GHO_SOURCE.id;
  readonly descriptor = WHO_GHO_SOURCE;

  private readonly http: HttpClient;
  private readonly sink: ObservationSink;
  private readonly definitions: IndicatorDefinition[];
  private readonly baseUrl: string;
  /** Warnings and skip counts from the most recent normalize() call. */
  private normalizeWarnings: SyncWarning[] = [];
  private normalizeSkipped = 0;

  constructor(deps: WhoGhoProviderDeps) {
    this.http = deps.http;
    this.sink = deps.sink;
    this.definitions = deps.indicators ?? GHO_INDICATORS;
    this.baseUrl = deps.baseUrl ?? GHO_BASE_URL;
  }

  async fetch(): Promise<GhoRawBundle> {
    const warnings: SyncWarning[] = [];

    let indicatorList: unknown[] | null = null;
    try {
      indicatorList = await this.fetchAllPages(`${this.baseUrl}/Indicator`);
    } catch (error) {
      warnings.push({
        code: "INDICATOR_FETCH_FAILED",
        message: `Indicator discovery failed; attempting curated indicators directly: ${errorMessage(error)}`,
      });
    }

    const knownCodes = indicatorList ? discoveredCodes(indicatorList) : null;
    const datasets: GhoRawBundle["datasets"] = [];

    for (const definition of this.definitions) {
      if (knownCodes && !knownCodes.has(definition.code)) continue;
      try {
        const pages = await this.fetchAllPages(
          `${this.baseUrl}/${encodeURIComponent(definition.code)}`,
        );
        datasets.push({ code: definition.code, pages });
      } catch (error) {
        warnings.push({
          code: "INDICATOR_FETCH_FAILED",
          message: `${definition.code}: ${errorMessage(error)}`,
          context: { indicator: definition.code },
        });
      }
    }

    return { indicatorList, datasets, warnings };
  }

  async validate(input: GhoRawBundle): Promise<GhoValidBundle> {
    const warnings = [...input.warnings];
    let skipped = 0;

    const upstreamNames = new Map<string, string>();
    if (input.indicatorList) {
      for (const page of input.indicatorList) {
        for (const item of ghoIndicatorListSchema.parse(page).value) {
          upstreamNames.set(item.IndicatorCode, item.IndicatorName);
        }
      }
    }

    const indicators: DiscoveredIndicator[] = this.definitions.map(
      (definition) => {
        const upstreamName = upstreamNames.get(definition.code) ?? null;
        // Without a discovery result, availability is unknown; assume available
        // and let the per-indicator fetch decide.
        const available = input.indicatorList ? upstreamName !== null : true;
        if (!available) {
          warnings.push({
            code: "INDICATOR_UNAVAILABLE",
            message: `${definition.code} is no longer listed by GHO and was skipped.`,
            context: { indicator: definition.code },
          });
        }
        return { ...definition, upstreamName, available };
      },
    );

    const datasets: GhoValidBundle["datasets"] = [];
    for (const dataset of input.datasets) {
      const definition = this.definitions.find((d) => d.code === dataset.code);
      if (!definition) continue;

      const rows: GhoObservation[] = [];
      let invalid = 0;
      for (const page of dataset.pages) {
        for (const candidate of ghoObservationPageSchema.parse(page).value) {
          const parsed = ghoObservationSchema.safeParse(candidate);
          if (parsed.success && parsed.data.IndicatorCode === definition.code)
            rows.push(parsed.data);
          else invalid++;
        }
      }
      if (invalid > 0) {
        skipped += invalid;
        warnings.push({
          code: "INVALID_ROWS",
          message: `${definition.code}: ${invalid} row(s) failed schema validation.`,
          context: { indicator: definition.code, rows: invalid },
        });
      }
      datasets.push({ definition, rows });
    }

    return { indicators, datasets, warnings, skipped };
  }

  async normalize(input: GhoValidBundle): Promise<NormalizedRecord[]> {
    this.normalizeWarnings = [];
    this.normalizeSkipped = 0;
    const records: NormalizedRecord[] = [];
    for (const { definition, rows } of input.datasets) {
      const result = normalizeGhoRows(definition, rows);
      records.push(...result.records);
      this.normalizeWarnings.push(...result.warnings);
      this.normalizeSkipped += result.skipped;
    }
    return records;
  }

  async sync(): Promise<SyncResult> {
    try {
      const raw = await this.fetch();
      const valid = await this.validate(raw);
      const records = await this.normalize(valid);

      await this.sink.registerIndicators(valid.indicators);
      const stats = await this.sink.writeObservations(records);
      await this.sink.markIndicatorsSynced(
        valid.datasets.map((d) => d.definition.code),
      );

      const attempted = valid.indicators.filter((i) => i.available).length;
      const succeeded = valid.datasets.length;
      const status =
        succeeded === 0 && attempted > 0
          ? "FAILED"
          : succeeded < attempted
            ? "PARTIAL"
            : "SUCCEEDED";

      return buildSyncResult(this.id, {
        status,
        recordsProcessed:
          records.length + valid.skipped + this.normalizeSkipped,
        stats,
        skipped: valid.skipped + this.normalizeSkipped,
        warnings: [...valid.warnings, ...this.normalizeWarnings],
        errorMessage:
          status === "FAILED" ? "No GHO indicator could be fetched." : null,
      });
    } catch (error) {
      return buildSyncResult(this.id, {
        status: "FAILED",
        errorMessage: errorMessage(error),
      });
    }
  }

  /** Follows OData `@odata.nextLink` pagination. */
  private async fetchAllPages(firstUrl: string): Promise<unknown[]> {
    const pages: unknown[] = [];
    let url: string | undefined = firstUrl;
    while (url) {
      if (pages.length >= MAX_PAGES)
        throw new Error(`Exceeded ${MAX_PAGES} pages for ${firstUrl}`);
      const page = await this.http.getJson(url);
      pages.push(page);
      const next: unknown = (page as Record<string, unknown> | null)?.[
        "@odata.nextLink"
      ];
      url = typeof next === "string" ? new URL(next, url).href : undefined;
    }
    return pages;
  }
}

function discoveredCodes(pages: unknown[]): Set<string> {
  const codes = new Set<string>();
  for (const page of pages) {
    const parsed = ghoIndicatorListSchema.safeParse(page);
    if (parsed.success)
      parsed.data.value.forEach((i) => codes.add(i.IndicatorCode));
  }
  return codes;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
