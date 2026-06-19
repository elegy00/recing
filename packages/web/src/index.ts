import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

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

if (isDev) {
  // ─── DEV: Vite dev server on port 5173, Hono API + proxy on port 3000 ─────
  const honoApp = (await import("./hono-app.js")).default;
  const { createServer } = await import("node:http");

  // Start the Vite dev server in-process (no child process). This is the key to
  // stability: running Vite as a spawned child left orphaned processes locking
  // the port whenever this process crashed. In-process, a crash releases every
  // port because there is a single process.
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ server: { port: vitePort } });
  await vite.listen();

  // Read index.html from Vite's source for SPA fallback (while Vite is starting).
  const viteRoot = join(__dirname, "..", "src");
  let indexHtml = readFileSync(join(viteRoot, "index.html"), "utf-8");

  // Only real API endpoints go to Hono. Guard against client modules such as
  // `/api.ts` (a Vite-served source file) by matching `/api/` and `/health`.
  const isApiRequest = (url: string | undefined) =>
    !!url && (url.startsWith("/api/") || url === "/api" || url.startsWith("/health"));

  const server = createServer(async (req, res) => {
    // API routes → Hono
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
        const response = await honoApp.fetch(hReq);

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

      for (const [key, value] of response.headers) {
        res.setHeader(key, value);
      }
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
      // Vite not ready yet — serve raw index.html as fallback.
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

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  // Ensure both the HTTP server and the in-process Vite server are torn down on
  // any exit path so no port stays locked after a crash or Ctrl+C.
  let shuttingDown = false;
  async function shutdown(code: number) {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.allSettled([
      new Promise<void>((resolve) => server.close(() => resolve())),
      vite.close(),
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
    return map[ext] || "application/octet-stream";
  }

  app.all("*", async (c) => {
    const urlPath = c.req.path;
    const filePath = join(__dirname, "..", "dist", "client", urlPath === "/" ? "/index.html" : urlPath);

    try {
      const data = readFileSync(filePath);
      const ext = urlPath.slice(urlPath.lastIndexOf("."));
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (await import("@hono/node-server")).serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`\n  ✓ Prod server running at http://localhost:${PORT}\n`);
  });
}
