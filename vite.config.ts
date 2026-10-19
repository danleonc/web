import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
const pilotMarker: Plugin = {
  name: "entre-pilot-marker",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "entre-build.json",
      source: JSON.stringify({ mode: "accounts", version: 1 }),
    });
  },
};
export default defineConfig(({ mode }) => ({
  base: "./",
  define: {
    "import.meta.env.VITE_ENTRE_ACCOUNTS": JSON.stringify(
      mode === "pilot" ? "1" : "0",
    ),
  },
  build: { outDir: mode === "pilot" ? "dist-pilot" : "dist" },
  plugins: [react(), ...(mode === "pilot" ? [pilotMarker] : [])],
  server: { proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true } } },
}));
