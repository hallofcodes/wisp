import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MapExplorer } from "@/components/maps/map-explorer";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Global outbreak map",
  description:
    "Interactive world map of countries named in WHO Disease Outbreak News reports, and of reported disease statistics, with source attribution.",
  alternates: { canonical: "/map" },
};

export default function MapPage({ searchParams }: PageProps<"/map">) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-3 border-b border-[#E5E5E5] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-[#525252]">
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E5E5E5] bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#171717]">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[#FF5A1F]"
              />
              Geographic Surveillance Explorer
            </span>
            <span aria-hidden="true" className="text-[#D4D4D4]">
              ·
            </span>
            <span>Source-linked reports &amp; country indicators</span>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-[#C23B0A] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] rounded-sm"
          >
            ← Back to overview &amp; indicator catalog
          </Link>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-[#171717] sm:text-3xl">
            Global outbreak map
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#525252] sm:text-base">
            Countries named in official WHO Disease Outbreak News reports, and
            country-level reported statistics such as weekly COVID-19 cases.
            Every highlighted geography links back to its underlying source and
            reporting period. Data is synchronized periodically and is not
            real-time.
          </p>
        </div>
      </header>

      <Suspense
        fallback={
          <div
            className="flex flex-col gap-4"
            aria-busy="true"
            aria-label="Loading map"
          >
            <Skeleton className="h-20 w-full rounded-[6px]" />
            <Skeleton className="h-[60vh] min-h-[360px] w-full rounded-[6px]" />
          </div>
        }
      >
        <MapExplorer searchParams={searchParams} />
      </Suspense>
    </div>
  );
}