// ill make changes here. this is the first changed file
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight } from "lucide-react";
import { mainNav, siteConfig } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm shadow-orange-200">
            <Activity size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-950">
              WIDSP<span className="text-orange-500">.</span>
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              Global disease intelligence
            </span>
          </span>
          <span className="sr-only">{siteConfig.fullName}</span>
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-1 sm:gap-2">
            {mainNav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors sm:px-4 ${
                      active
                        ? "bg-orange-50 text-orange-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <a
          href={siteConfig.repositoryUrl}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-700 md:inline-flex"
        >
          Open source
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
