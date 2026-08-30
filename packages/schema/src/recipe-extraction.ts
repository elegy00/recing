import { z } from "zod";
import { ZodValidationError } from "./zod-helpers.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Transform nullish string to always be string | null (never undefined). */
const nullString = (schema: z.ZodType<string>) =>
  schema.nullish().transform((v) => v ?? null);

// ─── Ingredient ──────────────────────────────────────────────────────────────

/** Accept string or number for quantity; optional (null when the source has no amount).
 * Normalizes to string | null. Parsing stays lenient if the LLM omits it, but the prompt and
 * schema description instruct the model to fill it in whenever the source states an amount. */
const nullableQuantity = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v === undefined || v === null ? null : String(v)))
  .describe(
    'Amount of the ingredient as written in the source (e.g. "2", "300"). Extract it from originalText when present; use null only if the source gives no amount.'
  );

const ingredientSchema = z.object({
  quantity: nullableQuantity,
  unit: nullString(z.string()).describe(
    'Measure/unit of the ingredient as written in the source (e.g. "g", "cups", "dl"). Use null when there is none.'
  ),
  name: z.string().min(1),
  note: nullString(z.string()),
  originalText: z.string().min(1),
});

/** A single ingredient from a recipe extraction. */
export interface RecipeIngredient {
  quantity: string | null;
  unit: string | null;
  name: string;
  note: string | null;
  originalText: string;
}

// ─── Instruction ─────────────────────────────────────────────────────────────

const instructionSchema = z.object({
  stepNumber: z.number().int().min(1),
  text: z.string().min(1),
  timer: nullString(z.string()),
});

/** A single instruction step from a recipe extraction. */
export interface RecipeInstruction {
  stepNumber: number;
  text: string;
  timer?: string | null;
}

// ─── RecipeExtraction ────────────────────────────────────────────────────────

const RECIPE_SCHEMA_VERSION = "recipe_extraction.v1";

/** Base schema for all recipe extractions. Fields like schemaVersion, sourceUrl,
 * and notes are optional here because the LLM (without an embedded JSON Schema)
 * may omit them. Missing values are filled in by parseRecipeExtraction(). */
export const baseSchema = z.object({
  schemaVersion: nullString(z.literal(RECIPE_SCHEMA_VERSION)),
  status: z.enum(["extracted", "unusable"]),
  sourceUrl: nullString(z.string().url()),
  recipeName: nullString(z.string()),
  description: nullString(z.string()),
  prepTime: nullString(z.string()),
  cookTime: nullString(z.string()),
  totalTime: nullString(z.string()),
  servings: nullString(z.string()),
  cuisine: nullString(z.string()),
  category: nullString(z.string()),
  /** Keywords/tags — accept string (legacy), array of strings, or null. Normalized to string[] | null. */
  keywords: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional()
    .default(null)
    .transform((v) => {
      if (v === null || v === undefined) return null;
      return Array.isArray(v) ? v : [v];
    }),
  ingredients: ingredientSchema.array().optional().default([]),
  instructions: instructionSchema.array().optional().default([]),
  notes: z.array(z.string().min(1)).optional().default([]),
  unusableReason: nullString(z.string()),
});

/** Parsed recipe extraction from the LLM. */
export interface RecipeExtraction {
  schemaVersion: string;
  status: "extracted" | "unusable";
  sourceUrl: string;
  recipeName: string | null;
  description: string | null;
  prepTime: string | null;
  cookTime: string | null;
  totalTime: string | null;
  servings: string | null;
  cuisine: string | null;
  category: string | null;
  keywords: string[] | null;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  notes: string[];
  unusableReason: string | null;
}

/** Generates a simple deterministic ID from the raw input for fallback sourceUrl. */
function generateId(data: unknown): string {
  const hash = JSON.stringify(data ?? "").split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return `recipe:${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

/** Validates raw data against the JSON schema rules, or throws on failure. */
export function parseRecipeExtraction(raw: unknown): RecipeExtraction {
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ZodValidationError(parsed.error);
  }
  let data = parsed.data;

  // Fill in missing required-ish fields that the LLM may omit (no JSON Schema was sent)
  data = { ...data, schemaVersion: RECIPE_SCHEMA_VERSION };
  if (!data.sourceUrl) {
    data = { ...data, sourceUrl: generateId(raw) };
  }

  // Conditional validation (from JSON schema allOf/if-then)
  if (data.status === "extracted") {
    if (!data.recipeName || data.unusableReason !== null) {
      throw new ZodValidationError(
        "Invalid state: status=extracted requires recipeName and no unusableReason"
      );
    }
    if (data.ingredients.length < 1 || data.instructions.length < 1) {
      throw new ZodValidationError(
        "Invalid state: extracted recipe must have ingredients and instructions"
      );
    }
  }

  if (data.status === "unusable") {
    // Allow recipeName to be set (e.g., from Wikipedia page titles) — the key requirement
    // is that unusableReason explains why full extraction failed.
    if (!data.unusableReason) {
      throw new ZodValidationError(
        "Invalid state: status=unusable requires an unusableReason"
      );
    }
  }

  // After the transforms above, all required fields are guaranteed to be set.
  // TypeScript can't narrow this through reassignment, so we assert.
  return data as RecipeExtraction;
}

/** Returns true if this is a valid extracted recipe. */
export function isValid(extraction: RecipeExtraction): boolean {
  return (
    extraction.status === "extracted" &&
    !!extraction.recipeName &&
    extraction.ingredients.length > 0 &&
    extraction.instructions.length > 0
  );
}

/** Returns true if the page content was deemed unusable for extraction. */
export function isUnusable(extraction: RecipeExtraction): boolean {
  return extraction.status === "unusable";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create an empty/unusable extraction record (default starter). */
export function createEmptyRecipeExtraction(): RecipeExtraction {
  return {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    status: "unusable",
    sourceUrl: "",
    recipeName: null,
    description: null,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    servings: null,
    cuisine: null,
    category: null,
    keywords: null,
    ingredients: [],
    instructions: [],
    notes: [],
    unusableReason: "No extraction performed",
  };
}
