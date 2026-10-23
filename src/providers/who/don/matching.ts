import { type CountryRecord, loadCountries } from "@/lib/geo/countries";
import type { ReportScope } from "@/providers/base/types";

interface DiseaseRule {
  slug: string;
  pattern: RegExp;
}

/** Ordered: the first matching rule wins. */
export const DISEASE_RULES: DiseaseRule[] = [
  {
    slug: "covid-19",
    pattern: /\bCOVID-19\b|\bSARS-CoV-2\b|novel coronavirus \(?2019|2019-nCoV/i,
  },
  {
    slug: "mers",
    pattern: /Middle East respiratory syndrome|\bMERS(-CoV)?\b/i,
  },
  { slug: "influenza", pattern: /influenza|\bH\d{1,2}N\d{1,2}\b/i },
  { slug: "marburg-virus-disease", pattern: /\bMarburg\b/i },
  {
    slug: "ebola-virus-disease",
    pattern:
      /\bEbola\b|Sudan virus disease|Bundibugyo virus|Ta[iï] Forest virus/i,
  },
  { slug: "crimean-congo-haemorrhagic-fever", pattern: /Crimean[- ]Congo/i },
  { slug: "plague", pattern: /\bplague\b/i },
  { slug: "cholera", pattern: /\bcholera\b/i },
  { slug: "measles", pattern: /\bmeasles\b/i },
  { slug: "mpox", pattern: /\bmpox\b|\bmonkeypox\b|\bMPXV\b/i },
  {
    slug: "polio",
    pattern: /\bpolio(myelitis|virus)?\b|\bcVDPV\d?\b|\bWPV\d?\b/i,
  },
  { slug: "yellow-fever", pattern: /\byellow fever\b/i },
  { slug: "dengue", pattern: /\bdengue\b/i },
  { slug: "chikungunya", pattern: /\bchikungunya\b/i },
  { slug: "zika-virus-disease", pattern: /\bzika\b/i },
  { slug: "malaria", pattern: /\bmalaria\b/i },
  { slug: "tuberculosis", pattern: /\btuberculosis\b/i },
  { slug: "nipah-virus-disease", pattern: /\bNipah\b/i },
  { slug: "hantavirus-disease", pattern: /\bhantavirus\b/i },
  { slug: "diphtheria", pattern: /\bdiphtheria\b/i },
  { slug: "rift-valley-fever", pattern: /Rift Valley fever/i },
  { slug: "anthrax", pattern: /\banthrax\b/i },
  { slug: "rabies", pattern: /\brabies\b/i },
  { slug: "meningitis", pattern: /meningococcal|meningitis/i },
  { slug: "lassa-fever", pattern: /\bLassa\b/i },
  { slug: "oropouche-virus-disease", pattern: /\bOropouche\b/i },
];

export function matchDisease(
  title: string,
  knownSlugs?: ReadonlySet<string>,
): { slug: string; span: [number, number] } | null {
  for (const rule of DISEASE_RULES) {
    if (knownSlugs && !knownSlugs.has(rule.slug)) continue;
    const match = rule.pattern.exec(title);
    if (match)
      return {
        slug: rule.slug,
        span: [match.index, match.index + match[0].length],
      };
  }
  return null;
}

/** Names WHO uses that differ from common/official ISO names. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  COD: [
    "Democratic Republic of the Congo",
    "Democratic Republic of Congo",
    "DR Congo",
    "DRC",
  ],
  COG: ["Republic of the Congo", "Republic of Congo", "Congo"],
  TZA: ["United Republic of Tanzania", "Tanzania"],
  USA: ["United States of America", "United States", "USA"],
  GBR: [
    "United Kingdom of Great Britain and Northern Ireland",
    "United Kingdom",
    "UK",
  ],
  SAU: ["Kingdom of Saudi Arabia", "Saudi Arabia"],
  KOR: ["Republic of Korea", "South Korea"],
  PRK: ["Democratic People's Republic of Korea"],
  IRN: ["Iran (Islamic Republic of)", "Islamic Republic of Iran", "Iran"],
  BOL: [
    "Bolivia (Plurinational State of)",
    "Plurinational State of Bolivia",
    "Bolivia",
  ],
  VEN: [
    "Venezuela (Bolivarian Republic of)",
    "Bolivarian Republic of Venezuela",
    "Venezuela",
  ],
  LAO: ["Lao People's Democratic Republic", "Lao PDR", "Laos"],
  VNM: ["Viet Nam", "Vietnam"],
  SYR: ["Syrian Arab Republic", "Syria"],
  RUS: ["Russian Federation", "Russia"],
  MDA: ["Republic of Moldova", "Moldova"],
  TUR: ["Türkiye", "Turkiye", "Turkey"],
  CIV: ["Côte d'Ivoire", "Côte d’Ivoire", "Cote d'Ivoire", "Ivory Coast"],
  CPV: ["Cabo Verde", "Cape Verde"],
  CZE: ["Czechia", "Czech Republic"],
  NLD: ["Netherlands (Kingdom of the)", "Netherlands"],
  REU: ["La Réunion", "Réunion", "Reunion"],
  FSM: ["Micronesia (Federated States of)", "Federated States of Micronesia"],
  PSE: ["occupied Palestinian territory", "Palestine"],
  SWZ: ["Eswatini", "Swaziland"],
  MKD: ["North Macedonia"],
  TLS: ["Timor-Leste", "East Timor"],
  MMR: ["Myanmar", "Burma"],
};

/** Phrases describing a non-country scope, longest first. */
const SCOPE_PATTERNS: { scope: ReportScope; pattern: RegExp }[] = [
  {
    scope: "GLOBAL",
    pattern: /\bglobal(\s+(situation|update))?\b|\bworldwide\b/i,
  },
  {
    scope: "MULTI_COUNTRY",
    pattern: /\bmulti[- ](country|countries|locations?)\b/i,
  },
  {
    scope: "REGION",
    pattern:
      /\b(Region of the Americas|African Region|Eastern Mediterranean Region|European Region|South-East Asia Region|Western Pacific Region|the Americas|Americas|West Africa|Central Africa|East Africa|Southern Africa|Middle East|Europe)\b|\((AFRO|EMRO|EURO|PAHO|AMRO|SEARO|WPRO)\)/i,
  },
];

interface CountryPattern {
  iso3: string;
  pattern: RegExp;
  length: number;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let cachedPatterns: CountryPattern[] | null = null;

function countryPatterns(
  countries: CountryRecord[] = loadCountries(),
): CountryPattern[] {
  if (cachedPatterns) return cachedPatterns;
  const names = new Map<string, string>();
  for (const c of countries) {
    for (const name of [c.name, c.officialName]) {
      if (name.length >= 4) names.set(name, c.iso3);
    }
  }
  for (const [iso3, aliases] of Object.entries(COUNTRY_ALIASES)) {
    for (const alias of aliases) names.set(alias, iso3);
  }
  cachedPatterns = [...names.entries()]
    .map(([name, iso3]) => ({
      iso3,
      // Letters on either side would make this part of a longer word ("Niger" in "Nigeria").
      pattern: new RegExp(
        `(?<![\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`,
        "giu",
      ),
      length: name.length,
    }))
    .sort((a, b) => b.length - a.length);
  return cachedPatterns;
}

/**
 * Strain or subtype named in a title. Reports naming different variants of the
 * same disease (Zaire vs Bundibugyo ebolavirus, H5N1 vs H9N2) describe
 * different events and must not be grouped together.
 */
const VARIANT_PATTERNS: RegExp[] = [
  /\b(Bundibugyo|Sudan|Zaire|Ta[iï] Forest)\b(?= (virus|ebolavirus))/i,
  /\bH\d{1,2}N\d{1,2}\b/i,
  /\bH\d{1,2}\b(?=\))/i,
  /\b(cVDPV|VDPV|WPV)\s*\d?\b/i,
  /\bclade\s+I{1,2}[ab]?\b/i,
  /\bO139\b/i,
];

export function matchVariant(title: string): string | null {
  for (const pattern of VARIANT_PATTERNS) {
    const match = pattern.exec(title);
    if (match)
      return match[0].replace(/\s+/g, "").toLowerCase().replace("ï", "i");
  }
  return null;
}

export interface TitleMatch {
  diseaseSlug: string | null;
  countryIso3s: string[];
  scope: ReportScope;
  scopeLabel: string | null;
  suspected: boolean;
  variant: string | null;
}

/** Text after the last title separator, e.g. "Global situation" in "Cholera – Global situation". */
function trailingPart(title: string): string | null {
  const parts = title.split(/\s[-–—]\s|[-–—]\s|,\s/);
  const last = parts[parts.length - 1]?.trim();
  return parts.length > 1 && last ? last : null;
}

export function matchTitle(
  rawTitle: string,
  knownDiseaseSlugs?: ReadonlySet<string>,
): TitleMatch {
  const title = rawTitle.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim();
  const disease = matchDisease(title, knownDiseaseSlugs);

  // Blank out the disease phrase so names inside it ("Sudan virus disease",
  // "Crimean-Congo") are not read as countries.
  let remaining = disease
    ? title.slice(0, disease.span[0]) +
      " ".repeat(disease.span[1] - disease.span[0]) +
      title.slice(disease.span[1])
    : title;

  const found: string[] = [];
  for (const { iso3, pattern } of countryPatterns()) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(remaining))) {
      if (!found.includes(iso3)) found.push(iso3);
      // Consume the match so shorter names inside it ("Congo") do not match again.
      remaining =
        remaining.slice(0, match.index) +
        " ".repeat(match[0].length) +
        remaining.slice(match.index + match[0].length);
    }
  }

  let scope: ReportScope =
    found.length > 1
      ? "MULTI_COUNTRY"
      : found.length === 1
        ? "COUNTRY"
        : "UNKNOWN";
  let scopeLabel: string | null = null;
  if (found.length === 0) {
    for (const candidate of SCOPE_PATTERNS) {
      if (candidate.pattern.test(remaining)) {
        scope = candidate.scope;
        break;
      }
    }
    scopeLabel = trailingPart(title);
  }

  return {
    diseaseSlug: disease?.slug ?? null,
    countryIso3s: found.sort(),
    scope,
    scopeLabel,
    suspected: /\bsuspected\b/i.test(title),
    variant: matchVariant(title),
  };
}
