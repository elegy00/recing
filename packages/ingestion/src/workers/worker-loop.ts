/**
 * Generic background polling loop shared by all ingestion workers.
 * Runs onTick in a loop until aborted; tick errors are logged and never fatal.
 */

import { describeError } from "../util/error-utils.js";
import { sleep } from "../util/sleep.js";

export interface WorkerLoopOptions {
  /** Log prefix, e.g. "worker" or "photo-worker". */
  name: string;
  /** Milliseconds to sleep between polling cycles. */
  pollIntervalMs: number;
  /** Abort the loop when this signal is aborted. */
  signal: AbortSignal;
  /** One polling cycle. */
  onTick: () => Promise<void>;
}

/** Starts the background loop. Returns immediately; abort via options.signal. */
export function startWorkerLoop(options: WorkerLoopOptions): void {
  const { name, pollIntervalMs, signal, onTick } = options;

  (async () => {
    while (!signal.aborted) {
      try {
        await onTick();
      } catch (error) {
        console.error(`[${name}] Poll error: ${describeError(error)}`);
      }
      if (!signal.aborted) {
        await sleep(pollIntervalMs);
      }
    }
    console.warn(`[${name}] Stopped`);
  })().catch(() => {});
}
