import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { IngestTable } from "../components/organisms/ingest-table/IngestTable";
import { listRecipes, listPhotoJobs } from "../api/server-functions";

interface IngestEntry {
	_id: string;
	source: "url" | "photo";
	displayName: string;
	status: "PENDING" | "PROCESSING" | "FAILED";
	timeLabel: string;
}

export default function IngestPage() {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<IngestEntry[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchJobs = useCallback(async () => {
		try {
			setLoading(true);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn strict mode
			const urlData = (await (listRecipes as any)({ data: { status: "all" } })) as { recipes: any[] };
			const photoData = await listPhotoJobs();

			function toEntry(source: "url" | "photo", j: any): IngestEntry {
				const isFailed = j.status === "FAILED" || j.error;
				return {
					_id: j._id, source,
					displayName: source === "url" ? (j.url.length > 60 ? j.url.slice(0, 60) + "…" : j.url) : `${j.totalPhotos} Foto${j.totalPhotos > 1 ? "s" : ""}`,
					status: isFailed ? "FAILED" : "PENDING", timeLabel: timeAgo(j.createdAt),
				};
			}

			const urlEntries = urlData.recipes.filter((j) => j.status !== "COMPLETED").map((j) => toEntry("url", j));
			const photoEntries = (photoData.jobs || []).filter((j) => j.status !== "COMPLETED").map((j) => toEntry("photo", j));

			setEntries([...urlEntries, ...photoEntries].sort((a, b) => new Date(a.timeLabel).getTime() - new Date(b.timeLabel).getTime()));
		} catch (err) {
			console.error("Failed to fetch ingest jobs", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { fetchJobs(); const interval = setInterval(fetchJobs, 10_000); return () => clearInterval(interval); }, [fetchJobs]);

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
			<IngestTable rows={entries} hasData={!loading} pollingActive loading={loading} />
		</div>
	);

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60_000);
		if (mins < 1) return "Jetzt";
		if (mins < 60) return `${mins}m`;
		return `${Math.floor(mins / 60)}h ${mins % 60}m`;
	}
}
