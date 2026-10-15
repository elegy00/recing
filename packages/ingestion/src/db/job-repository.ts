/**
 * Data access for the `jobs` table (URL ingestion).
 * All SQL for URL jobs lives here — workers and CLI never write queries directly.
 */

import type { Pool } from "pg";

/** A pending job from the database. */
export interface PendingJob {
  id: string;
  url: string;
}

/** Creates a new PENDING job and returns its id. */
export async function createJob(db: Pool, url: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.query(
    "INSERT INTO jobs (id, url, status, created_at, updated_at, result, error) VALUES ($1, $2, 'PENDING', NOW(), NOW(), NULL, NULL)",
    [id, url]
  );
  return id;
}

/** All pending jobs, oldest first. */
export async function fetchPendingJobs(db: Pool): Promise<PendingJob[]> {
  const res = await db.query<PendingJob>(
    "SELECT id, url FROM jobs WHERE status = 'PENDING' ORDER BY created_at ASC"
  );
  return res.rows;
}

/** Atomically claims a pending job (no-op if it is no longer PENDING). */
export async function markProcessing(db: Pool, jobId: string): Promise<void> {
  await db.query(
    "UPDATE jobs SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1 AND status = 'PENDING'",
    [jobId]
  );
}

/** Stores the extraction result and marks the job COMPLETED. */
export async function markCompleted(db: Pool, jobId: string, resultJson: string): Promise<void> {
  await db.query(
    "UPDATE jobs SET status = 'COMPLETED', result = $2, error = NULL, updated_at = NOW() WHERE id = $1",
    [jobId, resultJson]
  );
}

/** Marks the job FAILED with a human-readable error message. */
export async function markFailed(db: Pool, jobId: string, errorMessage: string): Promise<void> {
  await db.query(
    "UPDATE jobs SET status = 'FAILED', result = NULL, error = $2, updated_at = NOW() WHERE id = $1",
    [jobId, errorMessage]
  );
}
