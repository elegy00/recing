/**
 * URL fetch service with SSRF protection, redirect following, and content validation.
 * Uses native Node.js `fetch()` API for HTTP requests.
 */

import { FetchErrorCode } from "@recing/schema";
import { RecipeFetchException } from "./recipe-fetch-exception.js";
import { validateUrl } from "./url-safety-validator.js";
import { extractTitle } from "./content-reducer.js";
import type { RecipeFetchResult } from "./recipe-fetch-result.js";

const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

const USER_AGENT = "Recing/1.0 (Recipe Extractor)";

const ACCEPTED_CONTENT_TYPES: string[] = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
];

/**
 * Fetches the content at the given URL after validation and safety checks.
 */
export async function fetchUrl(submittedUrl: string): Promise<RecipeFetchResult> {
  const trimmedOriginal = submittedUrl.trim();
  const urlObj = await validateUrl(trimmedOriginal);

  let currentUrl = urlObj.href;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // AbortController for per-request timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1",
          "User-Agent": USER_AGENT,
        },
        redirect: "manual", // Don't auto-follow redirects — handle manually for SSRF safety
        signal: controller.signal,
      });

      clearTimeout(timer);

      const status = response.status;

      if (isRedirectStatus(status)) {
        const location = response.headers.get("Location");
        if (!location) {
          throw new RecipeFetchException(FetchErrorCode.REDIRECT_FAILURE, "No Location header");
        }

        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          throw new RecipeFetchException(FetchErrorCode.REDIRECT_FAILURE, "Invalid redirect URL");
        }

        // Validate the redirect target for SSRF safety before following
        await validateUrl(currentUrl);
      } else if (status === 304) {
        // 304 Not Modified — no body, skip content validation
        return { originalUrl: trimmedOriginal, finalUrl: currentUrl, status, contentType: "", body: "", byteCount: 0, title: null };
      } else if (status === 200) {
        return processResponse(trimmedOriginal, currentUrl, status, response);
      } else {
        throw new RecipeFetchException(FetchErrorCode.NON_SUCCESS_STATUS, status);
      }

    } catch (err) {
      clearTimeout(timer);

      if (err instanceof RecipeFetchException) throw err;

      // Node.js native fetch error classification
      if ((err as Error).name === "AbortError") {
        throw new RecipeFetchException(FetchErrorCode.TIMEOUT);
      }

      const message = (err as Error).message ?? "";
      if (/connection refused|ECONNREFUSED/i.test(message)) {
        throw new RecipeFetchException(FetchErrorCode.UNREACHABLE_HOST);
      }

      // Network-level failures (DNS, unreachable hosts)
      if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EHOSTUNREACH/i.test(message)) {
        throw new RecipeFetchException(FetchErrorCode.UNREACHABLE_HOST);
      }

      // Generic network error — include the raw error name for diagnostics
      const fallback = err instanceof Error && err.name !== "Error"
        ? `[${err.name}]`
        : "[unknown]";
      throw new RecipeFetchException(FetchErrorCode.FETCH_FAILED, `${message || fallback}`);
    }
  }

  throw new RecipeFetchException(
    FetchErrorCode.REDIRECT_FAILURE,
    `Too many redirects (exceeded ${MAX_REDIRECTS} hops)`
  );
}

/** Check if HTTP status is a redirect that we should follow. */
function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

/**
 * Processes a successful HTTP response body — validates content type,
 * checks size, decodes charset, and returns the result.
 */
async function processResponse(
  originalUrl: string,
  finalUrl: string,
  status: number,
  response: Response
): Promise<RecipeFetchResult> {
  const contentType = extractContentType(response.headers.get("Content-Type"));

  if (!isAcceptedContentType(contentType)) {
    throw new RecipeFetchException(FetchErrorCode.UNSUPPORTED_CONTENT_TYPE);
  }

  // Read body as array buffer to check size before decoding
  const arrayBuffer = await response.arrayBuffer();
  const byteCount = arrayBuffer.byteLength;

  if (byteCount > MAX_BODY_BYTES) {
    throw new RecipeFetchException(FetchErrorCode.RESPONSE_TOO_LARGE);
  }

  // Decode using charset from Content-Type header, fallback to UTF-8
  const charset = parseCharset(contentType);
  const decoder = charset ? new TextDecoder(charset, { fatal: false }) : new TextDecoder("utf-8", { fatal: false });

  let body: string;
  try {
    body = decoder.decode(arrayBuffer);
  } catch {
    // Fallback to UTF-8 if the declared charset fails
    body = new TextDecoder("utf-8").decode(arrayBuffer);
  }

  return { originalUrl, finalUrl, status, contentType, body, byteCount, title: extractTitle(body) };
}

/**
 * Extracts the base content type (without parameters like charset) from a Content-Type header value.
 */
export function extractContentType(raw: string | null): string {
  if (!raw || raw.length === 0) return "";
  const idx = raw.indexOf(";");
  if (idx >= 0) raw = raw.substring(0, idx);
  return raw.trim().toLowerCase();
}

/** Checks whether a content type is accepted by this service. */
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
