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

export async function submitRecipe(url: string): Promise<{ jobId: string }> {
  const res = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`Failed to submit: ${res.statusText}`);
  return res.json();
}

export async function listRecipes(status?: string): Promise<Job[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`/api/recipes${params}`);
  if (!res.ok) throw new Error(`Failed to load recipes: ${res.statusText}`);
  return (await res.json()).recipes;
}

export async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`);
}
