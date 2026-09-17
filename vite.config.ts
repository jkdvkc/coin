import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relatívne cesty → build funguje v koreni aj v podadresári (GitHub Pages).
  base: "./",
  server: {
    host: true,
    strictPort: false,
    allowedHosts: true,
    hmr: { clientPort: 443 },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "COOP": "same-origin"
    }
  },
  preview: {
    host: true,
    allowedHosts: true
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2019",
    chunkSizeWarningLimit: 900
  },
  worker: {
    format: "es"
  }
});
