import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import pg from "pg";

loadDotenv({ path: new URL("../../../.env", import.meta.url) });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Mode check ──────────────────────────────────────────────────────────────
const isDev = process.argv[1]?.includes("src/");

const PORT = Number(process.env.PORT) || 3000;
const vitePort = Number(process.env.VITE_PORT) || 5173;

/** Read a Node.js readable stream into text. */
async function readBody(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

// ─── Postgres pool (shared, created once) ────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL ?? "postgresql://recing:recing@localhost:5432/recing",
});

// ─── DEV: Vite dev server on port 5173, Hono API + proxy on port 3000 ───────

if (isDev) {
  const honoApp = (await import("./hono-app.js")).default;
  const { createServer } = await import("node:http");

  // Start the Vite dev server in-process.
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ server: { port: vitePort } });
  await vite.listen();

  const viteRoot = join(__dirname, "..", "src");
  let indexHtml = readFileSync(join(viteRoot, "index.html"), "utf-8");

  const isApiRequest = (url: string | undefined) =>
    !!url && (url.startsWith("/api/") || url === "/api" || url.startsWith("/health"));

  const server = createServer(async (req, res) => {
    if (isApiRequest(req.url)) {
      try {
        const bodyText = req.method !== "GET" && req.method !== "HEAD"
          ? await readBody(req)
          : undefined;
        const hReq = new Request(new URL(req.url!, `http://${req.headers.host}`), {
          method: req.method,
          headers: req.headers as HeadersInit,
          body: bodyText,
        });
        // Inject the Postgres pool as a binding (Hono.fetch signature: fetch(req, env, executionCtx))
        const response = await (honoApp as { fetch: (r: Request, env?: { DATABASE_POOL: pg.Pool }) => Promise<Response> }).fetch(hReq, { DATABASE_POOL: pool });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) {
          for await (const chunk of response.body) res.write(Buffer.from(chunk as Uint8Array));
        }
        res.end();
      } catch (err) {
        console.error("[Hono API error]", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal server error");
      }
      return;
    }

    // Non-API routes → proxy to Vite dev server.
    try {
      const targetUrl = `http://localhost:${vitePort}${req.url}`;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: req.headers as Record<string, string>,
      });
      for (const [key, value] of response.headers) res.setHeader(key, value);
      res.writeHead(response.status);
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      }
      res.end();
    } catch {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(indexHtml);
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n  ✗ Port ${PORT} is already in use. Another dev server may still be running.\n` +
        `    Find and stop it with:  lsof -ti :${PORT} | xargs kill\n`,
      );
    } else {
      console.error("[server error]", err);
    }
    void shutdown(1);
  });

  server.listen(PORT, () => {
    console.log(`\n  ✓ Hono API running at http://localhost:${PORT}`);
    console.log(`  ✓ Vite frontend proxied to http://localhost:${vitePort}\n`);
  });

  let shuttingDown = false;
  async function shutdown(code: number) {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.allSettled([
      new Promise<void>((resolve) => server.close(() => resolve())),
      vite.close(),
      pool.end(),
    ]);
    process.exit(code);
  }

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
    void shutdown(1);
  });
  process.on("unhandledRejection", (err) => {
    console.error("[unhandledRejection]", err);
    void shutdown(1);
  });
} else {
  // ─── PROD: Hono API + static file serving from Vite build ──────────────────
  const app = (await import("./hono-app.js")).default;

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
    return map[ext] || "text/plain";
  }

  app.all("*", async (c) => {
    const urlPath = c.req.path;
    const resolvedPath = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = join(__dirname, "..", "dist", "client", resolvedPath);
    const ext = resolvedPath.includes(".") ? resolvedPath.slice(resolvedPath.lastIndexOf(".")) : ".html";

    try {
      const data = readFileSync(filePath);
      return new Response(data, {
        headers: { "content-type": mimeType(ext), "cache-control": "public, max-age=31560000, immutable" },
      });
    } catch {
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

  (await import("@hono/node-server")).serve(
    { fetch: (req) => (app as { fetch: (r: Request, env?: { DATABASE_POOL: pg.Pool }) => Promise<Response> }).fetch(req, { DATABASE_POOL: pool }), port: PORT },
    () => {
      console.log(`\n  ✓ Prod server running at http://localhost:${PORT}\n`);
    }
  );
}
