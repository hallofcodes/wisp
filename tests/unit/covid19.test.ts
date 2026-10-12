import { describe, expect, it } from "vitest";
import { HttpClient } from "@/providers/base/http";
import type { DiscoveredIndicator, NormalizedRecord, ObservationSink } from "@/providers/base/types";
import { WhoCovid19Provider, weekEnding } from "@/providers/who/covid19/provider";
import { covidCsv, textFetchStub } from "../helpers/fixtures";

class MemorySink implements ObservationSink {
  records: NormalizedRecord[] = [];
  indicators: DiscoveredIndicator[] = [];
  async registerIndicators(i: DiscoveredIndicator[]) {
    this.indicators = i;
  }
  async writeObservations(r: NormalizedRecord[]) {
    this.records.push(...r);
    return { inserted: r.length, revised: 0, unchanged: 0, skipped: 0, warnings: [] };
  }
  async markIndicatorsSynced() {}
}

function provider(body: string | number) {
  const sink = new MemorySink();
  const http = new HttpClient({
    allowedHosts: ["srhdpeuwpubsa.blob.core.windows.net"],
    minIntervalMs: 0,
    timeoutMs: 1000,
    retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    userAgent: "test",
    fetchImpl: textFetchStub(body),
  });
  return { sink, provider: new WhoCovid19Provider({ http, sink }) };
}

describe("weekEnding", () => {
  it("returns the 7 days ending on the reporting date, across month and year ends", () => {
    expect(weekEnding("2026-09-20")).toEqual({ start: "2026-09-14", end: "2026-09-20" });
    expect(weekEnding("2026-01-04")).toEqual({ start: "2025-12-29", end: "2026-01-04" });
    expect(weekEnding("2024-03-03")).toEqual({ start: "2024-02-26", end: "2024-03-03" });
  });
});

describe("WhoCovid19Provider", () => {
  it("normalizes weekly cases and deaths with blanks as not reported", async () => {
    const { sink, provider: p } = provider(covidCsv());
    const result = await p.sync();
    expect(result.status).toBe("SUCCEEDED");
    expect(sink.records).toHaveLength(14 * 2);

    const fr = sink.records.find((r) => r.sourceRecordId === "New_cases|FR|2026-09-20");
    expect(fr).toMatchObject({
      value: "356",
      countryIso2: "FR",
      geoScope: "COUNTRY",
      periodStart: "2026-09-14",
      periodEnd: "2026-09-20",
      caseClassification: "REPORTED_UNSPECIFIED",
      aggregation: "PERIOD_TOTAL",
    });
    expect(sink.records.find((r) => r.sourceRecordId === "New_deaths|FR|2026-09-20")?.value).toBeNull();
    expect(sink.records.find((r) => r.sourceRecordId === "New_cases|CN|2026-09-20")?.value).toBe("0");
  });

  it("keeps Namibia's NA code and separates international conveyances", async () => {
    const { sink, provider: p } = provider(covidCsv());
    await p.sync();
    expect(sink.records.find((r) => r.geoCode === "NA")).toMatchObject({ countryIso2: "NA", value: null });
    expect(sink.records.find((r) => r.geoCode === "XXJ")).toMatchObject({ geoScope: "OTHER", countryIso2: null });
  });

  it("preserves negative corrections as published", async () => {
    const csv = `${covidCsv().trimEnd()}\n2026-09-27,FR,France,EURO,-12,39062355,,168207\n`;
    const { sink, provider: p } = provider(csv);
    await p.sync();
    expect(sink.records.find((r) => r.sourceRecordId === "New_cases|FR|2026-09-27")?.value).toBe("-12");
  });

  it("skips malformed rows and fails when expected columns are missing", async () => {
    const withBad = `${covidCsv().trimEnd()}\nnot-a-date,FR,France,EURO,1,1,1,1\n`;
    const bad = await provider(withBad).provider.sync();
    expect(bad.recordsSkipped).toBe(1);

    const renamed = await provider(covidCsv().replace("New_cases", "Cases")).provider.sync();
    expect(renamed.status).toBe("FAILED");
    expect(renamed.errorMessage).toMatch(/New_cases/);
  });

  it("reports FAILED when the download fails", async () => {
    const result = await provider(503).provider.sync();
    expect(result.status).toBe("FAILED");
  });
});
