import { describe, expect, it } from "vitest";
import { HttpClient } from "@/providers/base/http";
import type { NormalizedOutbreakReport, ReportSink } from "@/providers/base/types";
import { WhoDonProvider } from "@/providers/who/don/provider";
import { donFetchStub, donItems } from "../helpers/fixtures";

class MemoryReportSink implements ReportSink {
  reports: NormalizedOutbreakReport[] = [];
  complete: boolean | null = null;
  async writeReports(reports: NormalizedOutbreakReport[], options: { complete: boolean }) {
    this.reports = reports;
    this.complete = options.complete;
    return { inserted: reports.length, revised: 0, unchanged: 0, skipped: 0, warnings: [] };
  }
}

function provider(fetchImpl: typeof fetch) {
  const sink = new MemoryReportSink();
  const http = new HttpClient({
    allowedHosts: ["www.who.int"],
    minIntervalMs: 0,
    timeoutMs: 1000,
    retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    userAgent: "test",
    fetchImpl,
  });
  return { sink, provider: new WhoDonProvider({ http, sink }) };
}

/** 250 items so pagination spans three pages. */
function manyItems() {
  const base = donItems()[0];
  return Array.from({ length: 250 }, (_, i) => ({ ...base, Id: `id-${i}`, UrlName: `item-${i}` }));
}

describe("WhoDonProvider", () => {
  it("normalizes real reports with links, dates, disease and countries", async () => {
    const { sink, provider: p } = provider(donFetchStub());
    const result = await p.sync();
    expect(result.status).toBe("SUCCEEDED");
    expect(sink.complete).toBe(true);

    const latest = sink.reports.find((r) => r.displayId === "2026-DON619")!;
    expect(latest).toMatchObject({
      diseaseSlug: "ebola-virus-disease",
      countryIso3s: ["COD"],
      variant: "bundibugyo",
      sourceUrl: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON619",
    });
    expect(latest.publishedAt.toISOString().slice(0, 10)).toBe("2026-10-08");
    expect(latest.contentSummary).not.toMatch(/<[a-z]/i);

    const plague = sink.reports.find((r) => r.displayId === "2021-DON338")!;
    expect(plague).toMatchObject({ diseaseSlug: "plague", countryIso3s: ["MDG"] });
    expect(plague.sourceUrl).toBe("https://www.who.int/emergencies/disease-outbreak-news/item/plague---madagascar");
    expect(plague.contentSummary).toMatch(/pneumonic plague/);

    expect(sink.reports.find((r) => r.displayId === "2026-DON596")?.diseaseSlug).toBeNull();
    expect(result.warnings.map((w) => w.code)).toContain("UNMATCHED_DISEASE");
  });

  it("pages through all items", async () => {
    const { sink, provider: p } = provider(donFetchStub(manyItems()));
    await p.sync();
    expect(sink.reports).toHaveLength(250);
  });

  it("marks an interrupted fetch incomplete so outbreaks are not rebuilt", async () => {
    const { sink, provider: p } = provider(donFetchStub(manyItems(), { failSkip: 100 }));
    const result = await p.sync();
    expect(result.status).toBe("PARTIAL");
    expect(sink.complete).toBe(false);
    expect(sink.reports).toHaveLength(100);
  });

  it("rejects URL slugs that could change the link path", async () => {
    const items = donItems().map((item, i) => (i === 0 ? { ...item, UrlName: "../../evil" } : item));
    const { sink, provider: p } = provider(donFetchStub(items));
    const result = await p.sync();
    expect(result.recordsSkipped).toBe(1);
    expect(sink.reports.every((r) => r.sourceUrl.startsWith("https://www.who.int/emergencies/disease-outbreak-news/item/"))).toBe(true);
  });

  it("encodes slugs containing parentheses and non-ASCII characters", async () => {
    const items = [{ ...donItems()[0], UrlName: "avian-influenza-a(h5n1)-ｰ-india" }];
    const { sink, provider: p } = provider(donFetchStub(items));
    await p.sync();
    expect(sink.reports[0].sourceUrl).toBe(
      "https://www.who.int/emergencies/disease-outbreak-news/item/avian-influenza-a(h5n1)-%EF%BD%B0-india",
    );
  });

  it("fails when nothing can be fetched", async () => {
    const { provider: p } = provider(donFetchStub(donItems(), { failSkip: 0 }));
    expect((await p.sync()).status).toBe("FAILED");
  });
});
