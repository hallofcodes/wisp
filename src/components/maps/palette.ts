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

export const MAP_COLORS: Record<MapTheme, MapColors> = {
  light: {
    water: "#fcfcfb",
    border: "#fcfcfb",
    hover: "#0b0b0b",
    noData: "#e4e3df",
    zero: "#cde2fb",
    magnitude: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"],
    recency: ["#8f3311", "#c84c1c", "#e8703e", "#f09a74"],
    pulse: ["#3d1405", "#6b250b", "#8f3311"],
  },
  dark: {
    water: "#1a1a19",
    border: "#1a1a19",
    hover: "#ffffff",
    noData: "#383835",
    zero: "#0f2f57",
    magnitude: ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"],
    recency: ["#f59b72", "#dc6430", "#b34a21", "#8a3517"],
    pulse: ["#ffe1d3", "#ffc1a5", "#f59b72"],
  },
};
