/**
 * Photo-based recipe ingestion worker.
 * Processes 1-N photos sequentially through two steps per photo:
 *   Step A: Vision LLM extracts structured RecipeExtraction from each photo
 *   Step B: After all photos extracted, merge all extractions → final RecipeExtraction JSON
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

// ─── Retry settings (matching URL ingestion) ──────────────────────────

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wrap an async function with retry logic. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts?: number, delayMs?: number): Promise<T> {
  const attempts = maxAttempts ?? MAX_ATTEMPTS;
  const delay = delayMs ?? RETRY_DELAY_MS;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        console.warn(`[photo-worker] Attempt ${attempt}/${attempts} failed: ${err}. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// ─── Worker config ─────────────────────────────────────────────────────

export interface PhotoWorkerConfig extends LlamaClientConfig {
  /** Milliseconds between polling cycles (default: 5000) */
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;

// ─── Prompt templates ──────────────────────────────────────────────────

/** System prompt for per-photo extraction — asks for structured JSON matching RecipeExtraction schema. */
const PHOTO_EXTRACT_SYSTEM_PROMPT = [
  "You are a recipe extraction assistant. You receive photos of recipes.",
  "",
  "Rules:",
  '1. Return ONLY one valid JSON object — no markdown, no explanation text, no surrounding code fences.',
  `2. Match the RecipeExtraction schema: fields include status, recipeName, description, prepTime, cookTime, totalTime, servings, cuisine, category, keywords, ingredients[], instructions[], notes[]`,
  '3. Set status to "extracted" if you can identify a complete recipe with at least one ingredient AND one instruction.',
  '4. If the photo shows only partial info (e.g., just ingredients), set status to "unusable" and explain in unusableReason what is missing.',
  '5. Do NOT invent or guess any information. Use null for missing fields, empty arrays when no data exists.',
  "6. For ingredients, extract quantity, unit, name, note, and originalText from the photo.",
  "7. Instructions must be ordered with stepNumber starting at 1.",
  `8. Include all temporal info you can see (prepTime, cookTime, totalTime in ISO 8601 format like PT30M).`,
].join("\n");

/** System prompt for merging multiple structured extractions into one final recipe. */
const MERGE_SYSTEM_PROMPT = [
  "You are a recipe merger assistant. You receive structured RecipeExtraction objects extracted from individual photos of the same recipe.",
  "",
  "Rules:",
  '1. Return ONLY one valid JSON object — no markdown, no explanation text.',
  `2. Merge all information into a single complete RecipeExtraction following this schema: status, recipeName, description, prepTime, cookTime, totalTime, servings, cuisine, category, keywords, ingredients[], instructions[], notes[]`,
  "3. Deduplicate ingredients and instructions across fragments.",
  "4. Preserve the most detailed version of each piece of information.",
  '5. Set status to "extracted" when you have at least one ingredient AND one instruction in the final result.',
  '6. Use null for any fields not provided by ANY fragment.',
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

/** Fetch pending chunks with their associated photo data_uri. */
async function fetchPendingChunksWithPhotos(db: Pool, jobId: string): Promise<Array<{
  id: string;
  order_num: number;
  status: string;
  data_uri: string | null;
}>> {
  const res = await db.query(
    `SELECT c.id, c.order_num, c.status, p.data_uri
     FROM photo_chunks c
     LEFT JOIN photos p ON c.photo_id = p.id
     WHERE c.job_id = $1 AND c.status = 'PENDING'
     ORDER BY c.order_num ASC`,
    [jobId]
  );
  return res.rows as any[];
}

/** Fetch all chunks that have been extracted (success or failure). */
async function fetchExtractedChunks(db: Pool, jobId: string): Promise<Array<{
  id: string;
  order_num: number;
  status: string;
  error: string | null;
}>> {
  const res = await db.query(
    `SELECT id, order_num, status, error FROM photo_chunks WHERE job_id = $1 AND status IN ('EXTRACTED', 'FAILED') ORDER BY order_num ASC`,
    [jobId]
  );
  return res.rows as any[];
}

// ─── Step A: Extract structured RecipeExtraction from a single photo via vision LLM ──

async function extractFromPhoto(
  config: PhotoWorkerConfig,
  dataUri: string,
): Promise<schema.RecipeExtraction> {
  const systemPrompt = PHOTO_EXTRACT_SYSTEM_PROMPT;

  // Build a multimodal request — the data URI is already base64-encoded image
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: "Extract all recipe information visible in this photo. Return structured JSON." },
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
    response_format: { type: "json_object" }, // force JSON output
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

  // Parse and validate as RecipeExtraction
  return parseRecipeExtraction(JSON.parse(content));
}

// ─── Step B: Merge all structured extractions into final RecipeExtraction ──

async function mergeExtractedRecipes(
  config: PhotoWorkerConfig,
  chunksData: Array<{ orderNum: number; extraction: schema.RecipeExtraction | null }>,
): Promise<schema.RecipeExtraction> {
  const systemPrompt = MERGE_SYSTEM_PROMPT;

  // Build the user message with all extracted RecipeExtraction objects
  const parts = [
    "Here are structured RecipeExtraction objects extracted from individual photos. Merge them into one complete recipe.",
    "",
  ];

  for (const { orderNum, extraction } of chunksData) {
    if (!extraction) continue;
    parts.push(`--- Photo ${orderNum + 1} ---`);
    parts.push(JSON.stringify(extraction, null, 2));
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
  return parseRecipeExtraction(JSON.parse(content));
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

      let pendingChunks = await fetchPendingChunksWithPhotos(db, jobId);

      while (pendingChunks.length > 0) {
        // Process ONE chunk at a time
        const chunk = pendingChunks[0];

        try {
          console.warn(`[photo-worker] Extracting photo ${chunk.order_num + 1}/${pendingChunks.length} for job ${jobId}`);

          const dataUri = chunk.data_uri;
          if (!dataUri) {
            throw new Error("No image data found in photos table");
          }

          // Mark as extracting
          await db.query(
            `UPDATE photo_chunks SET status = 'EXTRACTING', updated_at = NOW() WHERE id = $1`, [chunk.id]
          );

          // Extract structured RecipeExtraction via vision LLM (with retry)
          const extraction = await withRetry(() => extractFromPhoto(config, dataUri));

          // Store result and mark as extracted
          const now = new Date().toISOString();
          await db.query(
            `UPDATE photo_chunks SET status = 'EXTRACTED', extracted_json = $2, error = NULL, updated_at = $3 WHERE id = $1`,
            [chunk.id, JSON.stringify(extraction), now]
          );

          // Update job completed count (simpler: just increment)
          await db.query(
            `UPDATE photo_jobs SET completed_chunks = completed_chunks + 1, updated_at = NOW() WHERE id = $2`,
            [jobId]
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
        pendingChunks = await fetchPendingChunksWithPhotos(db, jobId);
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

    // ── Phase 2: Merge all extracted RecipeExtractions → final result ─
    if (currentStatus === "MERGING") {
      const chunksRaw = await fetchExtractedChunks(db, jobId);

      // Re-fetch each chunk's extraction from JSONB
      const chunksWithExtraction: Array<{ orderNum: number; extraction: schema.RecipeExtraction | null }> = [];
      for (const c of chunksRaw) {
        if (c.status === "FAILED") {
          chunksWithExtraction.push({ orderNum: Number(c.order_num), extraction: null });
        } else {
          // Fetch the extracted_json for this chunk
          const jsonRes = await db.query(
            `SELECT extracted_json FROM photo_chunks WHERE id = $1`, [c.id]
          );
          const json = (jsonRes.rows[0]?.extracted_json ?? null) as schema.RecipeExtraction | null;
          chunksWithExtraction.push({ orderNum: Number(c.order_num), extraction: json });
        }
      }

      // Filter to only successful extractions for the merge
      const validChunks = chunksWithExtraction.filter((c) => c.extraction !== null);
      if (validChunks.length === 0) {
        throw new Error("No successful extractions available to merge");
      }

      console.warn(`[photo-worker] Merging ${validChunks.length} extraction(s) for job ${jobId}`);

      // Merge with retry
      const extraction = await withRetry(() => mergeExtractedRecipes(config, validChunks));

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
