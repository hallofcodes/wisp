import type { IndicatorDefinition } from "@/providers/base/types";

export const GHO_INDICATORS: IndicatorDefinition[] = [
  {
    code: "CHOLERA_0000000001",
    diseaseSlug: "cholera",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "Cholera cases officially reported to WHO by Member States for the year. Includes cases reported regardless of laboratory confirmation; many countries under-report or do not report.",
  },
  {
    code: "CHOLERA_0000000002",
    diseaseSlug: "cholera",
    indicator: "DEATHS",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "deaths",
    definition:
      "Deaths from cholera officially reported to WHO by Member States for the year.",
  },
  {
    code: "WHS3_62",
    diseaseSlug: "measles",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "Measles cases reported to WHO through the WHO/UNICEF Joint Reporting Form for the year. Case definitions and surveillance completeness vary by country.",
  },
  {
    code: "MALARIA_CONF_CASES",
    diseaseSlug: "malaria",
    indicator: "CASES",
    caseClassification: "CONFIRMED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "Malaria cases confirmed by microscopy or rapid diagnostic test, as reported by national malaria programmes for the year.",
  },
  {
    code: "MALARIA_EST_CASES",
    diseaseSlug: "malaria",
    indicator: "CASES",
    caseClassification: "ESTIMATED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "WHO modelled estimate of malaria cases for the year (World Malaria Report). An estimate, not a count of reported cases.",
  },
  {
    code: "MALARIA_EST_DEATHS",
    diseaseSlug: "malaria",
    indicator: "DEATHS",
    caseClassification: "ESTIMATED",
    aggregation: "PERIOD_TOTAL",
    unit: "deaths",
    definition:
      "WHO modelled estimate of malaria deaths for the year (World Malaria Report).",
  },
  {
    code: "TB_c_newinc",
    diseaseSlug: "tuberculosis",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "New and relapse tuberculosis cases notified to national programmes during the year (bacteriologically confirmed and clinically diagnosed combined, as reported).",
  },
  {
    code: "TB_e_inc_num",
    diseaseSlug: "tuberculosis",
    indicator: "CASES",
    caseClassification: "ESTIMATED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "WHO estimate of incident tuberculosis cases (all forms) for the year, with uncertainty interval (Global Tuberculosis Report).",
  },
  {
    code: "TB_e_mort_exc_tbhiv_num",
    diseaseSlug: "tuberculosis",
    indicator: "DEATHS",
    caseClassification: "ESTIMATED",
    aggregation: "PERIOD_TOTAL",
    unit: "deaths",
    definition:
      "WHO estimate of tuberculosis deaths among HIV-negative people for the year, with uncertainty interval. Excludes TB deaths among people with HIV.",
  },
  {
    code: "WHS3_49",
    diseaseSlug: "polio",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "Poliomyelitis cases reported to WHO through the WHO/UNICEF Joint Reporting Form for the year. May include wild and vaccine-derived poliovirus cases depending on national reporting.",
  },
  {
    code: "WHS3_50",
    diseaseSlug: "yellow-fever",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition:
      "Yellow fever cases reported to WHO through the WHO/UNICEF Joint Reporting Form for the year.",
  },
  {
    code: "WHS3_52",
    diseaseSlug: "plague",
    indicator: "CASES",
    caseClassification: "REPORTED_UNSPECIFIED",
    aggregation: "PERIOD_TOTAL",
    unit: "cases",
    definition: "Human plague cases reported to WHO for the year.",
  },
];
