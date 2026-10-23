import "dotenv/config";
import { createPrismaClient } from "@/lib/db/client";
import { providers } from "@/providers/registry";
import { runSync } from "@/services/ingestion/run-sync";

async function main() {
  const args = process.argv.slice(2);
  const ids = args.includes("--all")
    ? Object.keys(providers)
    : args.filter((a) => !a.startsWith("-"));
  if (ids.length === 0) {
    console.error(
      `Usage: npm run sync -- <provider-id...> | --all\nProviders: ${Object.keys(providers).join(", ")}`,
    );
    process.exitCode = 2;
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const db = createPrismaClient(url);

  let failed = false;
  try {
    for (const id of ids) {
      console.log(`[sync] ${id}: starting`);
      const outcome = await runSync(db, id, { trigger: "CLI" });
      const r = outcome.result;
      console.log(
        `[sync] ${id}: ${outcome.status} (job ${outcome.jobId})` +
          (r
            ? ` processed=${r.recordsProcessed} inserted=${r.recordsInserted} revised=${r.recordsUpdated} unchanged=${r.recordsUnchanged} skipped=${r.recordsSkipped}`
            : ""),
      );
      for (const w of r?.warnings ?? [])
        console.warn(`[sync] ${id}: warning ${w.code}: ${w.message}`);
      if (r?.errorMessage)
        console.error(`[sync] ${id}: error: ${r.errorMessage}`);
      if (outcome.status === "FAILED") failed = true;
    }
  } finally {
    await db.$disconnect();
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
