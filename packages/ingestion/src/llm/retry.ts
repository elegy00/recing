/**
 * Generic retry with a fixed delay between attempts.
 * Retry policy (which failures are retryable) is decided by the caller via onFailure.
 */

import { sleep } from "../util/sleep.js";

export interface RetryOptions {
  /** Total number of attempts, including the first (default: 2). */
  maxAttempts?: number;
  /** Delay between attempts in milliseconds (default: 500). */
  delayMs?: number;
  /**
   * Called after each failed attempt with the error and the attempt number.
   * Return true to retry, false to give up immediately.
   */
  onFailure?: (error: unknown, attempt: number, maxAttempts: number) => boolean;
}

/** Runs fn, retrying on failure according to options. Throws the last error when exhausted. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2;
  const delayMs = options.delayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const shouldRetry = options.onFailure ? options.onFailure(error, attempt, maxAttempts) : true;
      if (!shouldRetry || attempt === maxAttempts) break;
      await sleep(delayMs);
    }
  }

  throw lastError;
}
