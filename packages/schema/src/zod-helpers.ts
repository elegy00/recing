/** Error thrown when Zod validation fails. */
export class ZodValidationError extends Error {
  constructor(public readonly error: unknown) {
    super(String(error));
    this.name = "ZodValidationError";
  }
}
