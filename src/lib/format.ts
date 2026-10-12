import type { CaseClassification, Indicator } from "@/generated/prisma/enums";

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const formatDate = (date: Date) => dateFormat.format(date);
export const formatDateTime = (date: Date) => dateTimeFormat.format(date);

export const CLASSIFICATION_LABELS: Record<CaseClassification, string> = {
  CONFIRMED: "Confirmed",
  PROBABLE: "Probable",
  SUSPECTED: "Suspected",
  REPORTED_UNSPECIFIED: "Reported",
  ESTIMATED: "Modelled estimate",
};

export const INDICATOR_LABELS: Record<Indicator, string> = {
  CASES: "Cases",
  DEATHS: "Deaths",
  INCIDENCE_RATE: "Incidence rate",
  MORTALITY_RATE: "Mortality rate",
  CASE_FATALITY_RATE: "Case fatality rate",
};
