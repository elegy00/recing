/**
 * Thin HTTP client for the llama.cpp /v1/chat/completions endpoint.
 * Pure transport: builds the request JSON, sends it, returns the raw body.
 */

const MAX_COMPLETION_TOKENS = 24576;

/** Model used when no explicit model is configured. */
export const DEFAULT_MODEL = "qwen3.6";

export interface LlamaClientConfig {
  /** Base URL of the llama.cpp server (e.g., http://localhost:8085/v1/chat/completions) */
  endpoint: string;
  /** Request timeout in seconds */
  timeoutSeconds?: number;
  /** Model name (defaults to DEFAULT_MODEL when omitted) */
  model?: string;
}

/** Resolves the effective model name for a client config. */
export function resolveModel(config: LlamaClientConfig): string {
  return config.model ?? DEFAULT_MODEL;
}

// ─── Request types ──────────────────────────────────────────────────────────

export interface TextPart {
  type: "text";
  text: string;
}

export interface ImageUrlPart {
  type: "image_url";
  image_url: { url: string };
}

export type ContentPart = TextPart | ImageUrlPart;

/** A message's content: plain text, or a list of parts (for multimodal input). */
export type MessageContent = string | ContentPart[];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

/** The full chat completion request body as a JSON object. */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream: false;
  chat_template_kwargs?: Record<string, unknown>;
  response_format?: Record<string, unknown>;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Error thrown when the LLM endpoint is unreachable or returns an error status. */
export class LlmClientError extends Error {
  constructor(
    public readonly code: "LLM_UNAVAILABLE" | "LLM_HTTP_ERROR",
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "LlmClientError";
  }
}

// ─── Request building ───────────────────────────────────────────────────────

export interface BuildRequestOptions {
  /** System message content. */
  system: string;
  /** User message — plain text or a list of content parts (text/image). */
  user: MessageContent;
  /** Force strict JSON output matching the given schema (json_schema response_format). */
  jsonSchema?: Record<string, unknown>;
  /** Force plain JSON object output (json_object response_format). */
  jsonObject?: boolean;
}

/** Builds the full chat completion request JSON. */
export function buildRequest(model: string, options: BuildRequestOptions): ChatCompletionRequest {
  const messages: ChatMessage[] = [
    { role: "system", content: options.system },
    { role: "user", content: options.user },
  ];

  const request: ChatCompletionRequest = {
    messages,
    model,
    temperature: 0.0,
    top_p: 1.0,
    max_tokens: MAX_COMPLETION_TOKENS,
    stream: false,
    // Qwen3 thinking can consume the completion budget before JSON is emitted.
    chat_template_kwargs: { enable_thinking: false },
  };

  if (options.jsonSchema) {
    request.response_format = {
      type: "json_schema",
      json_schema: {
        name: "recipe_extraction",
        strict: true,
        schema: options.jsonSchema,
      },
    };
  } else if (options.jsonObject) {
    request.response_format = { type: "json_object" };
  }

  return request;
}

// ─── Transport ──────────────────────────────────────────────────────────────

/**
 * Sends a chat completion request and returns the raw response body string.
 */
export async function sendChatCompletion(
  config: LlamaClientConfig,
  requestBody: ChatCompletionRequest
): Promise<string> {
  const timeoutMs = (config.timeoutSeconds ?? 180) * 1000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) {
      const bodyPreview = await response.text();
      throw new LlmClientError(
        "LLM_HTTP_ERROR",
        `HTTP ${response.status}: ${bodyPreview.substring(0, 200)}`,
        response.status
      );
    }

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}
