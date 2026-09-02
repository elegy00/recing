import { Link } from "@tanstack/react-router";
import type { Job } from "../../../types";
import { Chip } from "../../atoms/chip/Chip";

interface Props {
	job: Job;
}

export function RecipeCard({ job }: Props) {
	const ext = job.result ?? null;
	if (!ext?.recipeName) return null;

	return (
		<div className="relative">
			<Link
				to="/recipes/$id"
				params={{ id: job._id }}
				className="card group block p-6 no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md text-inherit"
			>
				{(ext.prepTime || ext.cookTime || ext.totalTime) && (
					<div className="mb-4 flex flex-wrap gap-2">
						{ext.prepTime && <Chip>{ext.prepTime}</Chip>}
						{ext.cookTime && <Chip>{ext.cookTime}</Chip>}
						{ext.totalTime && !ext.prepTime && !ext.cookTime && (
							<Chip>total</Chip>
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
