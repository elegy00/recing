/**
 * Server functions for photo ingestion jobs.
 */

import { createServerFn } from "@tanstack/react-start";
import { getPool, toIsoString } from "./db";
import { isUuid } from "../utils/uuid";
import { requireId } from "./validators";

export interface PhotoJob {
	_id: string;
	status: string;
	totalPhotos: number;
	completedChunks: number;
	error?: string | null;
	result?: any;
	createdAt: string;
}

export interface PhotoChunk {
	_id: string;
	jobId: string;
	orderNum: number;
	status: string;
	dataUri?: string | null;
	extractedJson?: any;
	error?: string | null;
}

/** Map photo job DB row to frontend type. */
function mapPhotoJobRow(row: Record<string, unknown>): PhotoJob {
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
		createdAt: toIsoString(r.created_at),
	};
}

/** Map photo chunk DB row to frontend type. */
function mapPhotoChunkRow(row: Record<string, unknown>): PhotoChunk {
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

export const submitPhotoJob = createServerFn({ method: "POST" }).validator(
	(data: { photos?: unknown }) => {
		const photos = data?.photos;
		if (!Array.isArray(photos) || photos.length === 0) {
			throw new Error("At least one photo is required");
		}
		for (let i = 0; i < photos.length; i++) {
			const uri = (photos[i] as { dataUri?: unknown })?.dataUri;
			if (typeof uri !== "string" || !uri.startsWith("data:image/")) {
				throw new Error(
					`Photo ${i + 1} is not a valid base64-encoded image`,
				);
			}
		}
		return { photos: photos as Array<{ dataUri: string }> };
	},
).handler(async (ctx) => {
	const photos = ctx.data.photos;

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

export const listPhotoJobs = createServerFn({ method: "GET" }).handler(
	async () => {
		// Non-completed photo jobs (used by the ingest overview)
		const res = await getPool().query(
			"SELECT * FROM photo_jobs WHERE status != 'COMPLETED' ORDER BY created_at ASC",
		);
		return { jobs: res.rows.map(mapPhotoJobRow) };
	},
);

// ─── GET /api/photo-jobs/:id — Get single photo job with chunks ──────────

export const getPhotoJob = createServerFn({ method: "GET" })
	.validator(requireId)
	.handler(async (ctx) => {
		const { id } = ctx.data;

		if (!isUuid(id)) {
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
