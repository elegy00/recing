/**
 * Error thrown when a URL fetch operation fails.
 * Carries the machine-readable error code and a human-friendly message.
 */

import { FETCH_ERROR_MESSAGES, FetchErrorCode, resolveErrorMessage } from "@recing/schema";

export class RecipeFetchException extends Error {
  constructor(
    public readonly code: FetchErrorCode,
    ...args: unknown[]
  ) {
    super(resolveErrorMessage(FETCH_ERROR_MESSAGES, code, ...args));
    this.name = this.constructor.name;
  }
}
