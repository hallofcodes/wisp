export const siteConfig = {
  name: "WIDSP",
  fullName: "Worldwide Infectious Disease Surveillance Platform",
  tagline: "Track outbreaks. Understand trends. Stay informed.",
  description:
    "An open-source platform that aggregates publicly available infectious disease surveillance data from reputable sources, with full source attribution.",
  repositoryUrl: "https://github.com/hallofcodes/worldwide-infectious-disease-surveillance-platform",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/** Primary navigation. Only routes that exist are listed. */
export const mainNav: { href: string; label: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/map", label: "Map" },
];
