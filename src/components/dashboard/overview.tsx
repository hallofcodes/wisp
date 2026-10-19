import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/lib/db/client";
import {
  CLASSIFICATION_LABELS,
  INDICATOR_LABELS,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import { getOverview, type Overview } from "@/lib/statistics/overview";

export async function OverviewSection() {
  await connection();
  let overview: Overview;
  try {
    overview = await getOverview(getDb());
  } catch {
    return (
      <Card
        role="alert"
        className="border-l-4 border-l-[#B91C1C] bg-[#FEF2F2]/50"
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[#B91C1C]"
            />
            <CardTitle className="text-[#171717]">
              Data is temporarily unavailable
            </CardTitle>
          </div>
          <CardDescription className="text-[#525252]">
            The database could not be reached (or <code>DATABASE_URL</code> is
            not configured in <code>.env</code>). No statistics are shown rather
            than stale or fabricated ones. You can still explore the{" "}
            <Link
              href="/map"
              className="font-medium text-[#C23B0A] underline underline-offset-4"
            >
              Global outbreak map
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section
        aria-labelledby="summary-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h2
            id="summary-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#525252]"
          >
            Database Coverage Summary
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Diseases in catalog"
            value={overview.diseaseCount}
            note="Reference catalog. Inclusion does not indicate an active outbreak."
            highlight
          />
          <StatCard
            label="Statistical indicators with data"
            value={overview.indicatorsWithData}
            note="Source indicators with at least one country-level value."
          />
          <StatCard
            label="Countries and territories with data"
            value={overview.countriesWithData}
            note="Having any value for any indicator, any year. Absence of data is not absence of disease."
          />
        </div>
      </section>

      <section
        aria-labelledby="reports-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E5E5E5] pb-2.5">
          <div>
            <h2
              id="reports-heading"
              className="text-lg font-semibold tracking-tight text-[#171717]"
            >
              Latest official outbreak reports
            </h2>
            <p className="text-xs text-[#525252]">
              Most recent dispatches ingested from official public health
              surveillance feeds.
            </p>
          </div>
          <Link
            href="/map?mode=reports"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#C23B0A] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm"
          >
            <span>See them on the map</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {overview.recentReports.length === 0 ? (
          <div className="rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-5 text-sm text-[#525252]">
            No outbreak reports synchronized yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E5E5] rounded-[6px] border border-[#E5E5E5] bg-[#FFFFFF]">
            {overview.recentReports.map((r) => (
              <li
                key={r.url}
                className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-[#F5F5F5]/70 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <a
                  href={r.url}
                  className="group inline-flex items-baseline gap-1.5 text-sm font-medium text-[#171717] underline-offset-4 hover:text-[#C23B0A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm break-words"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{r.title}</span>
                  <ArrowUpRight
                    className="size-3.5 shrink-0 translate-y-0.5 text-[#737373] transition-colors group-hover:text-[#C23B0A]"
                    aria-hidden="true"
                  />
                </a>
                <span className="shrink-0 text-xs text-[#525252] tabular-nums">
                  <span className="font-medium text-[#171717]">
                    {formatDate(r.publishedAt)}
                  </span>
                  {r.displayId ? ` · ${r.displayId}` : ""} · {r.sourceName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="indicators-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E5E5E5] pb-2.5">
          <div>
            <h2
              id="indicators-heading"
              className="text-lg font-semibold tracking-tight text-[#171717]"
            >
              Indicators and data freshness
            </h2>
            <p className="text-xs text-[#525252]">
              Each indicator is shown separately with its own definition. Values
              are never summed across indicators, sources, or case
              classifications.
            </p>
          </div>
          <Link
            href="/map?mode=stats"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#C23B0A] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm"
          >
            <span>Map indicator values</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {overview.indicators.length === 0 ? (
          <div className="rounded-[6px] border border-[#E5E5E5] bg-[#F5F5F5] p-5 text-sm text-[#525252]">
            No source indicators have been synchronized yet. Run{" "}
            <code className="rounded bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-xs text-[#171717] border border-[#E5E5E5]">
              npm run sync -- --all
            </code>
            .
          </div>
        ) : (
          <div className="overflow-hidden rounded-[6px] border border-[#E5E5E5] bg-[#FFFFFF]">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F5F5F5] hover:bg-[#F5F5F5]">
                  <TableHead className="font-semibold text-[#171717]">
                    Disease
                  </TableHead>
                  <TableHead className="font-semibold text-[#171717]">
                    Indicator &amp; Source Metadata
                  </TableHead>
                  <TableHead className="font-semibold text-[#171717]">
                    Classification
                  </TableHead>
                  <TableHead className="font-semibold text-[#171717]">
                    Latest reporting period
                  </TableHead>
                  <TableHead className="text-right font-semibold text-[#171717]">
                    Geographies reporting
                  </TableHead>
                  <TableHead className="font-semibold text-[#171717]">
                    Last synchronized
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.indicators.map((i) => (
                  <TableRow key={i.code}>
                    <TableCell className="align-top font-semibold text-[#171717]">
                      {i.diseaseName}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal align-top">
                      <span className="block font-medium text-[#171717]">
                        {i.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#525252]">
                        {i.sourceName} ·{" "}
                        <span className="font-mono text-[11px] text-[#737373]">
                          {i.code}
                        </span>{" "}
                        · {INDICATOR_LABELS[i.indicator]} ({i.unit})
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant={
                          i.caseClassification === "ESTIMATED"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {CLASSIFICATION_LABELS[i.caseClassification]}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top tabular-nums text-[#171717]">
                      {i.latestPeriodStart && i.latestPeriodEnd ? (
                        `${formatDate(i.latestPeriodStart)} – ${formatDate(i.latestPeriodEnd)}`
                      ) : (
                        <span className="text-xs italic text-[#737373]">
                          No data stored
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-right font-medium tabular-nums text-[#171717]">
                      {i.latestPeriodEnd ? (
                        i.countriesInLatestPeriod.toLocaleString("en-US")
                      ) : (
                        <span className="text-[#737373]">–</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top tabular-nums text-xs text-[#525252]">
                      {!i.available ? (
                        <Badge variant="destructive">Withdrawn upstream</Badge>
                      ) : i.lastSuccessfulSync ? (
                        formatDateTime(i.lastSuccessfulSync)
                      ) : (
                        <span className="italic text-[#737373]">Never</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="sources-heading"
        className="flex flex-col gap-3"
      >
        <div className="border-b border-[#E5E5E5] pb-2.5">
          <h2
            id="sources-heading"
            className="text-lg font-semibold tracking-tight text-[#171717]"
          >
            Data sources &amp; attribution
          </h2>
          <p className="text-xs text-[#525252]">
            Upstream public health repositories, licensing terms, and
            synchronization status.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {overview.sources.map((s) => (
            <Card key={s.slug} className="flex flex-col justify-between">
              <CardHeader className="border-b border-[#F5F5F5] pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold text-[#171717]">
                      <a
                        href={s.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline-offset-4 hover:text-[#C23B0A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm"
                      >
                        <span>{s.name}</span>
                        <ArrowUpRight
                          className="size-3.5 text-[#737373]"
                          aria-hidden="true"
                        />
                      </a>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#525252]">
                      {s.organization}
                    </CardDescription>
                  </div>
                  {s.lastJob && <SyncStatusBadge status={s.lastJob.status} />}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-1 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                  <dt className="font-medium text-[#525252]">Licence</dt>
                  <dd className="text-[#171717]">
                    {s.licenseUrl ? (
                      <a
                        href={s.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#C23B0A] underline underline-offset-4 hover:text-[#9A2E06]"
                      >
                        {s.license}
                      </a>
                    ) : (
                      s.license
                    )}
                  </dd>
                  <dt className="font-medium text-[#525252]">Last full sync</dt>
                  <dd className="tabular-nums text-[#171717]">
                    {s.lastSuccessfulSync
                      ? formatDateTime(s.lastSuccessfulSync)
                      : "Not yet completed"}
                  </dd>
                  <dt className="font-medium text-[#525252]">Last attempt</dt>
                  <dd className="tabular-nums text-[#171717]">
                    {s.lastJob ? (
                      <>
                        {formatDateTime(s.lastJob.startedAt)} ·{" "}
                        <span className="font-medium">
                          {s.lastJob.status.charAt(0) +
                            s.lastJob.status.slice(1).toLowerCase()}
                        </span>
                      </>
                    ) : (
                      "Never"
                    )}
                  </dd>
                </dl>
                <p className="border-t border-[#F5F5F5] pt-2.5 text-xs leading-relaxed text-[#525252]">
                  {s.attributionRequirements}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-[#525252]">
          Synchronization polls sources on a schedule. The time of the last sync
          is not the time the data was collected: annual statistics are
          typically published months after the reporting period ends.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  highlight = false,
}: {
  label: string;
  value: number;
  note: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={
        highlight ? "border-t-2 border-t-[#FF5A1F]" : "border-[#E5E5E5]"
      }
    >
      <CardHeader className="pb-1">
        <CardDescription className="text-xs font-semibold uppercase tracking-wider text-[#525252]">
          {label}
        </CardDescription>
        <CardTitle className="mt-1 text-3xl font-semibold tracking-tight text-[#171717] tabular-nums">
          {value.toLocaleString("en-US")}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs leading-relaxed text-[#525252]">
        {note}
      </CardContent>
    </Card>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const variant =
    status === "SUCCEEDED"
      ? "outline"
      : status === "FAILED"
        ? "destructive"
        : "secondary";
  const dotColor =
    status === "SUCCEEDED"
      ? "bg-[#15803D]"
      : status === "FAILED"
        ? "bg-[#B91C1C]"
        : "bg-[#B45309]";

  return (
    <Badge variant={variant} className="gap-1.5">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${dotColor}`}
      />
      <span>
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    </Badge>
  );
}

export function OverviewSkeleton() {
  return (
    <div
      className="flex flex-col gap-10"
      aria-busy="true"
      aria-label="Loading statistics"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-[6px]" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-[6px]" />
    </div>
  );
}