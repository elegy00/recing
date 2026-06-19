package dev.recing.web.llm;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Single instruction step from a recipe extraction. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RecipeInstruction(
    int stepNumber,
    String text
) {
    public RecipeInstruction {
        if (text == null) text = "";
    }
}
