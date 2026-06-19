package dev.recing.web.llm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Single ingredient from a recipe extraction. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RecipeIngredient(
    String quantity,
    @JsonProperty("unit") String unitOfMeasure,
    String name,
    String note,
    String originalText
) {
    public RecipeIngredient {
        if (quantity == null) quantity = "";
        if (unitOfMeasure == null) unitOfMeasure = "";
        if (name == null) name = "";
        if (note == null) note = "";
        if (originalText == null) originalText = "";
    }
}
