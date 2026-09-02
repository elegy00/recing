const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Type guard for RFC 4122 style UUID strings. */
export function isUuid(value: unknown): value is string {
	return typeof value === "string" && UUID_RE.test(value);
}
