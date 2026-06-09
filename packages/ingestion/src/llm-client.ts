/**
 * Thin wrapper around Node.js native fetch for llama.cpp /v1/chat/completions endpoint.
 * Builds and sends the request JSON, returns raw response body as a string.
 */

const MAX_COMPLETION_TOKENS = 24576;

export interface LlamaClientConfig {
  /** Base URL of the llama.cpp server (e.g., http://localhost:8085/v1/chat/completions) */
  endpoint: string;
  /** Request timeout in seconds */
  timeoutSeconds?: number;
  /** Model name (e.g., "qwen3.6") */
  model?: string;
}

/** The full chat completion request body as a JSON object. */
export interface ChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream: false;
  chat_template_kwargs?: Record<string, unknown>;
  response_format?: Record<string, unknown>;
}

/** Parsed LLM response from the OpenAI-compatible endpoint. */
export interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

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

/**
 * Builds the full chat completion request JSON.
 */
export function buildRequest(
  model: string,
  systemMsg: string,
  userMsg: string,
  schemaJson?: Record<string, unknown>
): ChatCompletionRequest {
  const messages = [
    { role: "system", content: systemMsg },
    { role: "user", content: userMsg },
  ];

  const request: ChatCompletionRequest = {
    messages,
    model,
    temperature: 0.0,
    top_p: 1.0,
    max_tokens: MAX_COMPLETION_TOKENS,
    stream: false,
  };

  // Qwen3 thinking can consume the completion budget before JSON is emitted.
  request.chat_template_kwargs = { enable_thinking: false };

  if (schemaJson) {
    request.response_format = {
      type: "json_schema",
      json_schema: {
        name: "recipe_extraction",
        strict: true,
        schema: schemaJson,
      },
    };
  }

  return request;
}
