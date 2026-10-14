/**
 * Shared types for the recipe extraction pipelines (URL and photo).
 */

import * as schema from "@recing/schema";
import type { LlamaClientConfig } from "../llm/client.js";

/** Default maximum content size sent to the LLM, in characters. */
export const DEFAULT_MAX_CONTENT_CHARS = 60_000;

/** Configuration for the URL extraction pipeline. */
export interface ExtractionConfig extends LlamaClientConfig {
  /** Maximum content size to send to the LLM in characters (default: 60000). */
  maxContentChars?: number;
}

/** Input data for the extraction pipeline (content already fetched). */
export interface ExtractionInput {
  /** The final URL after redirects. */
  url: string;
  /** Content-Type header value. */
  contentType: string;
  /** Page title (may be null). */
  title: string | null;
  /** Raw HTML/text body from the fetch. */
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

  /** Short user-facing message (strips any parenthesized detail). */
  getUserMessage(): string {
    const msg = this.message;
    const parenIdx = msg.indexOf("(");
    if (parenIdx > 0) return msg.substring(0, parenIdx).trim();
    return msg;
  }
}
