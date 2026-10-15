import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listPhotoJobs, retryPhotoJob } from "../api/photo-jobs";
import { listRecipes, retryRecipe } from "../api/recipes";
import { Spinner } from "../components/atoms/spinner/Spinner";
import {
	IngestTable,
} from "../components/organisms/ingest-table/IngestTable";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import type { IngestRow } from "../utils/ingest-rows";
import { toPhotoEntry, toUrlEntry } from "../utils/ingest-rows";

export default function IngestPage() {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<IngestRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(
		new Set(),
	);

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

	async function handleRetry(row: IngestRow) {
		if (retryingIds.has(row._id)) return;
		setRetryingIds((prev) => new Set(prev).add(row._id));
		try {
			if (row.source === "url") {
				await retryRecipe({ data: { id: row._id } });
			} else {
				const res = await retryPhotoJob({ data: { id: row._id } });
				if (!res.ok) throw new Error(res.error);
			}
			await fetchJobs();
		} catch (err) {
			console.error("Failed to restart job", err);
		} finally {
			setRetryingIds((prev) => {
				const next = new Set(prev);
				next.delete(row._id);
				return next;
			});
		}
	}

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
			<IngestTable rows={entries} retryingIds={retryingIds} onRetry={handleRetry} />
		</div>
	);
}
