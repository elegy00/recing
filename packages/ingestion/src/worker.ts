import { getDb } from "./db.js";
import { fetchUrl } from "./url-fetcher.js";
import { RecipeFetchException } from "./recipe-fetch-exception.js";
import { extractRecipe, type ExtractionConfig, LlmExtractionError } from "./llm-extraction.js";
import { describeError } from "./error-utils.js";

import type { Pool } from "pg";

/** Configuration for the worker loop. */
export interface WorkerConfig extends ExtractionConfig {
  /** Milliseconds between polling cycles (default: 5000) */
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;

/** Result of processing a single job. */
export interface JobResult {
  jobId: string;
  url: string;
  success: boolean;
  error?: string;
}

/** Pending job from the database. */
interface PendingJob {
  id: string;
  url: string;
}

/** Process a single pending job through the full pipeline (fetch → reduce → LLM). */
async function processJob(db: Pool, config: WorkerConfig, job: PendingJob): Promise<JobResult> {
  const { id: jobId, url } = job;

  try {
    // Mark as processing
    await db.query("UPDATE jobs SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1 AND status = 'PENDING'", [jobId]);

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
    const now = new Date().toISOString();
    await db.query(
      "UPDATE jobs SET status = 'COMPLETED', result = $2, error = NULL, updated_at = $3 WHERE id = $1",
      [jobId, JSON.stringify(extraction.extraction), now]
    );

    console.warn(`[job:${jobId}] Recipe extracted successfully`);
    return { jobId, url, success: true };
  } catch (error) {
    let errorCode = "UNKNOWN";
    let errorMessage = String(error);

    if (error instanceof RecipeFetchException) {
      errorCode = `FETCH_${error.code}`;
      errorMessage = error.message;
    } else if (error instanceof LlmExtractionError) {
      errorCode = error.code;
      errorMessage = error.getUserMessage();
    }

    console.warn(`[job:${jobId}] Failed (${errorCode}): ${errorMessage}`);

    // Save error (best effort — a DB failure here must not mask the original job error)
    try {
      await db.query(
        "UPDATE jobs SET status = 'FAILED', result = NULL, error = $2, updated_at = NOW() WHERE id = $1",
        [jobId, errorMessage]
      );
    } catch (dbError) {
      console.error(`[job:${jobId}] Failed to persist job error: ${describeError(dbError)}`);
    }

    return { jobId, url, success: false, error: `${errorCode}: ${errorMessage}` };
  }
}

/** Fetch all pending jobs from the database. */
async function fetchPendingJobs(db: Pool): Promise<PendingJob[]> {
  const res = await db.query<PendingJob>(
    "SELECT id, url FROM jobs WHERE status = 'PENDING' ORDER BY created_at ASC"
  );
  return res.rows;
}

/** Run the worker loop. Returns an AbortController for graceful shutdown. */
export function runWorker(config: WorkerConfig): AbortController {
  const controller = new AbortController();
  const signal = controller.signal;
  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const db = getDb();

  console.warn(`[worker] Starting — polling for PENDING jobs every ${pollIntervalMs}ms`);
  console.warn(`[worker] LLM endpoint: ${config.endpoint} (model: ${config.model})`);



  async function tick(): Promise<void> {
    while (!signal.aborted) {
      try {
        const pendingJobs = await fetchPendingJobs(db);

        if (pendingJobs.length === 0) {
          console.warn("[worker] No pending jobs — sleeping");
        } else {
          console.warn(`[worker] Found ${pendingJobs.length} pending job(s)`);

          for (const job of pendingJobs) {
            if (signal.aborted) break;
            const result = await processJob(db, config, job);
            console.warn(`[worker] Job ${result.jobId}: ${result.success ? "✅ done" : `❌ failed — ${result.error}`}`);
          }
        }

        if (!signal.aborted) {
          await sleep(pollIntervalMs);
        }
      } catch (error) {
        console.error(`[worker] Poll error: ${describeError(error)}`);
        if (!signal.aborted) {
          await sleep(pollIntervalMs);
        }
      }
    }

    console.warn("[worker] Stopped");
  }

  // Start the loop in background
  tick().catch(() => {});

  return controller;
}

/** Sleep for the given milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
