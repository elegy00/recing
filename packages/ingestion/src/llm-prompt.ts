/**
 * Prompt templates for recipe extraction, ported from RecipeExtractionPrompt.java.
 */

export const PROMPT_VERSION = "recipe_extraction_prompt.v1" as const;
export const SCHEMA_VERSION = "recipe_extraction.v1" as const;

/** Regex for JSON-LD script tags to preserve during content reduction. */
export const RECIPE_JSONLD_PATTERN =
  '<script[^>]*type\\s*=\\s*"application/ld\\+json"[^>]*>.*?</script>';

/** System prompt defining extraction rules and constraints. */
export function buildSystemPrompt(schemaVersion: string): string {
  return [
    "/no_think",
    "You are a recipe extraction assistant. Extract structured recipe data from the provided page content.",
    "",
    "Rules:",
    "1. Return ONLY one valid JSON object matching this schema version: " +
      schemaVersion +
      " — no markdown, no explanation text, no filenames, no surrounding code fences.",
    "2. Do not output filenames like result.json. The response body must be the JSON object itself.",
    '3. Do NOT invent or guess any information. If data is not present in the page, use null (objects/strings) or empty lists (arrays).',
    "4. Ingredients should stay close to the page wording — split quantity, unit, name, and note when possible, but always include originalText.",
    "5. Instructions must be ordered with stepNumber starting at 1 and incrementing by 1.",
    '6. If the page does not contain a recognizable recipe (e.g., it is a blog about cooking equipment), set status to "unusable" and explain why in unusableReason.',
    `7. For valid recipes, set status to "extracted". A valid extraction requires at least one ingredient and one instruction plus a recipeName.`,
  ].join("\n");
}

/** User message template with source content. */
export function buildUserPrompt(
  url: string,
  contentType: string,
  truncated: boolean,
  title: string | null | undefined,
  content: string
): string {
  const parts = [
    "/no_think",
    "Return only the JSON object. Do not include markdown, filenames, explanations, or code fences.",
    `Source URL: ${url}`,
  ];

  if (title && title.trim()) {
    parts.push(`Page Title: ${title}`);
  }

  parts.push(
    `Content-Type: ${contentType}`,
    `Truncated: ${truncated}`,
    "",
    content,
  );

  return parts.join("\n");
}
