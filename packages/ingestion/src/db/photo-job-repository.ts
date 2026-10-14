/**
 * Data access for the photo ingestion tables (photo_jobs, photo_chunks, photos).
 * All SQL for photo jobs lives here — workers never write queries directly.
 */

import type { Pool } from "pg";
import { PhotoChunkStatus, PhotoJobStatus, type RecipeExtraction } from "@recing/schema";

/** A pending photo chunk with its photo data. */
export interface PendingPhotoChunk {
  id: string;
  orderNum: number;
  /** Base64 data URI of the photo (null if the photos row is missing). */
  dataUri: string | null;
}

/** A settled (EXTRACTED or FAILED) photo chunk. */
export interface SettledPhotoChunk {
  id: string;
  orderNum: number;
  status: PhotoChunkStatus;
  /** Structured extraction result (EXTRACTED chunks only). */
  extractedJson: RecipeExtraction | null;
  error: string | null;
}

/** Photo jobs that still need work, oldest first. */
export async function fetchPendingPhotoJobs(db: Pool): Promise<Array<{ id: string }>> {
  const res = await db.query<{ id: string }>(
    `SELECT id FROM photo_jobs
     WHERE status IN ('PENDING', 'CHUNKING', 'MERGING')
     ORDER BY created_at ASC`
  );
  return res.rows;
}

/** Current status of a job, or null if the job does not exist. */
export async function getJobStatus(db: Pool, jobId: string): Promise<PhotoJobStatus | null> {
  const res = await db.query<{ status: PhotoJobStatus }>(
    "SELECT status FROM photo_jobs WHERE id = $1",
    [jobId]
  );
  return res.rows[0]?.status ?? null;
}

/** Sets the job status. */
export async function setJobStatus(db: Pool, jobId: string, status: PhotoJobStatus): Promise<void> {
  await db.query(
    "UPDATE photo_jobs SET status = $2, updated_at = NOW() WHERE id = $1::uuid",
    [jobId, status]
  );
}

/** Increments the job's completed-chunks counter. */
export async function incrementCompletedChunks(db: Pool, jobId: string): Promise<void> {
  await db.query(
    "UPDATE photo_jobs SET completed_chunks = completed_chunks + 1, updated_at = NOW() WHERE id = $1::uuid",
    [jobId]
  );
}

/** Stores the final merged result and marks the job COMPLETED. */
export async function completeJob(db: Pool, jobId: string, resultJson: string): Promise<void> {
  await db.query(
    "UPDATE photo_jobs SET status = 'COMPLETED', result = $2::jsonb, error = NULL, updated_at = NOW() WHERE id = $1::uuid",
    [jobId, resultJson]
  );
}

/** Marks the job FAILED and fails any chunks still in flight. */
export async function failJob(db: Pool, jobId: string, errorMessage: string): Promise<void> {
  await db.query(
    "UPDATE photo_jobs SET status = 'FAILED', error = $2, updated_at = NOW() WHERE id = $1::uuid",
    [jobId, errorMessage]
  );
  await db.query(
    `UPDATE photo_chunks SET status = 'FAILED', error = $2, updated_at = NOW()
     WHERE job_id = $1::uuid AND status IN ('PENDING', 'EXTRACTING')`,
    [jobId, errorMessage]
  );
}

/** PENDING chunks of a job with their photo data, in order. */
export async function fetchPendingChunks(db: Pool, jobId: string): Promise<PendingPhotoChunk[]> {
  const res = await db.query(
    `SELECT c.id, c.order_num, p.data_uri
     FROM photo_chunks c
     LEFT JOIN photos p ON c.photo_id = p.id
     WHERE c.job_id = $1 AND c.status = 'PENDING'
     ORDER BY c.order_num ASC`,
    [jobId]
  );
  return res.rows.map((row) => ({
    id: row.id as string,
    orderNum: Number(row.order_num),
    dataUri: (row.data_uri as string | null) ?? null,
  }));
}

/** All settled (EXTRACTED or FAILED) chunks of a job, in order. */
export async function fetchSettledChunks(db: Pool, jobId: string): Promise<SettledPhotoChunk[]> {
  const res = await db.query(
    `SELECT id, order_num, status, error, extracted_json
     FROM photo_chunks
     WHERE job_id = $1 AND status IN ('EXTRACTED', 'FAILED')
     ORDER BY order_num ASC`,
    [jobId]
  );
  return res.rows.map((row) => ({
    id: row.id as string,
    orderNum: Number(row.order_num),
    status: row.status as PhotoChunkStatus,
    extractedJson: (row.extracted_json as RecipeExtraction | null) ?? null,
    error: (row.error as string | null) ?? null,
  }));
}

/** Marks a chunk as being extracted. */
export async function markChunkExtracting(db: Pool, chunkId: string): Promise<void> {
  await db.query(
    "UPDATE photo_chunks SET status = 'EXTRACTING', updated_at = NOW() WHERE id = $1::uuid",
    [chunkId]
  );
}

/** Stores the extraction result and marks a chunk EXTRACTED. */
export async function markChunkExtracted(db: Pool, chunkId: string, extractionJson: string): Promise<void> {
  await db.query(
    "UPDATE photo_chunks SET status = 'EXTRACTED', extracted_json = $2::jsonb, error = NULL, updated_at = NOW() WHERE id = $1::uuid",
    [chunkId, extractionJson]
  );
}

/** Marks a chunk FAILED with a human-readable error message. */
export async function markChunkFailed(db: Pool, chunkId: string, errorMessage: string): Promise<void> {
  await db.query(
    "UPDATE photo_chunks SET status = 'FAILED', error = $2, updated_at = NOW() WHERE id = $1::uuid",
    [chunkId, errorMessage]
  );
}
