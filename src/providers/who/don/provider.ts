import { z } from "zod";
import { HttpClient, type HttpClientOptions } from "@/providers/base/http";
import { buildSyncResult } from "@/providers/base/result";
import type {
  DiseaseDataProvider,
  NormalizedOutbreakReport,
  ReportSink,
  SourceDescriptor,
  SyncResult,
  SyncWarning,
} from "@/providers/base/types";
import { excerpt, htmlToText } from "@/services/normalization/html";
import { matchTitle } from "./matching";

export const DON_API_URL = "https://www.who.int/api/news/diseaseoutbreaknews";
export const DON_ITEM_BASE_URL =
  "https://www.who.int/emergencies/disease-outbreak-news/item/";
const PAGE_SIZE = 100;
const MAX_PAGES = 200;

export const WHO_DON_SOURCE: SourceDescriptor = {
  id: "who-don",
  name: "WHO Disease Outbreak News",
  organization: "World Health Organization",
  homepageUrl: "https://www.who.int/emergencies/disease-outbreak-news",
  documentationUrl: null,
  license: "WHO website terms of use",
  licenseUrl: "https://www.who.int/about/policies/publishing/copyright",
  attributionRequirements:
    "Source: World Health Organization, Disease Outbreak News. WIDSP shows titles, dates and short excerpts and links to the original publication, which remains the authoritative text.",
};

export const DON_HTTP_DEFAULTS: Omit<HttpClientOptions, "userAgent"> = {
  allowedHosts: [new URL(DON_API_URL).hostname],
  minIntervalMs: 1_000,
  timeoutMs: 60_000,
  retry: { maxAttempts: 5, baseDelayMs: 2_000, maxDelayMs: 60_000 },
};

const SELECT_FIELDS = [
  "Id",
  "DonId",
  "Title",
  "UseOverrideTitle",
  "OverrideTitle",
  "PublicationDateAndTime",
  "LastModified",
  "UrlName",
  "Summary",
  "Overview",
];

export const donItemSchema = z.looseObject({
  Id: z.string().min(1),
  DonId: z.string().nullish(),
  Title: z.string().min(1),
  UseOverrideTitle: z.boolean().nullish(),
  OverrideTitle: z.string().nullish(),
  PublicationDateAndTime: z.iso.datetime({ offset: true }),
  LastModified: z.iso.datetime({ offset: true }).nullish(),
  // Slugs contain parentheses and non-ASCII characters; only path separators
  // and traversal are rejected. The host of the resulting link is fixed.
  UrlName: z
    .string()
    .min(1)
    .refine((v) => !/[/\\?#]/.test(v) && v !== "." && v !== ".."),
  Summary: z.string().nullish(),
  Overview: z.string().nullish(),
});

export type DonItem = z.infer<typeof donItemSchema>;

const donPageSchema = z.object({ value: z.array(z.unknown()) });

export interface DonRawBundle {
  pages: unknown[];
  complete: boolean;
  warnings: SyncWarning[];
}

export interface DonValidBundle {
  items: DonItem[];
  complete: boolean;
  skipped: number;
  warnings: SyncWarning[];
}

export function normalizeDonItem(
  item: DonItem,
  knownDiseaseSlugs?: ReadonlySet<string>,
): NormalizedOutbreakReport {
  const title =
    (item.UseOverrideTitle && item.OverrideTitle?.trim()) || item.Title.trim();
  const match = matchTitle(title, knownDiseaseSlugs);
  const summaryText =
    htmlToText(item.Summary ?? "") || htmlToText(item.Overview ?? "");
  return {
    externalId: item.Id,
    displayId: item.DonId?.trim() || null,
    title,
    sourceUrl: `${DON_ITEM_BASE_URL}${encodeURIComponent(item.UrlName)}`,
    publishedAt: new Date(item.PublicationDateAndTime),
    updatedAt: item.LastModified ? new Date(item.LastModified) : null,
    contentSummary: summaryText ? excerpt(summaryText) : null,
    diseaseSlug: match.diseaseSlug,
    countryIso3s: match.countryIso3s,
    scope: match.scope,
    scopeLabel: match.scopeLabel,
    suspected: match.suspected,
    variant: match.variant,
  };
}

export interface WhoDonProviderDeps {
  http: HttpClient;
  sink: ReportSink;
  /** Catalog slugs; titles naming other diseases stay unmatched. */
  knownDiseaseSlugs?: ReadonlySet<string>;
  apiUrl?: string;
}

export class WhoDonProvider implements DiseaseDataProvider<
  DonRawBundle,
  DonValidBundle,
  NormalizedOutbreakReport
> {
  readonly id = WHO_DON_SOURCE.id;
  readonly descriptor = WHO_DON_SOURCE;

  constructor(private readonly deps: WhoDonProviderDeps) {}

  async fetch(): Promise<DonRawBundle> {
    const pages: unknown[] = [];
    const base = this.deps.apiUrl ?? DON_API_URL;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        sf_culture: "en",
        $orderby: "PublicationDateAndTime desc,Id",
        $top: String(PAGE_SIZE),
        $skip: String(page * PAGE_SIZE),
        $select: SELECT_FIELDS.join(","),
      });
      let body: unknown;
      try {
        body = await this.deps.http.getJson(`${base}?${params}`);
      } catch (error) {
        // Without every page, outbreak grouping would be built on a partial
        // history, so the caller must not rebuild outbreaks from this fetch.
        return {
          pages,
          complete: false,
          warnings: [
            {
              code: "INCOMPLETE_FETCH",
              message: `Stopped at page ${page + 1}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
      pages.push(body);
      const size = donPageSchema.safeParse(body).data?.value.length ?? 0;
      if (size < PAGE_SIZE) return { pages, complete: true, warnings: [] };
    }
    return {
      pages,
      complete: false,
      warnings: [
        { code: "INCOMPLETE_FETCH", message: `Exceeded ${MAX_PAGES} pages.` },
      ],
    };
  }

  async validate(input: DonRawBundle): Promise<DonValidBundle> {
    const items: DonItem[] = [];
    let skipped = 0;
    for (const page of input.pages) {
      for (const candidate of donPageSchema.parse(page).value) {
        const parsed = donItemSchema.safeParse(candidate);
        if (parsed.success) items.push(parsed.data);
        else skipped++;
      }
    }
    const warnings = [...input.warnings];
    if (skipped > 0) {
      warnings.push({
        code: "INVALID_ROWS",
        message: `${skipped} Disease Outbreak News item(s) failed validation.`,
      });
    }
    return { items, complete: input.complete, skipped, warnings };
  }

  async normalize(input: DonValidBundle): Promise<NormalizedOutbreakReport[]> {
    return input.items.map((item) =>
      normalizeDonItem(item, this.deps.knownDiseaseSlugs),
    );
  }

  async sync(): Promise<SyncResult> {
    try {
      const valid = await this.validate(await this.fetch());
      if (valid.items.length === 0) {
        return buildSyncResult(this.id, {
          status: "FAILED",
          warnings: valid.warnings,
          errorMessage: "No Disease Outbreak News items could be fetched.",
        });
      }
      const reports = await this.normalize(valid);
      const stats = await this.deps.sink.writeReports(reports, {
        complete: valid.complete,
      });

      const unmatched = reports.filter((r) => r.diseaseSlug === null).length;
      const warnings = [...valid.warnings];
      if (unmatched > 0) {
        warnings.push({
          code: "UNMATCHED_DISEASE",
          message: `${unmatched} report(s) name a disease outside the catalog; stored without an outbreak link.`,
        });
      }
      return buildSyncResult(this.id, {
        status: valid.complete ? "SUCCEEDED" : "PARTIAL",
        recordsProcessed: reports.length + valid.skipped,
        stats,
        skipped: valid.skipped,
        warnings,
      });
    } catch (error) {
      return buildSyncResult(this.id, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
