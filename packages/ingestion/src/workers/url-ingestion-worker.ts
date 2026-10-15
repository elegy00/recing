/**
 * URL ingestion worker: polls the jobs table and runs each pending job through
 * fetch → LLM extraction → persistence. No SQL here — see db/job-repository.
 */

import type { Pool } from "pg";
import { getDb } from "../db/pool.js";
import {
  fetchPendingJobs,
  markCompleted,
  markFailed,
  markProcessing,
  type PendingJob,
} from "../db/job-repository.js";
import { extractRecipe } from "../extraction/url-extractor.js";
import { LlmExtractionError, type ExtractionConfig } from "../extraction/types.js";
import { fetchUrl } from "../fetch/url-fetcher.js";
import { RecipeFetchException } from "../fetch/recipe-fetch-exception.js";
import { describeError } from "../util/error-utils.js";
import { startWorkerLoop } from "./worker-loop.js";

const DEFAULT_POLL_INTERVAL_MS = 5_000;

/** Configuration for the worker loop. */
export interface WorkerConfig extends ExtractionConfig {
  /** Milliseconds between polling cycles (default: 5000). */
  pollIntervalMs?: number;
}

/** Result of processing a single job. */
export interface JobResult {
  jobId: string;
  url: string;
  success: boolean;
  error?: string;
}

/** Runs the worker loop. Returns an AbortController for graceful shutdown. */
export function runWorker(config: WorkerConfig): AbortController {
  const controller = new AbortController();
  const db = getDb();
  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  console.warn(`[worker] Starting — polling for PENDING jobs every ${pollIntervalMs}ms`);
  console.warn(`[worker] LLM endpoint: ${config.endpoint} (model: ${config.model})`);

  startWorkerLoop({
    name: "worker",
    pollIntervalMs,
    signal: controller.signal,
    onTick: async () => {
      const pendingJobs = await fetchPendingJobs(db);

      if (pendingJobs.length === 0) {
        console.warn("[worker] No pending jobs — sleeping");
        return;
      }

      console.warn(`[worker] Found ${pendingJobs.length} pending job(s)`);
      for (const job of pendingJobs) {
        if (controller.signal.aborted) break;
        const result = await processJob(db, config, job);
        console.warn(`[worker] Job ${result.jobId}: ${result.success ? "✅ done" : `❌ failed — ${result.error}`}`);
      }
    },
  });

  return controller;
}

/** Processes a single pending job through the full pipeline (fetch → LLM → persist). */
async function processJob(db: Pool, config: WorkerConfig, job: PendingJob): Promise<JobResult> {
  const { id: jobId, url } = job;

  try {
    await markProcessing(db, jobId);

    // Step 1: Fetch the URL content
    console.warn(`[job:${jobId}] Fetching ${url}`);
    const fetchResult = await fetchUrl(url);

    // Step 2: Extract recipe via LLM
    console.warn(`[job:${jobId}] Extracting recipe from ${fetchResult.finalUrl} (${fetchResult.contentType})`);
    const extraction = await extractRecipe(config, {
      url: fetchResult.finalUrl,
      contentType: fetchResult.contentType,
      title: fetchResult.title ?? null,
      body: fetchResult.body,
    });

    // Step 3: Save result
    await markCompleted(db, jobId, JSON.stringify(extraction.extraction));

    console.warn(`[job:${jobId}] Recipe extracted successfully`);
    return { jobId, url, success: true };
  } catch (error) {
    const { code: errorCode, message: errorMessage } = classifyJobError(error);
    console.warn(`[job:${jobId}] Failed (${errorCode}): ${errorMessage}`);

    // Save error (best effort — a DB failure here must not mask the original job error)
    try {
      await markFailed(db, jobId, errorMessage);
    } catch (dbError) {
      console.error(`[job:${jobId}] Failed to persist job error: ${describeError(dbError)}`);
    }

    return { jobId, url, success: false, error: `${errorCode}: ${errorMessage}` };
  }
}

/** Maps a pipeline failure to a machine-readable code and a message for persistence. */
function classifyJobError(error: unknown): { code: string; message: string } {
  if (error instanceof RecipeFetchException) {
    return { code: `FETCH_${error.code}`, message: error.message };
  }
  if (error instanceof LlmExtractionError) {
    return { code: error.code, message: error.getUserMessage() };
  }
  return { code: "UNKNOWN", message: String(error) };
}
