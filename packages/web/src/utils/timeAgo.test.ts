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

	it("labels very recent timestamps as 'Jetzt'", () => {
		expect(timeAgo(minutesAgo(0.5))).toBe("Jetzt");
	});

	it("labels minutes", () => {
		expect(timeAgo(minutesAgo(5))).toBe("5m");
	});

	it("labels hours with remaining minutes", () => {
		expect(timeAgo(minutesAgo(2 * 60 + 30))).toBe("2h 30m");
	});

	it("treats future timestamps as 'Jetzt'", () => {
		expect(timeAgo(new Date(NOW.getTime() + 60_000).toISOString())).toBe(
			"Jetzt",
		);
	});
});
