/**
 * Failure policy for the URL extraction pipeline.
 * Decides which LLM failures are retryable and maps raw failures to controlled
 * LlmExtractionErrors. Ported from RecipeExtractionService.java (grill-me decision #8).
 */

import { LlmErrorCode } from "@recing/schema";
import { LlmClientError } from "../llm/client.js";
import { LlmResponseError } from "../llm/response.js";
import { LlmExtractionError } from "./types.js";

/**
 * Logs a failed extraction attempt and decides whether it should be retried.
 * Intended as the onFailure hook of withRetry.
 */
export function handleLlmFailure(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;

  if (error instanceof LlmExtractionError) {
    // Malformed JSON / unexpected response shape is retryable once.
    if (error.code === LlmErrorCode.LLM_BAD_RESPONSE) {
      console.warn(`Bad LLM response on attempt ${attempt}/${maxAttempts}; retrying: ${truncate(error.message, 200)}`);
      return true;
    }
    return false;
  }

  if (error instanceof LlmResponseError) {
    // Empty content is a model behavior problem — not worth retrying.
    if (error.reason === "empty_content") return false;
    console.warn(`Bad LLM response on attempt ${attempt}/${maxAttempts}; retrying: ${truncate(error.message, 200)}`);
    return true;
  }

  if (error instanceof LlmClientError) {
    // Connection refused → LLM not running (final). HTTP 5xx is retryable; 4xx is not.
    if (error.code === "LLM_UNAVAILABLE") return false;
    if (error.statusCode == null || error.statusCode >= 500) {
      console.warn(`LLM HTTP ${error.statusCode} on attempt ${attempt}: ${truncate(error.message, 200)}`);
      return true;
    }
    return false;
  }

  if (isAbortError(error)) {
    console.warn(`LLM request timed out (attempt ${attempt}/${maxAttempts})`);
    return true;
  }

  if (isConnectionRefused(error)) {
    // LLM not running — retrying will not help.
    console.warn(`LLM endpoint unreachable: ${truncate(errorMessage(error), 200)}`);
    return false;
  }

  logErrorDetail(error);
  console.warn(`LLM network error on attempt ${attempt}: ${truncate(errorMessage(error), 200)}`);
  return true;
}

/** Maps a raw LLM/network failure to a controlled LlmExtractionError. */
export function toLlmExtractionError(error: unknown): LlmExtractionError {
  if (error instanceof LlmExtractionError) return error;

  if (error instanceof LlmResponseError) {
    switch (error.reason) {
      case "empty_content":
        return new LlmExtractionError(LlmErrorCode.LLM_FAILED, error.message);
      case "unparseable_body":
      case "no_choices":
        return new LlmExtractionError(LlmErrorCode.LLM_BAD_RESPONSE, error.message);
    }
  }

  if (error instanceof LlmClientError) {
    if (error.code === "LLM_UNAVAILABLE") {
      return new LlmExtractionError(LlmErrorCode.LLM_UNAVAILABLE, error.message);
    }
    return new LlmExtractionError(
      LlmErrorCode.LLM_HTTP_ERROR,
      `The local extractor returned an unexpected response (HTTP ${error.statusCode ?? "unknown"}).`,
      error.message
    );
  }

  if (isAbortError(error)) {
    return new LlmExtractionError(LlmErrorCode.LLM_TIMEOUT, "The request to the local extractor timed out.");
  }

  if (isConnectionRefused(error)) {
    return new LlmExtractionError(
      LlmErrorCode.LLM_UNAVAILABLE,
      "The local recipe extractor is unavailable. Start llama.cpp and try again.",
      errorMessage(error)
    );
  }

  return new LlmExtractionError(
    LlmErrorCode.LLM_FAILED,
    "The extractor was unable to produce a valid response.",
    errorMessage(error)
  );
}

// ─── Error predicates ───────────────────────────────────────────────────────

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? "";
  const code = (error.cause as NodeJS.ErrnoException & { code?: string } | undefined)?.code ?? null;
  return message.includes("ECONNREFUSED") || code === "ECONNREFUSED" || message.toLowerCase().includes("connection refused");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Logs detailed error context (message, errno code, cause, stack) for debugging. */
function logErrorDetail(error: unknown): void {
  const errObj = error as Error & { cause?: unknown };
  const errStr = String(error);
  const errCause = errObj.cause ? String(errObj.cause) : null;
  const errCode = (errObj.cause as NodeJS.ErrnoException & { code?: string } | undefined)?.code ?? null;
  console.warn(`LLM request failed: ${errStr}`);
  if (errCode) console.warn(`  underlying code: ${errCode}`);
  if (errCause && errCause !== errStr) console.warn(`  cause: ${truncate(errCause, 500)}`);
  if (errObj.stack) console.warn(`  stack: ${errObj.stack.split("\n").slice(1, 3).join("\n          ")}`);
}

function truncate(s: string | undefined, max: number): string {
  if (s == null) return "";
  return s.length <= max ? s : s.substring(0, max);
}
