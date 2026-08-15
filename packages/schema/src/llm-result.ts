import { z } from "zod";
import type { RecipeExtraction } from "./recipe-extraction.js";
import { LlmErrorCode } from "./errors.js";

/** Metadata about an LLM extraction request/response cycle. */
export interface ExtractionMetadata {
  modelEndpoint: string;
  model: string;
  durationMs: number;
  promptVersion: string;
  schemaVersion: string;
  requestContentChars?: number | null;
  truncatedInput?: boolean | null;
  parsedAsExpected?: boolean | null;
  httpStatusCode: number;
  errorCode?: LlmErrorCode | null;
  promptTokens: number;
  completionTokens: number;
}

/** Result of a successful LLM extraction. */
export interface LlmExtractionResult {
  extraction: RecipeExtraction;
  metadata: ExtractionMetadata;
}

/** Validates the metadata portion of an LLM result. */
export function validateMetadata(raw: unknown): ExtractionMetadata {
  const result = z.object({
    modelEndpoint: z.string().min(1),
    model: z.string().min(1),
    durationMs: z.number().int().min(0),
    promptVersion: z.string().min(1),
    schemaVersion: z.string().min(1),
    requestContentChars: z.union([z.number(), z.null()]).optional(),
    truncatedInput: z.union([z.boolean(), z.null()]).optional(),
    parsedAsExpected: z.union([z.boolean(), z.null()]).optional(),
    httpStatusCode: z.number().int().min(100).max(599),
    errorCode: z.nativeEnum(LlmErrorCode).nullish(),
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
  }).safeParse(raw);

  if (!result.success) {
    throw new Error(`Invalid extraction metadata: ${result.error.message}`);
  }
  return result.data;
}

/** Calculates tokens per second from metadata. */
export function tokensPerSecond(metadata: ExtractionMetadata): number {
  if (metadata.durationMs <= 0 || metadata.completionTokens === 0) return 0;
  return Math.round((metadata.completionTokens * 100.0 / metadata.durationMs)) / 100;
}
