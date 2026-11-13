import { describe, expect, it } from "vitest";
import type { RecipeResult } from "../types";
import { normalizeRecipe } from "./normalize-recipe";

function makeResult(overrides: Partial<RecipeResult> = {}): RecipeResult {
	return {
		status: "extracted",
		recipeName: "Test Recipe",
		ingredients: [
			{
				quantity: "2",
				unit: "cups",
				name: "flour",
				note: null,
				originalText: "2 cups flour",
			},
			{
				quantity: null,
				unit: null,
				name: "salt",
				note: "to taste",
				originalText: "salt to taste",
			},
		],
		instructions: [
			{ stepNumber: 1, text: "Mix dry ingredients.", timer: null },
			{
				stepNumber: 2,
				text: "Make the batter:",
				timer: "5 mins",
				substeps: ["Add eggs.", "Stir until smooth."],
			},
			{ stepNumber: 3, text: "Cook on a griddle.", timer: null, substeps: [] },
		],
		notes: [],
		...overrides,
	};
}

describe("normalizeRecipe", () => {
	it("resolves null ingredient fields to undefined", () => {
		const { ingredients } = normalizeRecipe(makeResult());
		expect(ingredients[0]).toEqual({
			quantity: "2",
			unit: "cups",
			name: "flour",
			note: undefined,
		});
		expect(ingredients[1]).toEqual({
			quantity: undefined,
			unit: undefined,
			name: "salt",
			note: "to taste",
		});
	});

	it("keeps substeps as separate entries for steps that have them", () => {
		const { instructions } = normalizeRecipe(makeResult());
		expect(instructions[1].substeps).toEqual([
			"Add eggs.",
			"Stir until smooth.",
		]);
		expect(instructions[1].timer).toBe("5 mins");
	});

	it("omits substeps for legacy steps without the field", () => {
		const { instructions } = normalizeRecipe(makeResult());
		expect(instructions[0].substeps).toBeUndefined();
	});

	it("omits substeps when the array is empty", () => {
		const { instructions } = normalizeRecipe(makeResult());
		expect(instructions[2].substeps).toBeUndefined();
	});

	it("preserves step numbers and text", () => {
		const { instructions } = normalizeRecipe(makeResult());
		expect(instructions.map((s) => s.stepNumber)).toEqual([1, 2, 3]);
		expect(instructions[0].text).toBe("Mix dry ingredients.");
	});
});
