/**
 * Server functions — TanStack Start equivalent of the old Hono API routes.
 * These run server-side and are called from client components.
 */

import { createServerFn } from "@tanstack/react-start";
import { Pool } from "pg";
import type { Job, RecipeResult } from "../types";

// ─── Database connection (single shared pool) ──────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
	if (!_pool) {
		const url =
			process.env.POSTGRES_URL ??
			"postgresql://recing:recing@localhost:5432/recing";
		_pool = new Pool({ connectionString: url });
	}
	return _pool;
}

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
		createdAt:
			dbRow.created_at instanceof Date
				? dbRow.created_at.toISOString()
				: String(dbRow.created_at),
		updatedAt:
			dbRow.updated_at instanceof Date
				? dbRow.updated_at.toISOString()
				: String(dbRow.updated_at),
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

	if (!id) {
		return { recipe: null, error: "Recipe not found" };
	}

	// Validate UUID format
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
	) {
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

	if (!id) {
		return { error: "Job not found" };
	}

	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
	) {
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

	if (!id) {
		return { error: "Job not found" };
	}

	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
	) {
		return { error: "Job not found" };
	}

	const now = new Date().toISOString();
	await getPool().query(
		"UPDATE jobs SET status = 'PENDING', result = NULL, error = NULL, updated_at = $1 WHERE id = $2",
		[now, id],
	);

	return { ok: true, error: null };
});

// ─── Photo ingestion server functions ──────────────────────────────────────

/** Map photo job DB row to frontend type. */
function mapPhotoJobRow(row: Record<string, unknown>): {
	_id: string;
	status: string;
	totalPhotos: number;
	completedChunks: number;
	error?: string | null;
	result?: any;
	createdAt: string;
} {
	const r = row as {
		id: string;
		status: string;
		total_photos: number;
		completed_chunks: number;
		error?: string | null;
		result?: any;
		created_at: Date | string;
	};
	return {
		_id: r.id,
		status: r.status,
		totalPhotos: r.total_photos ?? 0,
		completedChunks: r.completed_chunks ?? 0,
		error: r.error,
		result: r.result,
		createdAt:
			r.created_at instanceof Date
				? r.created_at.toISOString()
				: String(r.created_at),
	};
}

/** Map photo chunk DB row to frontend type. */
function mapPhotoChunkRow(row: Record<string, unknown>): {
	_id: string;
	jobId: string;
	orderNum: number;
	status: string;
	dataUri?: string | null;
	extractedJson?: any;
	error?: string | null;
} {
	const r = row as {
		id: string;
		job_id: string;
		order_num: number;
		photo_id?: string | null;
		status: string;
		data_uri?: string; // joined from photos table
		extracted_json?: any;
		error?: string | null;
	};
	return {
		_id: r.id,
		jobId: r.job_id,
		orderNum: r.order_num,
		status: r.status,
		dataUri: r.data_uri ?? null, // from photos JOIN
		extractedJson: r.extracted_json,
		error: r.error,
	};
}

// ─── POST /api/photo-jobs — Submit photos for ingestion ──────────────────

export const submitPhotoJob = createServerFn({
	method: "POST",
	strict: false,
}).handler(async (ctx) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- data shape is controlled by caller
	const data = ctx.data as any;
	const photos: Array<{ dataUri: string }> | undefined = data?.photos;

	if (!photos || !Array.isArray(photos) || photos.length === 0) {
		throw new Error("At least one photo is required");
	}

	// Validate each photo URI (must be base64-encoded image)
	for (let i = 0; i < photos.length; i++) {
		if (!photos[i]?.dataUri || !photos[i].dataUri.startsWith("data:image/")) {
			throw new Error(`Photo ${i + 1} is not a valid base64-encoded image`);
		}
	}

	const pool = getPool();
	const jobId = crypto.randomUUID();
	const now = new Date().toISOString();

	// Insert job
	await pool.query(
		"INSERT INTO photo_jobs (id, status, total_photos, completed_chunks, created_at, updated_at) VALUES ($1, 'PENDING', $2, 0, $3, $3)",
		[jobId, photos.length, now],
	);

	// Insert each photo into the photos table (separate from chunks), then create a chunk referencing it
	for (let i = 0; i < photos.length; i++) {
		const photoId = crypto.randomUUID();
		const ctMatch = photos[i].dataUri.match(/^data:([^;]+);/);
		const contentType = ctMatch ? ctMatch[1] : "image/jpeg";
		const sizeBytes = new TextEncoder().encode(photos[i].dataUri).length;

		await pool.query(
			`INSERT INTO photos (id, job_id, order_num, content_type, data_uri, size_bytes) VALUES ($1, $2, $3, $4, $5, $6)`,
			[photoId, jobId, i, contentType, photos[i].dataUri, sizeBytes],
		);

		await pool.query(
			`INSERT INTO photo_chunks (job_id, order_num, photo_id, status, created_at, updated_at) VALUES ($1, $2, $3, 'PENDING', $4, $4)`,
			[jobId, i, photoId, now],
		);
	}

	return { jobId };
});

// ─── GET /api/photo-jobs — List photo jobs (non-completed by default) ────

export const listPhotoJobs = createServerFn({
	method: "GET",
	strict: false,
}).handler(async () => {
	// Non-completed photo jobs (used by the ingest overview)
	const res = await getPool().query(
		"SELECT * FROM photo_jobs WHERE status != 'COMPLETED' ORDER BY created_at ASC",
	);
	return { jobs: res.rows.map(mapPhotoJobRow) };
});

// ─── GET /api/photo-jobs/:id — Get single photo job with chunks ──────────

export const getPhotoJob = createServerFn({
	method: "GET",
	strict: false,
}).handler(async (ctx) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- data shape controlled by caller
	const data = ctx.data as any;
	const id = data?.id;

	if (
		!id ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
	) {
		return { job: null, error: "Job not found" };
	}

	const pool = getPool();
	const jobRes = await pool.query("SELECT * FROM photo_jobs WHERE id = $1", [
		id,
	]);
	if (jobRes.rows.length === 0) {
		return { job: null, error: "Job not found" };
	}

	const chunksRes = await pool.query(
		`SELECT c.*, p.data_uri, p.content_type \
       FROM photo_chunks c LEFT JOIN photos p ON c.photo_id = p.id \
       WHERE c.job_id = $1 ORDER BY c.order_num ASC`,
		[id],
	);

	const job = mapPhotoJobRow(jobRes.rows[0]);
	const chunks = chunksRes.rows.map(mapPhotoChunkRow);

	return { job, chunks };
});
