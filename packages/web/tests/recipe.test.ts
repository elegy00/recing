import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/hono-app.js";
import { query, queryOne } from "../src/db.js";

const TEST_URL = process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL || "postgresql://recing:recing@localhost:5432/recing";
// Ensure db.js's global pool (query/queryOne) targets the same database as the API pool in req().
process.env.POSTGRES_URL = TEST_URL;

beforeEach(async () => {
  // Truncate all tables for a clean slate
  await query("DELETE FROM jobs");
});

async function req(method: string, path: string, body?: unknown) {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    { DATABASE_POOL: new (await import("pg")).Pool({ connectionString: TEST_URL }) },
    {}
  );
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ─── POST /api/recipes ──────────────────────────────────────────────────────

describe("POST /api/recipes", () => {
  it("creates a job and returns jobId with 201", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/recipe" });
    expect(res.status).toBe(201);
    const data = await json<{ jobId: string }>(res);
    expect(data.jobId).toMatch(/^[a-f0-9\-]{36}$/);
  });

  it("rejects empty body", async () => {
    const res = await req("POST", "/api/recipes", {});
    expect(res.status).toBe(400);
  });

  it("rejects missing url field", async () => {
    const res = await req("POST", "/api/recipes", { foo: "bar" });
    expect(res.status).toBe(400);
  });

  it("trims whitespace from url", async () => {
    await req("POST", "/api/recipes", { url: "  http://example.com/trimmed  " });
    const jobs = await query<{ url: string; status: string }>("SELECT url, status FROM jobs");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].url).toBe("http://example.com/trimmed");
    expect(jobs[0].status).toBe("PENDING");
  });
});

// ─── GET /api/recipes ────────────────────────────────────────────────────────

describe("GET /api/recipes", () => {
  it("returns empty list when no jobs exist", async () => {
    const res = await req("GET", "/api/recipes");
    expect(res.status).toBe(200);
    const data = await json<Record<string, unknown>>(res);
    expect((data.recipes as unknown[]).length).toBe(0);
  });

  it("returns only completed valid recipes by default", async () => {
    await query("INSERT INTO jobs (id, url, status, result) VALUES (gen_random_uuid(), $1, $2, $3)", [
      "http://a.com", "COMPLETED", '{"status":"extracted","recipeName":"Pancakes","ingredients":[{"name":"flour"}],"instructions":[{"text":"Mix"}]}'
    ]);
    await query("INSERT INTO jobs (id, url, status) VALUES (gen_random_uuid(), $1, $2)", ["http://b.com", "PENDING"]);
    await query("INSERT INTO jobs (id, url, status, error) VALUES (gen_random_uuid(), $1, $2, $3)", ["http://c.com", "FAILED", "Error"]);
    
    const res = await req("GET", "/api/recipes");
    const data = await json<Record<string, unknown>>(res);
    expect((data.recipes as unknown[]).length).toBe(1);
    expect((data.recipes as Record<string, unknown>)[0].url).toBe("http://a.com");
  });

  it("filters by status when ?status=PENDING", async () => {
    await query("INSERT INTO jobs (id, url, status) VALUES (gen_random_uuid(), $1, $2)", ["http://a.com", "PENDING"]);
    await query("INSERT INTO jobs (id, url, status) VALUES (gen_random_uuid(), $1, $2)", ["http://b.com", "COMPLETED"]);
    
    const res = await req("GET", "/api/recipes?status=PENDING");
    const data = await json<Record<string, unknown>>(res);
    expect((data.recipes as unknown[]).length).toBe(1);
    expect((data.recipes as Record<string, unknown>)[0].url).toBe("http://a.com");
  });
});

// ─── GET /api/recipes/:id ───────────────────────────────────────────────────

describe("GET /api/recipes/:id", () => {
  it("returns a completed valid recipe", async () => {
    const row = await queryOne<{ id: string }>(
      "INSERT INTO jobs (id, url, status, result) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id",
      ["http://a.com", "COMPLETED", '{"status":"extracted","recipeName":"Spaghetti","ingredients":[{"name":"pasta"}],"instructions":[{"text":"Boil"}]}']
    );
    const res = await req("GET", `/api/recipes/${row?.id}`);
    expect(res.status).toBe(200);
    const data = await json<{ recipe: Record<string, unknown> }>(res);
    expect(data.recipe.status).toBe("COMPLETED");
    expect(data.recipe.result.recipeName).toBe("Spaghetti");
  });

  it("returns 404 for PENDING job", async () => {
    await query("INSERT INTO jobs (id, url, status) VALUES (gen_random_uuid(), $1, $2)", ["http://a.com", "PENDING"]);
    const res = await req("GET", "/api/recipes/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown ID", async () => {
    const res = await req("GET", "/api/recipes/nonexistent-id");
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/recipes/:id ────────────────────────────────────────────────

describe("DELETE /api/recipes/:id", () => {
  it("removes a job", async () => {
    const res1 = await req("POST", "/api/recipes", { url: "http://example.com/del" });
    const jobId = (await json<{ jobId: string }>(res1)).jobId;
    
    const res = await req("DELETE", `/api/recipes/${jobId}`);
    expect(res.status).toBe(200);
    
    const rows = await query<{ cnt: string }>("SELECT count(*) as cnt FROM jobs");
    expect(parseInt(rows[0].cnt)).toBe(0);
  });

  it("returns 404 for unknown job", async () => {
    const res = await req("DELETE", "/api/recipes/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/recipes/:id/retry ─────────────────────────────────────────────

describe("PATCH /api/recipes/:id/retry", () => {
  it("resets a FAILED job to PENDING and clears result/error", async () => {
    const jobId = crypto.randomUUID();
    await query(
      "INSERT INTO jobs (id, url, status, result, error) VALUES ($1, $2, $3, $4, $5)",
      [jobId, "http://example.com/recipe", "FAILED", '{"recipeName":"Test"}', "Something went wrong"]
    );

    const res = await req("PATCH", `/api/recipes/${jobId}/retry`);
    expect(res.status).toBe(200);

    const job = await queryOne<{ status: string; result: unknown; error: unknown }>(
      "SELECT status, result, error FROM jobs WHERE id = $1", [jobId]
    );
    expect(job?.status).toBe("PENDING");
    expect(job?.result).toBeNull();
    expect(job?.error).toBeNull();
  });

  it("returns 404 for unknown job", async () => {
    const res = await req("PATCH", "/api/recipes/nonexistent-id/retry");
    expect(res.status).toBe(404);
  });

  it("resets a PENDING job back to PENDING (idempotent)", async () => {
    const jobId = crypto.randomUUID();
    await query(
      "INSERT INTO jobs (id, url, status) VALUES ($1, $2, $3)",
      [jobId, "http://example.com/recipe", "PENDING"]
    );

    const res = await req("PATCH", `/api/recipes/${jobId}/retry`);
    expect(res.status).toBe(200);

    const job = await queryOne<{ status: string }>("SELECT status FROM jobs WHERE id = $1", [jobId]);
    expect(job?.status).toBe("PENDING");
  });
});

// ─── _id field in responses ──────────────────────────────────────────────────
// Database columns use "id" but the frontend expects "_id". This must be mapped.

describe("API responses use _id not id", () => {
  it("GET /api/recipes returns _id on recipe objects", async () => {
    const row = await queryOne<{ id: string }>(
      "INSERT INTO jobs (id, url, status, result) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id",
      ["http://a.com", "COMPLETED", '{"status":"extracted","recipeName":"A","ingredients":[{"name":"flour"}],"instructions":[{"text":"Mix"}]}']
    );
    const res = await req("GET", `/api/recipes/${row?.id}`);
    const data = await json<{ recipe: Record<string, unknown> }>(res);
    expect(data.recipe._id).toBeDefined();
    expect(data.recipe.id).toBeUndefined();
  });

  it("GET /api/recipes?status=PENDING returns _id on job objects", async () => {
    const jobId = crypto.randomUUID();
    await query("INSERT INTO jobs (id, url, status) VALUES ($1, $2, $3)", [jobId, "http://a.com", "PENDING"]);
    const res = await req("GET", "/api/recipes?status=PENDING");
    const data = await json<{ recipes: Record<string, unknown>[] }>(res);
    expect(data.recipes.length).toBe(1);
    expect(data.recipes[0]._id).toBeDefined();
    expect(data.recipes[0].id).toBeUndefined();
  });
});

// ─── Health check ──────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns ok when Postgres is reachable", async () => {
    const { Pool } = await import("pg");
    const res = await app.fetch(
      new Request("http://localhost/health"),
      { DATABASE_POOL: new Pool({ connectionString: TEST_URL }) },
      {}
    );
    expect(res.status).toBe(200);
    const data = await json<{ status: string }>(res);
    expect(data.status).toBe("ok");
  });
});
