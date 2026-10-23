import "dotenv/config";
import { createPrismaClient } from "../src/lib/db/client";
import { providers } from "../src/providers/registry";
import { upsertDataSource } from "../src/services/ingestion/run-sync";
import { loadCountries } from "./data/countries";
import { diseases } from "./data/diseases";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const db = createPrismaClient(url);

  try {
    for (const disease of diseases) {
      const { slug, references, ...fields } = disease;
      const data = { ...fields, references: references as unknown as object };
      await db.disease.upsert({
        where: { slug },
        create: { slug, ...data },
        update: data,
      });
    }
    console.log(`[seed] diseases: ${diseases.length}`);

    const countries = loadCountries();
    for (const country of countries) {
      const { iso3, ...fields } = country;
      await db.country.upsert({
        where: { iso3 },
        create: { iso3, ...fields },
        update: fields,
      });
    }
    console.log(`[seed] countries: ${countries.length}`);

    for (const registration of Object.values(providers)) {
      await upsertDataSource(db, registration.descriptor);
    }
    console.log(`[seed] data sources: ${Object.keys(providers).length}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
