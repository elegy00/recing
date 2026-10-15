/**
 * Photo recipe extraction: per-photo markdown transcription + final conversion.
 * Pure LLM orchestration — no database access (the worker persists between steps).
 *
 *   1. Per photo: the vision LLM transcribes the visible text into markdown
 *      (the worker stores it as an intermediate result).
 *   2. After all photos: the aggregated markdown is converted to a final
 *      RecipeExtraction JSON using the same pipeline as URL ingestion.
 */

import * as schema from "@recing/schema";
import { buildRequest, resolveModel, sendChatCompletion, type LlamaClientConfig } from "../llm/client.js";
import { parseAssistantReply } from "../llm/response.js";
import { extractRecipe } from "./url-extractor.js";
import { PHOTO_TRANSCRIBE_SYSTEM_PROMPT, PHOTO_TRANSCRIBE_USER_TEXT } from "./prompts/photo-prompts.js";

/** One successfully transcribed per-photo fragment. */
export interface PhotoMarkdownFragment {
  orderNum: number;
  markdown: string;
}

/** Transcribes all visible text of a single photo (base64 data URI) into markdown via the vision LLM. */
export async function extractMarkdownFromPhoto(config: LlamaClientConfig, dataUri: string): Promise<string> {
  const requestBody = buildRequest(resolveModel(config), {
    system: PHOTO_TRANSCRIBE_SYSTEM_PROMPT,
    user: [
      { type: "text", text: PHOTO_TRANSCRIBE_USER_TEXT },
      { type: "image_url", image_url: { url: dataUri } },
    ],
  });

  const rawBody = await sendChatCompletion(config, requestBody);
  return parseAssistantReply(rawBody).text;
}

/**
 * Converts the aggregated per-photo markdown into the final RecipeExtraction.
 * Reuses the URL ingestion pipeline — same prompt, schema, content reduction,
 * retry and error policy (see url-extractor.ts).
 */
export function convertMarkdownToRecipe(
  config: LlamaClientConfig,
  source: string,
  fragments: PhotoMarkdownFragment[]
): Promise<schema.RecipeExtraction> {
  const body = aggregatePhotoMarkdown(fragments);
  return extractRecipe(config, { url: source, contentType: "text/markdown", title: null, body }).then(
    ({ extraction }) => extraction
  );
}

/** Joins the per-photo markdown fragments into a single document. */
export function aggregatePhotoMarkdown(fragments: PhotoMarkdownFragment[]): string {
  const parts = ["Here is the transcribed text of each photo of one recipe.", ""];

  for (const { orderNum, markdown } of fragments) {
    parts.push(`--- Photo ${orderNum + 1} ---`, markdown.trim(), "");
  }

  return parts.join("\n");
}
