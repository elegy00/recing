import { Hono } from "hono";
import type { Context, Env } from "hono";
import type { Pool } from "pg";
import { requireAuth } from "./auth.js";
import { queryOne } from "./db.js";

// ─── Hono Env type ───────────────────────────────────────────────────────────

interface AppEnv extends Env {
  Bindings: { DATABASE_POOL: Pool };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Rename DB "id" → "_id" for frontend compatibility. */
function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const { id, ...rest } = row;
  return { _id: id, ...rest };
}

/** Rename DB "id" → "_id" for an array of rows. */
function mapRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(mapRow);
}

function json(_c: Context<AppEnv>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// ─── Public Routes ───────────────────────────────────────────────────────────

const publicApp = new Hono<AppEnv>();

publicApp.get("/health", async (c: Context<AppEnv>) => {
  try {
    await c.env.DATABASE_POOL.query("SELECT 1");
    return json(c, { status: "ok" });
  } catch {
    return json(c, { status: "error", message: "Postgres unreachable" }, 503);
  }
});

// ─── Authenticated API Routes ────────────────────────────────────────────────

const api = new Hono<AppEnv>().use("*", requireAuth());

// POST /api/recipes — user submits a URL to ingest
api.post("/api/recipes", async (c: Context<AppEnv>) => {
  const body = await c.req.json();
  if (!body?.url || typeof body.url !== "string") {
    return json(c, { error: "URL is required" }, 400);
  }

  const url = body.url.trim();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DATABASE_POOL.query(
    "INSERT INTO jobs (id, url, status, created_at, updated_at, result, error) VALUES ($1, $2, 'PENDING', $3, $3, NULL, NULL)",
    [id, url, now]
  );

  return json(c, { jobId: id }, 201);
});

// GET /api/recipes — list completed recipes
api.get("/api/recipes", async (c: Context<AppEnv>) => {
  const status = c.req.query("status");

  if (status) {
    const res = await c.env.DATABASE_POOL.query(
      "SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC", [status]
    );
    return json(c, { recipes: mapRows(res.rows) });
  }

  // Default: only valid completed recipes
  const res = await c.env.DATABASE_POOL.query(`
    SELECT * FROM jobs
    WHERE status = 'COMPLETED'
      AND result IS NOT NULL
      AND result->>'status' = 'extracted'
      AND result->>'recipeName' IS NOT NULL
      AND jsonb_array_length(result->'ingredients') > 0
      AND jsonb_array_length(result->'instructions') > 0
    ORDER BY created_at DESC
  `);
  return json(c, { recipes: mapRows(res.rows) });
});

// GET /api/recipes/:id — fetch a single completed recipe by ID
api.get("/api/recipes/:id", async (c: Context<AppEnv>) => {
  const id = c.req.param("id");
  try {
    const job = await queryOne(
      "SELECT * FROM jobs WHERE id = $1 AND status = 'COMPLETED'", [id]
    );

    if (!job || !job.result) return json(c, { error: "Recipe not found" }, 404);

    const r = job.result as Record<string, unknown>;
    if (r.status !== "extracted" || !r.recipeName ||
        !Array.isArray(r.ingredients) || r.ingredients.length === 0 ||
        !Array.isArray(r.instructions) || r.instructions.length === 0) {
      return json(c, { error: "Recipe not found" }, 404);
    }

    return json(c, { recipe: mapRow(job) });
  } catch (err: unknown) {
    if ((err as Error).message?.includes("invalid input syntax for type uuid")) {
      return json(c, { error: "Recipe not found" }, 404);
    }
    throw err;
  }
});

// PATCH /api/recipes/:id/retry — reset a FAILED job back to PENDING
api.patch("/api/recipes/:id/retry", async (c: Context<AppEnv>) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();

  try {
    const res = await c.env.DATABASE_POOL.query(
      "UPDATE jobs SET status = 'PENDING', result = NULL, error = NULL, updated_at = $1 WHERE id = $2",
      [now, id]
    );

    if (res.rowCount === 0) return json(c, { error: "Job not found" }, 404);
    return json(c, { ok: true });
  } catch (err: unknown) {
    if ((err as Error).message?.includes("invalid input syntax for type uuid")) {
      return json(c, { error: "Job not found" }, 404);
    }
    throw err;
  }
});

// DELETE /api/recipes/:id — remove a job
api.delete("/api/recipes/:id", async (c: Context<AppEnv>) => {
  const id = c.req.param("id");
  try {
    const res = await c.env.DATABASE_POOL.query("DELETE FROM jobs WHERE id = $1", [id]);

    if (res.rowCount === 0) return json(c, { error: "Job not found" }, 404);
    return json(c, { ok: true });
  } catch (err: unknown) {
    if ((err as Error).message?.includes("invalid input syntax for type uuid")) {
      return json(c, { error: "Job not found" }, 404);
    }
    throw err;
  }
});

// ─── Combine ─────────────────────────────────────────────────────────────────

const app = new Hono<AppEnv>();
app.route("", publicApp);
app.route("", api);

export default app;
