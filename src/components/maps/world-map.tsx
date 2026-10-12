"use client";

import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { MAP_COLORS, type MapTheme } from "./palette";

/** What the map shows for one country. Built on the server. */
export interface MapCountryDatum {
  /** Fill class: null = no value, 0 = zero, 1..n = increasing magnitude. In report mode, the recency tier. */
  fillClass: number | null;
  /** Recency tier for the pulsing outline (report mode only). */
  pulseTier?: 1 | 2 | 3;
  /** Popup lines, already formatted. The first is the heading. */
  lines: string[];
  link?: { href: string; label: string };
}

export interface WorldMapProps {
  mode: "reports" | "stats";
  data: Record<string, MapCountryDatum>;
  /** Popup line for countries with no datum. */
  emptyLine: string;
  /** Accessible description of what the map shows. */
  label: string;
  attribution: string;
}

const BOUNDARIES_URL = "/geo/countries.geojson";
// Served from public/ (see scripts/copy-maplibre-worker.mjs).
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

type CountryCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { iso3: string; name: string }
>;

function currentTheme(): MapTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A "lub-dub" heartbeat curve in [0, 1] for phase t in [0, 1). */
export function heartbeat(t: number): number {
  const beat = (center: number, width: number) =>
    Math.exp(-(((t - center) / width) ** 2));
  return Math.min(1, beat(0.08, 0.05) + 0.6 * beat(0.26, 0.05));
}

const PULSE_PERIOD_MS: Record<1 | 2 | 3, number> = {
  1: 1100,
  2: 1900,
  3: 3200,
};

function withData(
  boundaries: CountryCollection,
  data: Record<string, MapCountryDatum>,
): CountryCollection {
  return {
    ...boundaries,
    features: boundaries.features.map((f) => {
      const datum = data[f.properties.iso3];
      return {
        ...f,
        properties: {
          ...f.properties,
          fillClass: datum?.fillClass ?? -1,
          pulseTier: datum?.pulseTier ?? 0,
        },
      };
    }),
  };
}

function fillColorExpression(
  mode: WorldMapProps["mode"],
  theme: MapTheme,
): maplibregl.ExpressionSpecification {
  const colors = MAP_COLORS[theme];
  // Class n uses ramp[n - 1]: magnitude classes 1..5, or recency tiers 1..3.
  const ramp = mode === "reports" ? colors.recency : colors.magnitude;
  const stops: (string | number)[] = [];
  ramp.forEach((color, i) => stops.push(i + 1, color));
  return [
    "match",
    ["get", "fillClass"],
    -1,
    colors.noData,
    0,
    mode === "reports" ? colors.noData : colors.zero,
    ...stops,
    colors.noData,
  ] as unknown as maplibregl.ExpressionSpecification;
}

function popupContent(
  name: string,
  datum: MapCountryDatum | undefined,
  emptyLine: string,
): HTMLElement {
  // Built with textContent only: titles come from external sources.
  const root = document.createElement("div");
  root.className = "widsp-popup";
  const heading = document.createElement("p");
  heading.className = "widsp-popup-title";
  heading.textContent = datum?.lines[0] ?? name;
  root.append(heading);
  for (const line of datum ? datum.lines.slice(1) : [emptyLine]) {
    const p = document.createElement("p");
    p.textContent = line;
    root.append(p);
  }
  if (datum?.link) {
    const a = document.createElement("a");
    a.href = datum.link.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = datum.link.label;
    root.append(a);
  }
  return root;
}

export function WorldMap({
  mode,
  data,
  emptyLine,
  label,
  attribution,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const boundariesRef = useRef<CountryCollection | null>(null);
  const propsRef = useRef({ mode, data, emptyLine });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    propsRef.current = { mode, data, emptyLine };
  }, [mode, data, emptyLine]);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let frame = 0;
    const theme = currentTheme();
    maplibregl.setWorkerUrl(WORKER_URL);

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": MAP_COLORS[theme].water },
          },
        ],
      },
      // Fit the inhabited world at any container size.
      bounds: [
        [-168, -56],
        [190, 78],
      ],
      fitBoundsOptions: { padding: 4 },
      minZoom: 0,
      maxZoom: 6,
      renderWorldCopies: false,
      attributionControl: { compact: true, customAttribution: attribution },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    mapRef.current = map;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "280px",
      offset: 8,
    });
    let pinned = false;

    const showPopup = (
      feature: MapGeoJSONFeature,
      lngLat: maplibregl.LngLat,
    ) => {
      const { iso3, name } = feature.properties as {
        iso3: string;
        name: string;
      };
      const { data: current, emptyLine: empty } = propsRef.current;
      popup
        .setLngLat(lngLat)
        .setDOMContent(popupContent(name, current[iso3], empty))
        .addTo(map);
    };

    map.on("load", async () => {
      try {
        const response = await fetch(BOUNDARIES_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const boundaries = (await response.json()) as CountryCollection;
        if (cancelled) return;
        boundariesRef.current = boundaries;
        const { mode: m, data: d } = propsRef.current;

        map.addSource("countries", {
          type: "geojson",
          data: withData(boundaries, d),
          attribution: "Natural Earth",
        });
        map.addLayer({
          id: "country-fill",
          type: "fill",
          source: "countries",
          paint: { "fill-color": fillColorExpression(m, theme) },
        });
        map.addLayer({
          id: "country-border",
          type: "line",
          source: "countries",
          paint: { "line-color": MAP_COLORS[theme].border, "line-width": 0.5 },
        });
        for (const tier of [3, 2, 1] as const) {
          map.addLayer({
            id: `pulse-${tier}`,
            type: "line",
            source: "countries",
            filter: ["==", ["get", "pulseTier"], tier],
            paint: {
              "line-color": MAP_COLORS[theme].pulse[tier - 1],
              "line-width": 2,
              "line-opacity": 0.9,
            },
          });
        }
        map.addLayer({
          id: "country-hover",
          type: "line",
          source: "countries",
          filter: ["==", ["get", "iso3"], ""],
          paint: { "line-color": MAP_COLORS[theme].hover, "line-width": 2 },
        });

        map.on("mousemove", "country-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          map.getCanvas().style.cursor = "pointer";
          map.setFilter("country-hover", [
            "==",
            ["get", "iso3"],
            feature.properties.iso3,
          ]);
          if (!pinned) showPopup(feature, e.lngLat);
        });
        map.on("mouseleave", "country-fill", () => {
          map.getCanvas().style.cursor = "";
          map.setFilter("country-hover", ["==", ["get", "iso3"], ""]);
          if (!pinned) popup.remove();
        });
        map.on("click", (e) => {
          const feature = map.queryRenderedFeatures(e.point, {
            layers: ["country-fill"],
          })[0];
          if (feature) {
            pinned = true;
            showPopup(feature, e.lngLat);
          } else {
            pinned = false;
            popup.remove();
          }
        });

        setStatus("ready");

        if (!prefersReducedMotion()) {
          let last = 0;
          const animate = (time: number) => {
            frame = requestAnimationFrame(animate);
            if (time - last < 33) return; // ~30 fps is plenty for a pulse
            last = time;
            for (const tier of [1, 2, 3] as const) {
              const b = heartbeat(
                (time % PULSE_PERIOD_MS[tier]) / PULSE_PERIOD_MS[tier],
              );
              map.setPaintProperty(
                `pulse-${tier}`,
                "line-width",
                1.5 + 3.5 * b,
              );
              map.setPaintProperty(
                `pulse-${tier}`,
                "line-opacity",
                0.45 + 0.55 * b,
              );
            }
          };
          frame = requestAnimationFrame(animate);
        } else {
          for (const tier of [1, 2, 3] as const)
            map.setPaintProperty(`pulse-${tier}`, "line-width", 3);
        }
      } catch (error) {
        console.error("Failed to load country boundaries", error);
        if (!cancelled) setStatus("error");
      }
    });

    // Follow the site's theme toggle.
    const observer = new MutationObserver(() => {
      if (!map.getLayer("country-fill")) return;
      const t = currentTheme();
      const colors = MAP_COLORS[t];
      map.setPaintProperty("background", "background-color", colors.water);
      map.setPaintProperty(
        "country-fill",
        "fill-color",
        fillColorExpression(propsRef.current.mode, t),
      );
      map.setPaintProperty("country-border", "line-color", colors.border);
      map.setPaintProperty("country-hover", "line-color", colors.hover);
      for (const tier of [1, 2, 3] as const)
        map.setPaintProperty(
          `pulse-${tier}`,
          "line-color",
          colors.pulse[tier - 1],
        );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [attribution]);

  // Push new data without recreating the map.
  useEffect(() => {
    const map = mapRef.current;
    const boundaries = boundariesRef.current;
    if (!map || !boundaries || status !== "ready") return;
    (map.getSource("countries") as GeoJSONSource | undefined)?.setData(
      withData(boundaries, data),
    );
    map.setPaintProperty(
      "country-fill",
      "fill-color",
      fillColorExpression(mode, currentTheme()),
    );
  }, [data, mode, status]);

  return (
    <div className="relative h-[60vh] min-h-[360px] w-full overflow-hidden rounded-lg border bg-muted">
      {/* MapLibre's stylesheet makes this element position: relative, so it is sized with h-full. */}
      <div
        ref={containerRef}
        className="h-full w-full"
        role="img"
        aria-label={label}
      />
      {status === "loading" && (
        <div
          className="absolute inset-0 grid place-items-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          Loading map…
        </div>
      )}
      {status === "error" && (
        <div
          className="absolute inset-0 grid place-items-center p-4 text-center text-sm"
          role="alert"
        >
          The map could not be loaded. The data is still listed below.
        </div>
      )}
    </div>
  );
}
