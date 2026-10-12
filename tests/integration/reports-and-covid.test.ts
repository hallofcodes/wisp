import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import type { PrismaClient } from "@/generated/prisma/client";
import { getIndicatorMap, getIndicatorOptions, getReportActivity } from "@/lib/map/data";
import { donItemSchema, normalizeDonItem } from "@/providers/who/don/provider";
import { PrismaReportSink } from "@/services/ingestion/prisma-report-sink";
import { runSync } from "@/services/ingestion/run-sync";
import { covidCsv, donFetchStub, donItems, textFetchStub } from "../helpers/fixtures";
import { createPrismaClient, migrate, resetDatabase, testDatabaseUrl } from "./setup-db";

const url = testDatabaseUrl();
const http = (fetchImpl: typeof fetch) => ({
  fetchImpl,
  minIntervalMs: 0,
  retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
  sleep: async () => undefined,
});

describe.skipIf(!url)("WHO Disease Outbreak News and COVID-19 pipelines (PostgreSQL)", () => {
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

  it("stores reports, derives outbreaks with country-level locations, and is idempotent", async () => {
    const first = await runSync(db, "who-don", { trigger: "CLI", http: http(donFetchStub()) });
    expect(first.status).toBe("SUCCEEDED");
    expect(first.result?.recordsInserted).toBe(6);

    const ebola = await db.outbreak.findMany({
      where: { disease: { slug: "ebola-virus-disease" } },
      include: { locations: { include: { country: true } }, reports: true },
      orderBy: { firstReportedAt: "asc" },
    });
    // 2025 Ebola (Zaire) and 2026 Bundibugyo are distinct outbreaks.
    expect(ebola.map((o) => o.slug)).toEqual([
      "ebola-virus-disease-cod-2025-12-01",
      "ebola-virus-disease-bundibugyo-cod-uga-2026-07-17",
    ]);
    const bundibugyo = ebola[1];
    expect(bundibugyo.status).toBe("REPORTED");
    expect(bundibugyo.locations.map((l) => l.country?.iso3).sort()).toEqual(["COD", "UGA"]);
    expect(bundibugyo.locations.every((l) => l.latitude === null && l.locationPrecision === "COUNTRY")).toBe(true);
    expect(bundibugyo.reports).toHaveLength(2);

    const global = await db.outbreak.findFirstOrThrow({ where: { disease: { slug: "covid-19" } }, include: { locations: true } });
    expect(global.locations).toEqual([expect.objectContaining({ countryId: null, locationPrecision: "REGION", regionName: "Global Situation" })]);

    const unmatched = await db.outbreakReport.findFirstOrThrow({ where: { displayId: "2026-DON596" } });
    expect(unmatched.outbreakId).toBeNull();

    const second = await runSync(db, "who-don", { trigger: "CLI", http: http(donFetchStub()) });
    expect(second.result).toMatchObject({ recordsInserted: 0, recordsUpdated: 0, recordsUnchanged: 6 });
    expect(await db.outbreak.count()).toBe(4);
  });

  it("leaves outbreaks untouched when the report history is incomplete", async () => {
    await runSync(db, "who-don", { trigger: "CLI", http: http(donFetchStub()) });
    const before = await db.outbreak.findMany({ orderBy: { slug: "asc" }, select: { slug: true, lastReportedAt: true } });
    const source = await db.dataSource.findUniqueOrThrow({ where: { slug: "who-don" } });

    const sink = new PrismaReportSink(db, source.id);
    const reports = donItems().slice(0, 1).map((item) => normalizeDonItem(donItemSchema.parse(item)));
    const stats = await sink.writeReports(reports, { complete: false });

    expect(stats.warnings.map((w) => w.code)).toContain("INCOMPLETE_FETCH");
    expect(await db.outbreak.findMany({ orderBy: { slug: "asc" }, select: { slug: true, lastReportedAt: true } })).toEqual(before);
  });

  it("never deletes stored reports when a later history is shorter", async () => {
    await runSync(db, "who-don", { trigger: "CLI", http: http(donFetchStub()) });
    await runSync(db, "who-don", { trigger: "CLI", http: http(donFetchStub(donItems().slice(0, 2))) });
    expect(await db.outbreakReport.count()).toBe(6);
  });

  it("attributes each report only to the countries it names", async () => {
    await runSync(db, "who-don", { trigger: "CLI", http: http(donFetchStub()) });
    const activity = await getReportActivity(db, 365, undefined, new Date("2026-10-10T00:00:00Z"));
    const byIso = Object.fromEntries(activity.countries.map((c) => [c.iso3, c]));
    expect(byIso.COD.latest.displayId).toBe("2026-DON619");
    expect(byIso.COD.tier).toBe(1);
    // Uganda's latest report is the July one that names it, not October's DRC-only report.
    expect(byIso.UGA.latest.displayId).toBe("2026-DON613");
    expect(byIso.UGA.tier).toBe(3);
    expect(activity.otherReports.map((r) => r.displayId)).toEqual(expect.arrayContaining(["2026-DON596"]));

    const plague = await getReportActivity(db, 3650, "plague", new Date("2026-10-10T00:00:00Z"));
    expect(plague.countries.map((c) => [c.iso3, c.tier])).toEqual([["MDG", 4]]);
  });

  it("stores weekly COVID-19 counts linked by ISO2 and serves them to the map", async () => {
    const outcome = await runSync(db, "who-covid19", { trigger: "CLI", http: http(textFetchStub(covidCsv())) });
    expect(outcome.status).toBe("SUCCEEDED");
    expect(await db.diseaseObservation.count()).toBe(28);

    const namibia = await db.diseaseObservation.findFirstOrThrow({ where: { geoCode: "NA" }, include: { country: true } });
    expect(namibia.country?.name).toBe("Namibia");
    expect(namibia.value).toBeNull();
    expect(await db.diseaseObservation.count({ where: { geoCode: { in: ["XK", "XXJ"] }, countryId: null } })).toBe(8);

    const options = await getIndicatorOptions(db);
    const cases = options.find((o) => o.label.includes("cases"))!;
    const map = await getIndicatorMap(db, options, cases.id, undefined);
    expect(map?.period).toEqual({ start: "2026-09-14", end: "2026-09-20" });
    const values = Object.fromEntries(map!.values.map((v) => [v.iso3, v.value]));
    expect(values).toMatchObject({ FRA: 356, CHN: 0, NAM: null });
    expect(values.USA).toBeNull();
  });
});
