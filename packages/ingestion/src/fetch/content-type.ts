/**
 * Content-Type header parsing utilities used by the URL fetcher.
 */

const ACCEPTED_CONTENT_TYPES: string[] = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
];

/** Extracts the base content type (without parameters like charset) from a Content-Type header value. */
export function extractContentType(raw: string | null): string {
  if (!raw || raw.length === 0) return "";
  const idx = raw.indexOf(";");
  if (idx >= 0) raw = raw.substring(0, idx);
  return raw.trim().toLowerCase();
}

/** Checks whether a content type is accepted for ingestion. */
export function isAcceptedContentType(contentType: string): boolean {
  if (!contentType || contentType.length === 0) return false;
  return ACCEPTED_CONTENT_TYPES.some((accepted) => contentType.startsWith(accepted));
}

/** Parses the charset from a Content-Type header value. Returns undefined if not found or invalid. */
export function parseCharset(contentType: string): string | undefined {
  if (!contentType || contentType.length === 0) return undefined;

  for (const param of contentType.split(";")) {
    const trimmed = param.trim().toLowerCase();
    if (trimmed.startsWith("charset=")) {
      const charsetName = trimmed.substring("charset=".length).trim();
      // Validate that the charset is known to Node.js TextDecoder
      try {
        new TextDecoder(charsetName);
        return charsetName;
      } catch {
        // Invalid charset — skip it
      }
    }
  }

  return undefined;
}
