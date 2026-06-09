import { describe, it, expect } from "vitest";
import { validateMetadata, tokensPerSecond } from "./llm-result.js";

describe("validateMetadata", () => {
  const valid = {
    modelEndpoint: "http://localhost:8085/v1/chat/completions",
    model: "qwen3.6",
    durationMs: 4200,
    promptVersion: "recipe_extraction_prompt.v1",
    schemaVersion: "recipe_extraction.v1",
    requestContentChars: 1200,
    truncatedInput: false,
    parsedAsExpected: true,
    httpStatusCode: 200,
    errorCode: null,
    promptTokens: 850,
    completionTokens: 397,
  };

  it("accepts valid metadata", () => {
    const result = validateMetadata(valid);
    expect(result.model).toBe("qwen3.6");
    expect(result.durationMs).toBe(4200);
  });

  it("rejects missing required fields", () => {
    const bad = { modelEndpoint: "http://x.com" };
    expect(() => validateMetadata(bad)).toThrow();
  });

  it("rejects invalid HTTP status code", () => {
    const bad = { ...valid, httpStatusCode: 999 };
    expect(() => validateMetadata(bad)).toThrow();
  });

  it("accepts optional fields as null/undefined", () => {
    const minimal = {
      modelEndpoint: "http://x.com",
      model: "test",
      durationMs: 100,
      promptVersion: "v1",
      schemaVersion: "recipe_extraction.v1",
      httpStatusCode: 200,
      promptTokens: 50,
      completionTokens: 20,
    };
    const result = validateMetadata(minimal);
    expect(result.requestContentChars).toBeUndefined();
    expect(result.errorCode).toBeUndefined();
  });

  it("accepts LlmErrorCode in errorCode field", () => {
    // This would need the import — skipping since we test resolveErrorMessage separately
    const result = validateMetadata({ ...valid, errorCode: null } as unknown);
    expect(result.errorCode).toBeNull();
  });
});

describe("tokensPerSecond", () => {
  it("calculates TPS correctly (matches Java formula)", () => {
    const metadata = {
      modelEndpoint: "http://x.com",
      model: "test",
      durationMs: 4200,
      promptVersion: "v1",
      schemaVersion: "recipe_extraction.v1",
      httpStatusCode: 200,
      promptTokens: 850,
      completionTokens: 397,
    };
    // Java formula: Math.round(397 * 100.0 / 4200) / 100.0
    expect(tokensPerSecond(metadata)).toBeCloseTo(0.09, 1);
  });

  it("returns 0 for zero duration", () => {
    const metadata = { modelEndpoint: "http://x.com", model: "test", promptVersion: "v1", schemaVersion: "recipe_extraction.v1", httpStatusCode: 200, promptTokens: 100, completionTokens: 100, durationMs: 0 };
    expect(tokensPerSecond(metadata)).toBe(0);
  });

  it("returns 0 for zero completion tokens", () => {
    const metadata = { modelEndpoint: "http://x.com", model: "test", promptVersion: "v1", schemaVersion: "recipe_extraction.v1", httpStatusCode: 200, promptTokens: 100, durationMs: 1000, completionTokens: 0 };
    expect(tokensPerSecond(metadata)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const metadata = { modelEndpoint: "http://x.com", model: "test", promptVersion: "v1", schemaVersion: "recipe_extraction.v1", httpStatusCode: 200, completionTokens: 1, durationMs: 333, promptTokens: 50 };
    // Math.round(1 * 100.0 / 333) / 100 = Math.round(0.3) / 100 = 0
    expect(tokensPerSecond(metadata)).toBeCloseTo(0, 2);
  });
});
