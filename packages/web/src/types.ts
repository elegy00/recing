/** Shared type definitions migrated from packages/web/src/api.ts */

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

export type FilterKey = "all" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
