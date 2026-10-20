import { Suspense } from "react";
import {
  OverviewSection,
  OverviewSkeleton,
} from "@/components/dashboard/overview";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-col gap-2 border-b border-[#E5E5E5] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-[#171717] sm:text-3xl">
          Worldwide Infectious Disease Surveillance
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#525252] sm:text-base">
          Publicly available disease statistics from reputable sources, each
          shown with its source, definition, and reporting period. Data is
          synchronized periodically and is not real-time.
        </p>
      </header>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection />
      </Suspense>
    </div>
  );
}