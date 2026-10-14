/**
 * Ingestion configuration loaded from environment variables.
 * Single source of truth for all config defaults used by the CLI and workers.
 */

export interface IngestionConfig {
  /** llama.cpp chat-completions endpoint. */
  endpoint: string;
  /** Model name. */
  model: string;
  /** Maximum page content size sent to the LLM, in characters. */
  maxContentChars: number;
  /** Milliseconds between worker polling cycles. */
  pollIntervalMs: number;
}

export function loadEnvConfig(): IngestionConfig {
  return {
    endpoint: process.env.LLM_ENDPOINT ?? "http://localhost:8085/v1/chat/completions",
    model: process.env.LLM_MODEL ?? "qwen3.6",
    maxContentChars: Number(process.env.MAX_CONTENT_CHARS) || 60_000,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5_000,
  };
}
