export interface RecipeResult {
  schemaVersion?: string | null;
  status?: string | null;
  sourceUrl?: string | null;
  recipeName?: string | null;
  description?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  servings?: string | null;
  cuisine?: string | null;
  category?: string | null;
  keywords?: string | null;
  ingredients: Array<{
    quantity?: string | null;
    unit?: string | null;
    name: string;
    note?: string | null;
    originalText?: string;
  }>;
  instructions: Array<{
    stepNumber: number;
    text: string;
    timer?: string | null;
  }>;
  notes: string[];
  unusableReason?: string | null;
}

export interface Job {
  _id: string;
  url: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  createdAt: string;
  updatedAt: string;
  result: RecipeResult | null;
  error?: string | null;
}

/** Read the API key from a meta tag injected by the server (or env var in dev). */
function getApiKey(): string | undefined {
  const meta = document.querySelector<HTMLMetaElement>("meta[name='recing-api-key']");
  if (meta?.content) return meta.content;
  // Dev fallback: check for a global set by the server
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (globalThis as any).__RECING_API_KEY === "string" ? (globalThis as any).__RECING_API_KEY : undefined;
}

let _cachedKey: string | null = null; // null = not yet checked, "" = none found
function getCachedApiKey(): string | undefined {
  if (_cachedKey === null) _cachedKey = getApiKey() ?? "";
  return _cachedKey || undefined;
}

async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const apiKey = getCachedApiKey();
  const headers = new Headers(init?.headers);
  if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
  return fetch(input, { ...init, headers });
}

export async function submitRecipe(url: string): Promise<{ jobId: string }> {
  const res = await authenticatedFetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Failed to submit: ${res.statusText}`);
  return res.json();
}

export async function listRecipes(status?: string): Promise<Job[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authenticatedFetch(`/api/recipes${params}`);
  if (!res.ok) throw new Error(`Failed to load recipes: ${res.statusText}`);
  return (await res.json()).recipes;
}

export async function getRecipe(id: string): Promise<Job> {
  const res = await authenticatedFetch(`/api/recipes/${id}`);
  if (!res.ok) throw new Error(`Failed to load recipe: ${res.statusText}`);
  return (await res.json()).recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const res = await authenticatedFetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`);
}

/** Move a FAILED job back to PENDING so it gets re-processed. */
export async function retryRecipe(id: string): Promise<void> {
  const res = await authenticatedFetch(`/api/recipes/${id}/retry`, { method: "PATCH" });
  if (!res.ok) throw new Error(`Failed to retry: ${res.statusText}`);
}
