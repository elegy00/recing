/**
 * Pure row mapping for the ingest overview page.
 * Kept separate from the page component so it can be unit-tested.
 */

import type { PhotoJob } from "../api/photo-jobs";
import type { Job } from "../types";
import { timeAgo } from "./timeAgo";

export interface IngestRow {
	_id: string;
	source: "url" | "photo";
	displayName: string;
	status: "PENDING" | "PROCESSING" | "FAILED";
	/** ISO timestamp; used for ordering. */
	createdAt: string;
	timeLabel: string;
	/** Error message for FAILED rows, when the worker reported one. */
	error?: string;
}

export function statusOf(job: {
	status: string;
	error?: string | null;
}): IngestRow["status"] {
	if (job.status === "FAILED" || job.error) return "FAILED";
	if (job.status === "PROCESSING") return "PROCESSING";
	return "PENDING";
}

export function toUrlEntry(job: Job): IngestRow {
	const url = job.url;
	return {
		_id: job._id,
		source: "url",
		displayName: url.length > 60 ? `${url.slice(0, 60)}…` : url,
		status: statusOf(job),
		createdAt: job.createdAt,
		timeLabel: timeAgo(job.createdAt),
		error: job.error ?? undefined,
	};
}

export function toPhotoEntry(job: PhotoJob): IngestRow {
	return {
		_id: job._id,
		source: "photo",
		displayName: `${job.totalPhotos} Foto${job.totalPhotos > 1 ? "s" : ""}`,
		status: statusOf(job),
		createdAt: job.createdAt,
		timeLabel: timeAgo(job.createdAt),
		error: job.error ?? undefined,
	};
}
