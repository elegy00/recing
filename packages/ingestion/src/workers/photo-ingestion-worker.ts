/**
 * Photo-based recipe ingestion worker.
 * Drives each photo job through two phases, persisting before every step so a
 * crash always leaves the job in a resumable state:
 *   1. CHUNKING — extract a structured RecipeExtraction from each photo (vision LLM)
 *   2. MERGING  — merge all per-photo extractions into the final result
 * No SQL here — see db/photo-job-repository. No prompt/LLM details — see extraction/.
 */

import type { Pool } from "pg";
import { PhotoChunkStatus, PhotoJobStatus } from "@recing/schema";
import { getDb } from "../db/pool.js";
import {
  completeJob,
  failJob,
  fetchPendingChunks,
  fetchPendingPhotoJobs,
  fetchSettledChunks,
  getJobStatus,
  incrementCompletedChunks,
  markChunkExtracted,
  markChunkExtracting,
  markChunkFailed,
  setJobStatus,
  type PendingPhotoChunk,
} from "../db/photo-job-repository.js";
import { extractFromPhoto, mergeExtractedRecipes, type PhotoFragment } from "../extraction/photo-extractor.js";
import type { LlamaClientConfig } from "../llm/client.js";
import { withRetry } from "../llm/retry.js";
import { describeError } from "../util/error-utils.js";
import { startWorkerLoop } from "./worker-loop.js";

const DEFAULT_POLL_INTERVAL_MS = 5_000;

// Retry settings (matching URL ingestion)
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

/** Configuration for the photo worker loop. */
export interface PhotoWorkerConfig extends LlamaClientConfig {
  /** Milliseconds between polling cycles (default: 5000). */
  pollIntervalMs?: number;
}

/** Starts the photo worker polling loop. Returns an AbortController for shutdown. */
export function runPhotoWorker(config: PhotoWorkerConfig): AbortController {
  const controller = new AbortController();
  const db = getDb();
  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  console.warn(`[photo-worker] Starting — polling every ${pollIntervalMs}ms`);
  console.warn(`[photo-worker] LLM endpoint: ${config.endpoint}`);

  startWorkerLoop({
    name: "photo-worker",
    pollIntervalMs,
    signal: controller.signal,
    onTick: async () => {
      const pendingJobs = await fetchPendingPhotoJobs(db);

      if (pendingJobs.length === 0) {
        console.warn("[photo-worker] No pending jobs — sleeping");
        return;
      }

      for (const job of pendingJobs) {
        if (controller.signal.aborted) break;
        await processJob(db, config, job.id);
      }
    },
  });

  return controller;
}

/** Drives one photo job through its current phase. */
async function processJob(db: Pool, config: PhotoWorkerConfig, jobId: string): Promise<void> {
  const status = await getJobStatus(db, jobId);
  if (status === null) return;

  console.warn(`[photo-worker] Processing job ${jobId} (${status})`);
  try {
    // Each call runs at most one phase; the next poll picks up the following phase.
    if (status === PhotoJobStatus.PENDING || status === PhotoJobStatus.CHUNKING) {
      await runExtractionPhase(db, config, jobId);
    } else if (status === PhotoJobStatus.MERGING) {
      await runMergePhase(db, config, jobId);
    }
  } catch (error) {
    const message = describeError(error);
    console.warn(`[photo-worker] Job ${jobId} failed: ${message}`);
    await failJob(db, jobId, message);
  }
}

/** Phase 1: extract one RecipeExtraction per photo, then hand the job over to MERGING. */
async function runExtractionPhase(db: Pool, config: PhotoWorkerConfig, jobId: string): Promise<void> {
  await setJobStatus(db, jobId, PhotoJobStatus.CHUNKING);

  let pending = await fetchPendingChunks(db, jobId);
  while (pending.length > 0) {
    const chunk = pending[0];
    console.warn(`[photo-worker] Extracting photo ${chunk.orderNum + 1}/${pending.length} for job ${jobId}`);
    await extractChunk(db, config, jobId, chunk);
    // Re-fetch: the processed chunk is now EXTRACTED or FAILED
    pending = await fetchPendingChunks(db, jobId);
  }

  const settled = await fetchSettledChunks(db, jobId);
  if (settled.length > 0 && settled.every((c) => c.status === PhotoChunkStatus.FAILED)) {
    throw new Error("All photo extractions failed");
  }

  // All chunks processed — move to merging phase
  await setJobStatus(db, jobId, PhotoJobStatus.MERGING);
}

/** Extracts one chunk. A failure marks the chunk FAILED but never blocks the job. */
async function extractChunk(
  db: Pool,
  config: PhotoWorkerConfig,
  jobId: string,
  chunk: PendingPhotoChunk
): Promise<void> {
  if (!chunk.dataUri) {
    await markChunkFailed(db, chunk.id, "No image data found in photos table");
    return;
  }

  await markChunkExtracting(db, chunk.id);
  try {
    const extraction = await withRetry(
      () => extractFromPhoto(config, chunk.dataUri as string),
      { maxAttempts: MAX_ATTEMPTS, delayMs: RETRY_DELAY_MS, onFailure: logLlmAttemptFailure }
    );

    await markChunkExtracted(db, chunk.id, JSON.stringify(extraction));
    await incrementCompletedChunks(db, jobId);
  } catch (error) {
    console.warn(`[photo-worker] Failed to extract photo ${chunk.orderNum + 1}: ${describeError(error)}`);
    await markChunkFailed(db, chunk.id, describeError(error));
  }
}

/** Phase 2: merge all successful per-photo extractions into the final result. */
async function runMergePhase(db: Pool, config: PhotoWorkerConfig, jobId: string): Promise<void> {
  const settled = await fetchSettledChunks(db, jobId);
  const fragments: PhotoFragment[] = settled
    .filter((c) => c.status === PhotoChunkStatus.EXTRACTED && c.extractedJson !== null)
    .map((c) => ({ orderNum: c.orderNum, extraction: c.extractedJson! }));

  if (fragments.length === 0) {
    throw new Error("No successful extractions available to merge");
  }

  // If ALL chunks are unusable, skip merging and fail gracefully
  if (fragments.every((f) => f.extraction.status === "unusable")) {
    throw new Error("All photo extractions were unusable — no recipe could be extracted");
  }

  console.warn(`[photo-worker] Merging ${fragments.length} extraction(s) for job ${jobId}`);
  const extraction = await withRetry(
    () => mergeExtractedRecipes(config, fragments),
    { maxAttempts: MAX_ATTEMPTS, delayMs: RETRY_DELAY_MS, onFailure: logLlmAttemptFailure }
  );

  await completeJob(db, jobId, JSON.stringify(extraction));
  console.warn(`[photo-worker] Job ${jobId} completed — recipe: ${extraction.recipeName}`);
}

/** Logs a failed LLM attempt and allows the retry. */
function logLlmAttemptFailure(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt < maxAttempts) {
    console.warn(`[photo-worker] Attempt ${attempt}/${maxAttempts} failed: ${describeError(error)}. Retrying in ${RETRY_DELAY_MS}ms...`);
  }
  return true;
}
