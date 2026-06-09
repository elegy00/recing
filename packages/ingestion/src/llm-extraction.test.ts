import { describe, expect, it, vi } from "vitest";
import type { ExtractionConfig, ExtractionInput, LlmExtractionOutput } from "./llm-extraction.js";
import { extractRecipe, LlmExtractionError } from "./llm-extraction.js";
import { tokensPerSecond as calcTokensPerSecond } from "@recing/schema";

// Helper to create a mock fetch that returns a chat completion response
function mockFetch(responseBody: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    status: 200,
    text: () => Promise.resolve(responseBody),
  }));
}

const config: ExtractionConfig = {
  endpoint: "http://localhost:8085/v1/chat/completions",
  model: "qwen3.6",
  timeoutSeconds: 60,
};

function makeExtraction(name: string) {
  return JSON.stringify({
    schemaVersion: "recipe_extraction.v1",
    status: "extracted" as const,
    sourceUrl: "https://example.com/pancakes",
    recipeName: name,
    ingredients: [{ quantity: "1.5", unit: "cups", name: "all-purpose flour", note: "", originalText: "1.5 cups all-purpose flour" }],
    instructions: [{ stepNumber: 1, text: "Mix it." }],
    notes: [],
  });
}

const input: ExtractionInput = {
  url: "https://example.com/pancakes",
  contentType: "text/html; charset=utf-8",
  title: "Classic Pancakes Recipe",
  body: `
    <html><body>
      <h1>Classic Pancakes</h1>
      <p>Fluffy pancakes made from scratch.</p>
      <ul>
        <li>1.5 cups all-purpose flour</li>
        <li>3.5 teaspoons baking powder</li>
        <li>1 cup milk</li>
        <li>1 egg</li>
      </ul>
      <ol>
        <li>Mix dry ingredients.</li>
        <li>Add wet ingredients and stir.</li>
      </ol>
    </body></html>
  `,
};

function buildChatResponse(content: string, promptTokens = 100, completionTokens = 50) {
  return JSON.stringify({
    model: "qwen3.6",
    choices: [{ message: { role: "assistant", content } }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  });
}

describe("extractRecipe", () => {
  it("returns parsed extraction on success (first attempt)", async () => {
    mockFetch(buildChatResponse(makeExtraction("Classic Pancakes")));

    const result = await extractRecipe(config, input);

    expect(result.extraction.recipeName).toBe("Classic Pancakes");
    expect(result.extraction.status).toBe("extracted");
    expect(result.extraction.ingredients.length).toBe(1);
    expect(result.extraction.instructions.length).toBe(1);
    expect(result.metadata.modelEndpoint).toBe(config.endpoint);
    expect(result.metadata.model).toBe("qwen3.6");
    expect(result.metadata.httpStatusCode).toBe(200);
  });

  it("strips markdown code fences from model output", async () => {
    const fenced = '```json\n' + makeExtraction("Test Fences") + '\n```';

    mockFetch(buildChatResponse(fenced));

    const result = await extractRecipe(config, input);
    expect(result.extraction.recipeName).toBe("Test Fences");
  });

  it("strips code fences without language tag", async () => {
    const fenced = '```\n' + makeExtraction("No Lang Tag") + '\n```';

    mockFetch(buildChatResponse(fenced));

    const result = await extractRecipe(config, input);
    expect(result.extraction.recipeName).toBe("No Lang Tag");
  });

  it("retries on LLM_BAD_RESPONSE and succeeds on second attempt", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      if (callCount++ === 0) {
        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve('{"choices":[{"message":{"content":"not json at all"}}]}'),
        });
      }
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(buildChatResponse(makeExtraction("Retry Success"))),
      });
    }));

    const result = await extractRecipe(config, input);
    expect(result.extraction.recipeName).toBe("Retry Success");
    expect(callCount).toBe(2);
  });

  it("retries on HTTP 5xx and succeeds on second attempt", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      if (callCount++ === 0) {
        return Promise.resolve({ status: 503, text: () => Promise.resolve("Service Unavailable") });
      }
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(buildChatResponse(makeExtraction("5xx Retry OK"))),
      });
    }));

    const result = await extractRecipe(config, input);
    expect(result.extraction.recipeName).toBe("5xx Retry OK");
    expect(callCount).toBe(2);
  });

  it("throws LLM_TIMEOUT on AbortError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timeout", "AbortError")));

    await expect(extractRecipe(config, input)).rejects.toThrow(/timed out/i);
  });

  it("throws LLM_UNAVAILABLE on connection refused", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8085")));

    await expect(extractRecipe(config, input)).rejects.toThrow(/unavailable/i);
  });

  it("throws LLM_BAD_RESPONSE on empty choices", async () => {
    mockFetch(JSON.stringify({ choices: [] }));

    await expect(extractRecipe(config, input)).rejects.toThrow(/no choices/i);
  });

  it("throws LLM_FAILED on empty content from model", async () => {
    mockFetch(buildChatResponse(""));

    await expect(extractRecipe(config, input)).rejects.toThrow(/empty/i);
  });

  it("throws LLM_CONTENT_TOO_LARGE when reduced text is blank", async () => {
    const junkInput: ExtractionInput = {
      ...input,
      body: "<html><body><!-- only comments --> <script>var x=1;</script></body></html>",
    };

    await expect(extractRecipe(config, junkInput)).rejects.toThrow(/no extractable content/i);
  });

  it("throws LLM_BAD_RESPONSE when extraction JSON is invalid", async () => {
    mockFetch(buildChatResponse('"result.json"'));

    await expect(extractRecipe(config, input)).rejects.toThrow();
  });

  it("calculates tokensPerSecond from metadata", async () => {
    mockFetch(buildChatResponse(makeExtraction("Speed Test"), 200, 50)); // 50 completion tokens

    const result = await extractRecipe(config, input);
    expect(result.metadata.completionTokens).toBe(50);
    expect(result.metadata.promptTokens).toBe(200);
    expect(typeof calcTokensPerSecond(result.metadata)).toBe("number");
  });

  it("throws LLM_FAILED when both attempts fail with bad response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{"choices":[{"message":{"content":"garbage"}}]}'),
    }));

    await expect(extractRecipe(config, input)).rejects.toThrow(/bad.*response|could not parse/i);
  });

  it("throws LLM_HTTP_ERROR on persistent 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 502,
      text: () => Promise.resolve("Bad Gateway"),
    }));

    await expect(extractRecipe(config, input)).rejects.toThrow(/unexpected response/i);
  });
});

describe("LlmExtractionError", () => {
  it("carries the error code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timeout", "AbortError")));

    try {
      await extractRecipe(config, input);
    } catch (error) {
      expect((error as LlmExtractionError).code).toBe("LLM_TIMEOUT");
    }
  });

  it("provides user-friendly message via getUserMessage", () => {
    const err = new LlmExtractionError("LLM_UNAVAILABLE", "Test error detail here (some extra)");
    expect(err.getUserMessage()).toBe("Test error detail here");
  });
});
