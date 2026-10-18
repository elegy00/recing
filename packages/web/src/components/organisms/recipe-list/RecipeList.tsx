import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Job } from "../../../types";
import { Spinner } from "../../atoms/spinner/Spinner";
import { Figs } from "../../Motifs";
import { RecipeCard } from "../../molecules/recipe-card/RecipeCard";

export interface RecipeListProps {
	loading: boolean;
	error: string | null;
	jobs: Job[];
}

export function RecipeList({ loading, error, jobs }: RecipeListProps) {
	if (error) return <ErrorState error={error} />;
	if (loading && jobs.length === 0) return <LoadingState />;
	if (jobs.length === 0) return <EmptyState />;

	// listRecipes() only returns valid completed recipes.
	return (
		<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
			{jobs.map((job) => (
				<RecipeCard key={job._id} job={job} />
			))}
		</div>
	);
}

function LoadingState() {
	const { t } = useTranslation();
	return (
		<p className="text-lg text-[var(--text-secondary)]">
			<Spinner className="mr-2" />
			{t("loading")}
		</p>
	);
}

function ErrorState({ error }: { error: string }) {
	const { t } = useTranslation();
	return (
		<p className="text-lg text-[var(--accent-deep)]">
			{t("load_error", { error })}
		</p>
	);
}

function EmptyState() {
	const { t } = useTranslation();
	return (
		<div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
			<Figs className="h-20 w-32" />
			<p className="max-w-md text-lg leading-relaxed text-[var(--text-secondary)]">
				{t("recipes_empty")}
			</p>
			<Link to="/import" className="btn-primary mt-2">
				{t("recipes_empty_cta")}
			</Link>
		</div>
	);
}
