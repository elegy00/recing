import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRecipe, deleteRecipe, retryRecipe } from "../api";
import type { Job } from "../api";

type ViewMode = "detail" | "cook";

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
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
        setJob(await getRecipe(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipe");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Extraction data (stored directly on result in MongoDB)
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
      await deleteRecipe(id!);
      navigate("/recipes", { replace: true });
    } catch (err) {
      console.error("Delete failed:", err);
      setConfirmAction(null);
    }
  }

  async function handleReset() {
    try {
      await retryRecipe(id!);
      // Update local state to reflect the reset
      setJob((prev) => prev ? { ...prev, status: "PENDING", result: null, error: null } : null);
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
      <div className="container">
        <p style={{ color: "var(--text-secondary)" }}>
          <span className="loading-spinner" /> Loading recipe...
        </p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container">
        <h1 className="page-title">Recipe Not Found</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          {error || "This recipe could not be found."}
        </p>
        <button onClick={() => navigate("/recipes")} className="btn btn-primary">
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
      <div className="container">
        {/* Cook header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <button onClick={exitCooking} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 14 }}>
            ← Exit Cook Mode
          </button>
          <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{progressPct}%</span>
        </div>

        {/* Progress bar */}
        <div style={{ background: "var(--border)", borderRadius: 999, height: 6, marginBottom: 32 }}>
          <div style={{ background: "var(--accent)", borderRadius: 999, height: 6, width: `${progressPct}%`, transition: "width .3s" }} />
        </div>

        {/* Step card */}
        <div className="recipe-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".5px" }}>Step {currentStep + 1} of {total}</span>
            {step?.timer && (
              <span className="badge badge-completed">⏱ {step.timer}</span>
            )}
          </div>
          <p style={{ fontSize: 20, lineHeight: 1.6 }}>{step.text}</p>
        </div>

        {/* Ingredient checklist */}
        <h3 style={{ marginBottom: 12, fontFamily: "'EB Garamond',Georgia,serif", fontSize: 20 }}>Ingredients for this step</h3>
        {(ext?.ingredients ?? []).map((ing, idx) => (
          <label
            key={idx}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", color: checkedIngredients.has(idx) ? "var(--text-secondary)" : "var(--text-primary)", textDecoration: checkedIngredients.has(idx) ? "line-through" : "none", transition: "color .15s" }}
          >
            <input type="checkbox" checked={checkedIngredients.has(idx)} onChange={() => toggleIngredient(idx)} style={{ accentColor: "var(--accent)" }} />
            <span>{ing.quantity && `${ing.quantity} `}{ing.unit && `${ing.unit} `}{ing.name}</span>
          </label>
        ))}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <button disabled={!hasPrev()} onClick={() => setCurrentStep((s) => s - 1)} className="btn" style={{ opacity: hasPrev() ? 1 : 0.4, cursor: hasPrev() ? "pointer" : "not-allowed" }}>
            ← Previous
          </button>
          <span style={{ color: "var(--text-secondary)", alignSelf: "center", fontSize: 14 }}>{currentStep + 1} / {total}</span>
          {hasNext() ? (
            <button onClick={() => setCurrentStep((s) => s + 1)} className="btn btn-primary">Next Step →</button>
          ) : (
            <button onClick={exitCooking} className="btn btn-primary" style={{ background: "#2e7d32" }}>✓ Finished!</button>
          )}
        </div>
      </div>
    );
  }

  // ─── Normal detail view ──────────────────────────────────────────────────
  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">{ext?.recipeName}</h1>
          {ext?.description && (
            <p className="page-desc">{ext.description}</p>
          )}
        </div>
        <button onClick={startCooking} className="btn btn-primary" style={{ fontSize: 16, padding: "12px 32px" }}>
          🍳 Start Cooking
        </button>
      </div>

      {/* Meta info */}
      {(ext?.prepTime || ext?.cookTime || ext?.totalTime || ext?.servings) && (
        <div style={{ display: "flex", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
          {ext.prepTime && <span>🥄 Prep: {ext.prepTime}</span>}
          {ext.cookTime && <span>🔥 Cook: {ext.cookTime}</span>}
          {ext.totalTime && <span>⏱ Total: {ext.totalTime}</span>}
          {ext.servings && <span>🍽 Serves: {ext.servings}</span>}
        </div>
      )}

      {/* Ingredients */}
      <h2 style={{ fontFamily: "'EB Garamond',Georgia,serif", fontSize: 24, marginBottom: 16 }}>Ingredients</h2>
      <ul style={{ listStyle: "none", margin: "0 0 32px" }}>
        {(ext?.ingredients ?? []).map((ing, idx) => (
          <li key={idx} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 15 }}>
            {ing.quantity && <strong>{ing.quantity}</strong>}{" "}
            {ing.unit && <em>{ing.unit}</em>}{" "}
            {ing.name}
            {ing.note && <span style={{ color: "var(--text-secondary)" }}> — {ing.note}</span>}
          </li>
        ))}
      </ul>

      {/* Instructions */}
      <h2 style={{ fontFamily: "'EB Garamond',Georgia,serif", fontSize: 24, marginBottom: 16 }}>Instructions</h2>
      <ol style={{ margin: "0 0 32px", paddingLeft: 24 }}>
        {(ext?.instructions ?? []).map((step) => (
          <li key={step.stepNumber} style={{ padding: "8px 0", lineHeight: 1.6, fontSize: 15 }}>
            {step.text}{step.timer && <span className="badge badge-completed" style={{ position: "static", marginLeft: 8, fontSize: 11 }}>{step.timer}</span>}
          </li>
        ))}
      </ol>

      {/* Source */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <p className="recipe-meta">
          {ext?.sourceUrl && (
            <a href={ext.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
              Source URL →
            </a>
          )}
          <span>{new Date(job.createdAt).toLocaleDateString()}</span>
        </p>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        {job.status === "COMPLETED" && (
          <>
            <button onClick={() => setConfirmAction("reset")} className="btn" style={{ border: "1px solid #e65100", color: "#e65100", fontSize: 14 }}>
              ↻ Re-process Recipe
            </button>
            <button onClick={() => setConfirmAction("delete")} className="btn" style={{ border: "1px solid #c62828", color: "#c62828", fontSize: 14 }}>
              🗑 Delete Recipe
            </button>
          </>
        )}
      </div>

      {/* Back button */}
      <button onClick={() => navigate("/recipes")} style={{ marginTop: 16, background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 14 }}>
        ← Back to Recipes
      </button>

      {/* Confirmation modal */}
      {confirmAction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="recipe-card" style={{ maxWidth: 400, padding: 24 }}>
            {confirmAction === "delete" && (
              <>
                <h3 style={{ margin: "0 0 8px", fontFamily: "'EB Garamond',Georgia,serif" }}>Delete Recipe?</h3>
                <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                  This will permanently remove "{ext?.recipeName}". This action cannot be undone.
                </p>
              </>
            )}
            {confirmAction === "reset" && (
              <>
                <h3 style={{ margin: "0 0 8px", fontFamily: "'EB Garamond',Georgia,serif" }}>Re-process Recipe?</h3>
                <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                  This will reset "{ext?.recipeName}" to pending so it gets re-processed from the source URL. The current extracted data will be cleared.
                </p>
              </>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmAction(null)} className="btn">Cancel</button>
              {confirmAction === "delete" && (
                <button onClick={handleDelete} className="btn btn-primary" style={{ background: "#c62828" }}>Delete</button>
              )}
              {confirmAction === "reset" && (
                <button onClick={handleReset} className="btn btn-primary">Re-process</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
