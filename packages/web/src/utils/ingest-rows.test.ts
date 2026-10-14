import { describe, expect, it } from "vitest";
import type { PhotoJob } from "../api/photo-jobs";
import type { Job } from "../types";
import { statusOf, toPhotoEntry, toUrlEntry } from "./ingest-rows";

const now = new Date().toISOString();

function urlJob(overrides: Partial<Job> = {}): Job {
	return {
		_id: "11111111-1111-4111-8111-111111111111",
		url: "https://example.com/rezept",
		status: "PENDING",
		createdAt: now,
		updatedAt: now,
		result: null,
		error: null,
		...overrides,
	};
}

function photoJob(overrides: Partial<PhotoJob> = {}): PhotoJob {
	return {
		_id: "22222222-2222-4222-8222-222222222222",
		status: "PENDING",
		totalPhotos: 1,
		completedChunks: 0,
		error: null,
		result: null,
		createdAt: now,
		...overrides,
	};
}

describe("statusOf", () => {
	it("maps FAILED status to FAILED", () => {
		expect(statusOf({ status: "FAILED" })).toBe("FAILED");
	});

	it("maps a non-FAILED status with an error to FAILED", () => {
		expect(statusOf({ status: "PENDING", error: "boom" })).toBe("FAILED");
	});

	it("maps PROCESSING to PROCESSING", () => {
		expect(statusOf({ status: "PROCESSING" })).toBe("PROCESSING");
	});

	it("maps everything else to PENDING", () => {
		expect(statusOf({ status: "PENDING" })).toBe("PENDING");
		expect(statusOf({ status: "CHUNKING" })).toBe("PENDING");
		expect(statusOf({ status: "MERGING" })).toBe("PENDING");
	});
});

describe("toUrlEntry", () => {
	it("keeps short URLs unchanged", () => {
		const row = toUrlEntry(urlJob());
		expect(row.displayName).toBe("https://example.com/rezept");
		expect(row.source).toBe("url");
	});

	it("truncates long URLs with an ellipsis", () => {
		const url = `https://example.com/${"a".repeat(80)}`;
		const row = toUrlEntry(urlJob({ url }));
		expect(row.displayName).toHaveLength(61);
		expect(row.displayName.endsWith("…")).toBe(true);
	});

	it("propagates status and id", () => {
		const row = toUrlEntry(urlJob({ status: "FAILED", error: "x" }));
		expect(row.status).toBe("FAILED");
		expect(row._id).toBe("11111111-1111-4111-8111-111111111111");
	});
});

describe("toPhotoEntry", () => {
	it("uses singular 'Foto' for one photo", () => {
		expect(toPhotoEntry(photoJob({ totalPhotos: 1 })).displayName).toBe(
			"1 Foto",
		);
	});

	it("uses plural 'Fotos' for multiple photos", () => {
		expect(toPhotoEntry(photoJob({ totalPhotos: 3 })).displayName).toBe(
			"3 Fotos",
		);
	});

	it("marks photo jobs with an error as FAILED", () => {
		const row = toPhotoEntry(photoJob({ status: "FAILED", error: "x" }));
		expect(row.source).toBe("photo");
		expect(row.status).toBe("FAILED");
	});
});
