import { Hono } from "hono";
import type { Context, Env } from "hono";
import { requireAuth } from "./auth.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** JSON response helper. */
function json(_c: Context, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Generate a UUID v4 string. */
function uuid(): string {
  return crypto.randomUUID();
}

// ─── Public Routes (health check — no auth) ──────────────────────────────────

const publicApp = new Hono<Env>();

publicApp.get("/health", async (c: Context) => {
  try {
    const { getDb } = await import("./db.js");
    const db = await getDb({ url: process.env.MONGODB_URI ?? "mongodb://localhost:27017", dbName: process.env.DB_NAME ?? "recing" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).command({ ping: 1 });
    return json(c, { status: "ok" });
  } catch {
    return json(c, { status: "error", message: "MongoDB unreachable" }, 503);
  }
});

// ─── Authenticated API Routes ────────────────────────────────────────────────

const api = new Hono<Env>().use("*", requireAuth());

// POST /api/recipes — create a new extraction job
api.post("/api/recipes", async (c: Context) => {
  const { getDb } = await import("./db.js");
  const db = await getDb({ url: process.env.MONGODB_URI ?? "mongodb://localhost:27017", dbName: process.env.DB_NAME ?? "recing" });
  const body = await c.req.json();
  if (!body?.url || typeof body.url !== "string") {
    return json(c, { error: "URL is required" }, 400);
  }

  const url = body.url.trim();
  const now = new Date().toISOString();
  const id = uuid();

  const jobsCol = db.collection("jobs");
  await jobsCol.insertOne({
    _id: id as any,
    url,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    result: null,
    error: null,
  });

  return json(c, { jobId: id }, 201);
});

// GET /api/recipes — list jobs (filtered by ?status=)
api.get("/api/recipes", async (c: Context) => {
  const { getDb } = await import("./db.js");
  const db = await getDb({ url: process.env.MONGODB_URI ?? "mongodb://localhost:27017", dbName: process.env.DB_NAME ?? "recing" });
  const status = c.req.query("status");

  if (status) {
    // Return jobs matching the requested status
    const jobs = await db.collection("jobs").find({ status }).toArray();
    return json(c, { recipes: jobs });
  }

  // Default: only completed valid recipes (same filter as Java /recipes endpoint)
  const pipeline = [
    { $match: { status: "COMPLETED" } },
    {
      $addFields: {
        hasResult: { $ne: ["$result", null] },
        isExtracted: { $eq: ["$result.status", "extracted"] },
        hasName: { $ne: ["$result.recipeName", null] },
        hasIngredients: { $gt: [{$size: "$result.ingredients"}, 0] },
        hasInstructions: { $gt: [{$size: "$result.instructions"}, 0] },
      },
    },
    {
      $match: {
        hasResult: true,
        isExtracted: true,
        hasName: true,
        hasIngredients: true,
        hasInstructions: true,
      },
    },
    {
      $project: {
        _id: 1,
        url: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        result: 1,
      },
    },
  ];

  const recipes = await db.collection("jobs").aggregate(pipeline).toArray();
  return json(c, { recipes });
});

// PATCH /api/recipes/:id/result — post LLM extraction result (worker only)
api.patch("/api/recipes/:id/result", async (c: Context) => {
  const { getDb } = await import("./db.js");
  const db = await getDb({ url: process.env.MONGODB_URI ?? "mongodb://localhost:27017", dbName: process.env.DB_NAME ?? "recing" });
  const id = c.req.param("id");
  const body = await c.req.json();

  // Build partial update document
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updatedAt: now };

  if (body.result !== undefined) {
    update.result = body.result;
    update.status = body.isValid ? "COMPLETED" : "FAILED";
  }
  if (body.error !== undefined) {
    update.error = body.error;
    update.status = "FAILED";
  }

  const jobsCol = db.collection("jobs");
  const result = await jobsCol.findOneAndUpdate(
    { _id: id } as any,
    { $set: update },
    { returnDocument: "after" as const }
  );

  if (!result) {
    return json(c, { error: "Job not found" }, 404);
  }

  return json(c, result);
});

// GET /api/recipes/:id — fetch a single completed recipe by ID
api.get("/api/recipes/:id", async (c: Context) => {
  const { getDb } = await import("./db.js");
  const db = await getDb({ url: process.env.MONGODB_URI ?? "mongodb://localhost:27017", dbName: process.env.DB_NAME ?? "recing" });
  const id = c.req.param("id");

  // Fetch the job and validate it has a completed valid extraction in JS
  const recipe = await db.collection("jobs").findOne({ _id: id } as any);
  if (!recipe || recipe.status !== "COMPLETED" || !recipe.result) {
    return json(c, { error: "Recipe not found" }, 404);
  }

  const r = recipe.result;
  if (r.status !== "extracted" || !r.recipeName ||
      !Array.isArray(r.ingredients) || r.ingredients.length === 0 ||
      !Array.isArray(r.instructions) || r.instructions.length === 0) {
    return json(c, { error: "Recipe not found" }, 404);
  }

  return json(c, { recipe });
});

// PATCH /api/recipes/:id/retry — move FAILED → PENDING for re-processing
api.patch("/api/recipes/:id/retry", async (c: Context) => {
  const { getDb } = await import("./db.js");
  const db = await getDb({ url: process.env.MONGODB_URI ?? "mongodb://localhost:27017", dbName: process.env.DB_NAME ?? "recing" });
  const id = c.req.param("id");
  const now = new Date().toISOString();

  const result = await db.collection("jobs").findOneAndUpdate(
    { _id: id, status: "FAILED" } as any,
    { $set: { status: "PENDING", result: null, error: null, updatedAt: now } },
    { returnDocument: "after" as const }
  );

  if (!result) {
    return json(c, { error: "Job not found or not in FAILED state" }, 404);
  }

  return json(c, { ok: true });
});

// DELETE /api/recipes/:id — remove a job
api.delete("/api/recipes/:id", async (c: Context) => {
  const { getDb } = await import("./db.js");
  const db = await getDb({ url: process.env.MONGODB_URI ?? "mongodb://localhost:27017", dbName: process.env.DB_NAME ?? "recing" });
  const id = c.req.param("id");
  const jobsCol = db.collection("jobs");

  const result = await jobsCol.deleteOne({ _id: id } as any);
  if (result.deletedCount === 0) {
    return json(c, { error: "Job not found" }, 404);
  }

  return json(c, { ok: true });
});

// ─── Combine public + authenticated apps ─────────────────────────────────────

const app = new Hono<Env>();
app.route("", publicApp); // health check (public)
app.route("", api);       // all /api/* routes require auth

export default app;
