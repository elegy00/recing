import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/hono-app.js";
import type { DbConfig } from "../src/db.js";

// ─── In-memory MongoDB mock ──────────────────────────────────────────────────

type Doc = Record<string, unknown> & { _id: string };

class MemoryCollection implements AsyncIterable<Doc> {
  private store = new Map<string, Doc>();

  async insertOne(doc: Doc): Promise<{ insertedId: string }> {
    const id = (doc._id as string) ?? crypto.randomUUID();
    this.store.set(id, { ...doc, _id: id });
    return { insertedId: id };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findOneAndUpdate(filter: Record<string, any>, update: { $set: Record<string, unknown> }, opts: { returnDocument: "after" }): Promise<Doc | null> {
    const doc = this.store.get(filter._id);
    if (!doc) return null;
    Object.assign(doc, update.$set);
    this.store.set(doc._id as string, doc);
    return opts.returnDocument === "after" ? doc : null;
  }

  async deleteOne(filter: { _id: string }): Promise<{ deletedCount: number }> {
    const has = this.store.has(filter._id);
    if (has) this.store.delete(filter._id);
    return { deletedCount: has ? 1 : 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  find(filter: Record<string, any>): { toArray(): Promise<Doc[]>; [Symbol.asyncIterator](): AsyncIterator<Doc> } {
    const results = Array.from(this.store.values()).filter((doc) => Object.entries(filter).every(([k, v]) => (doc as Record<string, unknown>)[k] === v));
    return { toArray: () => Promise.resolve(results), [Symbol.asyncIterator]() { let i = 0; return { next: () => i < results.length ? Promise.resolve({ value: results[i++], done: false }) : Promise.resolve({ done: true } as IteratorResult<Doc>) }; } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aggregate(pipeline: any[]): { toArray(): Promise<Doc[]> } {
    let docs = Array.from(this.store.values()) as Doc[];
    for (const stage of pipeline) {
      if (stage.$match) {
        const match = stage.$match;
        // Handle $addFields inside $match
        if (match.$addFields) {
          docs = docs.map((doc) => {
            const r: Record<string, unknown> = { ...doc };
            for (const [k, expr] of Object.entries(match.$addFields)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              r[k] = evalExpr(expr as any, doc);
            }
            return r as Doc;
          });
        }
        // Filter by remaining fields
        const filterKeys = Object.keys(match).filter((k) => k !== "$addFields");
        docs = docs.filter((doc) => {
          for (const k of filterKeys) {
            if ((doc as Record<string, unknown>)[k] !== match[k]) return false;
          }
          return true;
        });
      } else if (stage.$addFields) {
        docs = docs.map((doc) => {
          const r: Record<string, unknown> = { ...doc };
          for (const [k, expr] of Object.entries(stage.$addFields)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            r[k] = evalExpr(expr as any, doc);
          }
          return r as Doc;
        });
      } else if (stage.$project) {
      } else if (stage.$project) {
        const proj = stage.$project;
        docs = docs.map((doc) => {
          const result: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(proj)) {
            if (v === 1 || v === true) result[k as string] = (doc as Record<string, unknown>)[k];
          }
          return result as Doc;
        });
      }
    }
    return { toArray: () => Promise.resolve(docs) };
  }

  async countDocuments(filter?: Record<string, unknown>): Promise<number> {
    if (!filter) return this.store.size;
    return Array.from(this.store.values()).filter((doc) => Object.entries(filter).every(([k, v]) => (doc as Record<string, unknown>)[k] === v)).length;
  }

  async deleteMany(filter?: Record<string, unknown>): Promise<{ deletedCount: number }> {
    const keys = Array.from(this.store.keys());
    let count = 0;
    for (const key of keys) {
      if (!filter || Object.entries(filter).every(([k, v]) => (this.store.get(key)! as Record<string, unknown>)[k] === v)) {
        this.store.delete(key);
        count++;
      }
    }
    return { deletedCount: count };
  }

  async findOne(filter: { _id: string }): Promise<Doc | null> {
    return this.store.get(filter._id) ?? null;
  }

  collection(_name: string): MemoryCollection {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async command(cmd: any): Promise<{ ok: number }> {
    if (cmd.ping) return { ok: 1 };
    throw new Error(`Unsupported command: ${JSON.stringify(cmd)}`);
  }

  [Symbol.asyncIterator](): AsyncIterator<Doc> {
    const values = Array.from(this.store.values());
    let i = 0;
    return { next: () => i < values.length ? Promise.resolve({ value: values[i++], done: false }) : Promise.resolve({ done: true } as IteratorResult<Doc>) };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evalExpr(expr: any, doc: Record<string, unknown>): unknown {
  // Handle null/undefined (from MongoDB $ne with null literal)
  if (expr === null || expr === undefined) return expr;
  // MongoDB operator: { $op: [args...] } or { $op: expr }
  if (typeof expr === "object" && !Array.isArray(expr)) {
    const keys = Object.keys(expr)
    if (keys.length === 1) {
      const op = keys[0];
      const rawArg = expr[op];
      // Normalize: wrap non-array args into array for consistent handling
      const args: unknown[] = Array.isArray(rawArg) ? rawArg : [rawArg];
      switch (op) {
      case "$ne": return evalExpr(args[0], doc) !== evalExpr(args[1], doc);
      case "$eq": return evalExpr(args[0], doc) === evalExpr(args[1], doc);
      case "$gt": return evalExpr(args[0], doc) > evalExpr(args[1], doc);
      case "$size": {
        const arr = evalExpr(args[0], doc);
        return Array.isArray(arr) ? arr.length : 0;
      }
      default: break;
      }
    } else {
      return expr; // multi-key object, treat as literal
    }
  }
  // Field reference like "$result", "$result.ingredients"
  if (typeof expr === "string" && expr.startsWith("$")) {
    const parts = expr.slice(1).split(".");
    let val: unknown = doc;
    for (const p of parts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      val = (val as any)[p];
      if (val === undefined) return null;
    }
    return val;
  }
  return expr; // literal value
}

class MockDb implements AsyncIterable<Doc> {
  private collections = new Map<string, MemoryCollection>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async command(cmd: any): Promise<{ ok: number }> {
    if (cmd.ping) return { ok: 1 };
    throw new Error(`Unsupported command: ${JSON.stringify(cmd)}`);
  }

  collection(name: string): MemoryCollection {
    let coll = this.collections.get(name);
    if (!coll) {
      coll = new MemoryCollection();
      this.collections.set(name, coll);
    }
    return coll;
  }

  [Symbol.asyncIterator](): AsyncIterator<Doc> {
    throw new Error("Not implemented");
  }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

let mockDb: MockDb;

beforeEach(() => {
  // Set the global test hook that db.ts checks
  (globalThis as Record<string, unknown>).__recingMockDb = undefined;
  mockDb = new MockDb();
  (globalThis as Record<string, unknown>).__recingMockDb = mockDb;
});

async function req(method: string, path: string, body?: unknown) {
  const url = `http://localhost${path}`;
  return app.fetch(
    new Request(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
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
    // Clean up first
    await mockDb.collection("jobs").deleteMany({});
    const res = await req("POST", "/api/recipes", { url: "  http://example.com/trimmed  " });
    expect(res.status).toBe(201);

    // Verify via mock db that URL was trimmed
    const jobsCol = mockDb.collection("jobs");
    const allDocs = await jobsCol.find({}).toArray();
    expect(allDocs.length).toBe(1);
    expect(allDocs[0].url).toBe("http://example.com/trimmed");
    expect(allDocs[0].status).toBe("PENDING");
  });
});

// ─── GET /api/recipes ────────────────────────────────────────────────────────

describe("GET /api/recipes", () => {
  it("returns empty list when no jobs exist", async () => {
    const res = await req("GET", "/api/recipes");
    expect(res.status).toBe(200);
    const data = await json<{ recipes: unknown[] }>(res);
    expect(data.recipes.length).toBe(0);
  });

  it("returns only completed valid recipes by default", async () => {
    // Valid completed recipe
    await mockDb.collection("jobs").insertOne({
      _id: "valid-1", url: "http://example.com/pancakes", status: "COMPLETED",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      result: {
        schemaVersion: "recipe_extraction.v1", status: "extracted", sourceUrl: "",
        recipeName: "Pancakes", ingredients: [{ name: "flour", originalText: "1 cup" }],
        instructions: [{ stepNumber: 1, text: "Mix" }], notes: [],
      },
    });

    // Pending job (should NOT appear)
    await mockDb.collection("jobs").insertOne({
      _id: "pending-1", url: "http://example.com/pending", status: "PENDING",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), result: null,
    });

    // Failed job (should NOT appear)
    await mockDb.collection("jobs").insertOne({
      _id: "failed-1", url: "http://example.com/failed", status: "FAILED",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      result: null, error: "Connection refused",
    });

    const res = await req("GET", "/api/recipes");
    expect(res.status).toBe(200);
    const data = await json<{ recipes: unknown[] }>(res);
    expect(data.recipes.length).toBe(1);
    expect(data.recipes[0].url).toBe("http://example.com/pancakes");

    // Cleanup
    await mockDb.collection("jobs").deleteMany({});
  });

  it("filters by status when ?status=pending is provided", async () => {
    await mockDb.collection("jobs").insertOne({
      _id: "p1", url: "http://a.com/1", status: "PENDING",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), result: null,
    });
    await mockDb.collection("jobs").insertOne({
      _id: "c1", url: "http://b.com/2", status: "COMPLETED",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      result: { schemaVersion: "recipe_extraction.v1", status: "extracted", sourceUrl: "", recipeName: null, ingredients: [], instructions: [], notes: [] },
    });

    const res = await req("GET", "/api/recipes?status=PENDING");
    expect(res.status).toBe(200);
    const data = await json<{ recipes: unknown[] }>(res);
    expect(data.recipes.length).toBe(1);
    expect(data.recipes[0].url).toBe("http://a.com/1");

    await mockDb.collection("jobs").deleteMany({});
  });
});

// ─── PATCH /api/recipes/:id/result ──────────────────────────────────────────

describe("PATCH /api/recipes/:id/result", () => {
  it("updates job to COMPLETED with result", async () => {
    const insertRes = await mockDb.collection("jobs").insertOne({
      _id: "patch-1", url: "http://example.com/test", status: "PENDING",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      result: null, error: null,
    });

    const extraction = {
      schemaVersion: "recipe_extraction.v1", status: "extracted", sourceUrl: "",
      recipeName: "Test Recipe", ingredients: [{ name: "sugar", originalText: "1 cup" }],
      instructions: [{ stepNumber: 1, text: "Mix" }], notes: [],
    };

    const res = await req("PATCH", `/api/recipes/${insertRes.insertedId}/result`, {
      result: extraction, isValid: true,
    });
    expect(res.status).toBe(200);

    const job = await mockDb.collection("jobs").findOne({ _id: insertRes.insertedId });
    expect(job?.status).toBe("COMPLETED");
    expect((job as Record<string, unknown>)?.result?.recipeName).toBe("Test Recipe");
  });

  it("sets FAILED status with error message", async () => {
    const insertRes = await mockDb.collection("jobs").insertOne({
      _id: "patch-2", url: "http://example.com/test2", status: "PENDING",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      result: null, error: null,
    });

    const res = await req("PATCH", `/api/recipes/${insertRes.insertedId}/result`, {
      isValid: false, error: "LLM unavailable",
    });
    expect(res.status).toBe(200);

    const job = await mockDb.collection("jobs").findOne({ _id: insertRes.insertedId });
    expect(job?.status).toBe("FAILED");
    expect(job?.error).toBe("LLM unavailable");
  });

  it("returns 404 for unknown job id", async () => {
    const res = await req("PATCH", "/api/recipes/nonexistent-id/result", {});
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/recipes/:id ────────────────────────────────────────────────

describe("DELETE /api/recipes/:id", () => {
  it("removes a job and returns ok", async () => {
    const insertRes = await mockDb.collection("jobs").insertOne({
      _id: "del-1", url: "http://example.com/del", status: "PENDING",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      result: null, error: null,
    });

    const res = await req("DELETE", `/api/recipes/${insertRes.insertedId}`);
    expect(res.status).toBe(200);
    const data = await json<{ ok: boolean }>(res);
    expect(data.ok).toBe(true);

    // Verify deletion
    const remaining = await mockDb.collection("jobs").countDocuments();
    expect(remaining).toBe(0);
  });

  it("returns 404 for unknown job id", async () => {
    const res = await req("DELETE", "/api/recipes/nonexistent-id");
    expect(res.status).toBe(404);
  });
});

// ─── Health check ──────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns ok when MongoDB is reachable", async () => {
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const data = await json<{ status: string }>(res);
    expect(data.status).toBe("ok");
  });
});
