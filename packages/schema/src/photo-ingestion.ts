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

// ─── Photo (stored image file) ─────────────────────────────────────────

/** Postgres row representing a single uploaded photo in a photo job. */
export interface PhotoPhoto {
  id?: string;
  jobId: string;
  orderNum: number;
  contentType: string;
  dataUri: string; // base64 image URI (stored for LLM vision input)
  sizeBytes: number;
  createdAt?: Date;
}

export function validatePhotoPhoto(raw: unknown): PhotoPhoto {
  const result = z.object({
    id: z.string().optional(),
    job_id: z.string().uuid("photos.job_id must be a valid UUID"),
    order_num: z.number().int().min(0),
    content_type: z.string().min(1),
    data_uri: z.string().min(1),
    size_bytes: z.number().int().min(0),
    created_at: z.coerce.date().optional(),
  }).safeParse(raw);

  if (!result.success) {
    throw new Error(`Invalid photo: ${result.error.message}`);
  }

  const d = result.data;
  return {
    id: d.id,
    jobId: d.job_id,
    orderNum: d.order_num,
    contentType: d.content_type,
    dataUri: d.data_uri,
    sizeBytes: d.size_bytes,
    createdAt: d.created_at,
  };
}

// ─── PhotoChunk ────────────────────────────────────────────────────────

const photoChunkStatusSchema = z.nativeEnum(PhotoChunkStatus);

/** Postgres row representing a single photo chunk in a photo job. */
export interface PhotoChunk {
  id?: string;
  jobId: string;
  orderNum: number;
  /** FK to the photos table — worker fetches image data_uri from photos via this link. */
  photoId?: string | null;
  status: PhotoChunkStatus;
  /** Structured RecipeExtraction from vision LLM (replaces extracted_markdown). */
  extractedJson?: RecipeExtraction | null;
  error?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function validatePhotoChunk(raw: unknown): PhotoChunk {
  const result = z.object({
    id: z.string().optional(),
    job_id: z.string().uuid("photo_chunks.job_id must be a valid UUID"),
    order_num: z.number().int().min(0),
    photo_id: z.string().uuid().nullish(),
    status: photoChunkStatusSchema,
    extracted_json: z.unknown().nullable().optional(),
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
    photoId: d.photo_id ?? null,
    status: d.status as PhotoChunkStatus,
    extractedJson: d.extracted_json as RecipeExtraction | null | undefined,
    error: d.error ?? null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}
