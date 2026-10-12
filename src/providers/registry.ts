import { HttpClient, type HttpClientOptions } from "./base/http";
import type {
  DiseaseDataProvider,
  ObservationSink,
  ReportSink,
  SourceDescriptor,
} from "./base/types";
import {
  COVID19_HTTP_DEFAULTS,
  WHO_COVID19_SOURCE,
  WhoCovid19Provider,
} from "./who/covid19/provider";
import {
  DON_HTTP_DEFAULTS,
  WHO_DON_SOURCE,
  WhoDonProvider,
} from "./who/don/provider";
import {
  GHO_HTTP_DEFAULTS,
  WHO_GHO_SOURCE,
  WhoGhoProvider,
} from "./who/gho/provider";

export const USER_AGENT =
  "WIDSP/0.1 (+https://github.com/hallofcodes/worldwide-infectious-disease-surveillance-platform)";

export interface ProviderFactoryDeps {
  observations: ObservationSink;
  reports: ReportSink;
  /** Catalog disease slugs, for providers that match free text to diseases. */
  knownDiseaseSlugs: ReadonlySet<string>;
  /** HTTP overrides, used by tests to stub fetch and skip real delays. */
  http?: Partial<HttpClientOptions>;
}

/** What the sync runner needs from any provider. */
export type RunnableProvider = Pick<
  DiseaseDataProvider<unknown, unknown, never>,
  "id" | "descriptor" | "sync"
>;

export interface ProviderRegistration {
  descriptor: SourceDescriptor;
  create(deps: ProviderFactoryDeps): RunnableProvider;
}

const http = (
  defaults: Omit<HttpClientOptions, "userAgent">,
  overrides?: Partial<HttpClientOptions>,
) => new HttpClient({ ...defaults, userAgent: USER_AGENT, ...overrides });

export const providers: Record<string, ProviderRegistration> = {
  [WHO_GHO_SOURCE.id]: {
    descriptor: WHO_GHO_SOURCE,
    create: (deps) =>
      new WhoGhoProvider({
        sink: deps.observations,
        http: http(GHO_HTTP_DEFAULTS, deps.http),
      }),
  },
  [WHO_COVID19_SOURCE.id]: {
    descriptor: WHO_COVID19_SOURCE,
    create: (deps) =>
      new WhoCovid19Provider({
        sink: deps.observations,
        http: http(COVID19_HTTP_DEFAULTS, deps.http),
      }),
  },
  [WHO_DON_SOURCE.id]: {
    descriptor: WHO_DON_SOURCE,
    create: (deps) =>
      new WhoDonProvider({
        sink: deps.reports,
        knownDiseaseSlugs: deps.knownDiseaseSlugs,
        http: http(DON_HTTP_DEFAULTS, deps.http),
      }),
  },
};

export function getProviderRegistration(id: string): ProviderRegistration {
  const registration = providers[id];
  if (!registration) {
    throw new Error(
      `Unknown provider "${id}". Known providers: ${Object.keys(providers).join(", ")}`,
    );
  }
  return registration;
}
