import worldCountries from "world-countries";

export interface CountryRecord {
  iso2: string;
  iso3: string;
  name: string;
  officialName: string;
  altSpellings: string[];
  region: string | null;
  subregion: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * ISO 3166-1 countries and territories from the `world-countries` dataset
 * (mledoze/countries, ODbL 1.0). User-assigned codes (e.g. XK) are excluded so
 * that every entry carries an officially assigned ISO code.
 */
export function loadCountries(): CountryRecord[] {
  return worldCountries
    .filter((c) => c.status === "officially-assigned" && c.cca2 && c.cca3)
    .map((c) => ({
      iso2: c.cca2.toUpperCase(),
      iso3: c.cca3.toUpperCase(),
      name: c.name.common,
      officialName: c.name.official,
      altSpellings: c.altSpellings ?? [],
      region: c.region || null,
      subregion: c.subregion || null,
      latitude: c.latlng?.[0] ?? null,
      longitude: c.latlng?.[1] ?? null,
    }))
    .sort((a, b) => a.iso3.localeCompare(b.iso3));
}
