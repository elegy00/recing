import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listPhotoJobs, type PhotoJob } from "../api/photo-jobs";
import { listRecipes } from "../api/recipes";
import type { Job } from "../types";
import { IngestTable, type IngestRow } from "../components/organisms/ingest-table/IngestTable";
import { PageHeader } from "../components/organisms/page-header/PageHeader";

function statusOf(job: { status: string; error?: string | null }): IngestRow["status"] {
	if (job.status === "FAILED" || job.error) return "FAILED";
	if (job.status === "PROCESSING") return "PROCESSING";
	return "PENDING";
}

function toUrlEntry(job: Job): IngestRow {
	const url = job.url;
	return {
		_id: job._id,
		source: "url",
		displayName: url.length > 60 ? `${url.slice(0, 60)}…` : url,
		status: statusOf(job),
		timeLabel: timeAgo(job.createdAt),
	};
}

function toPhotoEntry(job: PhotoJob): IngestRow {
	return {
		_id: job._id,
		source: "photo",
		displayName: `${job.totalPhotos} Foto${job.totalPhotos > 1 ? "s" : ""}`,
		status: statusOf(job),
		timeLabel: timeAgo(job.createdAt),
	};
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "Jetzt";
	if (mins < 60) return `${mins}m`;
	return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function IngestPage() {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<IngestRow[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchJobs = useCallback(async () => {
		try {
			setLoading(true);
			const [urlData, photoData] = await Promise.all([
				listRecipes({ data: { status: "all" } }),
				listPhotoJobs(),
			]);

			const urlEntries = urlData.recipes
				.filter((j) => j.status !== "COMPLETED")
				.map(toUrlEntry);
			const photoEntries = photoData.jobs
				.filter((j) => j.status !== "COMPLETED")
				.map(toPhotoEntry);

			setEntries(
				[...urlEntries, ...photoEntries].sort(
					(a, b) => new Date(a.timeLabel).getTime() - new Date(b.timeLabel).getTime(),
				),
			);
		} catch (err) {
			console.error("Failed to fetch ingest jobs", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchJobs();
		const interval = setInterval(fetchJobs, 10_000);
		return () => clearInterval(interval);
	}, [fetchJobs]);

	if (loading && entries.length === 0) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-12 text-center text-[var(--text-secondary)]">
				<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />Laden...
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<PageHeader title={t("ingest_title")} subtitle={`${entries.length} aktive Einträge`} />
			<p className="mb-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
				<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />Automatische Aktualisierung aktiv
			</p>
			<IngestTable rows={entries} />
		</div>
	);
}
