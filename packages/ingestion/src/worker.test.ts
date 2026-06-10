import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock modules before any imports ──────────────────────────────────────────

vi.mock("./url-fetcher.js", () => ({
  fetchUrl: vi.fn(),
}));

vi.mock("./llm-extraction.js", () => {
  const LlmExtractionError = class extends Error {
    constructor(
      public readonly code: string,
      message?: string,
      detail?: string
    ) {
      super(detail ? `${message}: ${detail}` : message ?? "");
      this.name = "LlmExtractionError";
    }
    getUserMessage(): string { return this.message.split(":")[0]; }
  };
  return { extractRecipe: vi.fn(), LlmExtractionError };
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

const baseConfig = { baseUrl: "http://localhost:3000", apiKey: "test-key" as const };
const extractionConfig = { endpoint: "http://localhost:8085/v1/chat/completions" as const, model: "qwen3.6" as const };

// ─── runWorker tests ──────────────────────────────────────────────────────────

describe("runWorker", () => {
  it("returns an AbortController that can stop the loop", async () => {
    // Re-import after mocks are set up
    vi.resetModules();
    const mod = await import("./worker.js");
    const controller = (mod as typeof import("./worker.js")).runWorker({ ...baseConfig, ...extractionConfig, pollIntervalMs: 10 });

    expect(controller.signal.aborted).toBe(false);
    setTimeout(() => controller.abort(), 50);

    await new Promise<void>((resolve) => {
      const check = () => {
        if (controller.signal.aborted) resolve();
        else setTimeout(check, 20);
      };
      check();
    });

    expect(controller.signal.aborted).toBe(true);
  });

  it("handles empty pending jobs without error", async () => {
    vi.resetModules();
    const mod = await import("./worker.js");
    // fetchPendingJobs mock (from api-client) returns []
    const controller = (mod as typeof import("./worker.js")).runWorker({ ...baseConfig, ...extractionConfig, pollIntervalMs: 10 });
    setTimeout(() => controller.abort(), 50);

    await new Promise<void>((resolve) => {
      const check = () => {
        if (controller.signal.aborted) resolve();
        else setTimeout(check, 20);
      };
      check();
    });
  });

  it("handles poll errors without crashing", async () => {
    vi.resetModules();
    // Mock fetch to throw on the pending jobs call
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch as unknown as typeof fetch;

    const mod = await import("./worker.js");
    const controller = (mod as typeof import("./worker.js")).runWorker({ ...baseConfig, ...extractionConfig, pollIntervalMs: 10 });
    setTimeout(() => controller.abort(), 50);

    await new Promise<void>((resolve) => {
      const check = () => {
        if (controller.signal.aborted) resolve();
        else setTimeout(check, 20);
      };
      check();
    });
  });
});

// ─── api-client tests ─────────────────────────────────────────────────────────

describe("api-client", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("fetchPendingJobs returns recipes array with correct auth header", async () => {
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipes: [{ _id: "j1", url: "http://x.com/r", status: "PENDING", createdAt: "", updatedAt: "", result: null }] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { fetchPendingJobs } = await import("./api-client.js");
    const jobs = await fetchPendingJobs(baseConfig);

    expect(jobs).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/recipes?status=PENDING",
      expect.objectContaining({ headers: { Authorization: "Bearer test-key" } })
    );
  });

  it("fetchPendingJobs throws on non-200", async () => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: "Unauthorized" });

    const { fetchPendingJobs } = await import("./api-client.js");
    await expect(fetchPendingJobs(baseConfig)).rejects.toThrow("Failed to fetch pending jobs");
  });

  it("submitJob returns jobId string", async () => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: "new-job-id" }),
    });

    const { submitJob } = await import("./api-client.js");
    const id = await submitJob(baseConfig, "http://example.com/test");

    expect(id).toBe("new-job-id");
  });

  it("postResult calls API with extraction and auth", async () => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { postResult } = await import("./api-client.js");
    await postResult(baseConfig, "j1", { schemaVersion: "v1", status: "extracted", sourceUrl: "", recipeName: null, ingredients: [], instructions: [], notes: [] }, {});

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/recipes/j1/result",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });

  it("reportFailure calls API with error info and auth", async () => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { reportFailure } = await import("./api-client.js");
    await reportFailure(baseConfig, "j1", "LLM_FAILED", "Something went wrong");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/recipes/j1/result",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("LLM_FAILED"),
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });
});
