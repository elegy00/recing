/**
 * @recing/ingestion — URL fetching, content reduction, and SSRF protection.
 */

// Content reducer
export type { ReducedContent } from "./content-reducer.js";
export { reduce, extractTitle } from "./content-reducer.js";

// URL fetcher
export type { RecipeFetchResult } from "./recipe-fetch-result.js";
export { fetchUrl } from "./url-fetcher.js";
export {
  extractContentType,
  isAcceptedContentType,
  parseCharset,
} from "./url-fetcher.js";

// URL safety validator (SSRF protection)
export { validateUrl, isPublicAddress } from "./url-safety-validator.js";

// Fetch exceptions
export { RecipeFetchException } from "./recipe-fetch-exception.js";
