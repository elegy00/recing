#!/usr/bin/env node

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: new URL("../../../.env", import.meta.url) });

import { runWorker } from "./worker.js";
import { closeDb } from "./db.js";
import { fetchUrl } from "./url-fetcher.js";
import { extractRecipe } from "./llm-extraction.js";

// ─── Configuration (env vars) ────────────────────────────────────────────────

interface CliConfig {
  endpoint: string;
  model: string;
  maxContentChars: number;
  pollIntervalMs: number;
}

function loadConfig(): CliConfig {
  return {
    endpoint: process.env.LLM_ENDPOINT ?? "http://localhost:8085/v1/chat/completions",
    model: process.env.LLM_MODEL ?? "qwen3.6",
    maxContentChars: Number(process.env.MAX_CONTENT_CHARS) || 60_000,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 5_000,
  };
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdStart(): Promise<void> {
  const config = loadConfig();
  console.warn("Recing Ingestion Worker — starting\n");

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

  abortController = runWorker(config);

  // Keep alive until shutdown
  await new Promise<void>((resolve) => {
    const check = () => {
      if (shuttingDown) resolve();
      else setTimeout(check, 200);
    };
    check();
  });

  await closeDb();
  process.exit(0);
}

async function cmdFetch(url: string): Promise<void> {
  console.warn(`Recing Ingestion — single-shot fetch\n`);
  console.warn(`URL: ${url}`);

  const config = loadConfig();

  // Step 1: Submit job to database
  const { getDb } = await import("./db.js");
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.query(
    "INSERT INTO jobs (id, url, status, created_at, updated_at, result, error) VALUES ($1, $2, 'PENDING', $3, $3, NULL, NULL)",
    [id, url, now]
  );
  console.warn(`Submitted as job ${id}\n`);

  // Step 2: Fetch content
  console.warn("Fetching URL...");
  const fetchResult = await fetchUrl(url);
  console.warn(`Fetched ${fetchResult.finalUrl} (${fetchResult.contentType}, ${fetchResult.body.length} chars)`);

  // Step 3: Extract recipe via LLM
  console.warn("Sending to LLM...");
  const extraction = await extractRecipe(config, {
    url: fetchResult.finalUrl,
    contentType: fetchResult.contentType,
    title: fetchResult.title ?? null,
    body: fetchResult.body,
  });

  // Step 4: Save result
  await db.query(
    "UPDATE jobs SET status = 'COMPLETED', result = $2, updated_at = $3 WHERE id = $1",
    [id, JSON.stringify(extraction.extraction), new Date().toISOString()]
  );

  await closeDb();
  console.warn(`\n✅ Done — job ${id} completed`);
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
    console.error("  POSTGRES_URL   Database connection string (default: local recing DB)");
    console.error("  LLM_ENDPOINT   llama.cpp endpoint (default: http://localhost:8085/v1/chat/completions)");
    console.error("  LLM_MODEL      Model name (default: qwen3.6)");
    console.error("  MAX_CONTENT_CHARS Max page content size (default: 60000)");
    console.error("  POLL_INTERVAL_MS Seconds between polls (default: 5000)");
    process.exit(1);
  }

  switch (command) {
    case "start":
      await cmdStart();
      break;
    case "fetch":
      if (args.length < 2) {
        console.error("Usage: recing-ingest fetch <url>");
        process.exit(1);
      }
      try {
        await cmdFetch(args[1]);
      } catch (error) {
        console.error(`\n❌ Failed: ${error}`);
        await closeDb();
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
