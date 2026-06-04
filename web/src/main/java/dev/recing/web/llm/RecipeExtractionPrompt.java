package dev.recing.web.llm;

/** Prompt templates for recipe extraction. */
public final class RecipeExtractionPrompt {

    private RecipeExtractionPrompt() {}

    public static final String PROMPT_VERSION = "recipe_extraction_prompt.v1";
    public static final String SCHEMA_VERSION = "recipe_extraction.v1";

    /** System prompt defining extraction rules and constraints. */
    public static String systemPrompt(String schemaVersion) {
        return """
            You are a recipe extraction assistant. Extract structured recipe data from the provided page content.
            
            Rules:
            1. Return ONLY valid JSON matching this schema version: %s — no markdown, no explanation text, no surrounding code fences.
            2. Do NOT invent or guess any information. If data is not present in the page, use null (objects/strings) or empty lists (arrays).
            3. Ingredients should stay close to the page wording — split quantity, unit, name, and note when possible, but always include originalText.
            4. Instructions must be ordered with stepNumber starting at 1 and incrementing by 1.
            5. If the page does not contain a recognizable recipe (e.g., it is a blog about cooking equipment), set status to "unusable" and explain why in unusableReason.
            6. For valid recipes, set status to "extracted". A valid extraction requires at least one ingredient and one instruction plus a recipeName.
            
            Response format:
            {
              "schemaVersion": "%s",
              "status": "extracted" | "unusable",
              "recipeName": string,
              "description": string (optional),
              "prepTime": string (optional, e.g. "15 minutes"),
              "cookTime": string (optional),
              "totalTime": string (optional),
              "servings": string (optional),
              "cuisine": string (optional),
              "category": string (optional),
              "keywords": string (optional),
              "ingredients": [{"quantity": string, "unit": string, "name": string, "note": string, "originalText": string}],
              "instructions": [{"stepNumber": number, "text": string}],
              "unusableReason": string (only when status is "unusable")
            }""".formatted(schemaVersion, schemaVersion);
    }

    /** User message template with source content. */
    public static String userPrompt(String url, String contentType, boolean truncated, String title, String content) {
        StringBuilder sb = new StringBuilder();
        sb.append("Source URL: ").append(url).append('\n');
        if (title != null && !title.isBlank()) {
            sb.append("Page Title: ").append(title).append('\n');
        }
        sb.append("Content-Type: ").append(contentType).append('\n');
        sb.append("Truncated: ").append(truncated).append("\n\n");
        sb.append(content);
        return sb.toString();
    }

    /** JSON-LD script tag regex to preserve during content reduction. */
    public static final String RECIPE_JSONLD_PATTERN = "<script[^>]*type\\s*=\\s*\"application/ld\\+json\"[^>]*>.*?</script>";
}
