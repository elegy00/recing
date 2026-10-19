import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import { PhotoChunkStatus, PhotoJobStatus } from "@recing/schema";

// ─── Mock modules before any imports ──────────────────────────────────────────

const mockFetchPendingChunks = vi.fn();
const mockFetchSettledChunks = vi.fn();
const mockSetJobStatus = vi.fn().mockResolvedValue(undefined);
const mockResetStuckChunks = vi.fn().mockResolvedValue(undefined);
const mockMarkChunkExtracting = vi.fn().mockResolvedValue(undefined);
const mockMarkChunkExtracted = vi.fn().mockResolvedValue(undefined);
const mockMarkChunkFailed = vi.fn().mockResolvedValue(undefined);
const mockIncrementCompletedChunks = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/photo-job-repository.js", () => ({
  fetchPendingPhotoJobs: vi.fn(),
  getJobStatus: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
  fetchPendingChunks: (...args: unknown[]) => mockFetchPendingChunks(...args),
  fetchSettledChunks: (...args: unknown[]) => mockFetchSettledChunks(...args),
  setJobStatus: (...args: unknown[]) => mockSetJobStatus(...args),
  resetStuckChunks: (...args: unknown[]) => mockResetStuckChunks(...args),
  markChunkExtracting: (...args: unknown[]) => mockMarkChunkExtracting(...args),
  markChunkExtracted: (...args: unknown[]) => mockMarkChunkExtracted(...args),
  markChunkFailed: (...args: unknown[]) => mockMarkChunkFailed(...args),
  incrementCompletedChunks: (...args: unknown[]) => mockIncrementCompletedChunks(...args),
}));

const mockExtractMarkdownFromPhoto = vi.fn();

vi.mock("../extraction/photo-extractor.js", () => ({
  extractMarkdownFromPhoto: (...args: unknown[]) => mockExtractMarkdownFromPhoto(...args),
  convertMarkdownToRecipe: vi.fn(),
}));

import { allExtractionsFailedMessage, runExtractionPhase } from "./photo-ingestion-worker.js";
import type { SettledPhotoChunk } from "../db/photo-job-repository.js";

const db = {} as Pool;
const config = { endpoint: "http://localhost:8085/v1/chat/completions", model: "qwen3.6" };
const jobId = "job-1";

function settled(overrides: Partial<SettledPhotoChunk> = {}): SettledPhotoChunk {
  return {
    id: "c1",
    orderNum: 0,
    status: PhotoChunkStatus.EXTRACTED,
    extractedMarkdown: "# Pancakes",
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetJobStatus.mockResolvedValue(undefined);
  mockResetStuckChunks.mockResolvedValue(undefined);
  mockMarkChunkExtracting.mockResolvedValue(undefined);
  mockMarkChunkExtracted.mockResolvedValue(undefined);
  mockMarkChunkFailed.mockResolvedValue(undefined);
  mockIncrementCompletedChunks.mockResolvedValue(undefined);
});

// ─── allExtractionsFailedMessage ──────────────────────────────────────────────

describe("allExtractionsFailedMessage", () => {
  it("includes the error of a single failed photo", () => {
    const msg = allExtractionsFailedMessage([settled({ status: PhotoChunkStatus.FAILED, error: "LLM endpoint unreachable" })]);
    expect(msg).toBe("All photo extractions failed — Photo 1: LLM endpoint unreachable");
  });

  it("joins the errors of multiple failed photos", () => {
    const msg = allExtractionsFailedMessage([
      settled({ status: PhotoChunkStatus.FAILED, error: "err one" }),
      settled({ orderNum: 1, status: PhotoChunkStatus.FAILED, error: "err two" }),
    ]);
    expect(msg).toBe("All photo extractions failed — Photo 1: err one; Photo 2: err two");
  });

  it("falls back to 'unknown error' when a chunk has no error message", () => {
    const msg = allExtractionsFailedMessage([settled({ status: PhotoChunkStatus.FAILED, error: null })]);
    expect(msg).toContain("Photo 1: unknown error");
  });
});

// ─── runExtractionPhase ───────────────────────────────────────────────────────

describe("runExtractionPhase", () => {
  it("resets stuck EXTRACTING chunks and moves to MERGING when all photos are done", async () => {
    mockFetchPendingChunks.mockResolvedValue([]);
    mockFetchSettledChunks.mockResolvedValue([settled()]);

    await runExtractionPhase(db, config, jobId);

    expect(mockSetJobStatus).toHaveBeenCalledWith(db, jobId, PhotoJobStatus.CHUNKING);
    expect(mockResetStuckChunks).toHaveBeenCalledWith(db, jobId);
    expect(mockSetJobStatus).toHaveBeenCalledWith(db, jobId, PhotoJobStatus.MERGING);
  });

  it("transcribes a pending chunk and moves to MERGING", async () => {
    const chunk = { id: "c1", orderNum: 0, dataUri: "data:image/jpeg;base64,xx" };
    mockFetchPendingChunks.mockResolvedValueOnce([chunk]).mockResolvedValue([]);
    mockExtractMarkdownFromPhoto.mockResolvedValue("# Pancakes");
    mockFetchSettledChunks.mockResolvedValue([settled()]);

    await runExtractionPhase(db, config, jobId);

    expect(mockMarkChunkExtracting).toHaveBeenCalledWith(db, "c1");
    expect(mockMarkChunkExtracted).toHaveBeenCalledWith(db, "c1", "# Pancakes");
    expect(mockIncrementCompletedChunks).toHaveBeenCalledWith(db, jobId);
    expect(mockSetJobStatus).toHaveBeenLastCalledWith(db, jobId, PhotoJobStatus.MERGING);
  });

  it("marks a chunk failed (without failing the job) when transcription fails", async () => {
    const chunk = { id: "c1", orderNum: 0, dataUri: "data:image/jpeg;base64,xx" };
    mockFetchPendingChunks.mockResolvedValueOnce([chunk]).mockResolvedValue([]);
    mockExtractMarkdownFromPhoto.mockRejectedValue(new Error("LLM down"));
    mockFetchSettledChunks.mockResolvedValue([settled(), settled({ orderNum: 1, id: "c2" })]);

    await runExtractionPhase(db, config, jobId);

    expect(mockMarkChunkFailed).toHaveBeenCalledWith(db, "c1", expect.stringContaining("LLM down"));
    // One photo still succeeded → job continues to merging
    expect(mockSetJobStatus).toHaveBeenLastCalledWith(db, jobId, PhotoJobStatus.MERGING);
  });

  it("throws an aggregated error naming each failed photo when all extractions fail", async () => {
    mockFetchPendingChunks.mockResolvedValue([]);
    mockFetchSettledChunks.mockResolvedValue([
      settled({ status: PhotoChunkStatus.FAILED, error: "LLM endpoint unreachable" }),
      settled({ id: "c2", orderNum: 1, status: PhotoChunkStatus.FAILED, error: "timeout" }),
    ]);

    await expect(runExtractionPhase(db, config, jobId)).rejects.toThrow(
      "All photo extractions failed — Photo 1: LLM endpoint unreachable; Photo 2: timeout"
    );
    // The job must not be handed over to merging
    expect(mockSetJobStatus).not.toHaveBeenCalledWith(db, jobId, PhotoJobStatus.MERGING);
  });
});
