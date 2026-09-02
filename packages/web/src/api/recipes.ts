/**
 * Server functions for recipe jobs (URL ingestion).
 */

import { createServerFn } from "@tanstack/react-start";
import type { Job, RecipeResult } from "../types";
import { getPool, toIsoString } from "./db";
import { isUuid } from "../utils/uuid";

/** Map DB columns to frontend-compatible field names. */
function mapRow(row: Record<string, unknown>): Job {
	const dbRow = row as {
		id: string;
		url: string;
		status: string;
		created_at: Date | string;
		updated_at: Date | string;
		result?: RecipeResult | null;
		error?: string | null;
	};

	return {
		_id: dbRow.id,
		url: dbRow.url,
		status: dbRow.status as Job["status"],
		createdAt: toIsoString(dbRow.created_at),
		updatedAt: toIsoString(dbRow.updated_at),
		result: (dbRow.result ?? null) as Job["result"],
		error: dbRow.error,
	};
}

// ─── POST /api/recipes — Submit a URL to ingest ────────────────────────────

export const submitRecipe = createServerFn({
	method: "POST",
	strict: false,
}).handler(async (ctx) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- data shape is controlled by caller
	const url = (ctx.data as any)?.url;
	if (!url || typeof url !== "string") {
		throw new Error("URL is required");
	}

	const trimmedUrl = url.trim();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await getPool().query(
		"INSERT INTO jobs (id, url, status, created_at, updated_at) VALUES ($1, $2, 'PENDING', $3, $3)",
		[id, trimmedUrl, now],
	);

	return { jobId: id };
});

// ─── GET /api/recipes — List recipes ──────────────────────────────────────

export const listRecipes = createServerFn({
	method: "GET",
	strict: false,
}).handler(async (ctx) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- data shape is controlled by caller
	const data = ctx.data as any;
	const pool = getPool();
	const status = data?.status;

	if (status === "all") {
		// All jobs regardless of status (used by the ingest overview)
		const res = await pool.query("SELECT * FROM jobs ORDER BY created_at DESC");
		return { recipes: res.rows.map(mapRow) };
	}

	if (status) {
		const res = await pool.query(
			"SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC",
			[status],
		);
		return { recipes: res.rows.map(mapRow) };
	}

	// Default: only valid completed recipes
	const res = await pool.query(`
      SELECT * FROM jobs
      WHERE status = 'COMPLETED'
        AND result IS NOT NULL
        AND (result->>'status')::text = 'extracted'
        AND (result->>'recipeName')::text IS NOT NULL
        AND jsonb_array_length((result->'ingredients')::jsonb) > 0
        AND jsonb_array_length((result->'instructions')::jsonb) > 0
      ORDER BY created_at DESC
    `);

	return { recipes: res.rows.map(mapRow) };
});

// ─── GET /api/recipes/:id — Fetch a single recipe ──────────────────────────

export const getRecipe = createServerFn({
	method: "GET",
	strict: false,
}).handler(async (ctx) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- data shape is controlled by caller
	const data = ctx.data as any;
	const id = data?.id;

	if (!isUuid(id)) {
		return { recipe: null, error: "Recipe not found" };
	}

	const res = await getPool().query("SELECT * FROM jobs WHERE id = $1", [id]);

	if (res.rows.length === 0) {
		return { recipe: null, error: "Recipe not found" };
	}

	const job = mapRow(res.rows[0]);
	if (!job.result) {
		return { recipe: null, error: "Recipe not found" };
	}

	const r = job.result as RecipeResult;
	if (
		r.status !== "extracted" ||
		!r.recipeName ||
		!Array.isArray(r.ingredients) ||
		r.ingredients.length === 0 ||
		!Array.isArray(r.instructions) ||
		r.instructions.length === 0
	) {
		return { recipe: null, error: "Recipe not found" };
	}

	return { recipe: job, error: null };
});

// ─── POST /api/recipes/:id/delete — Delete a job ──────────────────────────

export const deleteRecipe = createServerFn({
	method: "POST",
	strict: false,
}).handler(async (ctx) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- data shape is controlled by caller
	const data = ctx.data as any;
	const id = data?.id;

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

export const retryRecipe = createServerFn({
	method: "POST",
	strict: false,
}).handler(async (ctx) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- data shape is controlled by caller
	const data = ctx.data as any;
	const id = data?.id;

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
