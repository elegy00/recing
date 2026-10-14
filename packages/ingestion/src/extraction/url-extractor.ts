/**
 * URL recipe extraction pipeline: content reduction → prompt building → LLM call → parse/validate.
 * Content is already fetched; this module orchestrates everything from there to a validated RecipeExtraction.
 */

import * as schema from "@recing/schema";
import { reduce, type ReducedContent } from "../content/content-reducer.js";
import { buildRequest, resolveModel, sendChatCompletion, type ChatCompletionRequest } from "../llm/client.js";
import { parseAssistantReply } from "../llm/response.js";
import { withRetry } from "../llm/retry.js";
import { handleLlmFailure, toLlmExtractionError } from "./llm-error-policy.js";
import { PROMPT_VERSION, SCHEMA_VERSION, buildSystemPrompt, buildUserPrompt } from "./prompts/recipe-extraction-prompt.js";
import {
  DEFAULT_MAX_CONTENT_CHARS,
  LlmExtractionError,
  type ExtractionConfig,
  type ExtractionInput,
  type LlmExtractionOutput,
} from "./types.js";

// Retry settings — ported from Java (grill-me decision #8)
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

/**
 * Extracts recipe data from page content by sending it to the local LLM.
 */
export async function extractRecipe(
  config: ExtractionConfig,
  input: ExtractionInput
): Promise<LlmExtractionOutput> {
  const totalStart = Date.now();
  const maxContentChars = config.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS;

  // Step 1: Reduce content to LLM-sized text
  const reduced = reduce(input.body, maxContentChars);
  console.warn(`Content reduction: ${reduced.originalLength} chars → ${reduced.reducedLength} chars (truncated=${reduced.truncated})`);

  if (!reduced.text || reduced.text.trim().length === 0) {
    throw new LlmExtractionError(
      schema.LlmErrorCode.LLM_CONTENT_TOO_LARGE,
      "No extractable content found after stripping noise"
    );
  }

  // Step 2: Build the request
  const requestBody = buildRequest(resolveModel(config), {
    system: buildSystemPrompt(SCHEMA_VERSION),
    user: buildUserPrompt(input.url, input.contentType, reduced.truncated, input.title, reduced.text),
    jsonSchema: schema.recipeExtractionJsonSchema,
  });

  // Step 3: Call the LLM with retries, then parse and validate
  try {
    return await withRetry(
      () => attemptExtraction(config, requestBody, reduced, totalStart),
      { maxAttempts: MAX_ATTEMPTS, delayMs: RETRY_DELAY_MS, onFailure: (error, attempt) => handleLlmFailure(error, attempt, MAX_ATTEMPTS) }
    );
  } catch (error) {
    throw toLlmExtractionError(error);
  }
}

/** One extraction attempt: HTTP call → parse response → validate schema. */
async function attemptExtraction(
  config: ExtractionConfig,
  requestBody: ChatCompletionRequest,
  reduced: ReducedContent,
  totalStart: number
): Promise<LlmExtractionOutput> {
  const attemptStart = Date.now();
  console.debug(`LLM request to ${config.endpoint}`);

  const rawBody = await sendChatCompletion(config, requestBody);
  console.warn(`LLM response received (${Date.now() - attemptStart}ms)`);

  const reply = parseAssistantReply(rawBody); // throws LlmResponseError

  let extractionNode: unknown;
  try {
    extractionNode = JSON.parse(reply.text);
  } catch {
    throw new LlmExtractionError(
      schema.LlmErrorCode.LLM_BAD_RESPONSE,
      "Could not parse model output as JSON",
      reply.text.substring(0, 200)
    );
  }

  // Validate against the Zod schema from @recing/schema
  const extraction = schema.parseRecipeExtraction(extractionNode);

  const metadata: schema.ExtractionMetadata = {
    modelEndpoint: config.endpoint,
    model: resolveModel(config),
    durationMs: Date.now() - totalStart,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    requestContentChars: reduced.reducedLength,
    truncatedInput: reduced.truncated,
    parsedAsExpected: true,
    httpStatusCode: 200,
    errorCode: null,
    promptTokens: reply.promptTokens,
    completionTokens: reply.completionTokens,
  };

  console.warn(`LLM extraction completed in ${metadata.durationMs}ms (${reply.completionTokens} tokens)`);
  return { extraction, metadata };
}
