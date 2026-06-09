import { z } from "zod";
import { ZodValidationError } from "./zod-helpers.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Transform nullish string to always be string | null (never undefined). */
const nullString = (schema: z.ZodType<string>) =>
  schema.nullish().transform((v) => v ?? null);

// ─── Ingredient ──────────────────────────────────────────────────────────────

const ingredientSchema = z.object({
  quantity: nullString(z.string()),
  unit: nullString(z.string()),
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

/** Base schema for all recipe extractions. */
const baseSchema = z.object({
  schemaVersion: z.literal(RECIPE_SCHEMA_VERSION),
  status: z.enum(["extracted", "unusable"]),
  sourceUrl: z.string().url(),
  recipeName: nullString(z.string()),
  description: nullString(z.string()),
  prepTime: nullString(z.string()),
  cookTime: nullString(z.string()),
  totalTime: nullString(z.string()),
  servings: nullString(z.string()),
  cuisine: nullString(z.string()),
  category: nullString(z.string()),
  keywords: nullString(z.string()),
  ingredients: ingredientSchema.array(),
  instructions: instructionSchema.array(),
  notes: z.array(z.string().min(1)),
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
  keywords: string | null;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  notes: string[];
  unusableReason: string | null;
}

/** Validates raw data against the JSON schema rules, or throws on failure. */
export function parseRecipeExtraction(raw: unknown): RecipeExtraction {
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ZodValidationError(parsed.error);
  }
  const data = parsed.data;

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
    if (data.recipeName !== null || !data.unusableReason) {
      throw new ZodValidationError(
        "Invalid state: status=unusable requires no recipeName and a reason"
      );
    }
  }

  return data;
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
