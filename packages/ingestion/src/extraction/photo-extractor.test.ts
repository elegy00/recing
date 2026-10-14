import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeExtraction } from "@recing/schema";

// Mock only the transport; keep buildRequest/resolveModel real so request
// construction is verified end-to-end.
const mockSend = vi.hoisted(() => vi.fn());
vi.mock("../llm/client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../llm/client.js")>();
  return { ...actual, sendChatCompletion: (...args: unknown[]) => mockSend(...args) };
});

import { extractFromPhoto, mergeExtractedRecipes } from "./photo-extractor.js";

const config = { endpoint: "http://localhost:8085/v1/chat/completions", model: "qwen3.6" };
const DATA_URI = "data:image/jpeg;base64,PHNvbWUgaW1hZ2UgZGF0YT4=";

function makeExtraction(name: string): RecipeExtraction {
  return JSON.parse(
    JSON.stringify({
      schemaVersion: "recipe_extraction.v1",
      status: "extracted",
      sourceUrl: null,
      recipeName: name,
      ingredients: [{ quantity: "1.5", unit: "cups", name: "all-purpose flour", note: "", originalText: "1.5 cups all-purpose flour" }],
      instructions: [{ stepNumber: 1, text: "Mix it." }],
      notes: [],
    })
  );
}

function chatResponse(content: string): string {
  return JSON.stringify({ choices: [{ message: { role: "assistant", content } }] });
}

describe("extractFromPhoto", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("sends a multimodal request with the image and parses the reply", async () => {
    mockSend.mockResolvedValueOnce(chatResponse(JSON.stringify(makeExtraction("Photo Pancakes"))));

    const extraction = await extractFromPhoto(config, DATA_URI);
    expect(extraction.recipeName).toBe("Photo Pancakes");

    // Verify the request that was sent
    const [_cfg, requestBody] = mockSend.mock.calls[0] as [unknown, { messages: Array<{ role: string; content: unknown }>; response_format?: { type?: string } }];
    const userMessage = requestBody.messages.find((m) => m.role === "user")!;
    expect(userMessage.content).toEqual([
      { type: "text", text: expect.stringContaining("photo") },
      { type: "image_url", image_url: { url: DATA_URI } },
    ]);
    expect(requestBody.response_format).toEqual({ type: "json_object" });
  });

  it("strips code fences from the model output", async () => {
    const fenced = "```json\n" + JSON.stringify(makeExtraction("Fenced")) + "\n```";
    mockSend.mockResolvedValueOnce(chatResponse(fenced));

    const extraction = await extractFromPhoto(config, DATA_URI);
    expect(extraction.recipeName).toBe("Fenced");
  });

  it("rejects when the model returns empty content", async () => {
    mockSend.mockResolvedValueOnce(JSON.stringify({ choices: [{ message: {} }] }));
    await expect(extractFromPhoto(config, DATA_URI)).rejects.toThrow(/empty/i);
  });
});

describe("mergeExtractedRecipes", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("includes all fragments in the user prompt and returns the merged result", async () => {
    const merged = makeExtraction("Merged Pancakes");
    mockSend.mockResolvedValueOnce(chatResponse(JSON.stringify(merged)));

    const fragments = [
      { orderNum: 0, extraction: makeExtraction("Part A") },
      { orderNum: 1, extraction: makeExtraction("Part B") },
    ];
    const result = await mergeExtractedRecipes(config, fragments);
    expect(result.recipeName).toBe("Merged Pancakes");

    const [, requestBody] = mockSend.mock.calls[0] as [unknown, { messages: Array<{ role: string; content: unknown }>; response_format?: { type?: string } }];
    const userPrompt = String(requestBody.messages.find((m) => m.role === "user")!.content);
    expect(userPrompt).toContain("--- Photo 1 ---");
    expect(userPrompt).toContain("Part A");
    expect(userPrompt).toContain("--- Photo 2 ---");
    expect(userPrompt).toContain("Part B");
    expect(requestBody.response_format?.type).toBe("json_schema");
  });

  it("rejects when the merged output is not valid JSON", async () => {
    mockSend.mockResolvedValueOnce(chatResponse("not json"));
    await expect(
      mergeExtractedRecipes(config, [{ orderNum: 0, extraction: makeExtraction("A") }])
    ).rejects.toThrow(/could not parse/i);
  });
});
