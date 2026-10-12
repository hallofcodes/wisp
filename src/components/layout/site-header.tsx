import Link from "next/link";
import { mainNav, siteConfig } from "@/lib/site";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          {siteConfig.name}
          <span className="sr-only"> home</span>
        </Link>
        <ThemeToggle />
      </div>
      <nav aria-label="Main" className="border-t">
        <ul className="mx-auto flex h-10 max-w-6xl items-center gap-5 overflow-x-auto px-4 text-sm">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
