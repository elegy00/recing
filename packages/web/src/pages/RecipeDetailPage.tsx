import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { getRecipe, deleteRecipe, retryRecipe } from "../api/server-functions";
import type { Job } from "../types";
import { PageHeader } from "../components/organisms/page-header/PageHeader";
import { RecipeDetail } from "../components/organisms/recipe-detail/RecipeDetail";
import { CookMode } from "../components/organisms/cook-mode/CookMode";

type ViewMode = "detail" | "cook";

export default function RecipeDetailPage() {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
				const data = (await (getRecipe as any)({ data: { id } })) as { recipe: Job | null; error?: string };
				setJob(data.recipe);
			} catch (err) { setError(err instanceof Error ? err.message : "Failed to load recipe"); }
			finally { setLoading(false); }
		})();
	}, [id]);

	const ext = job?.result ?? null;

	function startCooking() { setCurrentStep(0); setCheckedIngredients(new Set()); setMode("cook"); }
	function exitCooking() { setMode("detail"); setCurrentStep(0); setCheckedIngredients(new Set()); }
	function toggleIngredient(idx: number) { setCheckedIngredients((prev) => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; }); }

	async function onConfirmDelete() {
		try { await (deleteRecipe as any)({ data: { id } }); navigate({ to: "/", replace: true }); } catch { setConfirmAction(null); }
	}
	async function onConfirmReset() {
		try { await (retryRecipe as any)({ data: { id } }); setJob((p) => p ? { ...p, status: "PENDING", result: null, error: null } : null); } catch { setConfirmAction(null); }
	}

	if (loading) return <div className="mx-auto max-w-4xl px-6 py-12 text-lg text-[var(--text-secondary)]">Laden...</div>;
	if (error || !job) return (
		<div className="mx-auto max-w-4xl px-6 py-12"><PageHeader title="Rezept nicht gefunden" subtitle={error ?? undefined} /><button onClick={() => navigate({ to: "/" })} className="btn-primary">Zurück</button></div>
	);

	const instructions = (ext?.instructions ?? []).map((s) => ({ ...s, timer: s.timer ?? undefined }));
	const ingredients = (ext?.ingredients ?? []).map((i) => ({ ...i, quantity: i.quantity ?? undefined, unit: i.unit ?? undefined, note: i.note ?? undefined }));

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
				name={ext?.recipeName ?? ""} description={ext?.description ?? undefined} prepTime={ext?.prepTime ?? undefined}
				cookTime={ext?.cookTime ?? undefined} totalTime={ext?.totalTime ?? undefined} servings={ext?.servings ?? undefined}
				ingredients={ingredients} instructions={instructions} onStartCooking={startCooking}
				onConfirmDelete={onConfirmDelete} onConfirmReset={onConfirmReset} onCancelConfirm={() => setConfirmAction(null)}
				onBack={() => navigate({ to: "/" })} showActions={job.status === "COMPLETED"} confirmAction={confirmAction}
			/>
		</div>
	);
}
