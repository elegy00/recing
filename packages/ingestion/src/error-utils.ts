/**
 * Produces a single-line, actionable description of an error for logging.
 *
 * Expands AggregateError sub-errors and the .cause chain. This matters because
 * Node.js (>= 20) `net.connect` with the default `autoSelectFamily` (happy
 * eyeballs) throws a bare `AggregateError` with an empty message when every
 * resolved address fails — `String(error)` would just log "AggregateError".
 */
export function describeError(error: unknown, depth = 0): string {
  if (depth > 3) return String(error);

  if (error instanceof AggregateError) {
    const subs = error.errors.map((e) => describeError(e, depth + 1)).join("; ");
    return `${error.message || "AggregateError"} [${subs}]`;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    let text = error.message ? `${error.name}: ${error.message}` : error.name;
    if (code) text += ` (${code})`;

    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error || typeof cause === "string") {
      text += ` | caused by: ${describeError(cause, depth + 1)}`;
    }
    return text;
  }

  return String(error);
}
