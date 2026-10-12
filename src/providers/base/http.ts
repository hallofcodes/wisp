export type Sleep = (ms: number) => Promise<void>;

export const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface HttpClientOptions {
  /** Hostnames this client may contact. Anything else is rejected. */
  allowedHosts: string[];
  /** Minimum spacing between request starts, in milliseconds. */
  minIntervalMs: number;
  timeoutMs: number;
  retry: RetryPolicy;
  userAgent: string;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: () => number;
  /** Source of jitter in [0, 1). Injected for deterministic tests. */
  random?: () => number;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Delay before retry number `attempt` (1-based), with full jitter. */
export function backoffDelay(
  attempt: number,
  policy: RetryPolicy,
  random: () => number,
): number {
  const ceiling = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** (attempt - 1),
  );
  return Math.round(ceiling / 2 + (ceiling / 2) * random());
}

/** Parses a Retry-After header (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(
  header: string | null,
  now: number,
): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export class HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: Sleep;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly allowedHosts: Set<string>;
  private nextSlot = 0;

  constructor(private readonly options: HttpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.allowedHosts = new Set(
      options.allowedHosts.map((h) => h.toLowerCase()),
    );
  }

  /** Throws unless the URL is https and its host is allowlisted. */
  assertAllowed(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new HttpError(`Invalid URL: ${rawUrl}`, null, rawUrl);
    }
    if (url.protocol !== "https:") {
      throw new HttpError(`Refusing non-HTTPS URL: ${rawUrl}`, null, rawUrl);
    }
    if (url.username || url.password) {
      throw new HttpError(
        `Refusing URL with credentials: ${url.host}`,
        null,
        rawUrl,
      );
    }
    if (!this.allowedHosts.has(url.hostname.toLowerCase())) {
      throw new HttpError(
        `Host not allowlisted: ${url.hostname}`,
        null,
        rawUrl,
      );
    }
    return url;
  }

  async getJson(rawUrl: string): Promise<unknown> {
    const text = await this.request(rawUrl, "application/json");
    try {
      return JSON.parse(text);
    } catch {
      const url = new URL(rawUrl);
      throw new HttpError(
        `Invalid JSON from ${url.host}${url.pathname}`,
        null,
        url.href,
      );
    }
  }

  async getText(
    rawUrl: string,
    accept = "text/plain, text/csv",
  ): Promise<string> {
    return this.request(rawUrl, accept);
  }

  private async request(rawUrl: string, accept: string): Promise<string> {
    const url = this.assertAllowed(rawUrl);
    const { maxAttempts } = this.options.retry;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.waitForSlot();
      let retryAfterMs: number | null = null;
      try {
        const response = await this.fetchImpl(url, {
          headers: { Accept: accept, "User-Agent": this.options.userAgent },
          // Redirects could point at hosts outside the allowlist.
          redirect: "error",
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
        if (response.ok) {
          return await response.text();
        }
        lastError = new HttpError(
          `HTTP ${response.status} from ${url.host}${url.pathname}`,
          response.status,
          url.href,
        );
        if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
        retryAfterMs = parseRetryAfter(
          response.headers.get("retry-after"),
          this.now(),
        );
      } catch (error) {
        if (
          error instanceof HttpError &&
          error.status !== null &&
          !RETRYABLE_STATUS.has(error.status)
        ) {
          throw error;
        }
        lastError = error;
      }

      if (attempt < maxAttempts) {
        const delay = Math.min(
          this.options.retry.maxDelayMs,
          retryAfterMs ??
            backoffDelay(attempt, this.options.retry, this.random),
        );
        await this.sleep(delay);
      }
    }

    if (lastError instanceof HttpError) throw lastError;
    const reason =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new HttpError(
      `Request failed after ${maxAttempts} attempts: ${reason}`,
      null,
      url.href,
    );
  }

  private async waitForSlot(): Promise<void> {
    const now = this.now();
    const start = Math.max(now, this.nextSlot);
    this.nextSlot = start + this.options.minIntervalMs;
    if (start > now) await this.sleep(start - now);
  }
}
