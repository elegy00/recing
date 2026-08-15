import { describe, it, expect } from "vitest";
import { FetchErrorCode, LlmErrorCode, resolveErrorMessage, LLM_ERROR_MESSAGES } from "./errors.js";

describe("FetchErrorCode messages", () => {
  for (const code of Object.values(FetchErrorCode)) {
    it(`has a message for ${code}`, () => {
      const msg = resolveErrorMessage({ [code]: "placeholder" }, code);
      expect(msg).toBeDefined();
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
    });
  }

  it("replaces {status} placeholder", () => {
    const msg = resolveErrorMessage({ [FetchErrorCode.NON_SUCCESS_STATUS]: "Got {status}" }, FetchErrorCode.NON_SUCCESS_STATUS, 404);
    expect(msg).toBe("Got 404");
  });

  it("returns default for unknown code", () => {
    const msg = resolveErrorMessage({}, "UNKNOWN_CODE");
    expect(msg).toBe("Unknown error code: UNKNOWN_CODE");
  });
});

describe("LlmErrorCode messages", () => {
  for (const code of Object.values(LlmErrorCode)) {
    it(`has a message for ${code}`, () => {
      const msg = resolveErrorMessage({ [code]: "placeholder" }, code);
      expect(msg).toBeDefined();
      expect(typeof msg).toBe("string");
    });
  }

  it("LLM_UNAVAILABLE mentions llama.cpp", () => {
    const msg = resolveErrorMessage(LLM_ERROR_MESSAGES, LlmErrorCode.LLM_UNAVAILABLE);
    expect(msg).toContain("llama");
  });

  it("LLM_HTTP_ERROR replaces {status}", () => {
    const msg = resolveErrorMessage({ [LlmErrorCode.LLM_HTTP_ERROR]: "HTTP {status}" }, LlmErrorCode.LLM_HTTP_ERROR, 503);
    expect(msg).toBe("HTTP 503");
  });
});
