import { Suspense } from "react";
import {
  OverviewSection,
  OverviewSkeleton,
} from "@/components/dashboard/overview";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Worldwide Infectious Disease Surveillance
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Publicly available disease statistics from reputable sources, each
          shown with its source, definition and reporting period. Data is
          synchronized periodically and is not real-time. This project is in
          early development: disease, country and outbreak pages are not
          available yet.
        </p>
      </header>
      
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection />
      </Suspense>
    </div>
  );
}
