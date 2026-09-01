import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listRecipes, listPhotoJobs } from "../api/server-functions";

type JobSource = "url" | "photo";
type Status = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface IngestEntry {
	_id: string;
	source: JobSource;
	urlOrTitle: string;
	status: Status;
	createdAt: string;
	error?: string | null;
}

interface PhotoJobEntry {
	_id: string;
	status: string;
	totalPhotos: number;
	completedChunks: number;
	createdAt: string;
	error?: string | null;
}

export default function IngestPage() {
	const { t } = useTranslation();
	const [entries, setEntries] = useState<IngestEntry[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchRecipes = useCallback(async () => {
		try {
			setLoading(true);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
			const urlData = (await (listRecipes as any)({
				data: { status: "all" },
			})) as {
				recipes: any[];
			};
			const photoData = (await (listPhotoJobs as any)({})) as {
				jobs: PhotoJobEntry[];
			};

			// Convert URL jobs to ingest entries
			const urlEntries: IngestEntry[] = urlData.recipes
				.filter((j: any) => j.status !== "COMPLETED")
				.map((j: any) => ({
					_id: j._id,
					source: "url" as JobSource,
					urlOrTitle: j.url.length > 60 ? j.url.slice(0, 60) + "…" : j.url,
					status: j.status as Status,
					createdAt: j.createdAt,
					error: j.error ?? null,
				}));

			// Convert photo jobs to ingest entries
			const photoEntries: IngestEntry[] = (photoData.jobs || [])
				.filter((j: PhotoJobEntry) => j.status !== "COMPLETED")
				.map((j: PhotoJobEntry) => ({
					_id: j._id,
					source: "photo" as JobSource,
					urlOrTitle: `${j.totalPhotos} Foto${j.totalPhotos > 1 ? "s" : ""}`,
					status:
						j.status === "CHUNKING" || j.status === "MERGING"
							? "PROCESSING"
							: (j.status as Status),
					createdAt: j.createdAt,
					error: j.error ?? null,
				}));

			setEntries(
				[...urlEntries, ...photoEntries].sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
				),
			);
		} catch (err) {
			// Keep the last good data, but never fail silently
			console.error("Failed to fetch ingest jobs", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRecipes();
		const interval = setInterval(fetchRecipes, 10_000);
		return () => clearInterval(interval);
	}, [fetchRecipes]);

	if (loading && entries.length === 0) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-12 text-center text-[var(--text-secondary)]">
				<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
				{t("ingest_loading")}
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
				{t("ingest_title")}
			</h1>
			<div className="mt-3 mb-6 h-1 w-16 rounded-full bg-[var(--accent)]" />
			<p className="mb-6 text-base text-[var(--text-secondary)]">
				{entries.length > 0 && (
					<span>{t("ingest_job_count", { count: entries.length })}</span>
				)}
			</p>

			{/* Polling indicator */}
			<div className="mb-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
				<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
				{t("ingest_polling")}
			</div>

			{/* Table */}
			<div className="card overflow-hidden">
				<table className="w-full text-base">
					<thead className="bg-[var(--olive-soft)]/60">
						<tr className="border-b border-[var(--border)] text-left text-sm uppercase tracking-wider text-[var(--text-secondary)]">
							<th className="px-5 py-3.5 font-medium">{t("ingest_url")}</th>
							<th className="w-48 px-5 py-3.5 font-medium">
								{t("ingest_status")}
							</th>
							<th className="px-6 py-3.5 text-right text-sm uppercase tracking-wider text-[var(--text-secondary)]">
								{t("ingest_submitted")}
							</th>
						</tr>
					</thead>
					<tbody>
						{entries.map((entry) => (
							<tr
								key={entry._id}
								className="border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--accent-soft)]/40"
							>
								<td className="max-w-xs truncate px-5 py-3.5 text-[var(--text-primary)]">
									{entry.source === "photo" && (
										<span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--fig)]" />
									)}
									{truncate(entry.urlOrTitle, 60)}
								</td>
								<td className="px-5 py-3.5">
									<StatusBadge status={entry.status} />
								</td>
								<td className="px-6 py-3.5 text-right tabular-nums text-[var(--text-secondary)]">
									{timeAgo(entry.createdAt)}
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{entries.length === 0 && (
					<div className="py-12 text-center text-[var(--text-secondary)]">
						{t("ingest_empty")}
					</div>
				)}
			</div>
		</div>
	);

	function StatusBadge({ status }: { status: Status }) {
		if (status === "PENDING") {
			return (
				<span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium text-[var(--accent-deep)]">
					<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
					{t("ingest_pending")}
				</span>
			);
		}
		if (status === "PROCESSING") {
			return (
				<span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--olive-soft)] px-3 py-1 text-sm font-medium text-[var(--olive-deep)]">
					<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--olive)]" />
					{t("ingest_processing")}
				</span>
			);
		}
		if (status === "FAILED") {
			return (
				<span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f0d9d2] px-3 py-1 text-sm font-medium text-[#8c3a2b]">
					{t("ingest_failed")}
				</span>
			);
		}
		return null; // shouldn't happen — COMPLETED is filtered out
	}

	function truncate(str: string, max: number) {
		if (str.length <= max) return str;
		return str.slice(0, max) + "…";
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60_000);
		if (mins < 1) return t("ingest_now");
		if (mins < 60) return `${mins}m`;
		return `${Math.floor(mins / 60)}h ${mins % 60}m`;
	}
}
