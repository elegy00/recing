## 3. Verify the LLM extraction result

### Goal
Check that the LLM output is valid JSON and conforms to the strict recipe JSON Schema before it is shown to the user.

### Scope
- Input: LLM response from step 2 plus the recipe JSON Schema.
- Output: schema-verified recipe JSON or a validation failure that can be displayed to the user.
- Out of scope for MVP: semantic correctness checks, grounding checks against source text, nutritional validation, unit conversion, ingredient substitution, duplicate recipe detection, and database persistence.

### Functional requirements
1. The application shall parse the LLM response as JSON.
2. The application shall reject responses that are not valid JSON.
3. The application shall validate parsed JSON against the strict recipe JSON Schema.
4. The schema shall require, at minimum, a recipe name, source URL, at least one ingredient, and at least one instruction step.
5. The schema shall define optional fields such as servings/yield, preparation time, cooking time, and notes as nullable or otherwise explicitly optional.
6. The application shall not perform MVP verification beyond JSON parsing and JSON Schema validation.
7. When schema validation fails, the application shall call the LLM again with the previous invalid output and the schema validation error so the model can repair the JSON.
8. The application shall attempt at most 5 LLM repair requests after the initial failed response.
9. If all repair attempts fail, the application shall return a controlled verification error.
10. The application shall not silently invent fallback recipe data when verification fails.
11. Verification errors shall identify whether the failure was JSON parse-related or JSON Schema-related.

### Quality requirements
- Verification must be deterministic and implemented outside the LLM prompt.
- Repair attempts must be bounded to avoid an endless LLM loop.
- Verification failures should be safe to show to users in summarized form.

### Acceptance criteria
- Valid JSON conforming to the recipe JSON Schema passes verification.
- Invalid JSON fails verification and triggers up to 5 repair attempts.
- JSON that violates the recipe JSON Schema fails verification and triggers up to 5 repair attempts.
- If a repair attempt returns schema-valid JSON, that JSON is accepted.
- If all repair attempts fail, the user receives a controlled verification failure.
