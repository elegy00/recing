import { describe, expect, it, vi } from "vitest";
import { buildRequest, sendChatCompletion, LlmClientError } from "./llm-client.js";

describe("buildRequest", () => {
  it("builds correct request structure", () => {
    const req = buildRequest(
      "test-model",
      "You are a recipe extractor.",
      "Source: http://example.com\nFlour, sugar...",
      undefined
    );

    expect(req.model).toBe("test-model");
    expect(req.temperature).toBe(0.0);
    expect(req.top_p).toBe(1.0);
    expect(req.max_tokens).toBe(24576);
    expect(req.stream).toBe(false);
  });

  it("includes two messages (system + user)", () => {
    const req = buildRequest("model", "sys", "usr", undefined);
    expect(req.messages).toHaveLength(2);
    expect(req.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(req.messages[1]).toEqual({ role: "user", content: "usr" });
  });

  it("disables thinking for Qwen3", () => {
    const req = buildRequest("model", "sys", "usr", undefined);
    expect(req.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("includes response_format when schema is provided", () => {
    const schemaJson = { type: "object", properties: {} };
    const req = buildRequest("model", "sys", "usr", schemaJson);

    expect(req.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "recipe_extraction",
        strict: true,
        schema: schemaJson,
      },
    });
  });

  it("omits response_format when no schema provided", () => {
    const req = buildRequest("model", "sys", "usr", undefined);
    expect(req.response_format).toBeUndefined();
  });
});

describe("sendChatCompletion", () => {
  const config = { endpoint: "http://localhost:8085/v1/chat/completions", timeoutSeconds: 60 };
  const requestBody = buildRequest("qwen3.6", "sys", "usr");

  it("returns response body on success", async () => {
    const mockResponse = '{"choices":[{"message":{"content":"{}"}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(mockResponse),
    }));

    const result = await sendChatCompletion(config, requestBody);
    expect(result).toBe(mockResponse);
  });

  it("throws on HTTP error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 503,
      text: () => Promise.resolve("Service Unavailable"),
    }));

    await expect(sendChatCompletion(config, requestBody)).rejects.toThrow(
      "HTTP 503"
    );
  });

  it("throws on HTTP 4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    }));

    await expect(sendChatCompletion(config, requestBody)).rejects.toThrow(
      "HTTP 401"
    );
  });



  it("aborts with AbortError name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      return Promise.reject(new DOMException("Timeout", "AbortError"));
    }));

    await expect(sendChatCompletion({ ...config, timeoutSeconds: 0 }, requestBody))
      .rejects.toThrow();
  });

  it("truncates long error bodies to 200 chars", async () => {
    const longBody = "x".repeat(500);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 500,
      text: () => Promise.resolve(longBody),
    }));

    try {
      await sendChatCompletion(config, requestBody);
      fail("should have thrown");
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg.length).toBeLessThanOrEqual(210); // status + ": " + 200 chars
    }
  });

  it.each([200, 201, 202])(
    "accepts HTTP %i as success",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        status,
        text: () => Promise.resolve('{"choices":[]}'),
      }));

      const result = await sendChatCompletion(config, requestBody);
      expect(result).toBe('{"choices":[]}');
    }
  );
});
