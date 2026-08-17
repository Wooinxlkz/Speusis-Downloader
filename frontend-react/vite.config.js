import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Speusis Downloader - React/Tailwind rewrite.
// Tauri's tauri.conf.json build.frontendDist must point at "../dist/renderer"
// (same output location the old vanilla build used) so nothing else in
// src-tauri needs to change.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        basket: resolve(__dirname, "basket.html"),
      },
    },
  },
  server: { port: 1420, strictPort: true },
});
