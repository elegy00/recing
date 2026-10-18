import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeAgo } from "./timeAgo";

const NOW = new Date("2026-09-01T12:00:00Z");
const minutesAgo = (mins: number) =>
	new Date(NOW.getTime() - mins * 60_000).toISOString();

describe("timeAgo", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("labels very recent timestamps as 'gerade eben'", () => {
		expect(timeAgo(minutesAgo(0.5))).toBe("gerade eben");
	});

	it("labels minutes", () => {
		expect(timeAgo(minutesAgo(5))).toBe("vor 5 Minuten");
	});

	it("rolls up to hours below 48h", () => {
		expect(timeAgo(minutesAgo(2 * 60 + 30))).toBe("vor 2 Stunden");
	});

	it("rolls up to days below 31 days", () => {
		expect(timeAgo(minutesAgo(20 * 24 * 60))).toBe("vor 20 Tagen");
	});

	it("falls back to an absolute date for old timestamps", () => {
		expect(timeAgo(minutesAgo(40 * 24 * 60))).toBe("23.07.2026");
	});

	it("treats future timestamps as 'gerade eben'", () => {
		expect(timeAgo(new Date(NOW.getTime() + 60_000).toISOString())).toBe(
			"gerade eben",
		);
	});

	it("returns an empty string for invalid input", () => {
		expect(timeAgo("not-a-date")).toBe("");
	});
});
