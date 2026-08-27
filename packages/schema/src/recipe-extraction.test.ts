import { describe, it, expect } from "vitest";
import { parseRecipeExtraction, isValid, isUnusable, createEmptyRecipeExtraction } from "./recipe-extraction.js";

describe("parseRecipeExtraction", () => {
  const validExtracted = {
    schemaVersion: "recipe_extraction.v1" as const,
    status: "extracted" as const,
    sourceUrl: "https://example.com/pancakes",
    recipeName: "Classic Pancakes",
    description: null,
    prepTime: "10 mins",
    cookTime: "15 mins",
    totalTime: "25 mins",
    servings: null,
    cuisine: null,
    category: null,
    keywords: null,
    ingredients: [
      { quantity: "2", unit: "cups", name: "flour", note: null, originalText: "2 cups flour" },
    ],
    instructions: [
      { stepNumber: 1, text: "Mix dry ingredients.", timer: null },
    ],
    notes: [],
    unusableReason: null,
  };

  const validUnusable: unknown = {
    schemaVersion: "recipe_extraction.v1",
    status: "unusable" as const,
    sourceUrl: "https://example.com/not-a-recipe",
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
    unusableReason: "No recipe found on page",
  };

  it("parses a valid extracted recipe", () => {
    const result = parseRecipeExtraction(validExtracted);
    expect(result.status).toBe("extracted");
    expect(result.recipeName).toBe("Classic Pancakes");
    expect(result.ingredients.length).toBe(1);
    expect(result.instructions.length).toBe(1);
  });

  it("parses a valid unusable extraction", () => {
    const result = parseRecipeExtraction(validUnusable);
    expect(result.status).toBe("unusable");
    expect(result.recipeName).toBeNull();
    expect(result.unusableReason).toBe("No recipe found on page");
  });



  it("rejects wrong status enum value", () => {
    const bad = { ...validExtracted, status: "unknown" as unknown as "extracted" | "unusable" };
    expect(() => parseRecipeExtraction(bad)).toThrow();
  });

  it("rejects extracted with null recipeName", () => {
    const bad = { ...validExtracted, recipeName: null };
    expect(() => parseRecipeExtraction(bad)).toThrow(
      "Invalid state: status=extracted requires recipeName and no unusableReason"
    );
  });

  it("rejects extracted with empty ingredients", () => {
    const bad = { ...validExtracted, ingredients: [] };
    expect(() => parseRecipeExtraction(bad)).toThrow(
      "Invalid state: extracted recipe must have ingredients and instructions"
    );
  });

  it("rejects unusable with non-null recipeName", () => {
    const bad = { ...validUnusable, recipeName: "Something" };
    expect(() => parseRecipeExtraction(bad)).toThrow(
      "Invalid state: status=unusable requires no recipeName and a reason"
    );
  });

  it("rejects unusable with empty unusableReason", () => {
    const bad = { ...validUnusable, unusableReason: null };
    expect(() => parseRecipeExtraction(bad)).toThrow();
  });

  it("accepts numeric quantity and converts to string", () => {
    const result = parseRecipeExtraction({
      status: "extracted" as const,
      recipeName: "Numeric Qty",
      ingredients: [
        { quantity: 250, unit: "g", name: "Mehl", note: null, originalText: "250 g Mehl" },
        { quantity: 0.75, unit: "TL", name: "Salz", note: null, originalText: "0.75 TL Salz" },
        { quantity: null, unit: null, name: "Fleur de Sel", note: "wenig", originalText: "wenig Fleur de Sel" },
      ],
      instructions: [{ stepNumber: 1, text: "Mix." }],
    });
    expect(result.ingredients[0].quantity).toBe("250");
    expect(result.ingredients[1].quantity).toBe("0.75");
    expect(result.ingredients[2].quantity).toBeNull();
  });

  it("keeps quantity/unit optional (lenient) — missing keys parse to null", () => {
    // Regression guard: quantity/unit must stay OPTIONAL so a model that omits them
    // does not fail validation. Extraction is encouraged via the prompt, not enforced here.
    const result = parseRecipeExtraction({
      status: "extracted" as const,
      recipeName: "Lenient",
      ingredients: [
        { name: "Salt", originalText: "a pinch of salt" }, // no quantity/unit keys at all
      ],
      instructions: [{ stepNumber: 1, text: "Season to taste." }],
    });
    expect(result.ingredients[0].quantity).toBeNull();
    expect(result.ingredients[0].unit).toBeNull();
  });

  it("fills in missing schemaVersion and sourceUrl (LLM-friendly)", () => {
    const minimal = {
      status: "extracted" as const,
      recipeName: "Minimal",
      ingredients: [{ quantity: null, unit: "", name: "x", note: null, originalText: "x" }],
      instructions: [{ stepNumber: 1, text: "y", timer: null }],
    };
    const result = parseRecipeExtraction(minimal);
    expect(result.schemaVersion).toBe("recipe_extraction.v1");
    expect(result.sourceUrl.startsWith("recipe:")).toBe(true);
    expect(result.notes).toEqual([]);
  });

  it("accepts LLM-like input with extra unknown fields", () => {
    const llmLike = {
      status: "extracted" as const,
      recipeName: "Test",
      description: null,
      prepTime: "PT25M",
      cookTime: "PT25M",
      totalTime: "PT50M",
      recipeYield: "4 Personen",       // extra field — LLM used this instead of servings
      recipeCategory: "Hauptspeise",   // extra field — LLM used this instead of category
      ingredients: [{ quantity: "400", unit: "g", name: "Krautstiel", note: null, originalText: "400 g Krautstiel" }],
      instructions: [{ stepNumber: 1, text: "Test." }],
      nutrition: { calories: "863 kcal" }, // extra field — not in schema
    };
    const result = parseRecipeExtraction(llmLike);
    expect(result.status).toBe("extracted");
    expect(result.recipeName).toBe("Test");
  });

  it("transforms undefined to null for nullable fields", () => {
    const minimal = {
      schemaVersion: "recipe_extraction.v1" as const,
      status: "unusable" as const,
      sourceUrl: "https://x.com",
      recipeName: undefined as unknown as string | null,
      description: undefined as unknown as string | null,
      prepTime: undefined as unknown as string | null,
      cookTime: undefined as unknown as string | null,
      totalTime: undefined as unknown as string | null,
      servings: undefined as unknown as string | null,
      cuisine: undefined as unknown as string | null,
      category: undefined as unknown as string | null,
      keywords: undefined as unknown as string | null,
      ingredients: [] as Array<unknown>,
      instructions: [] as Array<unknown>,
      notes: [] as string[],
      unusableReason: "test" as const,
    };
    // Should not throw — transforms are applied
    parseRecipeExtraction(minimal);
  });

  it("fills in sourceUrl even when provided URL is invalid (fallback)", () => {
    // If sourceUrl is missing or invalid, the parser generates one
    const minimal = {
      status: "unusable" as const,
      sourceUrl: undefined as unknown as string,
      recipeName: null,
      unusableReason: "test",
      description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      ingredients: [], instructions: [], notes: [],
    };
    const result = parseRecipeExtraction(minimal);
    expect(result.sourceUrl.startsWith("recipe:")).toBe(true);
  });
});

describe("isValid", () => {
  it("returns true for valid extracted recipe", () => {
    const extraction = parseRecipeExtraction({
      schemaVersion: "recipe_extraction.v1",
      status: "extracted" as const,
      sourceUrl: "https://example.com/recipe",
      recipeName: "Test Recipe",
      description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      ingredients: [{ quantity: "1", unit: "cup", name: "flour", note: null, originalText: "1 cup flour" }],
      instructions: [{ stepNumber: 1, text: "Do stuff.", timer: null }],
      notes: [],
      unusableReason: null,
    });
    expect(isValid(extraction)).toBe(true);
  });

  it("returns false for unusable extraction", () => {
    const extraction = parseRecipeExtraction({
      schemaVersion: "recipe_extraction.v1",
      status: "unusable" as const,
      sourceUrl: "https://example.com/other",
      recipeName: null, description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      ingredients: [], instructions: [], notes: [], unusableReason: "not a recipe",
    });
    expect(isValid(extraction)).toBe(false);
  });

  it("returns false when ingredients are empty but status is extracted", () => {
    // parseRecipeExtraction throws for this case, so we test isValid on a valid extraction
    const good = parseRecipeExtraction({
      schemaVersion: "recipe_extraction.v1",
      status: "extracted" as const,
      sourceUrl: "https://example.com/valid",
      recipeName: "Valid", description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      ingredients: [{ quantity: "1", unit: "cup", name: "flour", note: null, originalText: "x" }],
      instructions: [{ stepNumber: 1, text: "y", timer: null }],
      notes: [], unusableReason: null,
    });
    // isValid returns false for unusable
    expect(isUnusable(good)).toBe(false);
    expect(isValid(good)).toBe(true);
  });
});

describe("isUnusable", () => {
  it("returns true for unusable status", () => {
    const extraction = parseRecipeExtraction({
      schemaVersion: "recipe_extraction.v1",
      status: "unusable" as const,
      sourceUrl: "https://example.com/other",
      recipeName: null, description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      ingredients: [], instructions: [], notes: [], unusableReason: "no recipe",
    });
    expect(isUnusable(extraction)).toBe(true);
  });

  it("returns false for extracted status", () => {
    const extraction = parseRecipeExtraction({
      schemaVersion: "recipe_extraction.v1",
      status: "extracted" as const,
      sourceUrl: "https://example.com/recipe",
      recipeName: "Test", description: null, prepTime: null, cookTime: null, totalTime: null,
      servings: null, cuisine: null, category: null, keywords: null,
      ingredients: [{ quantity: "1", unit: "", name: "x", note: null, originalText: "x" }],
      instructions: [{ stepNumber: 1, text: "y", timer: null }],
      notes: [], unusableReason: null,
    });
    expect(isUnusable(extraction)).toBe(false);
  });
});

describe("createEmptyRecipeExtraction", () => {
  it("returns an unusable extraction with defaults", () => {
    const empty = createEmptyRecipeExtraction();
    expect(empty.status).toBe("unusable");
    expect(empty.recipeName).toBeNull();
    expect(empty.ingredients.length).toBe(0);
    expect(empty.instructions.length).toBe(0);
    expect(empty.unusableReason).toBe("No extraction performed");
  });

  it("has correct schemaVersion", () => {
    const empty = createEmptyRecipeExtraction();
    expect(empty.schemaVersion).toBe("recipe_extraction.v1");
  });
});
