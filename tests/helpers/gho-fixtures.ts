import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IndicatorDefinition } from "@/providers/base/types";
import { GHO_INDICATORS } from "@/providers/who/gho/indicators";
import { type GhoObservation, ghoObservationSchema } from "@/providers/who/gho/schema";

const FIXTURE_DIR = join(__dirname, "..", "fixtures", "gho");

/** Real GHO responses, trimmed to a handful of rows (see tests/fixtures/README.md). */
export function loadGhoFixture(name: string): { value: Record<string, unknown>[] } & Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf8"));
}

export function ghoRows(name: string): GhoObservation[] {
  return loadGhoFixture(name).value.map((row) => ghoObservationSchema.parse(row));
}

export function definitionFor(code: string): IndicatorDefinition {
  const def = GHO_INDICATORS.find((d) => d.code === code);
  if (!def) throw new Error(`No curated definition for ${code}`);
  return def;
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

/**
 * Fetch stub that routes GHO URLs to fixture bodies. `overrides` maps an
 * indicator code (or "Indicator") to a status code or a replacement body.
 */
export function ghoFetchStub(overrides: Record<string, number | object> = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const name = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const override = overrides[name];
    if (typeof override === "number") return new Response("error", { status: override });
    if (override) return jsonResponse(override);
    try {
      return jsonResponse(loadGhoFixture(name));
    } catch {
      return new Response("not found", { status: 404 });
    }
  }) as typeof fetch;
}

/** Curated definitions limited to the indicators that have fixtures. */
export const FIXTURE_INDICATORS = [definitionFor("TB_e_inc_num"), definitionFor("WHS3_50")];
