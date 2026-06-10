import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Dev mode check ──────────────────────────────────────────────────────────
const isDev = process.argv.includes("--mode") && process.argv[process.argv.indexOf("--mode") + 1] === "dev";

if (isDev) {
  // ─── DEV: Vite middleware + Hono API on same port ───────────────────────────
  const vite = await import("vite");
  const honoApp = (await import("./hono-app.js")).default;

  const viteServer = await vite.createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

/** Read a Node.js readable stream into text. */
async function readBody(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

const httpServer = createServer(async (req, res) => {
  // API routes → Hono
  if (req.url?.startsWith("/api")) {
    const bodyText = req.method !== "GET" && req.method !== "HEAD"
      ? await readBody(req)
      : undefined;
    const hReq = new Request(new URL(req.url!, `http://${req.headers.host}`), {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: bodyText,
    });
    const response = await honoApp.fetch(hReq);

    // Write Hono's Response back to the Node.js client
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      for await (const chunk of response.body) res.write(Buffer.from(chunk as Uint8Array));
    }
    res.end();
    return;
  }
  // Everything else → Vite middleware (handles index.html transform + static assets)
  viteServer.middlewares(req as IncomingMessage, res as ServerResponse);
});

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, () => {
    console.log(`\n  ✓ Dev server running at http://localhost:${PORT}\n`);
  });
} else {
  // ─── PROD: Hono API + static file serving from Vite build ──────────────────
  const app = (await import("./hono-app.js")).default;

  // MIME type lookup for common file extensions
  function mimeType(ext: string): string {
    const map: Record<string, string> = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
    };
    return map[ext] || "application/octet-stream";
  }

  // Serve static files from dist/client (Vite build output)
  app.all("*", async (c) => {
    const urlPath = c.req.path;
    const filePath = join(__dirname, "..", "dist", "client", urlPath === "/" ? "/index.html" : urlPath);

    try {
      const data = readFileSync(filePath);
      const ext = urlPath.slice(urlPath.lastIndexOf("."));
      return new Response(data, {
        headers: { "content-type": mimeType(ext), "cache-control": "public, max-age=31536000, immutable" },
      });
    } catch {
      // SPA fallback: serve index.html for non-API routes
      if (!urlPath.startsWith("/api")) {
        try {
          const html = readFileSync(join(__dirname, "..", "dist", "client", "index.html"));
          return new Response(html, { headers: { "content-type": "text/html" } });
        } catch {
          return c.text("Not found", 404);
        }
      }
      return c.text("Not found", 404);
    }
  });

  const PORT = Number(process.env.PORT) || 3000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (await import("@hono/node-server")).serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`\n  ✓ Prod server running at http://localhost:${PORT}\n`);
  });
}
