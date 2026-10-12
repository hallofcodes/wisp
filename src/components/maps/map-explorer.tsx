import { connection } from "next/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/client";
import {
  CLASSIFICATION_LABELS,
  INDICATOR_LABELS,
  formatDate,
} from "@/lib/format";
import {
  type IndicatorMap,
  type ReportActivity,
  RECENCY_TIERS,
  getIndicatorMap,
  getIndicatorOptions,
  getReportActivity,
  valueClass,
} from "@/lib/map/data";
import { MAP_COLORS } from "./palette";
import { type MapCountryDatum, WorldMap } from "./world-map";

export const WINDOW_OPTIONS = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
  { days: 1825, label: "Last 5 years" },
  { days: 3650, label: "Last 10 years" },
] as const;

const searchSchema = z.object({
  mode: z.enum(["reports", "stats"]).catch("reports"),
  window: z.coerce
    .number()
    .refine((n) => WINDOW_OPTIONS.some((o) => o.days === n))
    .catch(90),
  disease: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .optional()
    .catch(undefined),
  indicator: z
    .string()
    .regex(/^[a-z0-9]{1,40}$/)
    .optional()
    .catch(undefined),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export type MapSearch = z.infer<typeof searchSchema>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseMapSearch(
  params: Record<string, string | string[] | undefined>,
): MapSearch {
  return searchSchema.parse({
    mode: first(params.mode),
    window: first(params.window),
    disease: first(params.disease) || undefined,
    indicator: first(params.indicator) || undefined,
    period: first(params.period) || undefined,
  });
}

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const shortDate = (iso: string) => formatDate(new Date(iso));

export async function MapExplorer({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = parseMapSearch(await searchParams);
  await connection();
  const db = getDb();

  const diseases = await db.disease.findMany({
    where: { outbreaks: { some: {} } },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  if (search.mode === "stats") {
    const options = await getIndicatorOptions(db);
    const stats = await getIndicatorMap(
      db,
      options,
      search.indicator,
      search.period,
    );
    return (
      <div className="flex flex-col gap-4">
        <Filters
          search={search}
          diseases={diseases}
          indicatorOptions={options}
          stats={stats}
        />
        {stats ? (
          <StatsView stats={stats} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No statistics stored yet.
          </p>
        )}
      </div>
    );
  }

  const activity = await getReportActivity(db, search.window, search.disease);
  return (
    <div className="flex flex-col gap-4">
      <Filters
        search={search}
        diseases={diseases}
        indicatorOptions={[]}
        stats={null}
      />
      <ReportsView
        activity={activity}
        search={search}
        diseaseName={diseases.find((d) => d.slug === search.disease)?.name}
      />
    </div>
  );
}

function Filters({
  search,
  diseases,
  indicatorOptions,
  stats,
}: {
  search: MapSearch;
  diseases: { slug: string; name: string }[];
  indicatorOptions: Awaited<ReturnType<typeof getIndicatorOptions>>;
  stats: IndicatorMap | null;
}) {
  const select = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <form
      method="get"
      action="/map"
      className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
    >
      <label className="flex flex-col gap-1 text-xs font-medium">
        Show
        <select name="mode" defaultValue={search.mode} className={select}>
          <option value="reports">Official outbreak reports</option>
          <option value="stats">Reported statistics</option>
        </select>
      </label>
      {search.mode === "reports" ? (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Disease
            <select
              name="disease"
              defaultValue={search.disease ?? ""}
              className={select}
            >
              <option value="">All diseases</option>
              {diseases.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Published
            <select
              name="window"
              defaultValue={String(search.window)}
              className={select}
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">
            Indicator
            <select
              name="indicator"
              defaultValue={stats?.indicator.id ?? ""}
              className={`${select} max-w-[min(90vw,28rem)]`}
            >
              {indicatorOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} (
                  {CLASSIFICATION_LABELS[o.caseClassification].toLowerCase()},{" "}
                  {o.sourceName})
                </option>
              ))}
            </select>
          </label>
          {stats && (
            <label className="flex flex-col gap-1 text-xs font-medium">
              Reporting period
              <select
                name="period"
                defaultValue={stats.period.end}
                className={select}
              >
                {stats.periods.map((p) => (
                  <option key={p.end} value={p.end}>
                    {p.start.slice(0, 4) === p.end.slice(0, 4) &&
                    p.start.endsWith("-01-01") &&
                    p.end.endsWith("-12-31")
                      ? p.end.slice(0, 4)
                      : `${shortDate(p.start)} – ${shortDate(p.end)}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <Button type="submit" size="sm">
        Update map
      </Button>
    </form>
  );
}

function Swatch({
  light,
  dark,
  outline,
}: {
  light: string;
  dark: string;
  outline?: { light: string; dark: string };
}) {
  const box = "size-3.5 shrink-0 rounded-sm";
  return (
    <>
      <span
        className={`${box} inline-block dark:hidden`}
        style={{
          background: light,
          boxShadow: outline ? `0 0 0 2px ${outline.light}` : undefined,
        }}
        aria-hidden
      />
      <span
        className={`${box} hidden dark:inline-block`}
        style={{
          background: dark,
          boxShadow: outline ? `0 0 0 2px ${outline.dark}` : undefined,
        }}
        aria-hidden
      />
    </>
  );
}

function ReportsView({
  activity,
  search,
  diseaseName,
}: {
  activity: ReportActivity;
  search: MapSearch;
  diseaseName?: string;
}) {
  const data: Record<string, MapCountryDatum> = {};
  for (const c of activity.countries) {
    data[c.iso3] = {
      fillClass: c.tier,
      pulseTier: c.tier <= 3 ? (c.tier as 1 | 2 | 3) : undefined,
      lines: [
        c.name,
        `${c.diseases.join(", ") || "Disease not in catalog"}`,
        `Latest: ${c.latest.title}`,
        `Published ${shortDate(c.latest.publishedAt)} · ${c.reportCount} report${c.reportCount === 1 ? "" : "s"} in period`,
        `Source: ${c.latest.sourceName}`,
      ],
      link: { href: c.latest.url, label: "Read the original report" },
    };
  }
  const windowLabel =
    WINDOW_OPTIONS.find((o) => o.days === search.window)?.label.toLowerCase() ??
    "";
  const subject = diseaseName ?? "any disease";
  const tiersInWindow = RECENCY_TIERS.filter(
    (t, i) => i === 0 || RECENCY_TIERS[i - 1].maxDays < search.window,
  );

  return (
    <>
      <WorldMap
        mode="reports"
        data={data}
        label={`World map of countries named in WHO Disease Outbreak News reports about ${subject}, published in the ${windowLabel}. ${activity.countries.length} countries are highlighted; details are listed below the map.`}
        emptyLine={`Not named in a WHO outbreak report about ${subject} in the ${windowLabel}. This does not mean the disease is absent.`}
        attribution="Reports: World Health Organization, Disease Outbreak News"
      />
      <div className="flex flex-col gap-2 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {tiersInWindow.map((t) => (
            <li key={t.tier} className="flex items-center gap-2">
              <Swatch
                light={MAP_COLORS.light.recency[t.tier - 1]}
                dark={MAP_COLORS.dark.recency[t.tier - 1]}
                outline={
                  t.tier <= 3
                    ? {
                        light: MAP_COLORS.light.pulse[t.tier - 1],
                        dark: MAP_COLORS.dark.pulse[t.tier - 1],
                      }
                    : undefined
                }
              />
              Latest report {t.label.charAt(0).toLowerCase() + t.label.slice(1)}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <Swatch
              light={MAP_COLORS.light.noData}
              dark={MAP_COLORS.dark.noData}
            />
            Not named in a report in this period
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Outlines pulse for countries named in a report in the past year;
          faster means more recent. The pulse shows when WHO <em>published</em>{" "}
          a report, not current case activity, and stops for reduced-motion
          settings. Countries are those named in report titles; whole countries
          are shaded because reports rarely give precise locations.
        </p>
      </div>

      <section
        aria-labelledby="countries-heading"
        className="flex flex-col gap-2"
      >
        <h2 id="countries-heading" className="text-lg font-semibold">
          Countries named in reports ({activity.countries.length})
        </h2>
        {activity.countries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No WHO Disease Outbreak News report about {subject} named a country
            in the {windowLabel}. Try a longer period.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {activity.countries.map((c) => (
              <li
                key={c.iso3}
                className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.name}{" "}
                    {c.diseases.map((d) => (
                      <Badge
                        key={d}
                        variant="outline"
                        className="ml-1 align-middle"
                      >
                        {d}
                      </Badge>
                    ))}
                  </p>
                  <a
                    href={c.latest.url}
                    className="text-sm underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.latest.title}
                  </a>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {shortDate(c.latest.publishedAt)}
                  {c.latest.displayId ? ` · ${c.latest.displayId}` : ""} ·{" "}
                  {c.reportCount} report{c.reportCount === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activity.otherReports.length > 0 && (
        <section
          aria-labelledby="other-heading"
          className="flex flex-col gap-2"
        >
          <h2 id="other-heading" className="text-lg font-semibold">
            Global, regional and other reports ({activity.otherReports.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            These reports do not name a single country in their title (or
            concern a disease outside the catalog), so they are not drawn on the
            map.
          </p>
          <ul className="divide-y rounded-lg border">
            {activity.otherReports.map((r) => (
              <li
                key={r.url}
                className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <a
                  href={r.url}
                  className="text-sm underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.title}
                </a>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {shortDate(r.publishedAt)}
                  {r.displayId ? ` · ${r.displayId}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Source: World Health Organization, Disease Outbreak News. Titles and
        dates are shown as published; follow the links for the authoritative
        text.
      </p>
    </>
  );
}

function StatsView({ stats }: { stats: IndicatorMap }) {
  const { indicator, period, values, breaks } = stats;
  const data: Record<string, MapCountryDatum> = {};
  const periodLabel = `${shortDate(period.start)} – ${shortDate(period.end)}`;
  for (const v of values) {
    data[v.iso3] = {
      fillClass: valueClass(v.value, breaks),
      lines: [
        v.name,
        `${indicator.diseaseName}: ${INDICATOR_LABELS[indicator.indicator].toLowerCase()} (${CLASSIFICATION_LABELS[indicator.caseClassification].toLowerCase()})`,
        v.value === null
          ? "No value reported"
          : `${numberFormat.format(v.value)} ${indicator.unit}${v.rawValue?.includes("[") ? ` (${v.rawValue})` : ""}`,
        `Period: ${periodLabel}`,
        `Source: ${indicator.sourceName}`,
      ],
    };
  }

  const reported = values.filter((v) => v.value !== null);
  const sorted = [...reported].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const classes = breaks.map((upper, i) => ({
    lower: i === 0 ? 0 : breaks[i - 1],
    upper,
    index: i + 1,
  }));

  return (
    <>
      <WorldMap
        mode="stats"
        data={data}
        label={`World map of ${indicator.label}, ${periodLabel}. ${reported.length} countries reported a value. Values are listed in the table below the map.`}
        emptyLine={`No value reported for ${periodLabel}. This does not mean zero cases.`}
        attribution={`Data: ${indicator.sourceName}`}
      />
      <div className="flex flex-col gap-2 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {classes.map((c) => (
            <li key={c.index} className="flex items-center gap-2 tabular-nums">
              <Swatch
                light={MAP_COLORS.light.magnitude[c.index - 1]}
                dark={MAP_COLORS.dark.magnitude[c.index - 1]}
              />
              {c.index === 1 ? "1" : `>${numberFormat.format(c.lower)}`} –{" "}
              {numberFormat.format(c.upper)}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <Swatch light={MAP_COLORS.light.zero} dark={MAP_COLORS.dark.zero} />
            Zero (or a negative correction) reported
          </li>
          <li className="flex items-center gap-2">
            <Swatch
              light={MAP_COLORS.light.noData}
              dark={MAP_COLORS.dark.noData}
            />
            No value reported
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          {indicator.unit.charAt(0).toUpperCase() + indicator.unit.slice(1)} per
          country, {periodLabel}, from {indicator.sourceName}. Counts are not
          adjusted for population or testing and are not comparable across
          countries without context. {indicator.definition}
        </p>
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Data table ({reported.length} countries with a value)
        </summary>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Country</th>
              <th className="py-1 text-right font-medium">
                Value ({indicator.unit})
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.iso3} className="border-t">
                <td className="py-1">{v.name}</td>
                <td className="py-1 text-right tabular-nums">
                  {v.rawValue ?? numberFormat.format(v.value!)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
