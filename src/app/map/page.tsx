import type { Metadata } from "next";
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5 border-b border-[#E5E5E5] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[#171717] sm:text-3xl">
          Global outbreak map
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[#525252]">
          Explore countries named in official WHO outbreak dispatches alongside
          periodic indicator statistics. All observations link directly to their
          primary source and reporting period.
        </p>
      </header>

      <Suspense
        fallback={
          <div
            className="flex flex-col gap-4"
            aria-busy="true"
            aria-label="Loading map"
          >
            <Skeleton className="h-16 w-full rounded-[6px]" />
            <Skeleton className="h-[60vh] min-h-[360px] w-full rounded-[6px]" />
          </div>
        }
      >
        <MapExplorer searchParams={searchParams} />
      </Suspense>
    </div>
  );
}