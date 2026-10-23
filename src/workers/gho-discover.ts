import { diseases } from "../../prisma/data/diseases";
import { HttpClient } from "@/providers/base/http";
import { GHO_INDICATORS } from "@/providers/who/gho/indicators";
import { GHO_BASE_URL, GHO_HTTP_DEFAULTS } from "@/providers/who/gho/provider";
import { ghoIndicatorListSchema } from "@/providers/who/gho/schema";
import { USER_AGENT } from "@/providers/registry";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const http = new HttpClient({ ...GHO_HTTP_DEFAULTS, userAgent: USER_AGENT });
  const list = ghoIndicatorListSchema.parse(
    await http.getJson(`${GHO_BASE_URL}/Indicator`),
  ).value;
  const curated = new Set(GHO_INDICATORS.map((i) => i.code));

  for (const disease of diseases) {
    const terms = [disease.name, ...disease.alternativeNames]
      .filter((t) => t.length >= 4 && !t.includes("("))
      .map(escapeRegExp);
    const pattern = new RegExp(`\\b(${terms.join("|")})`, "i");
    const matches = list.filter((i) => pattern.test(i.IndicatorName));
    console.log(`\n${disease.name} (${matches.length})`);
    for (const m of matches) {
      console.log(
        `  ${curated.has(m.IndicatorCode) ? "[curated]" : "         "} ${m.IndicatorCode}  ${m.IndicatorName}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
