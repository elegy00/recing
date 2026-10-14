import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmErrorCode } from "@recing/schema";
import { LlmClientError } from "../llm/client.js";
import { LlmResponseError } from "../llm/response.js";
import { handleLlmFailure, toLlmExtractionError } from "./llm-error-policy.js";
import { LlmExtractionError } from "./types.js";

const MAX_ATTEMPTS = 2;

describe("toLlmExtractionError", () => {
  it("passes through LlmExtractionError unchanged", () => {
    const original = new LlmExtractionError(LlmErrorCode.LLM_FAILED, "boom");
    expect(toLlmExtractionError(original)).toBe(original);
  });

  it("maps unparseable body to LLM_BAD_RESPONSE", () => {
    const err = toLlmExtractionError(new LlmResponseError("unparseable_body", "Could not parse model output as JSON"));
    expect(err.code).toBe(LlmErrorCode.LLM_BAD_RESPONSE);
  });

  it("maps no choices to LLM_BAD_RESPONSE", () => {
    const err = toLlmExtractionError(new LlmResponseError("no_choices", "No choices in response"));
    expect(err.code).toBe(LlmErrorCode.LLM_BAD_RESPONSE);
  });

  it("maps empty content to LLM_FAILED", () => {
    const err = toLlmExtractionError(new LlmResponseError("empty_content", "Empty assistant content from model"));
    expect(err.code).toBe(LlmErrorCode.LLM_FAILED);
  });

  it("maps LLM_UNAVAILABLE client error to LLM_UNAVAILABLE", () => {
    const err = toLlmExtractionError(new LlmClientError("LLM_UNAVAILABLE", "refused"));
    expect(err.code).toBe(LlmErrorCode.LLM_UNAVAILABLE);
  });

  it("maps HTTP client errors to LLM_HTTP_ERROR with the status in the message", () => {
    const err = toLlmExtractionError(new LlmClientError("LLM_HTTP_ERROR", "HTTP 502: Bad Gateway", 502));
    expect(err.code).toBe(LlmErrorCode.LLM_HTTP_ERROR);
    expect(err.message).toContain("(HTTP 502)");
  });

  it("maps AbortError to LLM_TIMEOUT", () => {
    const err = toLlmExtractionError(new DOMException("Timeout", "AbortError"));
    expect(err.code).toBe(LlmErrorCode.LLM_TIMEOUT);
  });

  it("maps connection refused to LLM_UNAVAILABLE", () => {
    const err = toLlmExtractionError(new Error("connect ECONNREFUSED 127.0.0.1:8085"));
    expect(err.code).toBe(LlmErrorCode.LLM_UNAVAILABLE);
  });

  it("maps unknown errors to LLM_FAILED", () => {
    const err = toLlmExtractionError(new Error("kaboom"));
    expect(err.code).toBe(LlmErrorCode.LLM_FAILED);
  });
});

describe("handleLlmFailure (retryability)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries LLM_BAD_RESPONSE on the first attempt only", () => {
    const err = new LlmExtractionError(LlmErrorCode.LLM_BAD_RESPONSE, "bad");
    expect(handleLlmFailure(err, 1, MAX_ATTEMPTS)).toBe(true);
    expect(handleLlmFailure(err, MAX_ATTEMPTS, MAX_ATTEMPTS)).toBe(false);
  });

  it("does not retry other LlmExtractionError codes", () => {
    const err = new LlmExtractionError(LlmErrorCode.LLM_FAILED, "nope");
    expect(handleLlmFailure(err, 1, MAX_ATTEMPTS)).toBe(false);
  });

  it("retries unparseable/no-choices responses but not empty content", () => {
    expect(handleLlmFailure(new LlmResponseError("unparseable_body", "x"), 1, MAX_ATTEMPTS)).toBe(true);
    expect(handleLlmFailure(new LlmResponseError("no_choices", "x"), 1, MAX_ATTEMPTS)).toBe(true);
    expect(handleLlmFailure(new LlmResponseError("empty_content", "x"), 1, MAX_ATTEMPTS)).toBe(false);
  });

  it("retries HTTP 5xx but not 4xx or unavailability", () => {
    expect(handleLlmFailure(new LlmClientError("LLM_HTTP_ERROR", "HTTP 503", 503), 1, MAX_ATTEMPTS)).toBe(true);
    expect(handleLlmFailure(new LlmClientError("LLM_HTTP_ERROR", "HTTP 400", 400), 1, MAX_ATTEMPTS)).toBe(false);
    expect(handleLlmFailure(new LlmClientError("LLM_UNAVAILABLE", "refused"), 1, MAX_ATTEMPTS)).toBe(false);
  });

  it("retries timeouts and generic network errors once", () => {
    expect(handleLlmFailure(new DOMException("Timeout", "AbortError"), 1, MAX_ATTEMPTS)).toBe(true);
    expect(handleLlmFailure(new Error("socket hang up"), 1, MAX_ATTEMPTS)).toBe(true);
    expect(handleLlmFailure(new Error("socket hang up"), MAX_ATTEMPTS, MAX_ATTEMPTS)).toBe(false);
  });

  it("never retries connection refused (LLM not running)", () => {
    expect(handleLlmFailure(new Error("connect ECONNREFUSED 127.0.0.1:8085"), 1, MAX_ATTEMPTS)).toBe(false);
  });
});
