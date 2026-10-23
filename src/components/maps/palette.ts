export type MapTheme = "light" | "dark";

export interface MapColors {
  water: string;
  border: string;
  hover: string;
  noData: string;
  zero: string;
  magnitude: string[];
  /** Indexed by recency tier - 1 (most recent first). */
  recency: [string, string, string, string];
  pulse: [string, string, string];
}

const LIGHT_MAP_COLORS: MapColors = {
  water: "#f8f8f7",
  border: "#ffffff",
  hover: "#171717",
  noData: "#e5e5e3",
  zero: "#d8e6f8",
  magnitude: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"],
  recency: ["#9a2e06", "#d9460f", "#ff5a1f", "#f69d7a"],
  pulse: ["#3d1405", "#7c2505", "#c23b0a"],
};

/**
 * WIDSP is strictly light-mode-only. Both keys resolve to the verified
 * light-mode scientific palette so no code path can render a dark map.
 */
export const MAP_COLORS: Record<MapTheme, MapColors> = {
  light: LIGHT_MAP_COLORS,
  dark: LIGHT_MAP_COLORS,
};