import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import type { PrismaClient } from "@/generated/prisma/client";
import { acquireLock } from "@/services/ingestion/lock";
import { runSync } from "@/services/ingestion/run-sync";
import { ghoFetchStub, loadGhoFixture } from "../helpers/gho-fixtures";
import { createPrismaClient, migrate, resetDatabase, testDatabaseUrl } from "./setup-db";

const url = testDatabaseUrl();
const PROVIDER = "who-gho";

/** No real waiting in tests. */
function http(fetchImpl: typeof fetch) {
  return {
    fetchImpl,
    minIntervalMs: 0,
    retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    sleep: async () => undefined,
  };
}

describe.skipIf(!url)("GHO sync pipeline (PostgreSQL)", () => {
  let db: PrismaClient;

  beforeAll(() => {
    migrate(url!);
    db = createPrismaClient(url!);
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  const latest = (where: object = {}) =>
    db.diseaseObservation.findMany({ where: { isLatest: true, ...where }, orderBy: { sourceRecordId: "asc" } });

  it("stores observations with provenance and logs the job", async () => {
    const outcome = await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    expect(outcome.status).toBe("SUCCEEDED");
    expect(outcome.result).toMatchObject({ recordsInserted: 17, recordsUpdated: 0 });

    const rows = await latest();
    expect(rows).toHaveLength(17);
    expect(rows.every((r) => r.revision === 1 && r.syncJobId === outcome.jobId)).toBe(true);

    const job = await db.syncJob.findUniqueOrThrow({ where: { id: outcome.jobId } });
    expect(job).toMatchObject({ status: "SUCCEEDED", recordsInserted: 17, trigger: "CLI" });
    expect(job.completedAt).not.toBeNull();

    const source = await db.dataSource.findUniqueOrThrow({ where: { slug: PROVIDER } });
    expect(source.lastSuccessfulSync).not.toBeNull();
    expect(source.license).toContain("CC BY-NC-SA");

    const indicator = await db.sourceIndicator.findFirstOrThrow({ where: { code: "TB_e_inc_num" } });
    expect(indicator).toMatchObject({ caseClassification: "ESTIMATED", unit: "cases", available: true });
    expect(indicator.lastSuccessfulSync).not.toBeNull();

    expect(await db.auditLog.count({ where: { action: "sync.completed", entityId: outcome.jobId } })).toBe(1);
  });

  it("stores missing values as NULL, keeps zeros, and links countries by ISO3", async () => {
    await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    const est = await latest({ geoCode: "EST" });
    expect(est.filter((r) => r.value === null)).toHaveLength(2);
    expect(est.find((r) => r.value !== null)?.value?.toString()).toBe("0");

    const nga = await latest({ geoCode: "NGA", sourceIndicator: { code: "WHS3_50" } });
    const country = await db.country.findUniqueOrThrow({ where: { iso3: "NGA" } });
    expect(nga.every((r) => r.countryId === country.id)).toBe(true);
    expect(nga.map((r) => r.periodStart.toISOString().slice(0, 10)).sort()).toEqual([
      "2022-01-01",
      "2023-01-01",
      "2024-01-01",
    ]);

    const kosovo = await latest({ geoCode: "XKX" });
    expect(kosovo).toHaveLength(1);
    expect(kosovo[0].countryId).toBeNull();

    const regional = await latest({ geoScope: { not: "COUNTRY" } });
    expect(regional.every((r) => r.countryId === null)).toBe(true);
  });

  it("is idempotent: re-running with unchanged data writes nothing", async () => {
    await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    const second = await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    expect(second.result).toMatchObject({ recordsInserted: 0, recordsUpdated: 0, recordsUnchanged: 17 });
    expect(await db.diseaseObservation.count()).toBe(17);
  });

  it("preserves previous values when the source revises a statistic", async () => {
    await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });

    const yf = loadGhoFixture("WHS3_50");
    const revised = {
      ...yf,
      value: yf.value.map((row) =>
        row.SpatialDim === "NGA" && row.TimeDim === 2024 ? { ...row, Value: "25", NumericValue: 25, Id: 999 } : row,
      ),
    };
    const outcome = await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub({ WHS3_50: revised })) });
    expect(outcome.result).toMatchObject({ recordsInserted: 0, recordsUpdated: 1, recordsUnchanged: 16 });

    const history = await db.diseaseObservation.findMany({
      where: { geoCode: "NGA", periodStart: new Date("2024-01-01"), sourceIndicator: { code: "WHS3_50" } },
      orderBy: { revision: "asc" },
    });
    expect(history.map((r) => [r.revision, r.value?.toString(), r.isLatest])).toEqual([
      [1, "22", false],
      [2, "25", true],
    ]);
    expect(history[0].supersededAt).not.toBeNull();
    expect(history[1].syncJobId).toBe(outcome.jobId);
  });

  it("records a failed sync without touching stored data", async () => {
    await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    const before = await db.diseaseObservation.count();
    const source = await db.dataSource.findUniqueOrThrow({ where: { slug: PROVIDER } });

    const failed = await runSync(db, PROVIDER, {
      trigger: "CLI",
      http: http(ghoFetchStub({ TB_e_inc_num: 502, WHS3_50: 502 })),
    });
    expect(failed.status).toBe("FAILED");
    const job = await db.syncJob.findUniqueOrThrow({ where: { id: failed.jobId } });
    expect(job.errorMessage).toBeTruthy();
    expect(await db.diseaseObservation.count()).toBe(before);
    const after = await db.dataSource.findUniqueOrThrow({ where: { slug: PROVIDER } });
    expect(after.lastSuccessfulSync).toEqual(source.lastSuccessfulSync);
  });

  it("records a partial sync per indicator", async () => {
    const outcome = await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub({ WHS3_50: 502 })) });
    expect(outcome.status).toBe("PARTIAL");
    const indicators = await db.sourceIndicator.findMany({ where: { code: { in: ["TB_e_inc_num", "WHS3_50"] } } });
    const synced = Object.fromEntries(indicators.map((i) => [i.code, i.lastSuccessfulSync !== null]));
    expect(synced).toEqual({ TB_e_inc_num: true, WHS3_50: false });
    const source = await db.dataSource.findUniqueOrThrow({ where: { slug: PROVIDER } });
    expect(source.lastSuccessfulSync).toBeNull();
  });

  it("skips a sync while another holds the lock, and recovers abandoned jobs", async () => {
    const source = await db.dataSource.create({
      data: {
        slug: PROVIDER,
        name: "x",
        organization: "x",
        homepageUrl: "https://example.org",
        license: "x",
        attributionRequirements: "x",
      },
    });
    const lock = await acquireLock(db, `sync:${PROVIDER}`, 60_000);
    expect(lock).not.toBeNull();
    expect(await acquireLock(db, `sync:${PROVIDER}`, 60_000)).toBeNull();

    const skipped = await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    expect(skipped.status).toBe("SKIPPED");
    expect(await db.diseaseObservation.count()).toBe(0);
    await lock!.release();

    const abandoned = await db.syncJob.create({ data: { sourceId: source.id, trigger: "SCHEDULED", status: "RUNNING" } });
    const ok = await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    expect(ok.status).toBe("SUCCEEDED");
    const recovered = await db.syncJob.findUniqueOrThrow({ where: { id: abandoned.id } });
    expect(recovered.status).toBe("FAILED");
    expect(recovered.errorMessage).toMatch(/Abandoned/);
    expect(await db.syncLock.count()).toBe(0);
  });

  it("takes over an expired lease", async () => {
    const stale = await acquireLock(db, "sync:test", 1);
    expect(stale).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    const fresh = await acquireLock(db, "sync:test", 60_000);
    expect(fresh).not.toBeNull();
    expect(await stale!.renew()).toBe(false);
    await fresh!.release();
  });

  it("skips disabled sources", async () => {
    await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    await db.dataSource.update({ where: { slug: PROVIDER }, data: { enabled: false } });
    const outcome = await runSync(db, PROVIDER, { trigger: "CLI", http: http(ghoFetchStub()) });
    expect(outcome.status).toBe("SKIPPED");
  });
});
