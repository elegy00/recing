/**
 * Photo-based recipe ingestion worker.
 * Processes 1-N photos sequentially through two steps per photo:
 *   Step A: Vision LLM extracts partial recipe markdown from each photo
 *   Step B: After all photos extracted, merge all markdown → final RecipeExtraction JSON
 *
 * Each step is persisted before moving to the next — failure at any point
 * leaves the job in a recoverable state.
 */

import { getDb } from "./db.js";
import type { Pool } from "pg";
import { sendChatCompletion, buildRequest } from "./llm-client.js";
import type { LlamaClientConfig, ChatCompletionResponse } from "./llm-client.js";
import * as schema from "@recing/schema";
import { parseRecipeExtraction } from "@recing/schema";

// ─── Worker config ─────────────────────────────────────────────────────

export interface PhotoWorkerConfig extends LlamaClientConfig {
  /** Milliseconds between polling cycles (default: 5000) */
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;

// ─── Prompt templates ──────────────────────────────────────────────────

const PHOTO_EXTRACT_SYSTEM_PROMPT = [
  "You are a recipe extraction assistant. You receive photos of recipes.",
  "",
  "Rules:",
  "1. Return ONLY one valid JSON object — no markdown, no explanation text, no surrounding code fences.",
  '2. Set status to "extracted" if you can identify a complete recipe with ingredients and instructions.',
  '3. If the photo shows a partial recipe (e.g., just ingredients or just part of instructions), set status to "partial" and explain in description what is present.',
  '4. Do NOT invent or guess any information. Use null for missing fields, empty arrays when no data exists.',
  '5. For ingredients, extract quantity, unit, name, note, and originalText from the photo.',
  "6. Instructions must be ordered with stepNumber starting at 1.",
  `7. Include all temporal info you can see (prepTime, cookTime, totalTime in ISO 8601 format like PT30M).`,
].join("\n");

const MERGE_SYSTEM_PROMPT = [
  "You are a recipe merger assistant. You receive markdown fragments from multiple photos of the same recipe.",
  "",
  "Rules:",
  '1. Return ONLY one valid JSON object — no markdown, no explanation text.',
  '2. Merge all information into a single complete RecipeExtraction.',
  "3. Deduplicate ingredients and instructions across fragments.",
  "4. Preserve the most detailed version of each piece of information.",
  "5. Set status to 'extracted' when you have at least one ingredient AND one instruction.",
  "6. Use null for any fields not provided by ANY fragment.",
].join("\n");

// ─── DB helpers ────────────────────────────────────────────────────────

interface PendingPhotoJob {
  id: string;
}

async function fetchPendingPhotoJobs(db: Pool): Promise<PendingPhotoJob[]> {
  const res = await db.query<PendingPhotoJob>(
    `SELECT id FROM photo_jobs WHERE status IN ('PENDING', 'CHUNKING') ORDER BY created_at ASC`
  );
  return res.rows;
}

async function fetchPendingChunks(db: Pool, jobId: string): Promise<Array<{
  id: string;
  order_num: number;
  data_uri: string;
}>> {
  const res = await db.query(
    `SELECT id, order_num, data_uri FROM photo_chunks WHERE job_id = $1 AND status = 'PENDING' ORDER BY order_num ASC`,
    [jobId]
  );
  return res.rows as any[];
}

async function fetchExtractedChunks(db: Pool, jobId: string): Promise<Array<{
  id: string;
  order_num: number;
  extracted_markdown: string | null;
  status: string;
  error: string | null;
}>> {
  const res = await db.query(
    `SELECT id, order_num, extracted_markdown, status, error FROM photo_chunks WHERE job_id = $1 AND status IN ('EXTRACTED', 'FAILED') ORDER BY order_num ASC`,
    [jobId]
  );
  return res.rows as any[];
}

// ─── Step A: Extract markdown from a single photo via vision LLM ──────

async function extractFromPhoto(
  config: PhotoWorkerConfig,
  dataUri: string,
): Promise<string> {
  const systemPrompt = PHOTO_EXTRACT_SYSTEM_PROMPT;

  // Build a multimodal request — the data URI is already base64-encoded image
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: "Extract all recipe information visible in this photo." },
        { type: "image_url", image_url: { url: dataUri } },
      ],
    },
  ];

  const requestBody = {
    model: config.model ?? "qwen3.6",
    messages,
    temperature: 0.0,
    top_p: 1.0,
    max_tokens: 24576,
    stream: false,
    chat_template_kwargs: { enable_thinking: false },
  };

  const responseBody = await sendChatCompletion(config, requestBody as any);
  const parsed: ChatCompletionResponse = JSON.parse(responseBody);

  if (!parsed.choices || parsed.choices.length === 0) {
    throw new Error("No choices in LLM response");
  }

  let content = parsed.choices[0].message?.content;
  if (typeof content !== "string") {
    // Handle multimodal response — extract text parts
    const contentArr = Array.isArray(parsed.choices[0].message.content)
      ? parsed.choices[0].message.content as Array<{ type: string; text?: string }>
      : [];
    content = contentArr.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  }

  if (!content || !content.trim()) {
    throw new Error("Empty response from vision LLM");
  }

  // Strip code fences if present
  content = stripCodeFences(content.trim());

  return content;
}

// ─── Step B: Merge all markdown fragments into final RecipeExtraction ──

async function mergeMarkdownToFinal(
  config: PhotoWorkerConfig,
  chunksMarkdown: Array<{ orderNum: number; markdown: string | null }>,
): Promise<schema.RecipeExtraction> {
  const systemPrompt = MERGE_SYSTEM_PROMPT;

  // Build the user message with all extracted fragments
  const parts = [
    "Here are the recipe information fragments extracted from individual photos. Merge them into one complete recipe.",
    "",
  ];

  for (const { orderNum, markdown } of chunksMarkdown) {
    if (!markdown) continue;
    parts.push(`--- Fragment ${orderNum + 1} ---`);
    parts.push(markdown);
    parts.push("");
  }

  const userPrompt = parts.join("\n");

  // Use JSON schema for structured output
  const requestBody = buildRequest(
    config.model ?? "qwen3.6",
    systemPrompt,
    userPrompt,
    schema.recipeExtractionJsonSchema
  );

  const responseBody = await sendChatCompletion(config, requestBody);
  const parsed: ChatCompletionResponse = JSON.parse(responseBody);

  if (!parsed.choices || parsed.choices.length === 0) {
    throw new Error("No choices in merge LLM response");
  }

  let content = parsed.choices[0].message?.content;
  if (typeof content !== "string") {
    const contentArr = Array.isArray(parsed.choices[0].message.content)
      ? parsed.choices[0].message.content as Array<{ type: string; text?: string }>
      : [];
    content = contentArr.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  }

  if (!content || !content.trim()) {
    throw new Error("Empty merge response from LLM");
  }

  content = stripCodeFences(content.trim());

  // Parse and validate as RecipeExtraction
  const extractionNode = JSON.parse(content);
  return parseRecipeExtraction(extractionNode) as schema.RecipeExtraction;
}

// ─── Core worker loop ──────────────────────────────────────────────────

async function processJob(db: Pool, config: PhotoWorkerConfig, jobId: string): Promise<void> {
  console.warn(`[photo-worker] Processing job ${jobId}`);

  // Get job to check current step
  const jobRes = await db.query(
    `SELECT status FROM photo_jobs WHERE id = $1`, [jobId]
  );
  if (jobRes.rows.length === 0) return;

  const currentStatus = (jobRes.rows[0] as any).status;

  try {
    // ── Phase 1: Extract from each photo sequentially ──────────────
    if (currentStatus === "PENDING" || currentStatus === "CHUNKING") {
      await db.query(`UPDATE photo_jobs SET status = 'CHUNKING', updated_at = NOW() WHERE id = $1`, [jobId]);

      let pendingChunks = await fetchPendingChunks(db, jobId);

      while (pendingChunks.length > 0) {
        // Process ONE chunk at a time
        const chunk = pendingChunks[0];

        try {
          console.warn(`[photo-worker] Extracting photo ${chunk.order_num + 1}/${pendingChunks.length} for job ${jobId}`);

          // Mark as extracting
          await db.query(
            `UPDATE photo_chunks SET status = 'EXTRACTING', updated_at = NOW() WHERE id = $1`, [chunk.id]
          );

          // Extract markdown via vision LLM
          const markdown = await extractFromPhoto(config, chunk.data_uri);

          // Store result and mark as extracted
          const now = new Date().toISOString();
          await db.query(
            `UPDATE photo_chunks SET status = 'EXTRACTED', extracted_markdown = $2, error = NULL, updated_at = $3 WHERE id = $1`,
            [chunk.id, markdown, now]
          );

          // Update job completed count
          const res = await db.query(
            `SELECT COUNT(*) as cnt FROM photo_chunks WHERE job_id = $1 AND status = 'EXTRACTED'`, [jobId]
          );
          const completedCount = Number((res.rows[0] as any).cnt);

          await db.query(
            `UPDATE photo_jobs SET completed_chunks = $1, updated_at = NOW() WHERE id = $2`,
            [completedCount, jobId]
          );

        } catch (err) {
          console.warn(`[photo-worker] Failed to extract photo ${chunk.order_num}: ${err}`);
          await db.query(
            `UPDATE photo_chunks SET status = 'FAILED', error = $2, updated_at = NOW() WHERE id = $1`,
            [chunk.id, String(err)]
          );

          // Even if this chunk failed, try the next ones — don't block the whole job
        }

        // Re-fetch pending (the current one is now EXTRACTED or FAILED)
        pendingChunks = await fetchPendingChunks(db, jobId);
      }

      // All chunks processed — move to merging phase
      const extracted = await fetchExtractedChunks(db, jobId);
      const allFailed = extracted.every((c: any) => c.status === "FAILED");
      if (allFailed && extracted.length > 0) {
        throw new Error("All photo extractions failed");
      }

      // Move to merging phase
      await db.query(`UPDATE photo_jobs SET status = 'MERGING', updated_at = NOW() WHERE id = $1`, [jobId]);
    }

    // ── Phase 2: Merge all extracted markdown → final RecipeExtraction ─
    if (currentStatus === "MERGING") {
      const chunksRaw = await fetchExtractedChunks(db, jobId);
      const chunksMarkdown = chunksRaw.map((c: any) => ({
        orderNum: Number(c.order_num), // need to join or store this
        markdown: c.extracted_markdown,
      }));

      console.warn(`[photo-worker] Merging ${chunksMarkdown.length} fragment(s) for job ${jobId}`);

      const extraction = await mergeMarkdownToFinal(config, chunksMarkdown);

      // Save final result and mark as completed
      const now = new Date().toISOString();
      await db.query(
        `UPDATE photo_jobs SET status = 'COMPLETED', result = $2, error = NULL, updated_at = $3 WHERE id = $1`,
        [jobId, JSON.stringify(extraction), now]
      );

      console.warn(`[photo-worker] Job ${jobId} completed — recipe: ${extraction.recipeName}`);
    }

  } catch (err) {
    console.warn(`[photo-worker] Job ${jobId} failed: ${err}`);
    await db.query(
      `UPDATE photo_jobs SET status = 'FAILED', error = $2, updated_at = NOW() WHERE id = $1`,
      [jobId, String(err)]
    );

    // Mark all remaining pending chunks as FAILED too
    await db.query(
      `UPDATE photo_chunks SET status = 'FAILED', error = $2, updated_at = NOW() WHERE job_id = $1 AND status IN ('PENDING', 'EXTRACTING')`,
      [jobId, String(err)]
    );
  }
}

// ─── Public API ────────────────────────────────────────────────────────

/** Start the photo worker polling loop. Returns AbortController for shutdown. */
export function runPhotoWorker(config: PhotoWorkerConfig): AbortController {
  const controller = new AbortController();
  const signal = controller.signal;
  const pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const db = getDb();

  console.warn(`[photo-worker] Starting — polling every ${pollIntervalMs}ms`);
  console.warn(`[photo-worker] LLM endpoint: ${config.endpoint}`);

  async function tick(): Promise<void> {
    while (!signal.aborted) {
      try {
        const pendingJobs = await fetchPendingPhotoJobs(db);

        if (pendingJobs.length === 0) {
          console.warn("[photo-worker] No pending jobs — sleeping");
        } else {
          for (const job of pendingJobs) {
            if (signal.aborted) break;
            await processJob(db, config, job.id);
          }
        }

        if (!signal.aborted) {
          await sleep(pollIntervalMs);
        }
      } catch (err) {
        console.error(`[photo-worker] Poll error: ${err}`);
        if (!signal.aborted) {
          await sleep(pollIntervalMs);
        }
      }
    }

    console.warn("[photo-worker] Stopped");
  }

  tick().catch(() => {});
  return controller;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function stripCodeFences(content: string): string {
  if (!content.startsWith("```")) return content;
  const firstNewline = content.indexOf("\n");
  if (firstNewline > 0 && content.endsWith("```") && content.length - 3 > firstNewline) {
    return content.substring(firstNewline + 1, content.length - 3).trim();
  }
  return content;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
