import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";

// ─── Mock modules before any imports ──────────────────────────────────────────

const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockDb = { query: mockQuery } as unknown as Pool;
const mockFetchUrl = vi.fn();
const mockExtractRecipe = vi.fn();

vi.mock("./url-fetcher.js", () => ({
  fetchUrl: (...args: unknown[]) => mockFetchUrl(...args),
}));

vi.mock("./llm-extraction.js", () => ({
  extractRecipe: (...args: unknown[]) => mockExtractRecipe(...args),
  LlmExtractionError: class extends Error {
    constructor(public readonly code: string, message?: string) {
      super(message ?? "");
      this.name = "LlmExtractionError";
    }
    getUserMessage(): string { return this.message; }
  },
}));

vi.mock("./db.js", () => ({
  getDb: () => mockDb,
  closeDb: vi.fn().mockResolvedValue(undefined),
}));

import { runWorker } from "./worker.js";
import { getDb, closeDb } from "./db.js";

const extractionConfig = { endpoint: "http://localhost:8085/v1/chat/completions", model: "qwen3.6" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check if a SQL string was executed. */
function sqlWasCalled(sql: string): boolean {
  return mockQuery.mock.calls.some((c) => c[0] === sql);
}

/** Check if an SQL with the given substring was called. */
function sqlContains(substring: string): boolean {
  return mockQuery.mock.calls.some((c) => typeof c[0] === "string" && c[0].includes(substring));
}

/** Get the params from a call that matches the SQL substring. */
function getCallParams(sqlSubstring: string): unknown[] | undefined {
  const call = mockQuery.mock.calls.find((c) => typeof c[0] === "string" && c[0].includes(sqlSubstring));
  if (!call) return undefined;
  // query(sql, params) → call is [sql, params] → unwrap params
  return Array.isArray(call[1]) ? call[1] : call.slice(1);
}

// ─── runWorker tests ──────────────────────────────────────────────────────────

describe("runWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockFetchUrl.mockResolvedValue({
      url: "http://x.com/test",
      finalUrl: "http://x.com/test",
      contentType: "text/html",
      body: "<html><body>Test</body></html>",
      title: null,
    });
    mockExtractRecipe.mockResolvedValue({
      extraction: { schemaVersion: "v1", status: "extracted", ingredients: [], instructions: [], notes: [], sourceUrl: "" },
      metadata: { durationMs: 0, model: "qwen3.6", promptVersion: "v1", schemaVersion: "v1", requestContentChars: 100 },
    });
  });

  it("returns an AbortController that can stop the loop", async () => {
    const controller = runWorker({ ...extractionConfig, pollIntervalMs: 10 });
    expect(controller.signal.aborted).toBe(false);

    setTimeout(() => controller.abort(), 50);

    await new Promise<void>((resolve) => {
      const check = () => controller.signal.aborted ? resolve() : setTimeout(check, 20);
      check();
    });

    expect(controller.signal.aborted).toBe(true);
  });

  it("handles empty pending jobs without error", async () => {
    const controller = runWorker({ ...extractionConfig, pollIntervalMs: 10 });
    setTimeout(() => controller.abort(), 50);

    await new Promise<void>((resolve) => {
      const check = () => controller.signal.aborted ? resolve() : setTimeout(check, 20);
      check();
    });

    expect(controller.signal.aborted).toBe(true);
    expect(sqlWasCalled("SELECT id, url FROM jobs WHERE status = 'PENDING' ORDER BY created_at ASC")).toBe(true);
  });

  it("processes a pending job through full pipeline", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "j1", url: "http://x.com/test" }] });

    const controller = runWorker({ ...extractionConfig, pollIntervalMs: 10 });
    setTimeout(() => controller.abort(), 100);

    await new Promise<void>((resolve) => {
      const check = () => controller.signal.aborted ? resolve() : setTimeout(check, 20);
      check();
    });

    expect(controller.signal.aborted).toBe(true);
    expect(sqlWasCalled("SELECT id, url FROM jobs WHERE status = 'PENDING' ORDER BY created_at ASC")).toBe(true);
    expect(sqlWasCalled("UPDATE jobs SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1 AND status = 'PENDING'")).toBe(true);
    expect(sqlContains("UPDATE jobs SET status = 'COMPLETED'")).toBe(true);
    expect(sqlContains("UPDATE jobs SET status = 'FAILED'")).toBe(false);
    const params = getCallParams("UPDATE jobs SET status = 'COMPLETED'");
    expect(params?.[0]).toBe("j1");
  });

  it("handles fetch errors by marking job as failed", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "j1", url: "http://x.com" }] });
    mockFetchUrl.mockRejectedValue(new Error("network error"));
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE failed

    const controller = runWorker({ ...extractionConfig, pollIntervalMs: 10 });
    setTimeout(() => controller.abort(), 100);

    await new Promise<void>((resolve) => {
      const check = () => controller.signal.aborted ? resolve() : setTimeout(check, 20);
      check();
    });

    expect(controller.signal.aborted).toBe(true);
    expect(sqlContains("UPDATE jobs SET status = 'FAILED'")).toBe(true);
    const params = getCallParams("UPDATE jobs SET status = 'FAILED'");
    expect(params?.[0]).toBe("j1");
    expect(params?.[1]).toBe("Error: network error");
    expect(sqlContains("UPDATE jobs SET status = 'COMPLETED'")).toBe(false);
  });
});

describe("closeDb", () => {
  it("can be called for shutdown", async () => {
    await closeDb();
    expect(closeDb).toHaveBeenCalled();
  });
});
