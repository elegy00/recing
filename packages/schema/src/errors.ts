/** HTTP status mapping for error categories. */
const STATUS_BY_CATEGORY = {
  client: 400,
  server: 500,
} as const;

type StatusCode = (typeof STATUS_BY_CATEGORY)[keyof typeof STATUS_BY_CATEGORY];

/** Error codes for URL fetching failures. */
export enum FetchErrorCode {
  INVALID_URL = "INVALID_URL",
  UNSAFE_TARGET = "UNSAFE_TARGET",
  UNREACHABLE_HOST = "UNREACHABLE_HOST",
  TIMEOUT = "TIMEOUT",
  REDIRECT_FAILURE = "REDIRECT_FAILURE",
  UNSUPPORTED_CONTENT_TYPE = "UNSUPPORTED_CONTENT_TYPE",
  RESPONSE_TOO_LARGE = "RESPONSE_TOO_LARGE",
  NON_SUCCESS_STATUS = "NON_SUCCESS_STATUS",
  FETCH_FAILED = "FETCH_FAILED",
}

/** Human-readable messages for each fetch error code. */
export const FETCH_ERROR_MESSAGES: Record<FetchErrorCode, string> = {
  [FetchErrorCode.INVALID_URL]:
    "The URL you entered is not valid. Please enter a full web address starting with http:// or https://",
  [FetchErrorCode.UNSAFE_TARGET]:
    "This link appears to point to a private network address and cannot be fetched for security reasons.",
  [FetchErrorCode.UNREACHABLE_HOST]:
    "Could not reach the server at this address.",
  [FetchErrorCode.TIMEOUT]:
    "The request took too long to complete. The server may be slow or unreachable.",
  [FetchErrorCode.REDIRECT_FAILURE]:
    "Too many redirects or a redirect target could not be validated. The link may be broken.",
  [FetchErrorCode.UNSUPPORTED_CONTENT_TYPE]:
    "This page does not contain web content that can be processed.",
  [FetchErrorCode.RESPONSE_TOO_LARGE]:
    "The page was too large to process (over 5 MB).",
  [FetchErrorCode.NON_SUCCESS_STATUS]:
    'The server returned an error response ({status}). This page may be unavailable or restricted.',
  [FetchErrorCode.FETCH_FAILED]:
    "An unexpected error occurred while fetching the page. Please try again.",
};

/** Error codes for LLM extraction failures. */
/** Lifecycle states for a recipe extraction job. */
export enum JobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/** Error codes for LLM extraction failures. */
export enum LlmErrorCode {
  LLM_UNAVAILABLE = "LLM_UNAVAILABLE",
  LLM_TIMEOUT = "LLM_TIMEOUT",
  LLM_HTTP_ERROR = "LLM_HTTP_ERROR",
  LLM_BAD_RESPONSE = "LLM_BAD_RESPONSE",
  LLM_SCHEMA_MISMATCH = "LLM_SCHEMA_MISMATCH",
  LLM_CONTENT_TOO_LARGE = "LLM_CONTENT_TOO_LARGE",
  LLM_FAILED = "LLM_FAILED",
}

/** Human-readable messages for each LLM error code. */
export const LLM_ERROR_MESSAGES: Record<LlmErrorCode, string> = {
  [LlmErrorCode.LLM_UNAVAILABLE]:
    "The local recipe extractor is unavailable. Start llama.cpp and try again.",
  [LlmErrorCode.LLM_TIMEOUT]:
    "The request to the local extractor timed out. It may be busy or not running.",
  LLM_HTTP_ERROR: "The local extractor returned an unexpected response (HTTP {status}).",
  LLM_BAD_RESPONSE: "The extractor returned malformed data that could not be parsed.",
  LLM_SCHEMA_MISMATCH:
    "The extractor returned data that does not match the expected recipe format.",
  LLM_CONTENT_TOO_LARGE:
    "The page content is too large to send to the extractor.",
  LLM_FAILED:
    "The extractor was unable to produce a valid response. Please try again.",
};

/** Resolves an error code's message, replacing placeholders with provided args. */
export function resolveErrorMessage(
  messages: Record<string, string>,
  code: string,
  ...args: unknown[]
): string {
  const template = messages[code];
  if (!template) return `Unknown error code: ${code}`;
  let msg = template;
  for (const arg of args) {
    msg = msg.replace("{status}", String(arg));
  }
  return msg;
}

/** Base class for application errors with a machine-readable code. */
export class AppError extends Error {
  statusCode: StatusCode;

  constructor(
    public readonly code: string,
    message: string,
    statusCode?: StatusCode
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode ?? STATUS_BY_CATEGORY.client as StatusCode;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message };
  }
}
