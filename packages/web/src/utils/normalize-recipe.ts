/**
 * Normalizes an API recipe result into display-ready ingredients and steps.
 * Pure function — no React or server dependencies, so it is unit-testable.
 */

import type { RecipeIngredient, RecipeResult, RecipeStep } from "../types";

export interface NormalizedRecipe {
	ingredients: RecipeIngredient[];
	instructions: RecipeStep[];
}

/** Convert the API recipe result into display-ready ingredients and steps. */
export function normalizeRecipe(result: RecipeResult): NormalizedRecipe {
	return {
		ingredients: result.ingredients.map((i) => ({
			quantity: i.quantity ?? undefined,
			unit: i.unit ?? undefined,
			name: i.name,
			note: i.note ?? undefined,
		})),
		instructions: result.instructions.map((s) => ({
			stepNumber: s.stepNumber,
			text: s.text,
			timer: s.timer ?? undefined,
			substeps: toDisplaySubsteps(s.substeps),
		})),
	};
}

/** Sub-steps are display-relevant only when non-empty (legacy rows have none). */
function toDisplaySubsteps(substeps: string[] | undefined): string[] | undefined {
	return substeps && substeps.length > 0 ? substeps : undefined;
}
