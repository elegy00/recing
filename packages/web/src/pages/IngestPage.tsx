import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listPhotoJobs, type PhotoJob } from "../api/photo-jobs";
import { listRecipes } from "../api/recipes";
import { Spinner } from "../components/atoms/spinner/Spinner";
import {
	type IngestRow,
	IngestTable,
} from "../components/organisms/ingest-table/IngestTable";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import type { Job } from "../types";
import { timeAgo } from "../utils/timeAgo";

function statusOf(job: {
	status: string;
	error?: string | null;
}): IngestRow["status"] {
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
		createdAt: job.createdAt,
		timeLabel: timeAgo(job.createdAt),
	};
}

function toPhotoEntry(job: PhotoJob): IngestRow {
	return {
		_id: job._id,
		source: "photo",
		displayName: `${job.totalPhotos} Foto${job.totalPhotos > 1 ? "s" : ""}`,
		status: statusOf(job),
		createdAt: job.createdAt,
		timeLabel: timeAgo(job.createdAt),
	};
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
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
				<Spinner className="mr-2" />
				{t("loading")}
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<PageHeader
				title={t("ingest_title")}
				subtitle={t("ingest_job_count", { count: entries.length })}
			/>
			<p className="mb-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
				<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
				{t("ingest_polling")}
			</p>
			<IngestTable rows={entries} />
		</div>
	);
}
