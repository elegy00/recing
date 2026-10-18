/**
 * Format ISO 8601 duration strings (e.g. "PT30M", "PT1H45M") into
 * human-readable German text (e.g. "30 min", "1 h 45 min").
 */

function plural(value: string, singular: string, pluralForm: string): string {
	return value === "1" ? singular : pluralForm;
}

export function formatDuration(isoString: string | null | undefined): string {
	if (!isoString) return "";

	const match = isoString.match(
		/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/,
	);
	if (!match) return isoString;

	const [, years, months, weeks, days, hours, minutes] = match;

	const parts: string[] = [];
	if (years) parts.push(`${years} ${plural(years, "Jahr", "Jahre")}`);
	if (months) parts.push(`${months} ${plural(months, "Monat", "Monate")}`);
	if (weeks) parts.push(`${weeks} ${plural(weeks, "Woche", "Wochen")}`);
	if (days) parts.push(`${days} ${plural(days, "Tag", "Tage")}`);

	const totalHours = Number(hours || 0) + Math.floor(Number(minutes || 0) / 60);
	const remainingMinutes = Number(minutes || 0) % 60;

	if (totalHours > 0) parts.push(`${totalHours} h`);
	if (remainingMinutes > 0 || parts.length === 0) {
		parts.push(`${remainingMinutes} min`);
	}

	return parts.join(" ");
}
