import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { listRecipes } from "../api/server-functions";
import { formatDuration } from "../utils/formatTime";
import { Figs } from "../components/Motifs";
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
			{/* Page header */}
			<div className="mb-10 flex items-end justify-between gap-6">
				<div>
					<h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
						{t("recipes_title")}
					</h1>
					<div className="mt-3 h-1 w-16 rounded-full bg-[var(--accent)]" />
					<p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
						{t("recipes_description")}
					</p>
				</div>
				<Figs className="mb-1 hidden h-20 w-32 shrink-0 sm:block" />
			</div>

			{/* Loading */}
			{loading && (
				<p className="text-lg text-[var(--text-secondary)]">
					<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
					{t("recipes_loading")}
				</p>
			)}

			{/* Error */}
			{!loading && error && (
				<p className="text-lg text-[var(--accent-deep)]">
					{t("submit_status_error_prefix")} {error}
				</p>
			)}

			{/* Empty state */}
			{!loading && !error && jobs.length === 0 && (
				<div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
					<Figs className="h-20 w-32" />
					<p className="max-w-md text-lg leading-relaxed text-[var(--text-secondary)]">
						Keine Rezepte gefunden. Reiche eine URL ein, um zu beginnen.
					</p>
					<Link to="/submit" className="btn-primary mt-2">
						{t("nav_submit")}
					</Link>
				</div>
			)}

			{/* Recipe grid */}
			{!loading && !error && jobs.length > 0 && (
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
					{jobs
						.filter((j) => j.status === "COMPLETED")
						.map((job) => renderCard(job))}
				</div>
			)}
		</div>
	);

	function renderCard(job: Job) {
		const ext = job.result ?? null;
		if (!ext?.recipeName) return null;

		return (
			<div key={job._id} className="relative">
				<Link
					to="/recipes/$id"
					params={{ id: job._id }}
					className="card group block p-6 no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md text-inherit"
				>
					{(ext.prepTime || ext.cookTime || ext.totalTime) && (
						<div className="mb-4 flex flex-wrap gap-2">
							{ext.prepTime && (
								<span className="chip">
									{t("card_prep")} · {formatDuration(ext.prepTime)}
								</span>
							)}
							{ext.cookTime && (
								<span className="chip">
									{t("card_cook")} · {formatDuration(ext.cookTime)}
								</span>
							)}
							{ext.totalTime && !ext.prepTime && !ext.cookTime && (
								<span className="chip">
									{t("detail_total")} · {formatDuration(ext.totalTime)}
								</span>
							)}
						</div>
					)}
					<h3 className="mb-1.5 font-serif text-2xl font-semibold leading-snug break-words group-hover:text-[var(--accent-deep)]">
						{ext.recipeName}
					</h3>
					{ext.description && (
						<p className="line-clamp-2 text-base leading-relaxed text-[var(--text-secondary)]">
							{ext.description}
						</p>
					)}
				</Link>
			</div>
		);
	}
}
