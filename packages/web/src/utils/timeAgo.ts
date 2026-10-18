/**
 * Compact relative time label for recent timestamps (German UI).
 * Rolls up by magnitude; very old dates fall back to an absolute date.
 */
const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

export function timeAgo(dateStr: string): string {
	const diffMs = Date.now() - new Date(dateStr).getTime();
	if (Number.isNaN(diffMs)) return "";

	const mins = Math.floor(diffMs / 60_000);
	if (mins < 1) return "gerade eben";
	if (mins < 60) return rtf.format(-mins, "minute");

	const hours = Math.floor(mins / 60);
	if (hours < 48) return rtf.format(-hours, "hour");

	const days = Math.floor(hours / 24);
	if (days < 31) return rtf.format(-days, "day");

	// Absolute date (dd.mm.yyyy); formatted manually because
	// toLocaleDateString padding is not consistent across runtimes.
	const d = new Date(dateStr);
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	return `${dd}.${mm}.${d.getFullYear()}`;
}
