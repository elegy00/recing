/**
 * Immutable result of a successful URL fetch operation.
 */

export interface RecipeFetchResult {
  originalUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  byteCount: number;
  title: string | null;
}
