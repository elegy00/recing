import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: "src",
  base: mode === "production" ? "./" : "/",
  server: {
    // When Vite runs standalone (port 5173), proxy API calls back to Hono on port 3000.
    // Use a regex so client source files like `/api.ts` are NOT treated as API calls.
    proxy: {
      "^/api/": "http://localhost:3000",
    },
    // The browser loads the app via Hono (port 3000), which proxies HTTP but not
    // WebSocket upgrades. Point HMR straight at Vite so live reload works.
    hmr: {
      clientPort: 5173,
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
}));
