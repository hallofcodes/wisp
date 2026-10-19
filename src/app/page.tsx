import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import {
  OverviewSection,
  OverviewSkeleton,
} from "@/components/dashboard/overview";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#525252]">
          <span className="inline-flex items-center rounded-[4px] border border-[#E5E5E5] bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#171717]">
            Surveillance Overview
          </span>
          <span aria-hidden="true" className="text-[#D4D4D4]">
            ·
          </span>
          <span>Periodic source synchronization (non-real-time)</span>
        </div>

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[#171717] sm:text-3xl">
              Worldwide Infectious Disease Surveillance
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-[#525252] sm:text-base">
              Publicly available disease statistics and outbreak reports from
              reputable sources, presented with explicit source attribution,
              case classification, and reporting period. This platform is in
              early development: dedicated disease, country, and outbreak pages
              are not available yet.
            </p>
          </div>

          <div className="flex shrink-0 items-center">
            <Link
              href="/map"
              className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-[#FF5A1F] px-3.5 text-xs font-semibold text-[#FFFFFF] transition-colors hover:bg-[#E04812] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-2"
            >
              <span>Explore interactive outbreak map</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection />
      </Suspense>
    </div>
  );
}