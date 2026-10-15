/**
 * Parsing of raw chat completion response bodies into the assistant's text reply.
 * Handles multimodal content (string or list of parts) and markdown code fences.
 */

export type LlmResponseFailure = "unparseable_body" | "no_choices" | "empty_content";

/** Error thrown when a raw LLM response body cannot be turned into usable text. */
export class LlmResponseError extends Error {
  constructor(
    public readonly reason: LlmResponseFailure,
    message: string,
    detail?: string
  ) {
    super(detail ? `${message}: ${detail}` : message);
    this.name = "LlmResponseError";
  }
}

/** Parsed LLM response from the OpenAI-compatible endpoint. */
export interface ChatCompletionResponse {
  choices: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** The assistant's text reply plus token usage, extracted from a raw body. */
export interface AssistantReply {
  /** Code-fence-stripped, trimmed text content of the first choice. */
  text: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Parses a raw chat completion response body into the assistant's text reply.
 * Throws LlmResponseError when the body is unusable.
 */
export function parseAssistantReply(rawBody: string): AssistantReply {
  let parsed: ChatCompletionResponse;
  try {
    parsed = JSON.parse(rawBody) as ChatCompletionResponse;
  } catch {
    throw new LlmResponseError("unparseable_body", "Could not parse model output as JSON", rawBody.substring(0, 200));
  }

  if (!parsed.choices || parsed.choices.length === 0) {
    throw new LlmResponseError("no_choices", "No choices in response");
  }

  const content = extractTextContent(parsed.choices[0].message?.content);
  if (content == null || content.trim().length === 0) {
    throw new LlmResponseError("empty_content", "Empty assistant content from model");
  }

  return {
    text: stripCodeFences(content.trim()),
    promptTokens: parsed.usage?.prompt_tokens ?? 0,
    completionTokens: parsed.usage?.completion_tokens ?? 0,
  };
}

/** Extracts plain text from message content that may be a string or a list of parts. */
export function extractTextContent(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;

  const textParts = content.filter(
    (part): part is { type: string; text?: string } =>
      typeof part === "object" && part !== null && (part as { type?: unknown }).type === "text"
  );
  return textParts.map((part) => part.text ?? "").join("\n");
}

/** Removes markdown ```json ... ``` or ``` ... ``` wrappers from model output. */
export function stripCodeFences(content: string): string {
  if (!content.startsWith("```")) return content;

  const firstNewline = content.indexOf("\n");
  if (firstNewline > 0 && content.endsWith("```") && content.length - 3 > firstNewline) {
    return content.substring(firstNewline + 1, content.length - 3).trim();
  }
  return content;
}
