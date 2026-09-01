import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getRecipe, deleteRecipe, retryRecipe } from "../api/server-functions";
import { formatDuration } from "../utils/formatTime";
import { SprigDivider } from "../components/Motifs";
import type { Job } from "../types";

type ViewMode = "detail" | "cook";

export default function RecipeDetailPage() {
	const { t } = useTranslation();
	const { id } = useParams({ strict: false }) as { id: string };
	const navigate = useNavigate();
	const [job, setJob] = useState<Job | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Cook mode state
	const [mode, setMode] = useState<ViewMode>("detail");
	const [currentStep, setCurrentStep] = useState(0);
	const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
		new Set(),
	);

	// Confirmation modal state for delete/reset actions
	const [confirmAction, setConfirmAction] = useState<string | null>(null);

	useEffect(() => {
		if (!id) return;
		(async () => {
			try {
				setLoading(true);
				setError(null);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
				const data = (await (getRecipe as any)({ data: { id } })) as {
					recipe: Job | null;
					error?: string;
				};
				setJob(data.recipe);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load recipe");
			} finally {
				setLoading(false);
			}
		})();
	}, [id]);

	// Extraction data
	const ext = job?.result ?? null;

	function startCooking() {
		setCurrentStep(0);
		setCheckedIngredients(new Set());
		setMode("cook");
	}

	function exitCooking() {
		setMode("detail");
		setCurrentStep(0);
		setCheckedIngredients(new Set());
	}

	function toggleIngredient(idx: number) {
		setCheckedIngredients((prev) => {
			const next = new Set(prev);
			if (next.has(idx)) next.delete(idx);
			else next.add(idx);
			return next;
		});
	}

	async function handleDelete() {
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
			await (deleteRecipe as any)({ data: { id: id! } });
			navigate({ to: "/", replace: true });
		} catch (err) {
			console.error(t("delete_failed"), err);
			setConfirmAction(null);
		}
	}

	async function handleReset() {
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
			await (retryRecipe as any)({ data: { id: id! } });
			setJob((prev) =>
				prev ? { ...prev, status: "PENDING", result: null, error: null } : null,
			);
			setConfirmAction(null);
		} catch (err) {
			console.error(t("reset_failed"), err);
			setConfirmAction(null);
		}
	}

	function hasNext() {
		return ext && currentStep < (ext.instructions.length ?? 0) - 1;
	}

	function hasPrev() {
		return currentStep > 0;
	}

	// ─── Loading / Error states ──────────────────────────────
	if (loading) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-12 text-lg text-[var(--text-secondary)]">
				<span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
				{t("recipes_loading")}
			</div>
		);
	}

	if (error || !job) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-12">
				<h1 className="font-serif text-4xl font-semibold tracking-tight">
					{t("detail_not_found")}
				</h1>
				<p className="mt-4 mb-8 text-lg leading-relaxed text-[var(--text-secondary)]">
					{error || t("detail_not_found_message")}
				</p>
				<button onClick={() => navigate({ to: "/" })} className="btn-primary">
					{t("detail_back_to_recipes")}
				</button>
			</div>
		);
	}

	// ─── Cook mode view ──────────────────────────────────────
	if (mode === "cook") {
		const instructions = ext?.instructions ?? [];
		const step = instructions[currentStep];
		const total = instructions.length;
		const progressPct = Math.round(((currentStep + 1) / total) * 100);

		return (
			<div className="mx-auto max-w-4xl px-6 py-12">
				{/* Cook header */}
				<div className="mb-6 flex items-center justify-between gap-4">
					<button onClick={exitCooking} className="btn-outline">
						{t("cook_exit")}
					</button>
					<span className="text-base tabular-nums text-[var(--text-secondary)]">
						{progressPct}%
					</span>
				</div>

				{/* Progress bar */}
				<div className="mb-8 h-2 rounded-full bg-[var(--border)]">
					<div
						className="h-2 rounded-full bg-[var(--accent)] transition-all duration-300"
						style={{ width: `${progressPct}%` }}
					/>
				</div>

				{/* Step card */}
				<div className="card mb-8 p-6 sm:p-8">
					<div className="mb-5 flex items-center justify-between gap-4">
						<span className="eyebrow">
							{t("cook_step_of", { current: currentStep + 1, total })}
						</span>
						{step?.timer && (
							<span className="rounded-full bg-[var(--olive-soft)] px-3.5 py-1 text-base font-medium tabular-nums text-[var(--olive-deep)]">
								⏱ {step.timer}
							</span>
						)}
					</div>
					<p className="text-2xl leading-relaxed font-medium sm:text-3xl">
						{step.text}
					</p>
				</div>

				{/* Ingredient checklist */}
				<h3 className="mb-4 font-serif text-2xl font-semibold">
					{t("detail_ingredients")}
				</h3>
				{(ext?.ingredients ?? []).map((ing, idx) => (
					<label
						key={idx}
						className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-lg transition-colors ${
							checkedIngredients.has(idx)
								? "text-[var(--text-secondary)] line-through"
								: "text-[var(--text-primary)]"
						}`}
					>
						<input
							type="checkbox"
							checked={checkedIngredients.has(idx)}
							onChange={() => toggleIngredient(idx)}
							className="h-5 w-5 shrink-0 accent-[var(--accent)]"
						/>
						<span>
							{ing.quantity && <strong>{ing.quantity} </strong>}
							{ing.unit && <em className="font-serif">{ing.unit} </em>}
							{ing.name}
						</span>
					</label>
				))}

				{/* Navigation — large touch targets for kitchen use */}
				<div className="mt-10 flex items-center justify-between gap-4">
					<button
						disabled={!hasPrev()}
						onClick={() => setCurrentStep((s) => s - 1)}
						className="btn-outline px-7 py-3.5 text-lg"
					>
						{t("cook_previous")}
					</button>
					<span className="text-base tabular-nums text-[var(--text-secondary)]">
						{currentStep + 1} / {total}
					</span>
					{hasNext() ? (
						<button
							onClick={() => setCurrentStep((s) => s + 1)}
							className="btn-primary px-7 py-3.5 text-lg"
						>
							{t("cook_next")}
						</button>
					) : (
						<button
							onClick={exitCooking}
							className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--olive)] px-7 py-3.5 text-lg font-medium text-white transition-colors duration-150 hover:bg-[var(--olive-deep)]"
						>
							{t("cook_finished")}
						</button>
					)}
				</div>
			</div>
		);
	}

	// ─── Normal detail view ──────────────────────────────────
	return (
		<div className="mx-auto max-w-4xl px-6 py-12">
			{/* Header */}
			<div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
						{ext?.recipeName}
					</h1>
					<div className="mt-3 h-1 w-16 rounded-full bg-[var(--accent)]" />
					{ext?.description && (
						<p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)]">
							{ext.description}
						</p>
					)}
				</div>
				<button
					onClick={startCooking}
					className="btn-primary w-fit shrink-0 px-8 py-3.5 text-lg"
				>
					{t("detail_start_cooking")}
				</button>
			</div>

			{/* Meta info */}
			{(ext?.prepTime || ext?.cookTime || ext?.totalTime || ext?.servings) && (
				<div className="mb-10 flex flex-wrap gap-2.5">
					{ext.prepTime && (
						<span className="chip">
							{t("detail_prep")} · {formatDuration(ext.prepTime)}
						</span>
					)}
					{ext.cookTime && (
						<span className="chip">
							{t("detail_cook")} · {formatDuration(ext.cookTime)}
						</span>
					)}
					{ext.totalTime && !ext.prepTime && !ext.cookTime && (
						<span className="chip">
							{t("detail_total")} · {formatDuration(ext.totalTime)}
						</span>
					)}
					{ext.servings && (
						<span className="chip">
							{t("detail_servings")} · {ext.servings}
						</span>
					)}
				</div>
			)}

			{/* Ingredients */}
			<h2 className="mb-5 font-serif text-3xl font-semibold">
				{t("detail_ingredients")}
			</h2>
			<ul className="mb-10 grid list-none gap-x-10 gap-y-2.5 sm:grid-cols-2">
				{(ext?.ingredients ?? []).map((ing, idx) => (
					<li key={idx} className="text-lg leading-relaxed">
						{ing.quantity && <strong>{ing.quantity} </strong>}
						{ing.unit && <em className="font-serif">{ing.unit} </em>}
						{ing.name}
						{ing.note && (
							<span className="text-[var(--text-secondary)]">
								{" "}
								— {ing.note}
							</span>
						)}
					</li>
				))}
			</ul>

			<SprigDivider className="mb-10" />

			{/* Instructions */}
			<h2 className="mb-5 font-serif text-3xl font-semibold">
				{t("detail_instructions")}
			</h2>
			<ol className="list-decimal space-y-4 pl-6 marker:font-serif marker:text-xl marker:font-semibold marker:text-[var(--accent)]">
				{(ext?.instructions ?? []).map((step) => (
					<li key={step.stepNumber} className="text-lg leading-relaxed">
						{step.text}
						{step.timer && (
							<span className="ml-2 inline-block rounded-full bg-[var(--olive-soft)] px-3 py-0.5 text-sm font-medium tabular-nums text-[var(--olive-deep)]">
								⏱ {step.timer}
							</span>
						)}
					</li>
				))}
			</ol>

			{/* Footer */}
			<div className="mt-10 border-t border-[var(--border)] pt-5">
				<p className="text-sm text-[var(--text-secondary)]">
					{new Date(job.createdAt).toLocaleDateString()}
				</p>
			</div>

			{/* Action buttons */}
			{job.status === "COMPLETED" && (
				<div className="mt-6 flex flex-wrap gap-3">
					<button
						onClick={() => setConfirmAction("reset")}
						className="btn-outline text-[var(--accent-deep)] hover:border-[var(--accent)]"
					>
						{t("detail_reprocess")}
					</button>
					<button
						onClick={() => setConfirmAction("delete")}
						className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c98a7d] bg-transparent px-5 py-3 text-base font-medium text-[#9c3f2e] transition-colors duration-150 hover:bg-[#f6e3dc]"
					>
						{t("detail_delete")}
					</button>
				</div>
			)}

			{/* Back button */}
			<button
				onClick={() => navigate({ to: "/" })}
				className="btn-outline mt-4"
			>
				{t("detail_back_to_recipes")}
			</button>

			{/* Confirmation modal */}
			{confirmAction && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
					<div className="card w-full max-w-md p-7 shadow-xl">
						{confirmAction === "delete" && (
							<>
								<h3 className="mb-2 font-serif text-2xl font-semibold">
									{t("confirm_delete_title")}
								</h3>
								<p className="mb-6 leading-relaxed text-[var(--text-secondary)]">
									{t("confirm_delete_message", { name: ext?.recipeName })}
								</p>
							</>
						)}
						{confirmAction === "reset" && (
							<>
								<h3 className="mb-2 font-serif text-2xl font-semibold">
									{t("confirm_reprocess_title")}
								</h3>
								<p className="mb-6 leading-relaxed text-[var(--text-secondary)]">
									{t("confirm_reprocess_message", { name: ext?.recipeName })}
								</p>
							</>
						)}
						<div className="flex justify-end gap-3">
							<button
								onClick={() => setConfirmAction(null)}
								className="btn-outline"
							>
								{t("confirm_cancel")}
							</button>
							{confirmAction === "delete" && (
								<button
									onClick={handleDelete}
									className="inline-flex items-center justify-center gap-2 rounded-full bg-[#9c3f2e] px-6 py-3 text-base font-medium text-white transition-colors duration-150 hover:bg-[#833325]"
								>
									{t("confirm_delete_btn")}
								</button>
							)}
							{confirmAction === "reset" && (
								<button onClick={handleReset} className="btn-primary">
									{t("confirm_reprocess_btn")}
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
