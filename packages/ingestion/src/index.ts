/**
 * @recing/ingestion — URL fetching, content reduction, and recipe extraction.
 */

// LLM extraction pipeline
export type {
  ExtractionConfig,
  ExtractionInput,
  LlmExtractionOutput,
} from "./llm-extraction.js";
export { extractRecipe, LlmExtractionError } from "./llm-extraction.js";

// LLM client (thin fetch wrapper)
export type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  LlamaClientConfig,
} from "./llm-client.js";
export { sendChatCompletion, buildRequest, LlmClientError } from "./llm-client.js";

// Prompt templates
export {
  PROMPT_VERSION,
  SCHEMA_VERSION,
  RECIPE_JSONLD_PATTERN,
  buildSystemPrompt,
  buildUserPrompt,
} from "./llm-prompt.js";

// Worker loop
export type { WorkerConfig, JobResult } from "./worker.js";
export { runWorker } from "./worker.js";

// Content reducer
export type { ReducedContent } from "./content-reducer.js";
export { reduce, extractTitle } from "./content-reducer.js";

// URL fetcher
export type { RecipeFetchResult } from "./recipe-fetch-result.js";
export { fetchUrl } from "./url-fetcher.js";
export {
  extractContentType,
  isAcceptedContentType,
  parseCharset,
} from "./url-fetcher.js";

// URL safety validator (SSRF protection)
export { validateUrl, isPublicAddress } from "./url-safety-validator.js";

// Fetch exceptions
export { RecipeFetchException } from "./recipe-fetch-exception.js";
