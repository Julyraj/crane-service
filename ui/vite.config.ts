import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:4100", changeOrigin: false } },
  },
  build: { outDir: "dist", sourcemap: process.env.SOURCEMAP === "true", chunkSizeWarningLimit: 800 },
});
