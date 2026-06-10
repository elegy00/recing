import { describe, it, expect, beforeEach, afterEach } from "vitest";
import app from "../src/hono-app.js";
import { authEnabled } from "../src/auth.js";

// ─── In-memory MongoDB mock (same as recipe.test.ts) ────────────────────────

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
      if (stage.$match && stage.$match.$addFields) {
        const match = stage.$match;
        docs = docs.map((doc) => {
          const r: Record<string, unknown> = { ...doc };
          for (const [k, expr] of Object.entries(match.$addFields)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            r[k] = evalExpr(expr as any, doc);
          }
          return r as Doc;
        });
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

  async countDocuments(): Promise<number> { return this.store.size; }
  async deleteMany(): Promise<{ deletedCount: number }> { return { deletedCount: 0 }; }
  async findOne(filter: { _id: string }): Promise<Doc | null> { return this.store.get(filter._id) ?? null; }
  collection(_name: string): MemoryCollection { return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async command(cmd: any): Promise<{ ok: number }> { if (cmd.ping) return { ok: 1 }; throw new Error(`Unsupported command: ${JSON.stringify(cmd)}`); }
  [Symbol.asyncIterator](): AsyncIterator<Doc> { const values = Array.from(this.store.values()); let i = 0; return { next: () => i < values.length ? Promise.resolve({ value: values[i++], done: false }) : Promise.resolve({ done: true } as IteratorResult<Doc>) }; }
}

function evalExpr(expr: any, doc: Record<string, unknown>): unknown {
  if (expr === null || expr === undefined) return expr;
  if (typeof expr === "object" && !Array.isArray(expr)) {
    const keys = Object.keys(expr);
    if (keys.length === 1) {
      const op = keys[0];
      const rawArg = expr[op];
      const args: unknown[] = Array.isArray(rawArg) ? rawArg : [rawArg];
      switch (op) {
        case "$ne": return evalExpr(args[0], doc) !== evalExpr(args[1], doc);
        case "$eq": return evalExpr(args[0], doc) === evalExpr(args[1], doc);
        case "$gt": return evalExpr(args[0], doc) > evalExpr(args[1], doc);
        case "$size": { const arr = evalExpr(args[0], doc); return Array.isArray(arr) ? arr.length : 0; }
        default: break;
      }
    } else { return expr; }
  }
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
  return expr;
}

class MockDb implements AsyncIterable<Doc> {
  private collections = new Map<string, MemoryCollection>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async command(cmd: any): Promise<{ ok: number }> { if (cmd.ping) return { ok: 1 }; throw new Error(`Unsupported command`); }
  collection(name: string): MemoryCollection {
    let coll = this.collections.get(name);
    if (!coll) { coll = new MemoryCollection(); this.collections.set(name, coll); }
    return coll;
  }
  [Symbol.asyncIterator](): AsyncIterator<Doc> { throw new Error("Not implemented"); }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

let mockDb: MockDb;
const originalApiKey = process.env.RECING_API_KEY;

beforeEach(() => {
  // Reset auth state and DB between tests
  (globalThis as Record<string, unknown>).__recingMockDb = undefined;
  delete process.env.RECING_API_KEY;
  mockDb = new MockDb();
  (globalThis as Record<string, unknown>).__recingMockDb = mockDb;
});

afterEach(() => {
  // Restore original env
  if (originalApiKey !== undefined) {
    process.env.RECING_API_KEY = originalApiKey;
  } else {
    delete process.env.RECING_API_KEY;
  }
});

async function req(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const url = `http://localhost${path}`;
  return app.fetch(
    new Request(url, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ─── authEnabled() ────────────────────────────────────────────────────────────

describe("authEnabled()", () => {
  it("returns false when RECING_API_KEY is not set", () => {
    expect(authEnabled()).toBe(false);
  });

  it("returns true when RECING_API_KEY is set and non-empty", () => {
    process.env.RECING_API_KEY = "test-secret";
    expect(authEnabled()).toBe(true);
  });

  it("returns false when RECING_API_KEY is empty string", () => {
    process.env.RECING_API_KEY = "";
    expect(authEnabled()).toBe(false);
  });
});

// ─── Auth disabled (default dev behavior) ─────────────────────────────────────

describe("Auth disabled — no API key set", () => {
  it("allows POST /api/recipes without token", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/test" });
    expect(res.status).toBe(201);
    const data = await json<{ jobId: string }>(res);
    expect(data.jobId).toBeTruthy();
  });

  it("allows GET /api/recipes without token", async () => {
    const res = await req("GET", "/api/recipes");
    expect(res.status).toBe(200);
    const data = await json<{ recipes: unknown[] }>(res);
    expect(Array.isArray(data.recipes)).toBe(true);
  });

  it("allows GET /health without token", async () => {
    const res = await req("GET", "/health");
    expect(res.status).toBe(200);
    const data = await json<{ status: string }>(res);
    expect(data.status).toBe("ok");
  });
});

// ─── Auth enabled — missing/wrong token → 401 ────────────────────────────────

describe("Auth enabled — unauthenticated requests rejected", () => {
  beforeEach(() => { process.env.RECING_API_KEY = "super-secret-key"; });

  it("rejects POST without Authorization header", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/test" });
    expect(res.status).toBe(401);
    const data = await json<{ error: string }>(res);
    expect(data.error).toBe("Unauthorized");
  });

  it("rejects POST with wrong token", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/test" }, { Authorization: "Bearer wrong-key" });
    expect(res.status).toBe(401);
  });

  it("rejects POST with Bearer but no token", async () => {
    const res = await req("POST", "/api/recipes", {}, { Authorization: "Bearer " });
    expect(res.status).toBe(401);
  });

  it("rejects GET without Authorization header", async () => {
    const res = await req("GET", "/api/recipes");
    expect(res.status).toBe(401);
  });

  it("rejects DELETE without token", async () => {
    // Insert a job first (we can't since auth blocks us, but we test the route directly)
    const res = await req("DELETE", "/api/recipes/some-id");
    expect(res.status).toBe(401);
  });

  it("allows GET /health without token even when auth is enabled", async () => {
    const res = await req("GET", "/health");
    expect(res.status).toBe(200);
  });
});

// ─── Auth enabled — correct token works ──────────────────────────────────────

describe("Auth enabled — valid requests succeed", () => {
  beforeEach(() => { process.env.RECING_API_KEY = "super-secret-key"; });

  it("allows POST with correct Bearer token", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/pancakes" }, { Authorization: "Bearer super-secret-key" });
    expect(res.status).toBe(201);
    const data = await json<{ jobId: string }>(res);
    expect(data.jobId).toBeTruthy();
  });

  it("allows GET with correct Bearer token", async () => {
    // Insert a valid recipe via mock DB first
    await mockDb.collection("jobs").insertOne({
      _id: "auth-test-1", url: "http://example.com/test", status: "COMPLETED",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      result: { schemaVersion: "recipe_extraction.v1", status: "extracted", sourceUrl: "", recipeName: null, ingredients: [], instructions: [], notes: [] },
    });

    const res = await req("GET", "/api/recipes", undefined, { Authorization: "Bearer super-secret-key" });
    expect(res.status).toBe(200);
  });
});
