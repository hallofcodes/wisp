// this was the first change i made (personal note. please ignore)
"use client";


import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { mainNav, siteConfig } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = openMenuPath === pathname;

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuPath(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const isRouteActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E5E5] bg-[#FFFFFF]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            onClick={() => setOpenMenuPath(null)}
            className="group flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[#171717] font-mono text-xs font-bold tracking-tighter text-[#FFFFFF] transition-colors group-hover:bg-[#FF5A1F]"
            >
              W
            </span>
            <span className="text-base font-semibold tracking-tight text-[#171717]">
              {siteConfig.name}
            </span>
            <span className="sr-only">{siteConfig.fullName}</span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden md:flex md:items-center md:border-l md:border-[#E5E5E5] md:pl-5"
          >
            <ul className="flex items-center gap-1">
              {mainNav.map((item) => {
                const active = isRouteActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative inline-flex h-9 items-center rounded-[4px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] ${
                        active
                          ? "bg-[#FFF4EF] text-[#171717] font-semibold"
                          : "text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717]"
                      }`}
                    >
                      {item.label}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-2.5 -bottom-[10px] h-[2px] bg-[#FF5A1F]"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={siteConfig.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[#E5E5E5] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#525252] transition-colors hover:border-[#D4D4D4] hover:bg-[#F5F5F5] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <span>Source repository</span>
            <ArrowUpRight className="size-3.5 text-[#737373]" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={() =>
              setOpenMenuPath((prev) => (prev === pathname ? null : pathname))
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="widsp-mobile-navigation"
            aria-label={
              mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            className="inline-flex size-9 items-center justify-center rounded-[4px] border border-[#E5E5E5] bg-[#FFFFFF] text-[#171717] transition-colors hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Menu className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="widsp-mobile-navigation"
          className="border-t border-[#E5E5E5] bg-[#FFFFFF] px-4 py-3 sm:px-6 md:hidden"
        >
          <nav aria-label="Mobile navigation">
            <ul className="flex flex-col gap-1">
              {mainNav.map((item) => {
                const active = isRouteActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpenMenuPath(null)}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-10 items-center justify-between rounded-[4px] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F] ${
                        active
                          ? "border-l-2 border-[#FF5A1F] bg-[#FFF4EF] font-semibold text-[#171717]"
                          : "text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717]"
                      }`}
                    >
                      <span>{item.label}</span>
                      {active && (
                        <span className="text-[11px] font-medium uppercase tracking-wider text-[#C23B0A]">
                          Current
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 border-t border-[#E5E5E5] pt-3">
              <a
                href={siteConfig.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-9 items-center justify-between rounded-[4px] px-3 py-1.5 text-xs font-medium text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
              >
                <span>Open-source GitHub repository</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
