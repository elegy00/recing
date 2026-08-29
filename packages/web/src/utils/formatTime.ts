/**
 * Format ISO 8601 duration strings (e.g. "PT30M", "PT1H45M") into human-readable text.
 */

export function formatDuration(isoString: string | null | undefined): string {
	if (!isoString) return "";

	const match = isoString.match(
		/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/,
	);

	if (!match) return isoString;

	const [, years, months, weeks, days, hours, minutes] = match.slice(1);

	const parts: string[] = [];

	const y = Number(years ?? 0);
	if (years) parts.push(`${years} ${y === 1 ? "year" : "years"}`);
	const mo = Number(months ?? 0);
	if (months) parts.push(`${months} ${mo === 1 ? "month" : "months"}`);
	const w = Number(weeks ?? 0);
	if (weeks) parts.push(`${weeks} ${w === 1 ? "week" : "weeks"}`);
	const d = Number(days ?? 0);
	if (days) parts.push(`${days} ${d === 1 ? "day" : "days"}`);

	const h = Number(hours || "0");
	const m = Number(minutes || "0");

	const totalHours = h + Math.floor(m / 60);
	const remainingMinutes = m % 60;

	if (totalHours > 0) {
		parts.push(`${totalHours}h`);
	}
	if (remainingMinutes > 0 || parts.length === 0) {
		parts.push(remainingMinutes ? `${remainingMinutes}min` : "0min");
	}

	return parts.join(" ");
}
