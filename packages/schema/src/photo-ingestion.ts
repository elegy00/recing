import { z } from "zod";
import type { RecipeExtraction } from "./recipe-extraction.js";

// ─── Status enums ──────────────────────────────────────────────────────

export enum PhotoJobStatus {
  PENDING = "PENDING",
  CHUNKING = "CHUNKING",
  MERGING = "MERGING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum PhotoChunkStatus {
  PENDING = "PENDING",
  EXTRACTING = "EXTRACTING",
  EXTRACTED = "EXTRACTED",
  FAILED = "FAILED",
}

// ─── PhotoJob ──────────────────────────────────────────────────────────

const photoJobStatusSchema = z.nativeEnum(PhotoJobStatus);

/** Postgres row representing a photo-based recipe ingestion job. */
export interface PhotoJob {
  id?: string;
  status: PhotoJobStatus;
  totalPhotos: number;
  completedChunks: number;
  result?: RecipeExtraction | null;
  error?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function validatePhotoJob(raw: unknown): PhotoJob {
  const result = z.object({
    id: z.string().optional(),
    status: photoJobStatusSchema,
    total_photos: z.number().int().min(0).default(0).transform((v) => v),
    completed_chunks: z.number().int().min(0).default(0).transform((v) => v),
    result: z.unknown().nullable().optional(),
    error: z.string().nullish(),
    created_at: z.coerce.date().optional(),
    updated_at: z.coerce.date().optional(),
  }).safeParse(raw);

  if (!result.success) {
    throw new Error(`Invalid photo job: ${result.error.message}`);
  }

  const d = result.data;
  return {
    id: d.id,
    status: d.status as PhotoJobStatus,
    totalPhotos: d.total_photos,
    completedChunks: d.completed_chunks,
    result: d.result as RecipeExtraction | null | undefined,
    error: d.error ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// ─── PhotoChunk ────────────────────────────────────────────────────────

const photoChunkStatusSchema = z.nativeEnum(PhotoChunkStatus);

/** Postgres row representing a single photo chunk in a photo job. */
export interface PhotoChunk {
  id?: string;
  jobId: string;
  orderNum: number;
  status: PhotoChunkStatus;
  dataUri: string;
  extractedMarkdown?: string | null;
  error?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function validatePhotoChunk(raw: unknown): PhotoChunk {
  const result = z.object({
    id: z.string().optional(),
    job_id: z.string().uuid("photo_chunks.job_id must be a valid UUID"),
    order_num: z.number().int().min(0),
    status: photoChunkStatusSchema,
    data_uri: z.string().min(1),
    extracted_markdown: z.string().nullish(),
    error: z.string().nullish(),
    created_at: z.coerce.date().optional(),
    updated_at: z.coerce.date().optional(),
  }).safeParse(raw);

  if (!result.success) {
    throw new Error(`Invalid photo chunk: ${result.error.message}`);
  }

  const d = result.data;
  return {
    id: d.id,
    jobId: d.job_id,
    orderNum: d.order_num,
    status: d.status as PhotoChunkStatus,
    dataUri: d.data_uri,
    extractedMarkdown: d.extracted_markdown ?? null,
    error: d.error ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}
