import { Link } from "@tanstack/react-router";
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
	if (loading && jobs.length === 0) return <LoadingState />;
	if (error) return <ErrorState error={error} />;
	if (jobs.length === 0) return <EmptyState />;

	const completedJobs = jobs.filter((j) => j.status === "COMPLETED");
	return (
		<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
			{completedJobs.map((job) => (
				<RecipeCard key={job._id} job={job} />
			))}
		</div>
	);
}

function LoadingState() {
	return (
		<p className="text-lg text-[var(--text-secondary)]">
			<Spinner className="mr-2" />
			Laden...
		</p>
	);
}

function ErrorState({ error }: { error: string }) {
	return <p className="text-lg text-[var(--accent-deep)]">Fehler beim Laden: {error}</p>;
}

function EmptyState() {
	return (
		<div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
			<Figs className="h-20 w-32" />
			<p className="max-w-md text-lg leading-relaxed text-[var(--text-secondary)]">
				Keine Rezepte gefunden. Reiche eine URL ein, um zu beginnen.
			</p>
			<Link to="/submit" className="btn-primary mt-2">Rezept einreichen</Link>
		</div>
	);
}
