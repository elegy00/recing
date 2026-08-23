import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { getRecipe, deleteRecipe, retryRecipe } from "../api/server-functions";
import type { Job } from "../types";

type ViewMode = "detail" | "cook";

export default function RecipeDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cook mode state
  const [mode, setMode] = useState<ViewMode>("detail");
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  // Confirmation modal state for delete/reset actions
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
        const data = (await (getRecipe as any)({ data: { id } })) as { recipe: Job | null; error?: string };
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
      navigate({ to: "/recipes", replace: true });
    } catch (err) {
      console.error("Delete failed:", err);
      setConfirmAction(null);
    }
  }

  async function handleReset() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
      await (retryRecipe as any)({ data: { id: id! } });
      setJob((prev) => (prev ? { ...prev, status: "PENDING", result: null, error: null } : null));
      setConfirmAction(null);
    } catch (err) {
      console.error("Reset failed:", err);
      setConfirmAction(null);
    }
  }

  function hasNext() {
    return ext && currentStep < (ext.instructions.length ?? 0) - 1;
  }

  function hasPrev() {
    return currentStep > 0;
  }

  // ─── Loading / Error states ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 text-[var(--text-secondary)]">
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
        Loading recipe...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-6 text-3xl font-bold" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
          Recipe Not Found
        </h1>
        <p className="mb-6 text-[var(--text-secondary)]">{error || "This recipe could not be found."}</p>
        <button
          onClick={() => navigate({ to: "/recipes" })}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          ← Back to Recipes
        </button>
      </div>
    );
  }

  // ─── Cook mode view ──────────────────────────────────────────────────────
  if (mode === "cook") {
    const instructions = ext?.instructions ?? [];
    const step = instructions[currentStep];
    const total = instructions.length;
    const progressPct = Math.round(((currentStep + 1) / total) * 100);

    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Cook header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={exitCooking}
            className="rounded border border-[var(--border)] bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50"
          >
            ← Exit Cook Mode
          </button>
          <span className="text-sm text-[var(--text-secondary)]">{progressPct}%</span>
        </div>

        {/* Progress bar */}
        <div className="mb-8 h-1.5 rounded-full bg-[var(--border)]">
          <div
            className="h-1.5 rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step card */}
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              Step {currentStep + 1} of {total}
            </span>
            {step?.timer && (
              <span className="rounded-full bg-green-100 px-2.5 py-[3px] text-xs font-medium text-green-700">
                ⏱ {step.timer}
              </span>
            )}
          </div>
          <p className="text-lg leading-relaxed">{step.text}</p>
        </div>

        {/* Ingredient checklist */}
        <h3 className="mb-3 text-xl font-bold" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
          Ingredients for this step
        </h3>
        {(ext?.ingredients ?? []).map((ing, idx) => (
          <label
            key={idx}
            className={`flex cursor-pointer items-center gap-2.5 py-2 transition-colors ${
              checkedIngredients.has(idx) ? "text-[var(--text-secondary)] line-through" : "text-[var(--text-primary)]"
            }`}
          >
            <input
              type="checkbox"
              checked={checkedIngredients.has(idx)}
              onChange={() => toggleIngredient(idx)}
              className="accent-[var(--accent)]"
            />
            <span>
              {ing.quantity && `${ing.quantity} `}
              {ing.unit && `${ing.unit} `}
              {ing.name}
            </span>
          </label>
        ))}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            disabled={!hasPrev()}
            onClick={() => setCurrentStep((s) => s - 1)}
            className={`rounded border border-[var(--border)] bg-white px-4 py-2 text-sm transition-opacity ${
              hasPrev() ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-40"
            }`}
          >
            ← Previous
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            {currentStep + 1} / {total}
          </span>
          {hasNext() ? (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Next Step →
            </button>
          ) : (
            <button
              onClick={exitCooking}
              className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              ✓ Finished!
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Normal detail view ──────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
            {ext?.recipeName}
          </h1>
          {ext?.description && (
            <p className="mt-2 text-[var(--text-secondary)] leading-relaxed">{ext.description}</p>
          )}
        </div>
        <button
          onClick={startCooking}
          className="rounded-md bg-[var(--accent)] px-8 py-3 text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          🍳 Start Cooking
        </button>
      </div>

      {/* Meta info */}
      {(ext?.prepTime || ext?.cookTime || ext?.totalTime || ext?.servings) && (
        <div className="mb-8 flex flex-wrap gap-6">
          {ext.prepTime && <span>🥄 Prep: {ext.prepTime}</span>}
          {ext.cookTime && <span>🔥 Cook: {ext.cookTime}</span>}
          {ext.totalTime && <span>⏱ Total: {ext.totalTime}</span>}
          {ext.servings && <span>🍽 Serves: {ext.servings}</span>}
        </div>
      )}

      {/* Ingredients */}
      <h2 className="mb-4 text-2xl font-bold" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
        Ingredients
      </h2>
      <ul className="mb-8 list-none space-y-3 border-b border-[var(--border)] pb-6">
        {(ext?.ingredients ?? []).map((ing, idx) => (
          <li key={idx} className="py-1 text-sm leading-relaxed">
            {ing.quantity && <strong>{ing.quantity}</strong>}{" "}
            {ing.unit && <em>{ing.unit}</em>}{" "}
            {ing.name}
            {ing.note && <span className="ml-1 text-[var(--text-secondary)]">— {ing.note}</span>}
          </li>
        ))}
      </ul>

      {/* Instructions */}
      <h2 className="mb-4 text-2xl font-bold" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
        Instructions
      </h2>
      <ol className="mb-8 list-decimal space-y-3 pl-5">
        {(ext?.instructions ?? []).map((step) => (
          <li key={step.stepNumber} className="py-1 leading-relaxed text-sm">
            {step.text}
            {step.timer && (
              <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-[1px] text-xs font-medium text-green-700">
                {step.timer}
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* Source */}
      <div className="border-t border-[var(--border)] pt-4">
        <p className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          {ext?.sourceUrl && (
            <a href={ext.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              Source URL →
            </a>
          )}
          <span>{new Date(job.createdAt).toLocaleDateString()}</span>
        </p>
      </div>

      {/* Action buttons */}
      {job.status === "COMPLETED" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setConfirmAction("reset")}
            className="rounded border border-orange-600 px-4 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50"
          >
            ↻ Re-process Recipe
          </button>
          <button
            onClick={() => setConfirmAction("delete")}
            className="rounded border border-red-700 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            🗑 Delete Recipe
          </button>
        </div>
      )}

      {/* Back button */}
      <button
        onClick={() => navigate({ to: "/recipes" })}
        className="mt-4 rounded border border-[var(--border)] bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50"
      >
        ← Back to Recipes
      </button>

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-xl">
            {confirmAction === "delete" && (
              <>
                <h3
                  className="mb-2 text-xl font-bold"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Delete Recipe?
                </h3>
                <p className="mb-6 text-[var(--text-secondary)]">
                  This will permanently remove "{ext?.recipeName}". This action cannot be undone.
                </p>
              </>
            )}
            {confirmAction === "reset" && (
              <>
                <h3
                  className="mb-2 text-xl font-bold"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Re-process Recipe?
                </h3>
                <p className="mb-6 text-[var(--text-secondary)]">
                  This will reset "{ext?.recipeName}" to pending so it gets re-processed from the source URL. The current extracted data will be cleared.
                </p>
              </>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="rounded border border-[var(--border)] bg-white px-4 py-2 text-sm transition-colors hover:bg-gray-50">
                Cancel
              </button>
              {confirmAction === "delete" && (
                <button onClick={handleDelete} className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                  Delete
                </button>
              )}
              {confirmAction === "reset" && (
                <button onClick={handleReset} className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                  Re-process
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
