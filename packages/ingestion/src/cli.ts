#!/usr/bin/env node

import { runWorker } from "./worker.js";
import { fetchUrl } from "./url-fetcher.js";
import { extractRecipe, type ExtractionConfig, LlmExtractionError } from "./llm-extraction.js";
import { submitJob, postResult, reportFailure } from "./api-client.js";

// ─── Configuration (env vars) ────────────────────────────────────────────────

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Required environment variable ${name} is not set`);
  return value;
}

interface CliConfig {
  webApiUrl: string;
  apiKey: string;
  llmEndpoint: string;
  llmModel: string;
  maxContentChars: number;
  pollIntervalMs: number;
}

function loadConfig(): CliConfig {
  return {
    webApiUrl: process.env.WEB_API_URL ?? "http://localhost:3000",
    apiKey: getEnv("API_KEY"),
    llmEndpoint: process.env.LLM_ENDPOINT ?? "http://localhost:8085/v1/chat/completions",
    llmModel: process.env.LLM_MODEL ?? "qwen3.6",
    maxContentChars: Number(process.env.MAX_CONTENT_CHARS) || 60_000,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5_000,
  };
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdStart(_config: CliConfig): Promise<void> {
  const config = loadConfig();
  console.warn("Recing Ingestion Worker — starting\n");

  // Handle graceful shutdown on SIGINT/SIGTERM
  let abortController: AbortController | null = null;
  let shuttingDown = false;

  function shutdown(sig: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.warn(`\nReceived ${sig} — shutting down...`);
    abortController?.abort();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  abortController = runWorker({
    baseUrl: config.webApiUrl,
    apiKey: config.apiKey,
    endpoint: config.llmEndpoint,
    model: config.llmModel,
    maxContentChars: config.maxContentChars,
    pollIntervalMs: config.pollIntervalMs,
  });

  // Keep alive until shutdown
  await new Promise<void>((resolve) => {
    const check = () => {
      if (shuttingDown) resolve();
      else setTimeout(check, 200);
    };
    check();
  });

  process.exit(0);
}

async function cmdFetch(config: CliConfig, url: string): Promise<void> {
  console.warn(`Recing Ingestion — single-shot fetch\n`);
  console.warn(`URL: ${url}`);

  // Step 1: Submit job to web API
  const jobId = await submitJob({ baseUrl: config.webApiUrl, apiKey: config.apiKey }, url);
  console.warn(`Submitted as job ${jobId}\n`);

  // Step 2: Fetch content
  console.warn("Fetching URL...");
  const fetchResult = await fetchUrl(url);
  if (!fetchResult.ok) {
    throw new Error(`Fetch failed: ${fetchResult.error}`);
  }
  console.warn(`Fetched ${fetchResult.finalUrl} (${fetchResult.contentType}, ${fetchResult.body.length} chars)`);

  // Step 3: Extract recipe
  console.warn("Sending to LLM...");
  const extraction = await extractRecipe(config, {
    url: fetchResult.finalUrl,
    contentType: fetchResult.contentType,
    title: fetchResult.title ?? null,
    body: fetchResult.body,
  });

  // Step 4: Post result
  console.warn("Posting result...");
  await postResult({ baseUrl: config.webApiUrl, apiKey: config.apiKey }, jobId, extraction.extraction, {
    model: config.llmModel,
    endpoint: config.llmEndpoint,
    tokensIn: extraction.metadata.promptTokens,
    tokensOut: extraction.metadata.completionTokens,
  });

  console.warn(`\n✅ Done — job ${jobId} completed`);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error("Usage: recing-ingest <start|fetch [url]>");
    console.error("");
    console.error("Commands:");
    console.error("  start          Start the worker loop (polls for pending jobs)");
    console.error("  fetch <url>    Single-shot extraction (for testing/debugging)");
    console.error("");
    console.error("Environment variables:");
    console.error("  WEB_API_URL      Web API base URL (default: http://localhost:3000)");
    console.error("  API_KEY          Bearer token for authentication (required)");
    console.error("  LLM_ENDPOINT     llama.cpp endpoint (default: http://localhost:8085/v1/chat/completions)");
    console.error("  LLM_MODEL        Model name (default: qwen3.6)");
    console.error("  MAX_CONTENT_CHARS Max page content size (default: 60000)");
    console.error("  POLL_INTERVAL_MS Seconds between polls (default: 5000)");
    process.exit(1);
  }

  const config = loadConfig();

  switch (command) {
    case "start":
      await cmdStart(config);
      break;
    case "fetch":
      if (args.length < 2) {
        console.error("Usage: recing-ingest fetch <url>");
        process.exit(1);
      }
      try {
        await cmdFetch(config, args[1]);
      } catch (error) {
        console.error(`\n❌ Failed: ${error}`);

        // Report failure to web API if we have a jobId context
        const jobIdMatch = String(error).match(/job ([a-f0-9-]+)/i);
        if (jobIdMatch && command === "fetch") {
          try {
            await reportFailure({ baseUrl: config.webApiUrl, apiKey: config.apiKey }, jobIdMatch[1], "LLM_FAILED", String(error));
            console.error("(Reported failure to web API)");
          } catch {
            // Best effort — don't fail on report error
          }
        }

        process.exit(1);
      }
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(2);
});
