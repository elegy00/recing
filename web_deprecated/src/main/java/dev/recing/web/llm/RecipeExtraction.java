package dev.recing.web.llm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Parsed recipe extraction from the LLM. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RecipeExtraction(
    @JsonProperty("schemaVersion") String schemaVersion,
    String status,
    String recipeName,
    String description,
    String prepTime,
    String cookTime,
    String totalTime,
    String servings,
    String cuisine,
    String category,
    String keywords,
    java.util.List<RecipeIngredient> ingredients,
    java.util.List<RecipeInstruction> instructions,
    @JsonProperty("unusableReason") String unusableReason
) {
    public RecipeExtraction {
        if (schemaVersion == null) schemaVersion = "recipe_extraction.v1";
        if (status == null) status = "";
        if (recipeName == null) recipeName = "";
        if (description == null) description = "";
        if (prepTime == null) prepTime = "";
        if (cookTime == null) cookTime = "";
        if (totalTime == null) totalTime = "";
        if (servings == null) servings = "";
        if (cuisine == null) cuisine = "";
        if (category == null) category = "";
        if (keywords == null) keywords = "";
        if (ingredients == null) ingredients = java.util.List.of();
        if (instructions == null) instructions = java.util.List.of();
        if (unusableReason == null) unusableReason = "";
    }

    /** Returns true if this is a valid extracted recipe. */
    public boolean isValid() {
        return "extracted".equals(status)
            && !recipeName.isBlank()
            && !ingredients.isEmpty()
            && !instructions.isEmpty();
    }

    /** Returns true if the page content was deemed unusable for extraction. */
    public boolean isUnusable() {
        return "unusable".equals(status);
    }
}
