import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
	it("accepts valid UUIDs (lower- and uppercase)", () => {
		expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
		expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
	});

	it("rejects invalid values", () => {
		expect(isUuid("")).toBe(false);
		expect(isUuid("not-a-uuid")).toBe(false);
		expect(isUuid("123e4567e89b12d3a456426614174000")).toBe(false); // no dashes
		expect(isUuid("123e4567-e89b-12d3-a456-42661417400g")).toBe(false); // bad char
		expect(isUuid(123)).toBe(false);
		expect(isUuid(null)).toBe(false);
		expect(isUuid(undefined)).toBe(false);
	});
});
