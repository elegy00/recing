import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { listRecipes, deleteRecipe, retryRecipe } from "../api/server-functions";
import type { Job } from "../types";

type FilterKey = "all" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

const allFilters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "FAILED", label: "Failed" },
];

function statusBadgeClass(status: string): string {
  const base = "rounded-full px-2.5 py-[3px] text-xs font-medium uppercase tracking-wide";
  switch (status) {
    case "COMPLETED": return `${base} bg-green-100 text-green-700`;
    case "PENDING": return `${base} bg-orange-100 text-orange-600`;
    case "PROCESSING": return `${base} bg-blue-100 text-blue-600`;
    case "FAILED": return `${base} bg-red-100 text-red-700`;
    default: return base;
  }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
      const data = (await (listRecipes as any)({ data: { status: statusParam } })) as { recipes: Job[] };
      setJobs(data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecipes(); }, [filter]);

  async function handleDelete(id: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
      await (deleteRecipe as any)({ data: { id } });
      setJobs((prev) => prev.filter((j) => j._id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function handleRetry(id: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- server fn with strict: false
      await (retryRecipe as any)({ data: { id } });
      setJobs((prev) =>
        prev.map((j) =>
          j._id === id ? { ...j, status: "PENDING", result: null, error: null } : j
        )
      );
    } catch (err) {
      console.error("Retry failed:", err);
    }
  }

  function renderCard(job: Job) {
    const ext = job.result ?? null;

    // Completed valid recipe → clickable link to detail page with actions
    if (job.status === "COMPLETED" && ext?.recipeName) {
      return (
        <div key={job._id} className="relative">
          <Link
            to="/recipes/$id"
            params={{ id: job._id }}
            className="block rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-sm transition-colors duration-150 hover:border-[var(--accent)] hover:shadow-md cursor-pointer no-underline text-inherit"
          >
            {(ext.prepTime || ext.cookTime) && (
              <div className="mb-3 text-xs text-[var(--text-secondary)]">
                {ext.prepTime && <>Prep: {ext.prepTime} · </>}
                {ext.cookTime && <>Cook: {ext.cookTime}</>}
              </div>
            )}
            <h3 className="mb-1 text-xl font-bold" style={{ fontFamily: "'EB Garamond', Georgia, serif", wordBreak: "break-word" }}>
              {ext.recipeName}
            </h3>
            <p className="mt-2 break-all text-xs text-[var(--text-secondary)]">
              {new URL(job.url).hostname}
            </p>
          </Link>
          {/* Action buttons */}
          <div className="absolute right-4 top-4 flex gap-1">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRetry(job._id); }}
              title="Re-process recipe from source URL"
              className="rounded p-[2px] text-lg leading-none transition-colors hover:bg-red-50 hover:text-[var(--accent)]"
            >
              ↻
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(job._id); }}
              title="Delete this recipe"
              className="rounded p-[2px] text-lg leading-none transition-colors hover:bg-red-50 hover:text-[var(--accent)]"
            >
              ×
            </button>
          </div>
        </div>
      );
    }

    // Non-completed / invalid → show as-is with delete button
    return (
      <div key={job._id} className="relative rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-sm">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            onClick={() => handleDelete(job._id)}
            title="Delete"
            className="rounded p-[2px] text-lg leading-none transition-colors hover:bg-red-50 hover:text-[var(--accent)]"
          >
            ×
          </button>
          <span className={statusBadgeClass(job.status)}>{job.status}</span>
        </div>

        {ext?.recipeName ? (
          <>
            <h3 className="mb-1 text-xl font-bold" style={{ fontFamily: "'EB Garamond', Georgia, serif", wordBreak: "break-word" }}>
              {ext.recipeName}
            </h3>
            <p className="mt-2 break-all text-xs text-[var(--text-secondary)]">
              {new URL(job.url).hostname}
            </p>
          </>
        ) : (
          <p className="break-all text-xs text-[var(--text-secondary)]">{job.url}</p>
        )}

        {ext && ext.ingredients.length > 0 && ext.instructions.length > 0 && (
          <>
            <ul className="my-3 ml-5 list-disc space-y-1 text-sm">
              {ext.ingredients.slice(0, 5).map((ing, i) => (
                <li key={i}>{ing.name || ing.originalText}</li>
              ))}
            </ul>
            <ol className="mb-2 ml-5 list-decimal space-y-1 text-sm">
              {ext.instructions.slice(0, 3).map((step) => (
                <li key={step.stepNumber}>{step.text}</li>
              ))}
            </ol>
          </>
        )}

        <div className="mt-3 flex items-center gap-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-secondary)]">
          <span>{new Date(job.createdAt).toLocaleDateString()}</span>
          {job.error && <span className="text-red-600">Error: {job.error}</span>}
        </div>

        {job.status === "FAILED" && (
          <button
            onClick={() => handleRetry(job._id)}
            title="Reset this recipe to pending so the worker re-processes it"
            className="mt-3 inline-flex items-center gap-1.5 rounded border border-orange-600 bg-white px-4 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-600 hover:text-white"
          >
            ↻ Reset to Pending
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1
        className="mb-3 text-3xl font-bold"
        style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
      >
        RECIPES
      </h1>
      <p className="mb-8 max-w-xl text-[var(--text-secondary)] leading-relaxed">
        All extracted recipes from submitted URLs.
      </p>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap gap-2">
        {allFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              filter === f.key
                ? "border-[var(--accent)] bg-red-50 font-medium text-[var(--accent)]"
                : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:border-[#c0beb8] hover:text-[var(--text-primary)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-[var(--text-secondary)]">
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)] align-middle" />
          Loading...
        </p>
      )}

      {/* Error */}
      {!loading && error && <p className="text-red-600">Error: {error}</p>}

      {/* Empty state */}
      {!loading && !error && jobs.length === 0 && (
        <div className="py-20 text-center text-[var(--text-secondary)]">
          No recipes found. {filter !== "all" ? "Try a different filter." : 'Submit a URL to get started.'}
        </div>
      )}

      {/* Recipe grid */}
      {!loading && !error && jobs.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {jobs.map(renderCard)}
        </div>
      )}
    </div>
  );
}
