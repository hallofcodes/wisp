import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  let hasError = false;
  let diseases: { slug: string; name: string }[] = [];
  let indicatorOptions: Awaited<ReturnType<typeof getIndicatorOptions>> = [];
  let stats: IndicatorMap | null = null;
  let activity: ReportActivity | null = null;

  try {
    const db = getDb();
    diseases = await db.disease.findMany({
      where: { outbreaks: { some: {} } },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });

    if (search.mode === "stats") {
      indicatorOptions = await getIndicatorOptions(db);
      stats = await getIndicatorMap(
        db,
        indicatorOptions,
        search.indicator,
        search.period,
      );
    } else {
      activity = await getReportActivity(db, search.window, search.disease);
    }
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="flex flex-col gap-5">
        <Filters
          search={search}
          diseases={[]}
          indicatorOptions={[]}
          stats={null}
        />
        <Card
          role="alert"
          className="border-l-4 border-l-[#B91C1C] bg-[#FEF2F2]/50"
        >
          <CardHeader>
            <CardTitle className="text-[#171717]">
              Surveillance database is currently unavailable
            </CardTitle>
            <CardDescription className="text-[#525252]">
              The database could not be reached (or <code>DATABASE_URL</code> is
              not configured in <code>.env</code>). The interactive base map is
              shown below with no highlighted countries rather than displaying
              fabricated or stale surveillance data.
            </CardDescription>
          </CardHeader>
        </Card>
        <WorldMap
          mode={search.mode}
          data={{}}
          label="World map with no highlighted countries because the database is currently unavailable."
          emptyLine="Surveillance data is temporarily unavailable."
          attribution="Natural Earth"
        />
      </div>
    );
  }

  if (search.mode === "stats") {
    return (
      <div className="flex flex-col gap-5">
        <Filters
          search={search}
          diseases={diseases}
          indicatorOptions={indicatorOptions}
          stats={stats}
        />
        {stats ? (
          <StatsView stats={stats} />
        ) : (
          <div className="rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-5 text-sm text-[#525252]">
            No statistics stored yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Filters
        search={search}
        diseases={diseases}
        indicatorOptions={[]}
        stats={null}
      />
      <ReportsView
        activity={activity!}
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
  const selectClass =
    "h-9 w-full sm:w-auto rounded-[4px] border border-[#D4D4D4] bg-[#FFFFFF] px-2.5 text-sm text-[#171717] transition-colors focus-visible:border-[#FF5A1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]/40";

  const hasCustomFilters =
    (search.mode === "reports" &&
      (Boolean(search.disease) || search.window !== 90)) ||
    (search.mode === "stats" &&
      (Boolean(search.indicator) || Boolean(search.period)));

  return (
    <form
      method="get"
      action="/map"
      className="flex flex-col gap-3 rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-3.5 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[#525252]">
        <span>Show layer</span>
        <select name="mode" defaultValue={search.mode} className={selectClass}>
          <option value="reports">Official outbreak reports</option>
          <option value="stats">Reported statistics</option>
        </select>
      </label>

      {search.mode === "reports" ? (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[#525252]">
            <span>Disease</span>
            <select
              name="disease"
              defaultValue={search.disease ?? ""}
              className={selectClass}
            >
              <option value="">All diseases</option>
              {diseases.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[#525252]">
            <span>Published window</span>
            <select
              name="window"
              defaultValue={String(search.window)}
              className={selectClass}
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
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[#525252]">
            <span>Indicator</span>
            <select
              name="indicator"
              defaultValue={stats?.indicator.id ?? ""}
              className={`${selectClass} max-w-full sm:max-w-[28rem]`}
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
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[#525252]">
              <span>Reporting period</span>
              <select
                name="period"
                defaultValue={stats.period.end}
                className={selectClass}
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

      <div className="flex items-center gap-2 pt-1 sm:pt-0">
        <Button type="submit" size="lg" className="h-9 px-3.5">
          Update map
        </Button>
        {hasCustomFilters && (
          <Link
            href={search.mode === "stats" ? "/map?mode=stats" : "/map"}
            className="inline-flex h-9 items-center rounded-[4px] border border-[#D4D4D4] bg-[#FFFFFF] px-3 text-xs font-medium text-[#525252] transition-colors hover:bg-[#EFEFED] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            Reset filters
          </Link>
        )}
      </div>
    </form>
  );
}

function Swatch({ color, outline }: { color: string; outline?: string }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-[2px] border border-[#171717]/15"
      style={{
        background: color,
        boxShadow: outline ? `0 0 0 2px ${outline}` : undefined,
      }}
      aria-hidden="true"
    />
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

      <div className="flex flex-col gap-2.5 rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-3.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#171717]">
            Report Recency Legend
          </span>
          <ul
            className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#171717]"
            aria-label="Legend"
          >
            {tiersInWindow.map((t) => (
              <li key={t.tier} className="flex items-center gap-2">
                <Swatch
                  color={MAP_COLORS.light.recency[t.tier - 1]}
                  outline={
                    t.tier <= 3
                      ? MAP_COLORS.light.pulse[t.tier - 1]
                      : undefined
                  }
                />
                <span>
                  Latest report{" "}
                  {t.label.charAt(0).toLowerCase() + t.label.slice(1)}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Swatch color={MAP_COLORS.light.noData} />
              <span>Not named in a report in this period</span>
            </li>
          </ul>
        </div>
        <p className="text-xs leading-relaxed text-[#525252]">
          Outlines pulse for countries named in a report in the past year;
          faster means more recent. The pulse and shading show when WHO{" "}
          <em>published</em> a report—not outbreak severity or current case
          activity—and stop automatically for reduced-motion settings. Countries
          are those named in report titles; whole countries are shaded because
          reports rarely give sub-national coordinates.
        </p>
      </div>

      <section
        aria-labelledby="countries-heading"
        className="flex flex-col gap-3 pt-2"
      >
        <div className="border-b border-[#E5E5E5] pb-2">
          <h2
            id="countries-heading"
            className="text-lg font-semibold tracking-tight text-[#171717]"
          >
            Countries named in reports ({activity.countries.length})
          </h2>
        </div>

        {activity.countries.length === 0 ? (
          <div className="rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-5 text-sm text-[#525252]">
            No WHO Disease Outbreak News report about {subject} named a country
            in the {windowLabel}. Try selecting a longer time window above.
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E5E5] rounded-[6px] border border-[#E5E5E5] bg-[#FFFFFF]">
            {activity.countries.map((c) => (
              <li
                key={c.iso3}
                className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-[#F5F5F5]/70 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[#171717]">
                      {c.name}
                    </span>
                    {c.diseases.map((d) => (
                      <Badge key={d} variant="outline">
                        {d}
                      </Badge>
                    ))}
                  </div>
                  <a
                    href={c.latest.url}
                    className="group inline-flex items-baseline gap-1 text-sm text-[#525252] underline-offset-4 hover:text-[#C23B0A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm break-words"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>{c.latest.title}</span>
                    <ArrowUpRight
                      className="size-3.5 shrink-0 translate-y-0.5 text-[#737373] group-hover:text-[#C23B0A]"
                      aria-hidden="true"
                    />
                  </a>
                </div>
                <p className="shrink-0 text-xs text-[#525252] tabular-nums">
                  <span className="font-medium text-[#171717]">
                    {shortDate(c.latest.publishedAt)}
                  </span>
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
          className="flex flex-col gap-3 pt-2"
        >
          <div className="border-b border-[#E5E5E5] pb-2">
            <h2
              id="other-heading"
              className="text-lg font-semibold tracking-tight text-[#171717]"
            >
              Global, regional and other reports ({activity.otherReports.length}
              )
            </h2>
            <p className="text-xs text-[#525252]">
              These reports do not name a single country in their title (or
              concern a disease outside the catalog), so they are listed here
              rather than drawn on the map.
            </p>
          </div>
          <ul className="divide-y divide-[#E5E5E5] rounded-[6px] border border-[#E5E5E5] bg-[#FFFFFF]">
            {activity.otherReports.map((r) => (
              <li
                key={r.url}
                className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-[#F5F5F5]/70 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <a
                  href={r.url}
                  className="group inline-flex items-baseline gap-1 text-sm font-medium text-[#171717] underline-offset-4 hover:text-[#C23B0A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm break-words"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{r.title}</span>
                  <ArrowUpRight
                    className="size-3.5 shrink-0 translate-y-0.5 text-[#737373] group-hover:text-[#C23B0A]"
                    aria-hidden="true"
                  />
                </a>
                <p className="shrink-0 text-xs text-[#525252] tabular-nums">
                  <span className="font-medium text-[#171717]">
                    {shortDate(r.publishedAt)}
                  </span>
                  {r.displayId ? ` · ${r.displayId}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-[#525252]">
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
      <div className="flex flex-col gap-2.5 rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-3.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#171717]">
            {indicator.unit.charAt(0).toUpperCase() + indicator.unit.slice(1)}{" "}
            Legend ({periodLabel})
          </span>
          <ul
            className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#171717]"
            aria-label="Legend"
          >
            {classes.map((c) => (
              <li key={c.index} className="flex items-center gap-2 tabular-nums">
                <Swatch color={MAP_COLORS.light.magnitude[c.index - 1]} />
                <span>
                  {c.index === 1 ? "1" : `>${numberFormat.format(c.lower)}`} –{" "}
                  {numberFormat.format(c.upper)}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Swatch color={MAP_COLORS.light.zero} />
              <span>Zero (or a negative correction) reported</span>
            </li>
            <li className="flex items-center gap-2">
              <Swatch color={MAP_COLORS.light.noData} />
              <span>No value reported</span>
            </li>
          </ul>
        </div>
        <p className="text-xs leading-relaxed text-[#525252]">
          {indicator.unit.charAt(0).toUpperCase() + indicator.unit.slice(1)} per
          country, {periodLabel}, from{" "}
          <strong className="font-medium text-[#171717]">
            {indicator.sourceName}
          </strong>
          . Counts are not adjusted for population or testing capacity and are
          not directly comparable across countries without context. Missing
          values reflect reporting cadence rather than zero cases.{" "}
          {indicator.definition}
        </p>
      </div>
      <details className="group rounded-[6px] border border-[#E5E5E5] bg-[#FFFFFF] p-3.5">
        <summary className="cursor-pointer text-sm font-semibold text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm">
          Country data table ({reported.length} countries with a reported value
          for {periodLabel})
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#F5F5F5] text-left text-xs font-semibold uppercase tracking-wider text-[#525252]">
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2 text-right">
                  Value ({indicator.unit})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {sorted.map((v) => (
                <tr
                  key={v.iso3}
                  className="transition-colors hover:bg-[#F5F5F5]/60"
                >
                  <td className="px-3 py-2 font-medium text-[#171717]">
                    {v.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#171717]">
                    {v.rawValue ?? numberFormat.format(v.value!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}