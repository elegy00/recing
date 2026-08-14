import { Hono } from "hono";
import type { Context, Env } from "hono";
import type { Pool } from "pg";
import { requireAuth } from "./auth.js";
import { queryOne } from "./db.js";

// ─── Hono Env type ───────────────────────────────────────────────────────────

interface AppEnv extends Env {
  Bindings: { DATABASE_POOL: Pool; RECING_API_KEY?: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// POST /api/recipes — create a new job
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

// GET /api/recipes — list jobs
api.get("/api/recipes", async (c: Context<AppEnv>) => {
  const status = c.req.query("status");

  if (status) {
    const res = await c.env.DATABASE_POOL.query(
      "SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC", [status]
    );
    return json(c, { recipes: res.rows });
  }

  // Default: only completed valid recipes
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
  return json(c, { recipes: res.rows });
});

// PATCH /api/recipes/:id/result — post LLM extraction result (worker)
api.patch("/api/recipes/:id/result", async (c: Context<AppEnv>) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = new Date().toISOString();

  let update: Record<string, unknown> = { updated_at: now };
  let status = body.result !== undefined ? (body.isValid ? "COMPLETED" : "FAILED") : undefined;

  if (body.result !== undefined) update.result = JSON.stringify(body.result);
  if (body.error !== undefined) { update.error = body.error; status = "FAILED"; }

  if (status) update.status = status;

  const setClauses = Object.entries(update).map(([k], i) => `"${k}" = $${i + 2}`).join(", ");
  const params = [id, ...Object.values(update)];

  try {
    const res = await c.env.DATABASE_POOL.query(
      `UPDATE jobs SET ${setClauses} WHERE id = $1 RETURNING *`, params
    );

    if (res.rows.length === 0) return json(c, { error: "Job not found" }, 404);
    return json(c, res.rows[0]);
  } catch (err: unknown) {
    if ((err as Error).message?.includes("invalid input syntax for type uuid")) {
      return json(c, { error: "Job not found" }, 404);
    }
    throw err;
  }
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

    return json(c, { recipe: job });
  } catch (err: unknown) {
    // Invalid UUID format → treat as not found
    if ((err as Error).message?.includes("invalid input syntax for type uuid")) {
      return json(c, { error: "Recipe not found" }, 404);
    }
    throw err;
  }
});

// PATCH /api/recipes/:id/retry — move FAILED → PENDING
api.patch("/api/recipes/:id/retry", async (c: Context<AppEnv>) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();

  try {
    const res = await c.env.DATABASE_POOL.query(
      "UPDATE jobs SET status = 'PENDING', result = NULL, error = NULL, updated_at = $2 WHERE id = $1 AND status = 'FAILED' RETURNING *",
      [id, now]
    );

    if (res.rows.length === 0) return json(c, { error: "Job not found or not in FAILED state" }, 404);
    return json(c, { ok: true });
  } catch (err: unknown) {
    if ((err as Error).message?.includes("invalid input syntax for type uuid")) {
      return json(c, { error: "Job not found or not in FAILED state" }, 404);
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
