import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: "src",
  base: mode === "production" ? "./" : "/",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
}));
