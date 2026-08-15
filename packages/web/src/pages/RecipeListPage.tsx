import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listRecipes, deleteRecipe, retryRecipe } from "../api";
import type { Job } from "../api";

type FilterKey = "all" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

const allFilters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "FAILED", label: "Failed" },
];

function statusClass(status: string): string {
  return `badge badge-${status.toLowerCase()}`;
}

export default function RecipeListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecipes() {
    try {
      setLoading(true);
      setError(null);
      const statusParam = filter === "all" ? undefined : filter;
      setJobs(await listRecipes(statusParam));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecipes(); }, [filter]);

  async function handleDelete(id: string) {
    try {
      await deleteRecipe(id);
      setJobs((prev) => prev.filter((j) => j._id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function handleRetry(id: string) {
    try {
      await retryRecipe(id);
      setJobs((prev) => prev.map((j) => j._id === id ? { ...j, status: "PENDING", result: null, error: null } : j));
    } catch (err) {
      console.error("Retry failed:", err);
    }
  }

  function renderCard(job: Job) {
    const ext = job.result ?? null;

    // Completed valid recipe → clickable link to detail page
    if (job.status === "COMPLETED" && ext?.recipeName) {
      return (
        <Link key={job._id} to={`/recipes/${job._id}`} className="recipe-card-link">
          <div className="recipe-card">
            {ext.prepTime || ext.cookTime ? (
              <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                {ext.prepTime && <>Prep: {ext.prepTime} · </>}
                {ext.cookTime && <>Cook: {ext.cookTime}</>}
              </div>
            ) : null}
            <h3 className="recipe-name">{ext.recipeName}</h3>
            <p className="recipe-url" title={job.url}>{new URL(job.url).hostname}</p>
          </div>
        </Link>
      );
    }

    // Non-completed / invalid → show as-is with delete button
    return (
      <div key={job._id} className="recipe-card">
        <span className={statusClass(job.status)}>{job.status}</span>
        <button className="delete-btn" onClick={() => handleDelete(job._id)} title="Delete">×</button>

        {ext?.recipeName ? (
          <>
            <h3 className="recipe-name">{ext.recipeName}</h3>
            <p className="recipe-url" title={job.url}>{new URL(job.url).hostname}</p>
          </>
        ) : (
          <p className="recipe-url">{job.url}</p>
        )}

        {ext && ext.ingredients.length > 0 && ext.instructions.length > 0 && (
          <>
            <ul style={{ margin:"12px 0 8px", paddingLeft:20, fontSize:14 }}>
              {ext.ingredients.slice(0, 5).map((ing, i) => (
                <li key={i} style={{ marginBottom:3 }}>{ing.name || ing.originalText}</li>
              ))}
            </ul>
            <ol style={{ margin:"8px 0", paddingLeft:20, fontSize:14 }}>
              {ext.instructions.slice(0, 3).map((step) => (
                <li key={step.stepNumber} style={{ marginBottom:3 }}>{step.text}</li>
              ))}
            </ol>
          </>
        )}

        <div className="recipe-meta">
          <span>{new Date(job.createdAt).toLocaleDateString()}</span>
          {job.error && <span style={{ color:"#c62828" }}>Error: {job.error}</span>}
        </div>

        {job.status === "FAILED" && (
          <button className="reset-btn" onClick={() => handleRetry(job._id)} title="Reset this recipe to pending so the worker re-processes it">
            ↻ Reset to Pending
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="page-title">RECIPES</h1>
      <p className="page-desc">All extracted recipes from submitted URLs.</p>

      <div className="filters">
        {allFilters.map((f) => (
          <button
            key={f.key}
            className={`filter-btn ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color:"var(--text-secondary)" }}><span className="loading-spinner" /> Loading...</p>}
      {!loading && error && <p style={{ color:"#c62828" }}>Error: {error}</p>}

      {!loading && !error && jobs.length === 0 && (
        <div className="empty-state">No recipes found. {filter !== "all" ? "Try a different filter." : 'Submit a URL to get started.'}</div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="recipe-grid">{jobs.map(renderCard)}</div>
      )}
    </div>
  );
}
