import type { Context, Env, MiddlewareHandler } from "hono";
import { Hono } from "hono";

/** Get the API key from env (or undefined if not set). */
function getApiKey(): string | undefined {
  return process.env.RECING_API_KEY;
}

/** Check if auth is enabled (RECING_API_KEY is set and non-empty). */
export function authEnabled(): boolean {
  const key = getApiKey();
  return typeof key === "string" && key.length > 0;
}

/** Extract Bearer token from Authorization header. Returns undefined if missing/invalid format. */
function extractBearerToken(c: Context): string | undefined {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return undefined;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return undefined;
  return token;
}

/** Hono middleware that requires a valid API key. Skips check when auth is disabled. */
export function requireAuth(): MiddlewareHandler<Env> {
  return async (c: Context, next: () => Promise<void>) => {
    // Skip authentication entirely when no key is configured (dev convenience)
    if (!authEnabled()) {
      await next();
      return;
    }

    const token = extractBearerToken(c);
    const expected = getApiKey();

    if (!token || !expected || token !== expected) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  };
}

/** Create a Hono instance with auth middleware pre-applied to all routes. */
export function createAuthedApp(): Hono<Env> {
  const app = new Hono<Env>();
  app.use("*", requireAuth());
  return app;
}
