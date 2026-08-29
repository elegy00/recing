import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { listRecipes } from "../api/server-functions";
import { formatDuration } from "../utils/formatTime";
import type { Job } from "../types";

export default function RecipeListPage() {
	const { t } = useTranslation();
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchRecipes = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
			const data = (await (listRecipes as any)({})) as { recipes: Job[] };
			setJobs(data.recipes);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRecipes();
	}, [fetchRecipes]);

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<h1
				className="mb-3 text-3xl font-bold"
				style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
			>
				{t("recipes_title")}
			</h1>
			<p className="mb-8 max-w-xl text-[var(--text-secondary)] leading-relaxed">
				{t("recipes_description")}
			</p>

			{/* Loading */}
			{loading && (
				<p className="text-[var(--text-secondary)]">
					<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
					{t("recipes_loading")}
				</p>
			)}

			{/* Error */}
			{!loading && error && (
				<p className="text-red-600">
					{t("submit_status_error_prefix")} {error}
				</p>
			)}

			{/* Empty state */}
			{!loading && !error && jobs.length === 0 && (
				<div className="py-20 text-center text-[var(--text-secondary)]">
					{jobs.length === 0 &&
						"Keine Rezepte gefunden. Reiche eine URL ein, um zu beginnen."}
				</div>
			)}

			{/* Recipe grid */}
			{!loading && !error && jobs.length > 0 && (
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
					{jobs.map((job) => renderCard(job))}
				</div>
			)}
		</div>
	);

	function renderCard(job: Job) {
		const ext = job.result ?? null;

		return (
			<div key={job._id} className="relative">
				<Link
					to="/recipes/$id"
					params={{ id: job._id }}
					className="block rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-sm transition-colors duration-150 hover:border-[var(--accent)] hover:shadow-md cursor-pointer no-underline text-inherit"
				>
					{/* Status badge */}
					{job.status === "PENDING" && (
						<div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
							<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
							{t("card_pending")}
						</div>
					)}
					{job.status === "PROCESSING" && (
						<div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
							<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
							{t("card_processing")}
						</div>
					)}
					{job.status === "FAILED" && (
						<div className="mb-3 flex items-center gap-2 text-xs text-red-600">
							<span>✗</span>
							{t("card_failed")}
						</div>
					)}

					{ext?.recipeName && (
						<>
							{hasTimeInfo(ext) && (
								<div className="mb-3 flex gap-4 text-xs text-[var(--text-secondary)]">
									{ext.prepTime && (
										<span>
											{t("card_prep")}: {formatDuration(ext.prepTime)}
										</span>
									)}
									{ext.cookTime && (
										<span>
											{t("card_cook")}: {formatDuration(ext.cookTime)}
										</span>
									)}
									{ext.totalTime && !ext.prepTime && !ext.cookTime && (
										<span>
											{t("detail_total")}: {formatDuration(ext.totalTime)}
										</span>
									)}
								</div>
							)}
							<h3
								className="mb-1 text-xl font-bold"
								style={{
									fontFamily: "'EB Garamond', Georgia, serif",
									wordBreak: "break-word",
								}}
							>
								{ext.recipeName}
							</h3>
							{ext.description && (
								<p className="line-clamp-1 text-sm text-[var(--text-secondary)]">
									{ext.description}
								</p>
							)}
						</>
					)}
					{job.status === "FAILED" && job.error && (
						<p className="mt-1 text-xs text-red-500">{job.error}</p>
					)}
				</Link>
			</div>
		);
	}

	function hasTimeInfo(
		ext: NonNullable<Job["result"]>,
	): boolean {
		return !!ext.prepTime || !!ext.cookTime || !!ext.totalTime;
	}
}
