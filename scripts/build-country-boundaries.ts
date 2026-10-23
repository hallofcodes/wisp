import { writeFileSync } from "node:fs";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson";

type Position = number[];
type Coordinates = Position | Coordinates[];

function round(coords: Coordinates): Coordinates {
  if (typeof coords[0] === "number")
    return (coords as Position).map((n) => Math.round(n * 100) / 100);
  return (coords as Coordinates[]).map(round);
}

/** Natural Earth uses -99 when ISO_A3 is unassigned (e.g. France, Norway in some releases). */
function iso3(props: Record<string, string>): string | null {
  for (const key of ["ISO_A3", "ISO_A3_EH", "ADM0_A3"]) {
    const value = props[key];
    if (value && /^[A-Z]{3}$/.test(value)) return value;
  }
  return null;
}

async function main() {
  const response = await fetch(SOURCE);
  if (!response.ok)
    throw new Error(`HTTP ${response.status} fetching ${SOURCE}`);
  const source = (await response.json()) as {
    features: {
      properties: Record<string, string>;
      geometry: { type: string; coordinates: Coordinates };
    }[];
  };

  const features = source.features
    .map((f) => ({ code: iso3(f.properties), f }))
    .filter(
      (x): x is { code: string; f: (typeof source.features)[number] } =>
        x.code !== null,
    )
    .map(({ code, f }) => ({
      type: "Feature",
      id: code,
      properties: { iso3: code, name: f.properties.NAME },
      geometry: {
        type: f.geometry.type,
        coordinates: round(f.geometry.coordinates),
      },
    }));

  writeFileSync(
    "public/geo/countries.geojson",
    JSON.stringify({
      type: "FeatureCollection",
      // Attribution travels with the file.
      attribution:
        "Made with Natural Earth (public domain). Boundaries are illustrative and do not imply any position on territorial claims.",
      features,
    }),
  );
  console.log(`Wrote ${features.length} features`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
