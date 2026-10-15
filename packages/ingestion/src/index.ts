/**
 * @recing/ingestion — URL fetching, content reduction, and recipe extraction.
 * Public API: re-exports only. Internal structure lives in the subdirectories.
 */

// ─── URL ingestion worker ────────────────────────────────────────────────────
export type { WorkerConfig } from "./workers/url-ingestion-worker.js";
export { runWorker } from "./workers/url-ingestion-worker.js";

// ─── Photo ingestion worker ──────────────────────────────────────────────────
export type { PhotoWorkerConfig } from "./workers/photo-ingestion-worker.js";
export { runPhotoWorker } from "./workers/photo-ingestion-worker.js";

// ─── LLM extraction (URL pipeline) ───────────────────────────────────────────
export type {
  ExtractionConfig,
  ExtractionInput,
  LlmExtractionOutput,
} from "./extraction/types.js";
export { LlmExtractionError } from "./extraction/types.js";
export { extractRecipe } from "./extraction/url-extractor.js";

// ─── LLM client (transport + request building) ───────────────────────────────
export type {
  ChatCompletionRequest,
  ChatMessage,
  LlamaClientConfig,
} from "./llm/client.js";
export { buildRequest, resolveModel, sendChatCompletion, LlmClientError } from "./llm/client.js";
export type { ChatCompletionResponse } from "./llm/response.js";

// ─── Prompt templates ────────────────────────────────────────────────────────
export {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  RECIPE_JSONLD_PATTERN,
  buildSystemPrompt,
  buildUserPrompt,
} from "./extraction/prompts/recipe-extraction-prompt.js";

// ─── Content reduction ───────────────────────────────────────────────────────
export type { ReducedContent } from "./content/content-reducer.js";
export { extractTitle, reduce } from "./content/content-reducer.js";

// ─── URL fetching (SSRF-protected) ───────────────────────────────────────────
export type { RecipeFetchResult } from "./fetch/recipe-fetch-result.js";
export { fetchUrl } from "./fetch/url-fetcher.js";
export {
  extractContentType,
  isAcceptedContentType,
  parseCharset,
} from "./fetch/content-type.js";
export { isPublicAddress, validateUrl } from "./fetch/url-safety-validator.js";
export { RecipeFetchException } from "./fetch/recipe-fetch-exception.js";
