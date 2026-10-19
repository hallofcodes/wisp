import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { mainNav, siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#E5E5E5] bg-[#F5F5F5] text-[#525252]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="max-w-xl space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold tracking-tight text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              <span
                aria-hidden="true"
                className="inline-block size-2 rounded-[2px] bg-[#FF5A1F]"
              />
              <span>{siteConfig.name}</span>
              <span className="font-normal text-[#525252]">
                — {siteConfig.fullName}
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-[#525252]">
              {siteConfig.description}
            </p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium"
          >
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[#525252] transition-colors hover:text-[#C23B0A] focus-visible:outline-none focus-visible:underline"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={siteConfig.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#171717] transition-colors hover:text-[#C23B0A] focus-visible:outline-none focus-visible:underline"
            >
              <span>Source code (GitHub)</span>
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </nav>
        </div>

        <div className="mt-6 border-t border-[#E5E5E5] pt-5 space-y-2 text-xs leading-relaxed text-[#525252]">
          <p>
            <strong className="font-semibold text-[#171717]">
              Data &amp; Surveillance Caveat:
            </strong>{" "}
            WIDSP is an open-source epidemiological information and data
            visualization project, not a medical diagnosis tool, and does not
            provide medical advice. Reported surveillance data is subject to
            reporting lag, retrospective revision, and varying national case
            definitions; absence of reported data does not indicate absence of
            disease. Always consult original sources and public health
            authorities.
          </p>
          <p className="text-[#737373]">
            Independent open-source project. WIDSP is not affiliated with,
            endorsed by, or operated by the World Health Organization (WHO) or
            any national health agency.
          </p>
        </div>
      </div>
    </footer>
  );
}