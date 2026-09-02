/** Shared input validators for server functions. */

/** Requires a string `id` field; throws otherwise. */
export function requireId(data: { id?: unknown }): { id: string } {
	if (typeof data?.id !== "string") {
		throw new Error("id is required");
	}
	return { id: data.id };
}
