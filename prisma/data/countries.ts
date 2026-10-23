import { loadCountries as loadCountryRecords } from "../../src/lib/geo/countries";

export type CountrySeed = Pick<
  ReturnType<typeof loadCountryRecords>[number],
  "iso2" | "iso3" | "name" | "region" | "subregion" | "latitude" | "longitude"
>;

/** Country rows for the Country table. */
export function loadCountries(): CountrySeed[] {
  return loadCountryRecords().map(
    ({ iso2, iso3, name, region, subregion, latitude, longitude }) => ({
      iso2,
      iso3,
      name,
      region,
      subregion,
      latitude,
      longitude,
    }),
  );
}
