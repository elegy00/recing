import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeExtraction } from "@recing/schema";

// Mock only the transport; keep buildRequest/resolveModel real so request
// construction is verified end-to-end.
const mockSend = vi.hoisted(() => vi.fn());
vi.mock("../llm/client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../llm/client.js")>();
  return { ...actual, sendChatCompletion: (...args: unknown[]) => mockSend(...args) };
});

// The markdown → JSON conversion reuses the URL ingestion pipeline — mock it
// here to keep this file focused on photo-specific behavior.
const mockExtractRecipe = vi.hoisted(() => vi.fn());
vi.mock("./url-extractor.js", () => ({ extractRecipe: (...args: unknown[]) => mockExtractRecipe(...args) }));

import {
  aggregatePhotoMarkdown,
  convertMarkdownToRecipe,
  extractMarkdownFromPhoto,
} from "./photo-extractor.js";

const config = { endpoint: "http://localhost:8085/v1/chat/completions", model: "qwen3.6" };
const DATA_URI = "data:image/jpeg;base64,PHNvbWUgaW1hZ2UgZGF0YT4=";

function chatResponse(content: string): string {
  return JSON.stringify({ choices: [{ message: { role: "assistant", content } }] });
}

describe("extractMarkdownFromPhoto", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("sends a multimodal request with the image and returns the markdown reply", async () => {
    const markdown = "# Pancakes\n## Ingredients\n- 2 eggs";
    mockSend.mockResolvedValueOnce(chatResponse(markdown));

    const result = await extractMarkdownFromPhoto(config, DATA_URI);
    expect(result).toBe(markdown);

    // Verify the request that was sent
    const [_cfg, requestBody] = mockSend.mock.calls[0] as [unknown, { messages: Array<{ role: string; content: unknown }>; response_format?: { type?: string } }];
    const userMessage = requestBody.messages.find((m) => m.role === "user")!;
    expect(userMessage.content).toEqual([
      { type: "text", text: expect.stringMatching(/transcribe/i) },
      { type: "image_url", image_url: { url: DATA_URI } },
    ]);
    // Markdown output — no forced JSON response format
    expect(requestBody.response_format).toBeUndefined();
  });

  it("strips code fences from the model output", async () => {
    const fenced = "```markdown\n# Pancakes\n```";
    mockSend.mockResolvedValueOnce(chatResponse(fenced));

    const result = await extractMarkdownFromPhoto(config, DATA_URI);
    expect(result).toBe("# Pancakes");
  });

  it("rejects when the model returns empty content", async () => {
    mockSend.mockResolvedValueOnce(JSON.stringify({ choices: [{ message: {} }] }));
    await expect(extractMarkdownFromPhoto(config, DATA_URI)).rejects.toThrow(/empty/i);
  });
});

describe("aggregatePhotoMarkdown", () => {
  it("joins all fragments with per-photo section headers", () => {
    const doc = aggregatePhotoMarkdown([
      { orderNum: 0, markdown: "# Title\n- 2 eggs" },
      { orderNum: 1, markdown: "## Instructions\n1. Mix" },
    ]);

    expect(doc).toContain("--- Photo 1 ---");
    expect(doc).toContain("- 2 eggs");
    expect(doc).toContain("--- Photo 2 ---");
    expect(doc).toContain("1. Mix");
  });
});

describe("convertMarkdownToRecipe", () => {
  beforeEach(() => {
    mockExtractRecipe.mockReset();
  });

  it("feeds the aggregated markdown into the shared extraction pipeline", async () => {
    const extraction: RecipeExtraction = JSON.parse(
      JSON.stringify({
        schemaVersion: "recipe_extraction.v1",
        status: "extracted",
        recipeName: "Pancakes",
        ingredients: [],
        instructions: [],
        notes: [],
      })
    );
    mockExtractRecipe.mockResolvedValueOnce({ extraction, metadata: {} });

    const fragments = [
      { orderNum: 0, markdown: "# Title" },
      { orderNum: 1, markdown: "## Instructions" },
    ];
    const result = await convertMarkdownToRecipe(config, "photo://job-1", fragments);
    expect(result).toBe(extraction);

    expect(mockExtractRecipe).toHaveBeenCalledTimes(1);
    const [cfg, input] = mockExtractRecipe.mock.calls[0] as [unknown, { url: string; contentType: string; title: null; body: string }];
    expect(cfg).toBe(config);
    expect(input.url).toBe("photo://job-1");
    expect(input.contentType).toBe("text/markdown");
    expect(input.title).toBeNull();
    expect(input.body).toContain("--- Photo 1 ---");
    expect(input.body).toContain("# Title");
    expect(input.body).toContain("--- Photo 2 ---");
    expect(input.body).toContain("## Instructions");
  });
});
