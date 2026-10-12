import { describe, expect, it } from "vitest";
import { HttpClient } from "@/providers/base/http";
import type { DiscoveredIndicator, NormalizedRecord, ObservationSink } from "@/providers/base/types";
import { WhoGhoProvider } from "@/providers/who/gho/provider";
import { definitionFor, FIXTURE_INDICATORS, ghoFetchStub, loadGhoFixture } from "../helpers/gho-fixtures";

class MemorySink implements ObservationSink {
  indicators: DiscoveredIndicator[] = [];
  records: NormalizedRecord[] = [];
  synced: string[] = [];
  async registerIndicators(indicators: DiscoveredIndicator[]) {
    this.indicators = indicators;
  }
  async writeObservations(records: NormalizedRecord[]) {
    this.records.push(...records);
    return { inserted: records.length, revised: 0, unchanged: 0, skipped: 0, warnings: [] };
  }
  async markIndicatorsSynced(codes: string[]) {
    this.synced.push(...codes);
  }
}

function provider(fetchImpl: typeof fetch, indicators = FIXTURE_INDICATORS) {
  const sink = new MemorySink();
  const http = new HttpClient({
    allowedHosts: ["ghoapi.azureedge.net"],
    minIntervalMs: 0,
    timeoutMs: 1_000,
    retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    userAgent: "test",
    fetchImpl,
    sleep: async () => undefined,
  });
  return { sink, provider: new WhoGhoProvider({ http, sink, indicators }) };
}

describe("WhoGhoProvider", () => {
  it("syncs all curated indicators from fixtures", async () => {
    const { sink, provider: p } = provider(ghoFetchStub());
    const result = await p.sync();
    expect(result.status).toBe("SUCCEEDED");
    expect(result.recordsInserted).toBe(17);
    expect(sink.synced.sort()).toEqual(["TB_e_inc_num", "WHS3_50"]);
    expect(sink.indicators.find((i) => i.code === "WHS3_50")?.upstreamName).toBe(
      "Yellow fever - number of reported cases",
    );
  });

  it("reports PARTIAL and keeps going when one indicator keeps failing", async () => {
    const { sink, provider: p } = provider(ghoFetchStub({ WHS3_50: 502 }));
    const result = await p.sync();
    expect(result.status).toBe("PARTIAL");
    expect(sink.synced).toEqual(["TB_e_inc_num"]);
    expect(sink.records.every((r) => r.sourceIndicatorCode === "TB_e_inc_num")).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain("INDICATOR_FETCH_FAILED");
  });

  it("reports FAILED when no indicator can be fetched", async () => {
    const { provider: p } = provider(ghoFetchStub({ WHS3_50: 503, TB_e_inc_num: 503 }));
    const result = await p.sync();
    expect(result.status).toBe("FAILED");
    expect(result.recordsInserted).toBe(0);
  });

  it("skips curated indicators that are no longer listed upstream", async () => {
    const list = loadGhoFixture("Indicator");
    const withoutYf = { ...list, value: list.value.filter((i) => i.IndicatorCode !== "WHS3_50") };
    const { sink, provider: p } = provider(ghoFetchStub({ Indicator: withoutYf }));
    const result = await p.sync();
    expect(result.status).toBe("SUCCEEDED");
    expect(sink.indicators.find((i) => i.code === "WHS3_50")?.available).toBe(false);
    expect(result.warnings.map((w) => w.code)).toContain("INDICATOR_UNAVAILABLE");
  });

  it("still syncs curated indicators when discovery fails", async () => {
    const { sink, provider: p } = provider(ghoFetchStub({ Indicator: 502 }));
    const result = await p.sync();
    expect(result.status).toBe("SUCCEEDED");
    expect(sink.records).toHaveLength(17);
    expect(sink.indicators.every((i) => i.upstreamName === null)).toBe(true);
  });

  it("skips rows that fail schema validation", async () => {
    const tb = loadGhoFixture("TB_e_inc_num");
    const broken = { ...tb, value: [...tb.value, { IndicatorCode: "TB_e_inc_num", NumericValue: "lots" }] };
    const { provider: p } = provider(ghoFetchStub({ TB_e_inc_num: broken }), [definitionFor("TB_e_inc_num")]);
    const result = await p.sync();
    expect(result.recordsInserted).toBe(7);
    expect(result.recordsSkipped).toBe(1);
  });

  it("follows OData nextLink pagination", async () => {
    const tb = loadGhoFixture("TB_e_inc_num");
    const page1 = { value: tb.value.slice(0, 3), "@odata.nextLink": "https://ghoapi.azureedge.net/api/TB_page2" };
    const page2 = { value: tb.value.slice(3) };
    const { sink, provider: p } = provider(ghoFetchStub({ TB_e_inc_num: page1, TB_page2: page2 }), [
      definitionFor("TB_e_inc_num"),
    ]);
    await p.sync();
    expect(sink.records).toHaveLength(7);
  });

  it("refuses pagination links to other hosts", async () => {
    const tb = loadGhoFixture("TB_e_inc_num");
    const page1 = { value: tb.value.slice(0, 3), "@odata.nextLink": "https://attacker.example/next" };
    const { provider: p } = provider(ghoFetchStub({ TB_e_inc_num: page1 }), [definitionFor("TB_e_inc_num")]);
    const result = await p.sync();
    expect(result.status).toBe("FAILED");
    expect(result.warnings[0].message).toMatch(/not allowlisted/);
  });
});
