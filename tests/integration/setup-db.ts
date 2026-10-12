import { execFileSync } from "node:child_process";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db/client";
import { loadCountries } from "../../prisma/data/countries";
import { diseases } from "../../prisma/data/diseases";

/** Returns TEST_DATABASE_URL if it is safe to wipe, otherwise null (tests skip). */
export function testDatabaseUrl(): string | null {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return null;
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(name) || url === process.env.DATABASE_URL) {
    throw new Error(`Refusing to use "${name}" as a test database: its name must contain "test".`);
  }
  return url;
}

export function migrate(url: string): void {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

const TABLES = [
  "AuditLog",
  "DiseaseObservation",
  "SyncJob",
  "SyncLock",
  "SourceIndicator",
  "OutbreakReport",
  "OutbreakLocation",
  "Outbreak",
  "DataSource",
  "Country",
  "Disease",
];

/** Empties every table and loads reference metadata (no observations). */
export async function resetDatabase(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
  await db.disease.createMany({
    data: diseases.map(({ references, ...d }) => ({ ...d, references: references as unknown as object })),
  });
  await db.country.createMany({ data: loadCountries() });
}

export { createPrismaClient };
