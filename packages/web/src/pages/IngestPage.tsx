import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listRecipes } from "../api/server-functions";

type Status = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function IngestPage() {
	const { t } = useTranslation();
	const [jobs, setJobs] = useState<
		Array<{ _id: string; url: string; status: Status; createdAt: string }>
	>([]);
	const [loading, setLoading] = useState(true);

	const fetchRecipes = useCallback(async () => {
		try {
			setLoading(true);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
			const data = (await (listRecipes as any)({})) as { recipes: any[] };
			// Only show non-completed jobs
			setJobs(
				data.recipes.filter((j: any) => j.status !== "COMPLETED"),
			);
		} catch (_err) {
			// silently ignore — stale data is better than nothing
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRecipes();
		const interval = setInterval(fetchRecipes, 10_000);
		return () => clearInterval(interval);
	}, [fetchRecipes]);

	if (loading && jobs.length === 0) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-12 text-center text-[var(--text-secondary)]">
				<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
				{t("ingest_loading")}
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<h1
				className="mb-2 text-3xl font-bold"
				style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
			>
				{t("ingest_title")}
			</h1>
			<p className="mb-6 text-sm text-[var(--text-secondary)]">
				{jobs.length > 0 && (
					<span>
						{jobs.length} {t("ingest_job_count", { count: jobs.length })}
					</span>
				)}{" "}
			</p>

			{/* Polling indicator */}
			<div className="mb-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
				<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
				{t("ingest_polling")}
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded-lg border border-[var(--border)]">
				<table className="w-full text-sm">
					<thead className="bg-[var(--card-bg)]">
						<tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-secondary)]">
							<th className="px-4 py-3 font-medium">{t("ingest_url")}</th>
							<th className="w-28 px-4 py-3 font-medium">
								{t("ingest_status")}
							</th>
							<th className="w-36 px-4 py-3 font-medium">
								{t("ingest_submitted")}
							</th>
						</tr>
					</thead>
					<tbody>
						{jobs.map((job) => (
							<tr key={job._id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
								<td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-[var(--text-primary)]">
									{truncate(job.url, 60)}
								</td>
								<td className="px-4 py-3">
									<StatusBadge status={job.status} />
								</td>
								<td className="px-4 py-3 text-[var(--text-secondary)]">
									{timeAgo(job.createdAt)}
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{jobs.length === 0 && (
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
				<span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
					<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
					{t("ingest_pending")}
				</span>
			);
		}
		if (status === "PROCESSING") {
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
					<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
					{t("ingest_processing")}
				</span>
			);
		}
		if (status === "FAILED") {
			return (
				<span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
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
