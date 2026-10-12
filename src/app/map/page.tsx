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
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Global outbreak map
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Countries named in official WHO outbreak reports, and reported
          statistics such as weekly COVID-19 cases. Everything shown links back
          to its source. Data is synchronized periodically and is not real-time.
        </p>
      </header>
      <Suspense
        fallback={
          <div
            className="flex flex-col gap-4"
            aria-busy="true"
            aria-label="Loading map"
          >
            <Skeleton className="h-16" />
            <Skeleton className="h-[60vh] min-h-[360px]" />
          </div>
        }
      >
        <MapExplorer searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
