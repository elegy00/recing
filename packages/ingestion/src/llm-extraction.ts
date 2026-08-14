/**
 * Orchestrates the LLM extraction pipeline: content reduction → request building → HTTP call → parsing → validation.
 * Ported from RecipeExtractionService.java.
 */

import type { ReducedContent } from "./content-reducer.js";
import { reduce, extractTitle } from "./content-reducer.js";
import * as schema from "@recing/schema";

import type { LlamaClientConfig } from "./llm-client.js";
import { buildRequest, sendChatCompletion, LlmClientError } from "./llm-client.js";
import type { ChatCompletionResponse } from "./llm-client.js";
import {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  buildSystemPrompt,
  buildUserPrompt,
} from "./llm-prompt.js";

// Retry settings — ported from Java (grill-me decision #8)
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

export interface ExtractionConfig extends LlamaClientConfig {
  /** Maximum content size to send to the LLM in characters */
  maxContentChars?: number;
}

/** Input data for the extraction pipeline (already fetched). */
export interface ExtractionInput {
  /** The final URL after redirects */
  url: string;
  /** Content-Type header value */
  contentType: string;
  /** Page title (may be null) */
  title: string | null;
  /** Raw HTML/text body from fetch */
  body: string;
}

/** Result of a successful LLM extraction. */
export interface LlmExtractionOutput {
  extraction: schema.RecipeExtraction;
  metadata: schema.ExtractionMetadata;
}

/** Controlled error for LLM extraction failures. */
export class LlmExtractionError extends Error {
  constructor(
    public readonly code: schema.LlmErrorCode,
    message?: string,
    detail?: string
  ) {
    super(detail ? `${message}: ${detail}` : message ?? "");
    this.name = "LlmExtractionError";
  }

  getUserMessage(): string {
    const msg = this.message;
    const parenIdx = msg.indexOf("(");
    if (parenIdx > 0) return msg.substring(0, parenIdx).trim();
    return msg;
  }
}

/**
 * Extracts recipe data from page content by sending it to the local LLM.
 * Content is already fetched — this orchestrates reduction → request → HTTP → parse → validate.
 */
export async function extractRecipe(
  config: ExtractionConfig,
  input: ExtractionInput
): Promise<LlmExtractionOutput> {
  const totalStart = Date.now();
  const maxContentChars = config.maxContentChars ?? 60_000;

  // Step 1: Reduce content
  const reduced = reduce(input.body, maxContentChars);
  console.warn(`Content reduction: ${reduced.originalLength} chars → ${reduced.reducedLength} chars (truncated=${reduced.truncated})`);

  if (!reduced.text || reduced.text.trim().length === 0) {
    throw new LlmExtractionError(
      schema.LlmErrorCode.LLM_CONTENT_TOO_LARGE,
      "No extractable content found after stripping noise"
    );
  }

  // Step 2: Build request
  const systemPrompt = buildSystemPrompt(SCHEMA_VERSION);
  const userPrompt = buildUserPrompt(input.url, input.contentType, reduced.truncated, input.title, reduced.text);

  // Load the JSON schema for response_format (inline)
  const schemaJson = await loadRecipeExtractionSchema();
  const requestBody = buildRequest(config.model ?? "qwen3.6", systemPrompt, userPrompt, schemaJson);

  // Step 3: Send and parse with retry loop
  return extractWithRetry(
    config,
    requestBody,
    input.url,
    reduced.reducedLength,
    reduced.truncated,
    totalStart
  );
}

/** Internal retry loop for the LLM extraction call. */
async function extractWithRetry(
  config: ExtractionConfig,
  requestBody: import("./llm-client.js").ChatCompletionRequest,
  url: string,
  requestContentChars: number,
  truncatedInput: boolean,
  totalStart: number
): Promise<LlmExtractionOutput> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptStart = Date.now();

    try {
      console.debug(`LLM request attempt ${attempt} to ${config.endpoint}`);
      const responseBody = await sendChatCompletion(config, requestBody);
      const attemptDuration = Date.now() - attemptStart;
      console.warn(`LLM response received on attempt ${attempt} (${attemptDuration}ms)`);

      return parseResponse(
        responseBody,
        url,
        Date.now() - totalStart,
        requestContentChars,
        truncatedInput,
        config.endpoint,
        config.model ?? "qwen3.6"
      );
    } catch (error) {
      if (error instanceof LlmExtractionError) {
        // Malformed JSON / unexpected response shape is retryable once.
        if (error.code === schema.LlmErrorCode.LLM_BAD_RESPONSE && attempt < MAX_ATTEMPTS) {
          console.warn(`Bad LLM response on attempt ${attempt}/${MAX_ATTEMPTS}; retrying: ${truncate(error.message, 200)}`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw error;
      }

      if (error instanceof LlmClientError) {
        // Connection refused → LLM not running
        if (error.code === "LLM_UNAVAILABLE") {
          console.warn(`LLM endpoint unreachable: ${truncate(error.message, 200)}`);
          throw new LlmExtractionError(schema.LlmErrorCode.LLM_UNAVAILABLE, error.message);
        }

        // HTTP 5xx is retryable (grill-me #8); 4xx is not.
        if (error.statusCode && error.statusCode >= 500 && attempt < MAX_ATTEMPTS) {
          console.warn(`LLM HTTP ${error.statusCode} on attempt ${attempt}: ${truncate(error.message, 200)}`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        throw new LlmExtractionError(
          schema.LlmErrorCode.LLM_HTTP_ERROR,
          `The local extractor returned an unexpected response (HTTP ${error.statusCode ?? "unknown"}).`,
          error.message
        );
      }

      // Timeout or network errors — retryable once
      if ((error as Error & { name?: string }).name === "AbortError") {
        console.warn(`LLM request timed out (attempt ${attempt}/${MAX_ATTEMPTS})`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new LlmExtractionError(
          schema.LlmErrorCode.LLM_TIMEOUT,
          "The request to the local extractor timed out."
        );
      }

      // Log detailed error context for debugging
      const errObj = error as Error & { cause?: unknown };
      const errStr = String(error);
      const errCause = errObj.cause ? String(errObj.cause) : null;
      const errCode = (errObj.cause as NodeJS.ErrnoException & { code?: string })?.code ?? null;
      console.warn(`LLM request failed on attempt ${attempt}: ${errStr}`);
      if (errCode) console.warn(`  underlying code: ${errCode}`);
      if (errCause && errCause !== errStr) console.warn(`  cause: ${truncate(errCause, 500)}`);
      if (errObj.stack) console.warn(`  stack: ${errObj.stack.split("\n").slice(1, 3).join("\n          ")}`);

      // Connection refused → LLM not running (grill-me #8)
      if (
        errStr.includes("ECONNREFUSED") ||
        errCode === "ECONNREFUSED" ||
        errStr.toLowerCase().includes("connection refused")
      ) {
        console.warn(`LLM endpoint unreachable: ${truncate(errStr, 200)}`);
        throw new LlmExtractionError(
          schema.LlmErrorCode.LLM_UNAVAILABLE,
          "The local recipe extractor is unavailable. Start llama.cpp and try again.",
          errStr
        );
      }

      if (attempt < MAX_ATTEMPTS) {
        console.warn(`LLM network error on attempt ${attempt}: ${truncate(errStr, 200)}`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      throw new LlmExtractionError(
        schema.LlmErrorCode.LLM_FAILED,
        "The extractor was unable to produce a valid response.",
        errStr
      );
    }
  }

  throw new LlmExtractionError(schema.LlmErrorCode.LLM_FAILED, "Max retry attempts exhausted");
}

/** Parses the raw LLM response into a structured extraction. */
function parseResponse(
  responseBody: string,
  url: string,
  durationMs: number,
  requestContentChars: number,
  truncatedInput: boolean,
  modelEndpoint: string,
  model: string
): LlmExtractionOutput {
  let parsed: ChatCompletionResponse;

  try {
    parsed = JSON.parse(responseBody) as ChatCompletionResponse;
  } catch {
    throw new LlmExtractionError(
      schema.LlmErrorCode.LLM_BAD_RESPONSE,
      "Could not parse model output as JSON",
      responseBody.substring(0, 200)
    );
  }

  // Extract token usage if present
  const promptTokens = parsed.usage?.prompt_tokens ?? 0;
  const completionTokens = parsed.usage?.completion_tokens ?? 0;

  // Get assistant content from choices[0].message.content
  if (!parsed.choices || parsed.choices.length === 0) {
    throw new LlmExtractionError(
      schema.LlmErrorCode.LLM_BAD_RESPONSE,
      "No choices in response"
    );
  }

  const content = parsed.choices[0].message?.content;
  console.warn(`LLM assistant content: ${content}`);

  if (content == null || content.trim().length === 0) {
    throw new LlmExtractionError(
      schema.LlmErrorCode.LLM_FAILED,
      "Empty assistant content from model"
    );
  }

  // Trim potential markdown code fences: ```json ... ``` or ``` ... ```
  const trimmed = stripCodeFences(content.trim());

  // Parse as RecipeExtraction JSON
  let extractionNode: unknown;
  try {
    extractionNode = JSON.parse(trimmed);
  } catch {
    throw new LlmExtractionError(
      schema.LlmErrorCode.LLM_BAD_RESPONSE,
      "Could not parse model output as JSON",
      trimmed.substring(0, 200)
    );
  }

  // Validate against Zod schema from @recing/schema
  const parsedResult = schema.parseRecipeExtraction(extractionNode);

  // Build metadata
  const metadata: schema.ExtractionMetadata = {
    modelEndpoint,
    model,
    durationMs,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    requestContentChars,
    truncatedInput,
    parsedAsExpected: true,
    httpStatusCode: 200,
    errorCode: null,
    promptTokens,
    completionTokens,
  };

  console.warn(`LLM result: ${JSON.stringify(parsedResult)} [${JSON.stringify(metadata)}]`);

  return { extraction: parsedResult, metadata };
}

/** Loads the recipe-extraction JSON schema for response_format.json_schema. */
async function loadRecipeExtractionSchema(): Promise<Record<string, unknown> | undefined> {
  // The JSON schema is used by the OpenAI-compatible json_schema response_format.
  // Loading from a static file isn't available in this monorepo setup.
  // We return undefined — validation still applies post-parse via Zod.
  console.warn("JSON schema not embedded — skipping response_format.json_schema (validation still applies post-parse)");
  return undefined;
}

/** Removes markdown ```json ... ``` or ``` ... ``` wrappers from model output. */
function stripCodeFences(content: string): string {
  if (!content.startsWith("```")) return content;

  const firstNewline = content.indexOf("\n");
  if (firstNewline > 0 && content.endsWith("```") && content.length - 3 > firstNewline) {
    return content.substring(firstNewline + 1, content.length - 3).trim();
  }
  return content;
}

function truncate(s: string | undefined, max: number): string {
  if (s == null) return "";
  return s.length <= max ? s : s.substring(0, max);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
