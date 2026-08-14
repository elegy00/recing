import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/hono-app.js";

const TEST_URL = process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL || "postgresql://recing:recing@localhost:5432/recing";

async function req(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    { DATABASE_POOL: new (await import("pg")).Pool({ connectionString: TEST_URL }) },
    {}
  );
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ─── Auth disabled ──────────────────────────────────────────────────────────

describe("Auth disabled — no API key", () => {
  it("allows POST without token", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/test" });
    expect(res.status).toBe(201);
  });

  it("allows GET without token", async () => {
    const res = await req("GET", "/api/recipes");
    expect(res.status).toBe(200);
  });

  it("allows GET /health without token", async () => {
    const res = await req("GET", "/health");
    expect(res.status).toBe(200);
  });
});

// ─── Auth enabled ────────────────────────────────────────────────────────────

describe("Auth enabled — unauthenticated rejected", () => {
  beforeEach(() => { process.env.RECING_API_KEY = "super-secret-key"; });

  it("rejects POST without Authorization", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/test" });
    expect(res.status).toBe(401);
  });

  it("rejects POST with wrong token", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/test" }, { Authorization: "Bearer wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects GET without Authorization", async () => {
    const res = await req("GET", "/api/recipes");
    expect(res.status).toBe(401);
  });

  it("rejects DELETE without token", async () => {
    const res = await req("DELETE", "/api/recipes/some-id");
    expect(res.status).toBe(401);
  });

  it("allows GET /health without token", async () => {
    const res = await req("GET", "/health");
    expect(res.status).toBe(200);
  });
});

// ─── Auth enabled — correct token works ──────────────────────────────────────

describe("Auth enabled — valid requests succeed", () => {
  beforeEach(() => { process.env.RECING_API_KEY = "super-secret-key"; });

  it("allows POST with correct token", async () => {
    const res = await req("POST", "/api/recipes", { url: "http://example.com/test" }, { Authorization: "Bearer super-secret-key" });
    expect(res.status).toBe(201);
  });

  it("allows GET with correct token", async () => {
    const res = await req("GET", "/api/recipes", undefined, { Authorization: "Bearer super-secret-key" });
    expect(res.status).toBe(200);
  });
});
