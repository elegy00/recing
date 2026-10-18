import { describe, expect, it } from "vitest";
import { formatDuration } from "./formatTime";

describe("formatDuration", () => {
	it("returns an empty string for null/undefined", () => {
		expect(formatDuration(null)).toBe("");
		expect(formatDuration(undefined)).toBe("");
	});

	it("formats minutes", () => {
		expect(formatDuration("PT25M")).toBe("25 min");
	});

	it("formats hours and minutes", () => {
		expect(formatDuration("PT1H45M")).toBe("1 h 45 min");
	});

	it("normalizes more than 60 minutes to hours", () => {
		expect(formatDuration("PT90M")).toBe("1 h 30 min");
	});

	it("formats zero minutes explicitly", () => {
		expect(formatDuration("PT0M")).toBe("0 min");
	});

	it("formats days with German pluralization", () => {
		expect(formatDuration("P1D")).toBe("1 Tag");
		expect(formatDuration("P2D")).toBe("2 Tage");
	});

	it("formats weeks, months and years", () => {
		expect(formatDuration("P2W")).toBe("2 Wochen");
		expect(formatDuration("P1M")).toBe("1 Monat");
		expect(formatDuration("P1Y")).toBe("1 Jahr");
	});

	it("combines day and time parts", () => {
		expect(formatDuration("P1DT2H30M")).toBe("1 Tag 2 h 30 min");
	});

	it("returns unparseable input unchanged", () => {
		expect(formatDuration("garbage")).toBe("garbage");
	});
});
