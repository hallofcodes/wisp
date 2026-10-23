import { describe, expect, it, vi } from "vitest";
import { backoffDelay, HttpClient, HttpError, parseRetryAfter, type HttpClientOptions } from "@/providers/base/http";
import { jsonResponse } from "../helpers/gho-fixtures";

function client(fetchImpl: typeof fetch, overrides: Partial<HttpClientOptions> = {}) {
  let clock = 0;
  const sleeps: number[] = [];
  const http = new HttpClient({
    allowedHosts: ["api.example.org"],
    minIntervalMs: 0,
    timeoutMs: 1_000,
    retry: { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 1_000 },
    userAgent: "test",
    fetchImpl,
    random: () => 0.5,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    ...overrides,
  });
  return { http, sleeps };
}

const ok = () => jsonResponse({ ok: true });

describe("HttpClient SSRF protection", () => {
  const fetchImpl = vi.fn(async () => ok()) as unknown as typeof fetch;
  const { http } = client(fetchImpl);

  it.each([
    "http://api.example.org/x",
    "https://evil.example.com/x",
    "https://169.254.169.254/latest/meta-data",
    "https://user:pass@api.example.org/x",
    "file:///etc/passwd",
    "not a url",
  ])("rejects %s", async (url) => {
    await expect(http.getJson(url)).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses to follow redirects", async () => {
    const spy = vi.fn(async (_url: URL, init: RequestInit) => {
      expect(init.redirect).toBe("error");
      return ok();
    });
    await client(spy as unknown as typeof fetch).http.getJson("https://api.example.org/x");
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("HttpClient retries", () => {
  it("retries 502 responses with exponential backoff, then succeeds", async () => {
    const responses = [new Response("", { status: 502 }), new Response("", { status: 502 }), ok()];
    const fetchImpl = vi.fn(async () => responses.shift()!) as unknown as typeof fetch;
    const { http, sleeps } = client(fetchImpl);
    await expect(http.getJson("https://api.example.org/x")).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([75, 150]);
  });

  it("does not retry client errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const { http } = client(fetchImpl);
    await expect(http.getJson("https://api.example.org/x")).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("retries network errors and gives up after maxAttempts", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const { http } = client(fetchImpl);
    await expect(http.getJson("https://api.example.org/x")).rejects.toThrow(/after 4 attempts/);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("honours Retry-After on 429, capped at maxDelayMs", async () => {
    const responses = [new Response("", { status: 429, headers: { "retry-after": "60" } }), ok()];
    const fetchImpl = vi.fn(async () => responses.shift()!) as unknown as typeof fetch;
    const { http, sleeps } = client(fetchImpl);
    await http.getJson("https://api.example.org/x");
    expect(sleeps).toEqual([1_000]);
  });

  it("reports invalid JSON without retrying", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    const { http } = client(fetchImpl);
    await expect(http.getJson("https://api.example.org/x")).rejects.toThrow(/Invalid JSON/);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("HttpClient rate limiting", () => {
  it("spaces consecutive requests by minIntervalMs", async () => {
    const fetchImpl = vi.fn(async () => ok()) as unknown as typeof fetch;
    const { http, sleeps } = client(fetchImpl, { minIntervalMs: 500 });
    await http.getJson("https://api.example.org/a");
    await http.getJson("https://api.example.org/b");
    await http.getJson("https://api.example.org/c");
    expect(sleeps).toEqual([500, 500]);
  });
});

describe("backoff helpers", () => {
  const policy = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 5_000 };
  it("grows exponentially and is capped", () => {
    expect(backoffDelay(1, policy, () => 1)).toBe(1_000);
    expect(backoffDelay(2, policy, () => 1)).toBe(2_000);
    expect(backoffDelay(10, policy, () => 1)).toBe(5_000);
    expect(backoffDelay(1, policy, () => 0)).toBe(500);
  });

  it("parses Retry-After seconds and dates", () => {
    expect(parseRetryAfter("3", 0)).toBe(3_000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 0)).toBe(10_000);
    expect(parseRetryAfter("soon", 0)).toBeNull();
    expect(parseRetryAfter(null, 0)).toBeNull();
  });
});
