import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PhotoChunkStatus, PhotoJobStatus } from "@recing/schema";
import {
  completeJob,
  failJob,
  fetchPendingChunks,
  fetchPendingPhotoJobs,
  fetchSettledChunks,
  getJobStatus,
  incrementCompletedChunks,
  markChunkExtracted,
  markChunkExtracting,
  markChunkFailed,
  setJobStatus,
} from "./photo-job-repository.js";

function makeDb(rows: unknown[] = [], rowCount = 0): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount }),
  } as unknown as Pool;
}

const queryCalls = (db: Pool) => (db.query as ReturnType<typeof vi.fn>).mock.calls;

describe("photo job lifecycle", () => {
  it("fetchPendingPhotoJobs selects PENDING/CHUNKING/MERGING jobs, oldest first", async () => {
    const db = makeDb([{ id: "job-1" }], 1);
    const result = await fetchPendingPhotoJobs(db);

    expect(result).toEqual([{ id: "job-1" }]);
    const [sql] = queryCalls(db)[0];
    expect(sql).toContain("SELECT id FROM photo_jobs");
    expect(sql).toContain("'PENDING', 'CHUNKING', 'MERGING'");
    expect(sql).toContain("ORDER BY created_at ASC");
  });

  it("getJobStatus returns the status or null for unknown jobs", async () => {
    const db = makeDb([{ status: "MERGING" }], 1);
    expect(await getJobStatus(db, "job-1")).toBe(PhotoJobStatus.MERGING);

    const emptyDb = makeDb([], 0);
    expect(await getJobStatus(emptyDb, "missing")).toBeNull();
    expect(queryCalls(emptyDb)[0][1]).toEqual(["missing"]);
  });

  it("setJobStatus updates the job by id", async () => {
    const db = makeDb([], 1);
    await setJobStatus(db, "job-1", PhotoJobStatus.CHUNKING);
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("UPDATE photo_jobs SET status = $2");
    expect(sql).toContain("WHERE id = $1::uuid");
    expect(params).toEqual(["job-1", PhotoJobStatus.CHUNKING]);
  });

  it("failJob marks the job failed and fails chunks still in flight", async () => {
    const db = makeDb([], 1);
    await failJob(db, "job-1", "boom");

    const calls = queryCalls(db);
    expect(calls).toHaveLength(2);
    // Job row
    expect(calls[0][0]).toContain("UPDATE photo_jobs SET status = 'FAILED', error = $2");
    expect(calls[0][1]).toEqual(["job-1", "boom"]);
    // In-flight chunks (PENDING + EXTRACTING)
    expect(calls[1][0]).toContain("UPDATE photo_chunks SET status = 'FAILED'");
    expect(calls[1][0]).toContain("'PENDING', 'EXTRACTING'");
    expect(calls[1][1]).toEqual(["job-1", "boom"]);
  });

  it("completeJob stores the final extraction as jsonb and clears the error", async () => {
    const db = makeDb([], 1);
    await completeJob(db, "job-1", '{"ok":true}');
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("UPDATE photo_jobs SET status = 'COMPLETED', result = $2::jsonb, error = NULL");
    expect(params).toEqual(["job-1", '{"ok":true}']);
  });

  it("incrementCompletedChunks adds one to the completed counter", async () => {
    const db = makeDb([], 1);
    await incrementCompletedChunks(db, "job-1");
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("SET completed_chunks = completed_chunks + 1");
    expect(params).toEqual(["job-1"]);
  });
});

describe("chunk operations", () => {
  it("fetchPendingChunks joins photos for the data URI and maps snake_case rows", async () => {
    const db = makeDb([{ id: "c1", order_num: 3, data_uri: null }], 1);
    const chunks = await fetchPendingChunks(db, "job-1");

    expect(chunks).toEqual([{ id: "c1", orderNum: 3, dataUri: null }]);
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("LEFT JOIN photos p ON c.photo_id = p.id");
    expect(sql).toContain("WHERE c.job_id = $1 AND c.status = 'PENDING'");
    expect(sql).toContain("ORDER BY c.order_num ASC");
    expect(params).toEqual(["job-1"]);
  });

  it("fetchSettledChunks selects EXTRACTED/FAILED chunks in one query and maps rows", async () => {
    const db = makeDb([{ id: "c1", order_num: 0, status: "EXTRACTED", extracted_json: { a: 1 }, error: null }], 1);
    const chunks = await fetchSettledChunks(db, "job-1");

    expect(chunks).toEqual([
      { id: "c1", orderNum: 0, status: PhotoChunkStatus.EXTRACTED, extractedJson: { a: 1 }, error: null },
    ]);
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("WHERE job_id = $1 AND status IN ('EXTRACTED', 'FAILED')");
    expect(params).toEqual(["job-1"]);
  });

  it("markChunkExtracting transitions the chunk to EXTRACTING", async () => {
    const db = makeDb([], 1);
    await markChunkExtracting(db, "chunk-1");
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("UPDATE photo_chunks SET status = 'EXTRACTING'");
    expect(params).toEqual(["chunk-1"]);
  });

  it("markChunkExtracted stores the extraction as jsonb and clears any error", async () => {
    const db = makeDb([], 1);
    await markChunkExtracted(db, "chunk-1", '{"a":1}');
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("UPDATE photo_chunks SET status = 'EXTRACTED', extracted_json = $2::jsonb, error = NULL");
    expect(params).toEqual(["chunk-1", '{"a":1}']);
  });

  it("markChunkFailed stores the failure reason", async () => {
    const db = makeDb([], 1);
    await markChunkFailed(db, "chunk-1", "no image data");
    const [sql, params] = queryCalls(db)[0];
    expect(sql).toContain("UPDATE photo_chunks SET status = 'FAILED', error = $2");
    expect(params).toEqual(["chunk-1", "no image data"]);
  });
});
