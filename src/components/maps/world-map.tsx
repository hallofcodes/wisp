"use client";

import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { MAP_COLORS } from "./palette";

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

const HOVER_TINT_COLOR = "#FF5A1F";
const HOVER_TINT_OPACITY = 0.35;

const DEFAULT_CENTER: [number, number] = [12, 18];
const DEFAULT_ZOOM = 1.15;

type CountryCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { iso3: string; name: string }
>;

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
): maplibregl.ExpressionSpecification {
  const colors = MAP_COLORS.light;
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
  const hasPulseRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    propsRef.current = { mode, data, emptyLine };
    hasPulseRef.current = Object.values(data).some((d) => d.pulseTier);
  }, [mode, data, emptyLine]);

  // Create the map once in light mode.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let frame = 0;
    const colors = MAP_COLORS.light;
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
            paint: { "background-color": colors.water },
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 0.75,
      maxZoom: 6,
      renderWorldCopies: true,
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

    // Elastic bounceback when user drags past the inhabited world bounds
    let isBouncingBack = false;
    const enforceElasticBounds = () => {
      if (isBouncingBack) return;
      const center = map.getCenter();
      const zoom = map.getZoom();
      const maxLat = zoom < 1.6 ? 42 : 68;
      const minLat = zoom < 1.6 ? -32 : -58;
      const clampedLat = Math.max(minLat, Math.min(maxLat, center.lat));
      const clampedLng = Math.max(-165, Math.min(165, center.lng));

      if (
        Math.abs(clampedLat - center.lat) > 0.5 ||
        Math.abs(clampedLng - center.lng) > 0.5
      ) {
        isBouncingBack = true;
        map.easeTo({
          center: [clampedLng, clampedLat],
          duration: prefersReducedMotion() ? 0 : 280,
        });
        map.once("moveend", () => {
          isBouncingBack = false;
        });
      }
    };

    map.on("dragend", enforceElasticBounds);
    map.on("zoomend", enforceElasticBounds);

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "280px",
      offset: 12,
      className: "widsp-map-popup",
    });
    let pinned = false;
    let shownIso: string | null = null;
    let hoveredIso: string | null = null;

    const hidePopup = () => {
      shownIso = null;
      popup.remove();
    };

    const showPopup = (
      feature: MapGeoJSONFeature,
      lngLat: maplibregl.LngLat,
      isPinned: boolean,
      force = false,
    ) => {
      const { iso3, name } = feature.properties as {
        iso3: string;
        name: string;
      };
      const { data: current, emptyLine: empty } = propsRef.current;
      const datum = current[iso3];

      if (force || iso3 !== shownIso || !popup.isOpen()) {
        popup
          .setLngLat(lngLat)
          .setDOMContent(popupContent(name, datum, empty))
          .addTo(map);
        shownIso = iso3;
      } else {
        popup.setLngLat(lngLat);
      }

      const el = popup.getElement();
      if (el) {
        el.style.pointerEvents = isPinned && datum?.link ? "auto" : "none";
      }
    };

    const setHovered = (iso: string | null) => {
      if (iso === hoveredIso) return;
      if (hoveredIso) {
        try {
          map.setFeatureState(
            { source: "countries", id: hoveredIso },
            { hover: false },
          );
        } catch {
          // Ignore if source not yet ready
        }
      }
      if (iso) {
        try {
          map.setFeatureState(
            { source: "countries", id: iso },
            { hover: true },
          );
        } catch {
          // Ignore if source not yet ready
        }
      }
      hoveredIso = iso;
    };

    const clearHoverAndPopup = () => {
      if (!map.getSource("countries")) return;
      map.getCanvas().style.cursor = "";
      setHovered(null);
      if (!pinned) {
        hidePopup();
      }
    };

    const onContainerLeave = () => {
      clearHoverAndPopup();
    };
    container.addEventListener("mouseleave", onContainerLeave);

    map.on("dragstart", () => {
      pinned = false;
      hidePopup();
      clearHoverAndPopup();
    });

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
          promoteId: "iso3",
          maxzoom: 6,
        });
        map.addLayer({
          id: "country-fill",
          type: "fill",
          source: "countries",
          paint: { "fill-color": fillColorExpression(m) },
        });
        map.addLayer({
          id: "country-hover-fill",
          type: "fill",
          source: "countries",
          paint: {
            "fill-color": HOVER_TINT_COLOR,
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              HOVER_TINT_OPACITY,
              0,
            ] as unknown as maplibregl.ExpressionSpecification,
          },
        });
        map.addLayer({
          id: "country-border",
          type: "line",
          source: "countries",
          paint: { "line-color": colors.border, "line-width": 0.6 },
        });
        for (const tier of [3, 2, 1] as const) {
          map.addLayer({
            id: `pulse-${tier}`,
            type: "line",
            source: "countries",
            filter: ["==", ["get", "pulseTier"], tier],
            paint: {
              "line-color": colors.pulse[tier - 1],
              "line-width": 2,
              "line-opacity": 0.9,
            },
          });
        }

        // Synchronous mousemove handler on country-fill so e.features[0] is never lost
        map.on("mousemove", "country-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) {
            clearHoverAndPopup();
            return;
          }
          const iso = (feature.properties as { iso3: string }).iso3;
          map.getCanvas().style.cursor = "pointer";
          setHovered(iso);
          if (!pinned) {
            showPopup(feature, e.lngLat, false);
          }
        });

        map.on("mouseleave", "country-fill", () => {
          clearHoverAndPopup();
        });

        map.on("click", (e) => {
          const feature = map.queryRenderedFeatures(e.point, {
            layers: ["country-fill"],
          })[0];
          if (feature) {
            const iso3 = (feature.properties as { iso3: string }).iso3;
            const hasLink = Boolean(propsRef.current.data[iso3]?.link);
            pinned = hasLink;
            showPopup(feature, e.lngLat, hasLink, true);
          } else {
            pinned = false;
            hidePopup();
          }
        });

        setStatus("ready");

        if (!prefersReducedMotion()) {
          let last = 0;
          const animate = (time: number) => {
            frame = requestAnimationFrame(animate);
            if (time - last < 33) return;
            last = time;
            if (!hasPulseRef.current) return;
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

    return () => {
      cancelled = true;
      container.removeEventListener("mouseleave", onContainerLeave);
      cancelAnimationFrame(frame);
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [attribution]);

  // Push new data and update paint properties safely when map style is loaded.
  useEffect(() => {
    const map = mapRef.current;
    const boundaries = boundariesRef.current;
    if (!map || !boundaries || status !== "ready") return;

    const updateMap = () => {
      if (!map.isStyleLoaded() || !map.getLayer("country-fill")) return;
      const source = map.getSource("countries") as GeoJSONSource | undefined;
      if (source) {
        source.setData(withData(boundaries, data));
      }
      map.setPaintProperty(
        "country-fill",
        "fill-color",
        fillColorExpression(mode),
      );
    };

    if (map.isStyleLoaded()) {
      updateMap();
    } else {
      map.once("styledata", updateMap);
    }
  }, [data, mode, status]);

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      duration: prefersReducedMotion() ? 0 : 350,
    });
  };

  return (
    <div className="relative h-[60vh] min-h-[360px] w-full overflow-hidden rounded-[6px] border border-[#E5E5E5] bg-[#F8F8F7]">
      <div
        ref={containerRef}
        className="h-full w-full"
        role="img"
        aria-label={label}
      />
      {status === "ready" && (
        <button
          type="button"
          onClick={handleResetView}
          className="absolute left-2.5 top-2.5 z-10 inline-flex h-7 items-center rounded-[4px] border border-[#D4D4D4] bg-[#FFFFFF]/95 px-2.5 text-xs font-medium text-[#171717] shadow-xs transition-colors hover:bg-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          Reset view
        </button>
      )}
      {status === "loading" && (
        <div
          className="absolute inset-0 grid place-items-center bg-[#F8F8F7]/90 text-sm font-medium text-[#525252]"
          aria-live="polite"
        >
          Loading map boundaries…
        </div>
      )}
      {status === "error" && (
        <div
          className="absolute inset-0 grid place-items-center bg-[#FEF2F2]/95 p-4 text-center text-sm font-medium text-[#B91C1C]"
          role="alert"
        >
          The map boundaries could not be loaded. All underlying surveillance
          data is listed in the sections below.
        </div>
      )}
    </div>
  );
}