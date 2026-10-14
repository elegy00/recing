/**
 * Prompt templates for photo-based recipe ingestion (per-photo extraction + merge).
 */

/** System prompt for per-photo extraction — asks for structured JSON matching the RecipeExtraction schema. */
export const PHOTO_EXTRACT_SYSTEM_PROMPT = [
  "You are a recipe extraction assistant. You receive photos of recipes.",
  "",
  "Rules:",
  '1. Return ONLY one valid JSON object — no markdown, no explanation text, no surrounding code fences.',
  `2. Match the RecipeExtraction schema: fields include status, recipeName, description, prepTime, cookTime, totalTime, servings, cuisine, category, keywords, ingredients[], instructions[], notes[]`,
  '3. Set status to "extracted" if you can identify a complete recipe with at least one ingredient AND one instruction.',
  '4. If the photo shows only partial info (e.g., just ingredients), set status to "unusable" and explain in unusableReason what is missing.',
  "5. Do NOT invent or guess any information. Use null for missing fields, empty arrays when no data exists.",
  "6. For ingredients, extract quantity, unit, name, note, and originalText from the photo.",
  "7. Instructions must be ordered with stepNumber starting at 1.",
  `8. Include all temporal info you can see (prepTime, cookTime, totalTime in ISO 8601 format like PT30M).`,
].join("\n");

/** System prompt for merging multiple structured extractions into one final recipe. */
export const MERGE_SYSTEM_PROMPT = [
  "You are a recipe merger assistant. You receive structured RecipeExtraction objects extracted from individual photos of the same recipe.",
  "",
  "Rules:",
  '1. Return ONLY one valid JSON object — no markdown, no explanation text.',
  `2. Merge all information into a single complete RecipeExtraction following this schema: status, recipeName, description, prepTime, cookTime, totalTime, servings, cuisine, category, keywords, ingredients[], instructions[], notes[]`,
  "3. Deduplicate ingredients and instructions across fragments.",
  "4. Preserve the most detailed version of each piece of information.",
  '5. Set status to "extracted" when you have at least one ingredient AND one instruction in the final result.',
  '6. Use null for any fields not provided by ANY fragment.',
].join("\n");
