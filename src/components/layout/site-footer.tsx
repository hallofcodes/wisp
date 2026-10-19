// this is the second file changes
import Link from "next/link";
import { Activity, Github } from "lucide-react";
import { siteConfig, mainNav } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div className="max-w-md">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-slate-950">
              <Activity size={19} className="text-orange-500" aria-hidden="true" />
              WIDSP<span className="text-orange-500">.</span>
            </Link>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open-source infectious disease surveillance and data
              visualization, bringing public health information into one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-slate-600 transition-colors hover:text-orange-700"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={siteConfig.repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-slate-600 transition-colors hover:text-orange-700"
            >
              <Github size={15} aria-hidden="true" />
              Source code
            </a>
          </div>
        </div>

        <div className="mt-7 border-t border-slate-100 pt-5">
          <p className="text-xs leading-5 text-slate-500">
            WIDSP is an information and data visualization project, not a
            medical diagnosis tool and does not provide medical advice.
            Reported data may be delayed, revised or incomplete. Always consult
            original data sources and local health authorities.
          </p>
        </div>
      </div>
    </footer>
  );
}
