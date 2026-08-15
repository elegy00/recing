import { z } from "zod";
import type { RecipeExtraction } from "./recipe-extraction.js";
import { JobStatus } from "./errors.js";

const statusSchema = z.nativeEnum(JobStatus);

/** Postgres row representing a recipe extraction job. */
export interface JobSubmission {
  id?: string;
  url: string;
  status: JobStatus;
  createdAt?: Date;
  updatedAt?: Date;
  result?: RecipeExtraction | null;
  error?: string | null;
}

/** Validates a job submission document. */
export function validateJobSubmission(raw: unknown): JobSubmission {
  const result = z.object({
    id: z.string().optional(),
    url: z.string().url(),
    status: statusSchema,
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    result: z.unknown().nullable().optional(),
    error: z.string().nullish(),
  }).safeParse(raw);

  if (!result.success) {
    throw new Error(`Invalid job submission: ${result.error.message}`);
  }

  const data = result.data;
  return {
    id: data.id,
    url: data.url,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    result: data.result as RecipeExtraction | null | undefined,
    error: data.error,
  };
}
