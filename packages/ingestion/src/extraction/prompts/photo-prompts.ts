/**
 * Prompt templates for photo-based recipe ingestion (per-photo transcription).
 * The merge phase does not need its own prompt — converting the aggregated
 * markdown to a RecipeExtraction reuses the URL ingestion prompts
 * (see recipe-extraction-prompt.ts).
 */

/** System prompt for per-photo transcription — asks for markdown, not JSON. */
export const PHOTO_TRANSCRIBE_SYSTEM_PROMPT = [
  "You are a recipe photo transcription assistant. You receive photos of recipes.",
  "",
  "Rules:",
  "1. Transcribe ALL visible text from the photo as clean Markdown. No JSON, no commentary, no explanations.",
  "2. Structure the text: use headings for sections (e.g. '# <title>', '## Ingredients', '## Instructions') and lists for ingredients and steps.",
  "3. Preserve quantities, units, times and wording exactly as written in the photo.",
  "4. Do NOT invent or guess any information that is not visible in the photo.",
  "5. If the photo contains no readable recipe text, reply with exactly: NO READABLE TEXT",
].join("\n");

/** User message for the per-photo transcription request. */
export const PHOTO_TRANSCRIBE_USER_TEXT =
  "Transcribe all visible text from this recipe photo as Markdown.";
