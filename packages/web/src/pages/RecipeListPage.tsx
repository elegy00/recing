import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Figs } from "../components/Motifs";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { RecipeList } from "../components/organisms/recipe-list/RecipeList";
import { listRecipes } from "../api/server-functions";
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
			<PageHeader title={t("recipes_title")} subtitle={t("recipes_description")} decorativeIcon={<Figs className="mb-1 hidden h-20 w-32 shrink-0 sm:block" />} />

			{loading && jobs.length > 0 ? (
				<p className="text-lg text-[var(--text-secondary)]">Laden...</p>
			) : error ? (
				<p className="text-lg text-[var(--accent-deep)]">{error}</p>
			) : (
				<RecipeList loading={loading} error={error} jobs={jobs} />
			)}
		</div>
	);
}
