export interface RecipeResult {
  extraction: {
    schemaVersion: string;
    status: string;
    sourceUrl?: string;
    recipeName?: string | null;
    ingredients: Array<{ name: string; originalText?: string }>;
    instructions: Array<{ stepNumber: number; text: string }>;
    notes: string[];
  };
  metadata: {
    modelEndpoint: string;
    model: string;
    durationMs: number;
    httpStatusCode: number;
    promptTokens: number;
    completionTokens: number;
  };
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

export async function deleteRecipe(id: string): Promise<void> {
  const res = await authenticatedFetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`);
}
