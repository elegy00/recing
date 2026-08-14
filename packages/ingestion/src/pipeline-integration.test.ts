/**
 * Integration test: full extraction pipeline (reduce → request → mock LLM → parse).
 *
 * Uses a manual approach: import the module, spy on sendChatCompletion, and verify
 * end-to-end behavior without complex vi.mock() setup.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RecipeExtraction } from "@recing/schema";

// ── Test fixtures ──────────────────────────────────────────────────────

const MOCK_HTML = `<!DOCTYPE html>
<html>
<head><title>Pancakes</title></head>
<body>
<article>
<h1>Classic Pancakes</h1>
<p>A simple recipe for fluffy pancakes.</p>
<script>alert('noise');</script>
<style>.hidden { display: none; }</style>
<div class="ingredients">
  <ul>
    <li><span class="quantity">1 cup</span> flour</li>
    <li><span class="quantity">2</span> eggs</li>
    <li><span class="quantity">1 cup</span> milk</li>
    <li><span class="quantity">2 tbsp</span> sugar</li>
  </ul>
</div>
<div class="instructions">
  <ol>
    <li>Mix dry ingredients together.</li>
    <li>Add eggs and milk, stir until smooth.</li>
    <li>Cook on a hot griddle until golden brown.</li>
  </ol>
</div>
<script type="application/ld+json">{"@type":"Recipe","name":"Not This One"}</script>
</article>
</body>
</html>`;

function mockConfig(): import("./llm-extraction.js").ExtractionConfig {
  return {
    model: "qwen3.6",
    endpoint: "http://localhost:8085/v1/chat/completions",
    maxContentChars: 40_000,
  };
}

function buildLlmResponse(extraction: import("@recing/schema").RecipeExtraction): string {
  return JSON.stringify({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: Date.now(),
    model: "qwen3.6",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify(extraction) },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 1234, completion_tokens: 56 },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Full extraction pipeline integration", () => {
  let extractRecipe: typeof import("./llm-extraction.js").extractRecipe;
  let sendChatCompletionSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset modules to get clean state
    await vi.resetModules();

    // Create spy, then import llm-client to attach it
    const mockFn = vi.fn().mockResolvedValue("");
    const llmClientMod = await import("./llm-client.js");
    sendChatCompletionSpy = vi.spyOn(llmClientMod, "sendChatCompletion").mockImplementation(mockFn);

    // Import extractRecipe after the spy is set up
    const extractionMod = await import("./llm-extraction.js");
    extractRecipe = extractionMod.extractRecipe;
  });

  it("fetches content → reduces → sends to LLM → parses result", async () => {
    const expectedExtraction: RecipeExtraction = {
      schemaVersion: "recipe_extraction.v1",
      status: "extracted",
      sourceUrl: "http://example.com/pancakes",
      recipeName: "Classic Pancakes",
      ingredients: [
        { name: "flour", quantity: "1", unit: "cup", note: "", originalText: "1 cup" },
        { name: "eggs", quantity: "2", unit: "", note: "", originalText: "2" },
        { name: "milk", quantity: "1", unit: "cup", note: "", originalText: "1 cup" },
        { name: "sugar", quantity: "2", unit: "tbsp", note: "", originalText: "2 tbsp" },
      ],
      description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      unusableReason: null,
      instructions: [
        { stepNumber: 1, text: "Mix dry ingredients together." },
        { stepNumber: 2, text: "Add eggs and milk, stir until smooth." },
        { stepNumber: 3, text: "Cook on a hot griddle until golden brown." },
      ],
      notes: ["A simple recipe for fluffy pancakes."],
    };

    sendChatCompletionSpy.mockResolvedValueOnce(buildLlmResponse(expectedExtraction));

    const input = {
      url: "http://example.com/pancakes",
      contentType: "text/html",
      title: null,
      body: MOCK_HTML,
    };

    const result = await extractRecipe(mockConfig(), input);

    expect(result.extraction.schemaVersion).toBe("recipe_extraction.v1");
    expect(result.extraction.status).toBe("extracted");
    expect(result.extraction.recipeName).toBe("Classic Pancakes");
    expect(result.extraction.ingredients.length).toBe(4);
    expect(result.extraction.instructions.length).toBe(3);

    expect(result.metadata.modelEndpoint).toBe("http://localhost:8085/v1/chat/completions");
    expect(result.metadata.model).toBe("qwen3.6");
    // durationMs is 0+ with mocks (no real network latency) — just verify it's non-negative
    expect(result.metadata.durationMs >= 0).toBe(true);
    expect(result.metadata.promptVersion).toBeTruthy();
    expect(result.metadata.schemaVersion).toBe("recipe_extraction.v1");
    expect(result.metadata.requestContentChars).toBeGreaterThan(0);
  });

  it("handles LLM error response (empty content)", async () => {
    sendChatCompletionSpy.mockResolvedValueOnce(
      JSON.stringify({
        id: "chatcmpl-bad",
        choices: [{ index: 0, message: { role: "assistant" }, finish_reason: "stop" }],
      })
    );

    await expect(
      extractRecipe(mockConfig(), {
        url: "http://example.com/test",
        contentType: "text/html",
        title: null,
        body: MOCK_HTML,
      })
    ).rejects.toThrow("Empty assistant content from model");

    expect(sendChatCompletionSpy).toHaveBeenCalledTimes(1);
  });

  it("retries once on bad LLM JSON response", async () => {
    const goodExtraction: RecipeExtraction = {
      schemaVersion: "recipe_extraction.v1",
      status: "extracted",
      sourceUrl: "http://example.com/test",
      recipeName: "Retry Test",
      ingredients: [{ name: "flour", quantity: "1", unit: "cup", note: "", originalText: "1 cup" }],
      instructions: [{ stepNumber: 1, text: "Do it." }],
      notes: [],
      description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      unusableReason: null,
    };

    sendChatCompletionSpy
      .mockResolvedValueOnce("not-json-at-all") // first attempt fails
      .mockResolvedValueOnce(buildLlmResponse(goodExtraction)); // second succeeds

    const result = await extractRecipe(mockConfig(), {
      url: "http://example.com/test",
      contentType: "text/html",
      title: null,
      body: MOCK_HTML,
    });

    expect(result.extraction.recipeName).toBe("Retry Test");
    expect(sendChatCompletionSpy).toHaveBeenCalledTimes(2);
  });

  it("fails after two retries on persistent bad response", async () => {
    sendChatCompletionSpy.mockResolvedValueOnce("bad-json-1").mockResolvedValueOnce("bad-json-2");

    await expect(
      extractRecipe(mockConfig(), {
        url: "http://example.com/test",
        contentType: "text/html",
        title: null,
        body: MOCK_HTML,
      })
    ).rejects.toThrow(/LLM_BAD_RESPONSE|Could not parse model output/);

    expect(sendChatCompletionSpy).toHaveBeenCalledTimes(2);
  });

  it("passes correct request to LLM with reduced content", async () => {
    const expectedExtraction: RecipeExtraction = {
      schemaVersion: "recipe_extraction.v1",
      status: "extracted",
      sourceUrl: "http://example.com/test",
      recipeName: "Test",
      ingredients: [{ name: "flour", quantity: "1", unit: "cup", note: "", originalText: "1 cup" }],
      instructions: [{ stepNumber: 1, text: "Mix." }],
      notes: [],
      description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      unusableReason: null,
    };

    sendChatCompletionSpy.mockResolvedValueOnce(buildLlmResponse(expectedExtraction));

    await extractRecipe(mockConfig(), {
      url: "http://example.com/test",
      contentType: "text/html",
      title: null,
      body: MOCK_HTML,
    });

    const callArgs = sendChatCompletionSpy.mock.calls[0];
    expect(callArgs).toHaveLength(2);
    const [_config, requestBody] = callArgs as [import("./llm-client.js").LlamaClientConfig, import("./llm-client.js").ChatCompletionRequest];

    expect(requestBody.model).toBe("qwen3.6");
    expect(requestBody.temperature).toBe(0.0);
    expect(requestBody.stream).toBe(false);
    expect(requestBody.messages).toHaveLength(2);
    expect(requestBody.messages[0].role).toBe("system");
    expect(requestBody.messages[1].role).toBe("user");
  });
});
