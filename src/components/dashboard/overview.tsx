import Link from "next/link";
import { connection } from "next/server";
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
  } catch (error) {
    console.error("Failed to load overview", error);
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Data is temporarily unavailable</CardTitle>
          <CardDescription>
            The database could not be reached. No statistics are shown rather
            than stale or partial ones.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section
        aria-labelledby="summary-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="summary-heading" className="sr-only">
          Summary
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Diseases in catalog"
            value={overview.diseaseCount}
            note="Reference catalog. Inclusion does not indicate an active outbreak."
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reports-heading" className="text-lg font-semibold">
            Latest official outbreak reports
          </h2>
          <Link href="/map" className="text-sm underline underline-offset-4">
            See them on the map
          </Link>
        </div>
        {overview.recentReports.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No outbreak reports synchronized yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {overview.recentReports.map((r) => (
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
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDate(r.publishedAt)}
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
        <div>
          <h2 id="indicators-heading" className="text-lg font-semibold">
            Indicators and data freshness
          </h2>
          <p className="text-sm text-muted-foreground">
            Each indicator is shown separately with its own definition. Values
            are never summed across indicators, sources or case classifications.
          </p>
        </div>
        {overview.indicators.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No source indicators have been synchronized yet. Run{" "}
            <code>npm run sync -- --all</code>.
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disease</TableHead>
                  <TableHead>Indicator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Latest reporting period</TableHead>
                  <TableHead className="text-right">
                    Geographies reporting
                  </TableHead>
                  <TableHead>Last synchronized</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.indicators.map((i) => (
                  <TableRow key={i.code}>
                    <TableCell className="font-medium">
                      {i.diseaseName}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal">
                      <span className="block">{i.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {i.sourceName} · {i.code} ·{" "}
                        {INDICATOR_LABELS[i.indicator]}, {i.unit}
                      </span>
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      {i.latestPeriodStart && i.latestPeriodEnd ? (
                        `${formatDate(i.latestPeriodStart)} – ${formatDate(i.latestPeriodEnd)}`
                      ) : (
                        <span className="text-muted-foreground">
                          No data stored
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.latestPeriodEnd ? i.countriesInLatestPeriod : "–"}
                    </TableCell>
                    <TableCell>
                      {!i.available ? (
                        <Badge variant="destructive">Withdrawn upstream</Badge>
                      ) : i.lastSuccessfulSync ? (
                        formatDateTime(i.lastSuccessfulSync)
                      ) : (
                        <span className="text-muted-foreground">Never</span>
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
        <h2 id="sources-heading" className="text-lg font-semibold">
          Data sources
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {overview.sources.map((s) => (
            <Card key={s.slug}>
              <CardHeader>
                <CardTitle>
                  <a
                    href={s.homepageUrl}
                    className="underline-offset-4 hover:underline"
                  >
                    {s.name}
                  </a>
                </CardTitle>
                <CardDescription>{s.organization}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Licence</dt>
                  <dd>
                    {s.licenseUrl ? (
                      <a
                        href={s.licenseUrl}
                        className="underline underline-offset-4"
                      >
                        {s.license}
                      </a>
                    ) : (
                      s.license
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Last full sync</dt>
                  <dd>
                    {s.lastSuccessfulSync
                      ? formatDateTime(s.lastSuccessfulSync)
                      : "Not yet completed"}
                  </dd>
                  <dt className="text-muted-foreground">Last attempt</dt>
                  <dd>
                    {s.lastJob ? (
                      <>
                        {formatDateTime(s.lastJob.startedAt)} ·{" "}
                        <SyncStatusBadge status={s.lastJob.status} />
                      </>
                    ) : (
                      "Never"
                    )}
                  </dd>
                </dl>
                <p className="text-xs text-muted-foreground">
                  {s.attributionRequirements}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
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
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {value.toLocaleString("en-US")}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
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
  return (
    <Badge variant={variant}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
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
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
