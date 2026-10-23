import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsonResponse } from "./gho-fixtures";

const DIR = join(__dirname, "..", "fixtures");

export const readFixture = (path: string) => readFileSync(join(DIR, path), "utf8");

/** Real DON items (HTML sections truncated). */
export function donItems(): Record<string, unknown>[] {
  return JSON.parse(readFixture("don/items.json")).value;
}

export const covidCsv = () => readFixture("covid19/WHO-COVID-19-global-data.csv");

/** Serves DON items in pages honouring $top/$skip, optionally failing a page. */
export function donFetchStub(items = donItems(), options: { failSkip?: number } = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const top = Number(url.searchParams.get("$top"));
    const skip = Number(url.searchParams.get("$skip"));
    if (options.failSkip === skip) return new Response("bad gateway", { status: 502 });
    return jsonResponse({ value: items.slice(skip, skip + top) });
  }) as typeof fetch;
}

export function textFetchStub(body: string | number): typeof fetch {
  return (async () =>
    typeof body === "number" ? new Response("error", { status: body }) : new Response(body, { status: 200 })) as typeof fetch;
}
