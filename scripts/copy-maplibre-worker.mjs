import { copyFileSync, mkdirSync } from "node:fs";

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
mkdirSync("public/maplibre", { recursive: true });
for (const file of files)
  copyFileSync(
    `node_modules/maplibre-gl/dist/${file}`,
    `public/maplibre/${file}`,
  );
