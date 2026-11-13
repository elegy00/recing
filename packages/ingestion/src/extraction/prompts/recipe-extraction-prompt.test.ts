import { describe, it, expect } from "vitest";
import { buildSystemPrompt, SCHEMA_VERSION } from "./recipe-extraction-prompt.js";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(SCHEMA_VERSION);

  it("instructs the model to always extract quantity and unit when present", () => {
    // Regression guard for missing ingredient quantities: the fix relies on this guidance,
    // because quantity/unit are intentionally kept OPTIONAL in the schema (lenient parsing).
    expect(prompt).toMatch(/ALWAYS split out the amount into `quantity`/);
    expect(prompt).toMatch(/into `unit`/);
  });

  it("gives a concrete quantity/unit example to anchor extraction", () => {
    expect(prompt).toContain("'300 g flour' -> quantity='300', unit='g'");
    expect(prompt).toContain("'2 eggs' -> quantity='2', unit=null");
  });

  it("still tells the model to use null only when no amount is given", () => {
    expect(prompt).toMatch(/Use null for quantity\/unit only when the source truly gives no amount/);
  });

  it("instructs the model to extract instruction sub-steps as separate list entries", () => {
    // Regression guard: steps with multiple sub-steps must come back as individual
    // `substeps` entries, not merged into one paragraph in `text`.
    expect(prompt).toMatch(/extract EVERY sub-step as its own separate string in `substeps`/);
    expect(prompt).toMatch(/Never merge several sub-steps into a single paragraph/);
    expect(prompt).toMatch(/Use an empty array for `substeps` when the step has no sub-steps/);
  });
});
