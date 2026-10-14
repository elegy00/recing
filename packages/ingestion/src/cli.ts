#!/usr/bin/env node
/**
 * CLI entry point: argument parsing, command dispatch, and shutdown wiring only.
 * Pipeline logic lives in workers/, extraction/, and fetch/.
 */

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: new URL("../../../.env", import.meta.url) });

import { loadEnvConfig } from "./config/env-config.js";
import { closeDb, getDb } from "./db/pool.js";
import { createJob, markCompleted } from "./db/job-repository.js";
import { extractRecipe } from "./extraction/url-extractor.js";
import { fetchUrl } from "./fetch/url-fetcher.js";
import { describeError } from "./util/error-utils.js";
import { runPhotoWorker } from "./workers/photo-ingestion-worker.js";
import { runWorker } from "./workers/url-ingestion-worker.js";

// ─── Commands ────────────────────────────────────────────────────────────────

/** Starts both ingestion workers and blocks until SIGINT/SIGTERM. */
async function cmdStart(): Promise<void> {
  const config = loadEnvConfig();
  console.warn("Recing Ingestion Worker — starting\n");

  let shuttingDown = false;
  const urlController = runWorker(config);
  console.warn("Starting URL-based ingestion worker… done.");

  console.warn("\nStarting photo-based ingestion worker...");
  const photoController = runPhotoWorker(config);
  console.warn("Photo-based ingestion worker… started.");

  function shutdown(sig: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.warn(`\nReceived ${sig} — shutting down...`);
    urlController.abort();
    photoController.abort();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

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

/** Single-shot fetch + extraction for testing/debugging. */
async function cmdFetch(url: string): Promise<void> {
  console.warn(`Recing Ingestion — single-shot fetch\n`);
  console.warn(`URL: ${url}`);

  const config = loadEnvConfig();
  const db = getDb();

  // Step 1: Submit job to database
  const jobId = await createJob(db, url);
  console.warn(`Submitted as job ${jobId}\n`);

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
  await markCompleted(db, jobId, JSON.stringify(extraction.extraction));

  await closeDb();
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
        console.error(`\n❌ Failed: ${describeError(error)}`);
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
