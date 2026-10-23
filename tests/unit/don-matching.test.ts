import { describe, expect, it } from "vitest";
import { matchTitle, matchVariant } from "@/providers/who/don/matching";

describe("matchTitle", () => {
  it.each([
    ["Ebola disease caused by Bundibugyo virus - Democratic Republic of the Congo", "ebola-virus-disease", ["COD"], "COUNTRY"],
    ["Ebola disease caused by Bundibugyo virus, Democratic Republic of the Congo & Uganda", "ebola-virus-disease", ["COD", "UGA"], "MULTI_COUNTRY"],
    ["Sudan virus disease – Uganda", "ebola-virus-disease", ["UGA"], "COUNTRY"],
    ["Crimean-Congo haemorrhagic fever - Iraq", "crimean-congo-haemorrhagic-fever", ["IRQ"], "COUNTRY"],
    ["Plague - Madagascar", "plague", ["MDG"], "COUNTRY"],
    ["Seychelles – Suspected Plague (Ex- Madagascar)", "plague", ["MDG", "SYC"], "MULTI_COUNTRY"],
    ["Avian Influenza A(H5N1)- Lao People’s Democratic Republic", "influenza", ["LAO"], "COUNTRY"],
    ["Marburg virus disease– United Republic of Tanzania", "marburg-virus-disease", ["TZA"], "COUNTRY"],
    ["Middle East respiratory syndrome coronavirus - Kingdom of Saudi Arabia", "mers", ["SAU"], "COUNTRY"],
    ["Chikungunya - La Réunion and Mayotte", "chikungunya", ["MYT", "REU"], "MULTI_COUNTRY"],
    ["Cholera - Niger", "cholera", ["NER"], "COUNTRY"],
    ["Cholera - Nigeria", "cholera", ["NGA"], "COUNTRY"],
    ["Measles - Republic of the Congo", "measles", ["COG"], "COUNTRY"],
  ])("%s", (title, disease, countries, scope) => {
    const m = matchTitle(title);
    expect(m.diseaseSlug).toBe(disease);
    expect(m.countryIso3s).toEqual(countries);
    expect(m.scope).toBe(scope);
  });

  it("identifies non-country scopes", () => {
    expect(matchTitle("COVID-19 - Global Situation")).toMatchObject({ scope: "GLOBAL", scopeLabel: "Global Situation", countryIso3s: [] });
    expect(matchTitle("Measles – Region of the Americas")).toMatchObject({ scope: "REGION", scopeLabel: "Region of the Americas" });
    expect(matchTitle("Hantavirus cluster linked to cruise ship travel, Multi-country")).toMatchObject({
      diseaseSlug: "hantavirus-disease",
      scope: "MULTI_COUNTRY",
    });
  });

  it("leaves unknown diseases unmatched rather than guessing", () => {
    expect(matchTitle("Undiagnosed disease – Democratic Republic of the Congo").diseaseSlug).toBeNull();
    expect(matchTitle("Plague - Madagascar", new Set(["cholera"])).diseaseSlug).toBeNull();
  });

  it("flags suspected events", () => {
    expect(matchTitle("Suspected plague in the Democratic Republic of the Congo").suspected).toBe(true);
    expect(matchTitle("Plague - Madagascar").suspected).toBe(false);
  });
});

describe("matchVariant", () => {
  it("extracts strains and subtypes", () => {
    expect(matchVariant("Ebola disease caused by Bundibugyo virus - DRC")).toBe("bundibugyo");
    expect(matchVariant("Sudan virus disease – Uganda")).toBe("sudan");
    expect(matchVariant("Avian Influenza A(H9N2) - Italy")).toBe("h9n2");
    expect(matchVariant("Circulating vaccine-derived poliovirus type 2 (cVDPV2) - Yemen")).toBe("cvdpv2");
    expect(matchVariant("Ebola virus disease – Democratic Republic of the Congo")).toBeNull();
  });
});
