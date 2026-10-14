/**
 * Photo recipe extraction: per-photo vision extraction and multi-fragment merge.
 * Pure LLM orchestration — no database access (the worker persists between steps).
 */

import * as schema from "@recing/schema";
import { buildRequest, resolveModel, sendChatCompletion, type LlamaClientConfig } from "../llm/client.js";
import { parseAssistantReply } from "../llm/response.js";
import { MERGE_SYSTEM_PROMPT, PHOTO_EXTRACT_SYSTEM_PROMPT } from "./prompts/photo-prompts.js";

/** One successfully extracted per-photo fragment. */
export interface PhotoFragment {
  orderNum: number;
  extraction: schema.RecipeExtraction;
}

/** Extracts a RecipeExtraction from a single photo (base64 data URI) via the vision LLM. */
export async function extractFromPhoto(
  config: LlamaClientConfig,
  dataUri: string
): Promise<schema.RecipeExtraction> {
  const requestBody = buildRequest(resolveModel(config), {
    system: PHOTO_EXTRACT_SYSTEM_PROMPT,
    user: [
      { type: "text", text: "Extract all recipe information visible in this photo. Return structured JSON." },
      { type: "image_url", image_url: { url: dataUri } },
    ],
    jsonObject: true, // force JSON output
  });

  const rawBody = await sendChatCompletion(config, requestBody);
  const reply = parseAssistantReply(rawBody);
  return parseRecipeJson(reply.text);
}

/** Merges per-photo extractions into one final RecipeExtraction. */
export async function mergeExtractedRecipes(
  config: LlamaClientConfig,
  fragments: PhotoFragment[]
): Promise<schema.RecipeExtraction> {
  const requestBody = buildRequest(resolveModel(config), {
    system: MERGE_SYSTEM_PROMPT,
    user: buildMergeUserPrompt(fragments),
    jsonSchema: schema.recipeExtractionJsonSchema,
  });

  const rawBody = await sendChatCompletion(config, requestBody);
  const reply = parseAssistantReply(rawBody);
  return parseRecipeJson(reply.text);
}

/** Builds the user message containing all per-photo extractions to merge. */
function buildMergeUserPrompt(fragments: PhotoFragment[]): string {
  const parts = [
    "Here are structured RecipeExtraction objects extracted from individual photos. Merge them into one complete recipe.",
    "",
  ];

  for (const { orderNum, extraction } of fragments) {
    parts.push(`--- Photo ${orderNum + 1} ---`);
    parts.push(JSON.stringify(extraction, null, 2));
    parts.push("");
  }

  return parts.join("\n");
}

/** Parses and validates model output as a RecipeExtraction. */
function parseRecipeJson(text: string): schema.RecipeExtraction {
  let node: unknown;
  try {
    node = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse model output as JSON: ${text.substring(0, 200)}`);
  }
  return schema.parseRecipeExtraction(node);
}
