import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { deleteRecipe, getRecipe, retryRecipe } from "../api/recipes";
import type {
	Job,
	RecipeIngredient,
	RecipeResult,
	RecipeStep,
} from "../types";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { RecipeDetail } from "../components/organisms/recipe-detail/RecipeDetail";
import { CookMode } from "../components/organisms/cook-mode/CookMode";

type ViewMode = "detail" | "cook";

/** Convert the API recipe result into display-ready ingredients and steps. */
function normalizeRecipe(result: RecipeResult): {
	ingredients: RecipeIngredient[];
	instructions: RecipeStep[];
} {
	return {
		ingredients: result.ingredients.map((i) => ({
			quantity: i.quantity ?? undefined,
			unit: i.unit ?? undefined,
			name: i.name,
			note: i.note ?? undefined,
		})),
		instructions: result.instructions.map((s) => ({
			stepNumber: s.stepNumber,
			text: s.text,
			timer: s.timer ?? undefined,
		})),
	};
}

export default function RecipeDetailPage() {
	const { t } = useTranslation();
	const { id } = useParams({ strict: false }) as { id: string };
	const navigate = useNavigate();
	const [job, setJob] = useState<Job | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [mode, setMode] = useState<ViewMode>("detail");
	const [currentStep, setCurrentStep] = useState(0);
	const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
	const [confirmAction, setConfirmAction] = useState<"delete" | "reset" | null>(null);

	useEffect(() => {
		if (!id) return;
		(async () => {
			try {
				setLoading(true); setError(null);
				const data = await getRecipe({ data: { id } });
				setJob(data.recipe);
			} catch (err) { setError(err instanceof Error ? err.message : "Failed to load recipe"); }
			finally { setLoading(false); }
		})();
	}, [id]);

	function startCooking() { setCurrentStep(0); setCheckedIngredients(new Set()); setMode("cook"); }
	function exitCooking() { setMode("detail"); setCurrentStep(0); setCheckedIngredients(new Set()); }
	function toggleIngredient(idx: number) {
		setCheckedIngredients((prev) => {
			const next = new Set(prev);
			if (next.has(idx)) next.delete(idx);
			else next.add(idx);
			return next;
		});
	}

	async function onConfirmDelete() {
		try { await deleteRecipe({ data: { id } }); navigate({ to: "/", replace: true }); } catch { setConfirmAction(null); }
	}
	async function onConfirmReset() {
		try { await retryRecipe({ data: { id } }); navigate({ to: "/ingest" }); } catch { setConfirmAction(null); }
	}

	if (loading) return <div className="mx-auto max-w-4xl px-6 py-12 text-lg text-[var(--text-secondary)]">{t("loading")}</div>;
	if (error || !job?.result) return (
		<div className="mx-auto max-w-4xl px-6 py-12"><PageHeader title={t("detail_not_found")} subtitle={error ? t("load_error", { error }) : t("detail_not_found_message")} /><button onClick={() => navigate({ to: "/" })} className="btn-primary">{t("detail_back_to_recipes")}</button></div>
	);

	const { ingredients, instructions } = normalizeRecipe(job.result);

	if (mode === "cook") {
		const step = instructions[currentStep];
		const total = instructions.length;
		return (
			<div className="mx-auto max-w-4xl px-6 py-12">
				<CookMode
					step={step} totalSteps={total} currentStepIndex={currentStep} progressPct={Math.round(((currentStep + 1) / total) * 100)}
					ingredients={ingredients} checkedIngredients={checkedIngredients} onExitCooking={exitCooking}
					onPrev={() => setCurrentStep((s) => s - 1)} onNext={() => setCurrentStep((s) => s + 1)}
					onToggleIngredient={toggleIngredient} hasPrev={currentStep > 0} hasNext={currentStep < total - 1}
				/>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			<RecipeDetail
				name={job.result.recipeName ?? ""} description={job.result.description ?? undefined} prepTime={job.result.prepTime ?? undefined}
				cookTime={job.result.cookTime ?? undefined} totalTime={job.result.totalTime ?? undefined} servings={job.result.servings ?? undefined}
				ingredients={ingredients} instructions={instructions} onStartCooking={startCooking}
				onConfirmDelete={onConfirmDelete} onConfirmReset={onConfirmReset} onCancelConfirm={() => setConfirmAction(null)}
				onBack={() => navigate({ to: "/" })} showActions={job.status === "COMPLETED"} confirmAction={confirmAction}
			/>
		</div>
	);
}
