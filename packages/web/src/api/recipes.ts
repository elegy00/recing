/**
 * Server functions for recipe jobs (URL ingestion).
 */

import { createServerFn } from "@tanstack/react-start";
import type { Job, RecipeResult } from "../types";
import { isUuid } from "../utils/uuid";
import { getPool, toIsoString } from "./db";
import { requireId } from "./validators";

/** Shared shape of a recipe job row from either jobs or photo_jobs. */
interface RecipeJobRow {
	id: string;
	status: string;
	created_at: Date | string;
	updated_at: Date | string;
	result?: RecipeResult | null;
	error?: string | null;
}

/** Map a jobs-table row to the frontend Job shape. */
function mapRow(row: RecipeJobRow & { url: string }): Job {
	return {
		_id: row.id,
		url: row.url,
		status: row.status as Job["status"],
		createdAt: toIsoString(row.created_at),
		updatedAt: toIsoString(row.updated_at),
		result: (row.result ?? null) as Job["result"],
		error: row.error,
		source: "url",
	};
}

// NOTE: must stay private — exported non-server-fn code in this module is kept
// in the client bundle and would drag pg (via ./db) into the browser.
/** Map a photo_jobs row to the frontend Job shape (photo imports have no URL). */
function mapPhotoRowToJob(row: RecipeJobRow): Job {
	return {
		_id: row.id,
		url: null,
		status: row.status as Job["status"],
		createdAt: toIsoString(row.created_at),
		updatedAt: toIsoString(row.updated_at),
		result: (row.result ?? null) as Job["result"],
		error: row.error,
		source: "photo",
	};
}

/** SQL predicate for jobs holding a valid, extracted recipe (works on both job tables). */
const VALID_RECIPE_SQL = `
    status = 'COMPLETED'
    AND result IS NOT NULL
    AND (result->>'status')::text = 'extracted'
    AND (result->>'recipeName')::text IS NOT NULL
    AND jsonb_array_length((result->'ingredients')::jsonb) > 0
    AND jsonb_array_length((result->'instructions')::jsonb) > 0`;

/** True when the job holds a valid, extracted recipe. */
function isValidRecipe(job: Job): boolean {
	const r = job.result;
	if (!r) return false;
	return (
		r.status === "extracted" &&
		Boolean(r.recipeName) &&
		Array.isArray(r.ingredients) &&
		r.ingredients.length > 0 &&
		Array.isArray(r.instructions) &&
		r.instructions.length > 0
	);
}

// ─── POST /api/recipes — Submit a URL to ingest ────────────────────────────

export const submitRecipe = createServerFn({ method: "POST" })
	.validator((data: { url?: unknown }) => {
		if (typeof data?.url !== "string" || !data.url.trim()) {
			throw new Error("URL is required");
		}
		return { url: data.url };
	})
	.handler(async (ctx) => {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await getPool().query(
			"INSERT INTO jobs (id, url, status, created_at, updated_at) VALUES ($1, $2, 'PENDING', $3, $3)",
			[id, ctx.data.url.trim(), now],
		);

		return { jobId: id };
	});

// ─── GET /api/recipes — List recipes ──────────────────────────────────────

export const listRecipes = createServerFn({ method: "GET" })
	.validator((data?: { status?: unknown }) => ({
		status: typeof data?.status === "string" ? data.status : undefined,
	}))
	.handler(async (ctx) => {
		const pool = getPool();
		const status = ctx.data.status;

		if (status === "all") {
			// All jobs regardless of status (used by the ingest overview)
			const res = await pool.query(
				"SELECT * FROM jobs ORDER BY created_at DESC",
			);
			return { recipes: res.rows.map(mapRow) };
		}

		if (status) {
			const res = await pool.query(
				"SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC",
				[status],
			);
			return { recipes: res.rows.map(mapRow) };
		}

		// Default: only valid completed recipes — from both URL and photo imports
		const res = await pool.query(`
      SELECT 'url' AS source, id, status, result, error, created_at, updated_at
      FROM jobs
      WHERE ${VALID_RECIPE_SQL}
      UNION ALL
      SELECT 'photo' AS source, id, status, result, error, created_at, updated_at
      FROM photo_jobs
      WHERE ${VALID_RECIPE_SQL}
      ORDER BY created_at DESC
    `);

		return {
			recipes: res.rows.map((row) =>
				(row as { source: string }).source === "photo"
					? mapPhotoRowToJob(row)
					: mapRow(row),
			),
		};
	});

// ─── GET /api/recipes/:id — Fetch a single recipe ──────────────────────────

export const getRecipe = createServerFn({ method: "GET" })
	.validator(requireId)
	.handler(async (ctx) => {
		const { id } = ctx.data;

		if (!isUuid(id)) {
			return { recipe: null, error: "Recipe not found" };
		}

		// URL imports first…
		const res = await getPool().query("SELECT * FROM jobs WHERE id = $1", [id]);
		if (res.rows.length > 0) {
			const job = mapRow(res.rows[0]);
			return isValidRecipe(job)
				? { recipe: job, error: null }
				: { recipe: null, error: "Recipe not found" };
		}

		// …then photo imports.
		const photoRes = await getPool().query("SELECT * FROM photo_jobs WHERE id = $1", [id]);
		if (photoRes.rows.length > 0) {
			const job = mapPhotoRowToJob(photoRes.rows[0]);
			return isValidRecipe(job)
				? { recipe: job, error: null }
				: { recipe: null, error: "Recipe not found" };
		}

		return { recipe: null, error: "Recipe not found" };
	});

// ─── POST /api/recipes/:id/delete — Delete a job ──────────────────────────

export const deleteRecipe = createServerFn({ method: "POST" })
	.validator(requireId)
	.handler(async (ctx) => {
		const { id } = ctx.data;

		if (!isUuid(id)) {
			return { error: "Job not found" };
		}

		const res = await getPool().query("DELETE FROM jobs WHERE id = $1", [id]);

		if (res.rowCount === 0) {
			return { error: "Job not found" };
		}
		return { ok: true, error: null };
	});

// ─── POST /api/recipes/:id/retry — Reset FAILED job to PENDING ─────────────

export const retryRecipe = createServerFn({ method: "POST" })
	.validator(requireId)
	.handler(async (ctx) => {
		const { id } = ctx.data;

		if (!isUuid(id)) {
			return { error: "Job not found" };
		}

		const now = new Date().toISOString();
		await getPool().query(
			"UPDATE jobs SET status = 'PENDING', result = NULL, error = NULL, updated_at = $1 WHERE id = $2",
			[now, id],
		);

		return { ok: true, error: null };
	});
