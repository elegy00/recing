import { fetchUrl } from "./url-fetcher.js";
import { extractRecipe, type ExtractionConfig, LlmExtractionError } from "./llm-extraction.js";
import {
  fetchPendingJobs,
  postResult,
  reportFailure,
  type ApiClientConfig,
  type WebJob,
} from "./api-client.js";
import type { RecipeExtraction } from "@recing/schema";

/** Configuration for the worker loop. */
export interface WorkerConfig extends ApiClientConfig, ExtractionConfig {
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

/** Process a single pending job through the full pipeline (fetch → reduce → LLM). */
async function processJob(config: WorkerConfig, job: WebJob): Promise<JobResult> {
  const { _id: jobId, url } = job;

  try {
    // Step 1: Fetch the URL content
    console.warn(`[job:${jobId}] Fetching ${url}`);
    const fetchResult = await fetchUrl(url);

    if (!fetchResult.ok) {
      throw new Error(`URL fetch failed: ${fetchResult.error}`);
    }

    // Step 2: Extract recipe via LLM
    console.warn(`[job:${jobId}] Extracting recipe from ${fetchResult.finalUrl} (${fetchResult.contentType})`);
    const extraction = await extractRecipe(config, {
      url: fetchResult.finalUrl,
      contentType: fetchResult.contentType,
      title: fetchResult.title ?? null,
      body: fetchResult.body,
    });

    // Step 3: Post result back to web API
    console.warn(`[job:${jobId}] Recipe extracted successfully`);
    await postResult(config, jobId, extraction.extraction, {
      model: config.model,
      endpoint: config.endpoint,
      tokensIn: extraction.metadata.promptTokens,
      tokensOut: extraction.metadata.completionTokens,
    });

    return { jobId, url, success: true };
  } catch (error) {
    let errorCode = "LLM_FAILED" as const;
    let errorMessage = String(error);

    if (error instanceof LlmExtractionError) {
      errorCode = error.code;
      errorMessage = error.getUserMessage();
    } else if (error instanceof Error && "statusCode" in error) {
      // ApiClientError from post/report
      const e = error as { statusCode: number };
      errorMessage = `API error ${e.statusCode}: ${errorMessage}`;
    }

    console.warn(`[job:${jobId}] Failed (${errorCode}): ${errorMessage}`);

    try {
      await reportFailure(config, jobId, errorCode, errorMessage);
    } catch (reportError) {
      console.error(`[job:${jobId}] Also failed to report error: ${reportError}`);
    }

    return { jobId, url, success: false, error: `${errorCode}: ${errorMessage}` };
  }
}

/** Run the worker loop. Returns an AbortController for graceful shutdown. */
export function runWorker(config: WorkerConfig): AbortController {
  const controller = new AbortController();
  const signal = controller.signal;
  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  console.warn(`[worker] Starting — polling ${config.baseUrl}/api/recipes?status=PENDING every ${pollIntervalMs}ms`);
  console.warn(`[worker] LLM endpoint: ${config.endpoint} (model: ${config.model})`);

  let running = true;

  async function tick(): Promise<void> {
    while (!signal.aborted) {
      try {
        // Fetch pending jobs
        const pendingJobs = await fetchPendingJobs(config);

        if (pendingJobs.length === 0) {
          console.warn("[worker] No pending jobs — sleeping");
        } else {
          console.warn(`[worker] Found ${pendingJobs.length} pending job(s)`);

          // Process each job sequentially (single-threaded, matches Java behavior)
          for (const job of pendingJobs) {
            if (signal.aborted) break;
            const result = await processJob(config, job);
            console.warn(`[worker] Job ${result.jobId}: ${result.success ? "✅ done" : `❌ failed — ${result.error}`}`);
          }
        }

        // Wait for next poll cycle (only if not aborted)
        if (!signal.aborted) {
          await sleep(pollIntervalMs);
        }
      } catch (error) {
        console.error(`[worker] Poll error: ${error}`);
        if (!signal.aborted) {
          await sleep(pollIntervalMs);
        }
      }
    }

    console.warn("[worker] Stopped");
  }

  // Start the loop in background
  tick().catch(() => {}); // ignore abort errors

  return controller;
}

/** Sleep for the given milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
