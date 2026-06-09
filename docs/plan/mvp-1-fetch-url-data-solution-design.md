# MVP 1 Solution Design: Fetch Recipe URL Data
## Requirement source

Implements `docs/requirements/mvp/1_fetch-url-data.md` only.

## Objective

Add a bounded, safe server-side fetch pipeline that accepts one absolute public `http`/`https` recipe URL, retrieves the initial server-rendered HTML response, and returns normalized metadata plus body content or a controlled fetch error.

## Proposed shape

### Main components

- `RecipeController`
  - Accepts `POST /recipes` with `url`.
  - Calls `RecipeFetchService.fetch()` inside the handler method with a direct try-catch block (no separate exception handler).
  - On success: sets metadata attributes on the model for display.
  - On failure: catches `RecipeFetchException`, sets single `error` attribute, returns index page with error banner.
- `RecipeFetchService`
  - Public method: `RecipeFetchResult fetch(String submittedUrl)`.
  - Owns validation, redirects, timeout, response size limit, content type checks, and metadata creation.
  - Throws `RecipeFetchException` (with `FetchErrorCode`) on failure — never swallows exceptions.
- `UrlSafetyValidator`
  - Validates syntax and scheme before requests.
  - Resolves DNS and rejects unsafe resolved addresses before each request and redirect.
- `RecipeFetchResult`
  - Immutable DTO/record containing:
    - original URL
    - final URL
    - HTTP status
    - content type
    - body text/HTML (no title extraction — LLM handles parsing)
    - fetched byte count
- `RecipeFetchException`
  - Controlled exception with a stable `FetchErrorCode` enum and safe user message.

### Package layout

```text
web/src/main/java/dev/recing/web/
  RecipeController.java
  fetch/
    FetchErrorCode.java
    RecipeFetchException.java
    RecipeFetchResult.java
    RecipeFetchService.java
    UrlSafetyValidator.java
```

## Pipeline context

The end-to-end pipeline is fully synchronous: single `POST /recipes` request → fetch → LLM extraction (MVP2) → return response. No hidden fields, no sessions, no multi-stage UI. MVP1 implements only the fetch portion; the controller currently returns index with metadata on success and an error banner on failure.

## Fetch flow

1. Trim the submitted value.
2. Parse as `URI` and reject if not absolute or if scheme is not `http` or `https`.
3. Reject URLs with missing host, userinfo credentials, or malformed host/port.
4. Resolve the host with `InetAddress.getAllByName(host)`; reject any non-public address.
5. Build a raw Java 17 `HttpClient` with `Redirect.NEVER` and a 20-second per-request timeout.
6. Execute a GET request with:
   - `Accept: text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1`
   - a normal browser-ish `User-Agent` identifying this app
7. Do not request or parse subresources; only read the response body from the submitted document URL.
8. Handle redirects manually (no automatic following):
   - On 3xx, resolve relative `Location` against current URL
   - Validate scheme and SSRF safety on each redirect target
   - Cap at maximum 5 hops
9. Reject non-2xx final responses with a controlled error.
10. Accept only: `text/html`, `application/xhtml+xml`, `text/plain` (lenient for MVP — plain text pages are common for simple recipe lists).
11. Read the full response body into memory (capped at 5 MB); no streaming needed — one read + parse is simpler.
12. Decode using charset from `Content-Type`; fallback to UTF-8.
13. **No title extraction** — pass raw HTML/text body directly; the LLM handles parsing and extraction in the next step.
14. Return `RecipeFetchResult` with metadata for display and the raw body for the LLM pipeline.

## SSRF safety rules

Reject a target if any DNS result is:

- wildcard/any local address
- loopback
- link-local
- site-local/private
- multicast
- IPv4 private ranges: `10/8`, `172.16/12`, `192.168/16`
- IPv4 localhost `127/8`
- IPv4 link-local `169.254/16`
- IPv6 loopback `::1`
- IPv6 unique local `fc00::/7`
- IPv6 link-local `fe80::/10`

Implementation remark: Java helpers like `isLoopbackAddress`, `isLinkLocalAddress`, `isSiteLocalAddress`, `isAnyLocalAddress`, and `isMulticastAddress` cover most cases, but add explicit byte/range checks for clarity and tests.

## HTTP client choice

Use Java 17 `java.net.http.HttpClient` to avoid extra dependencies.

Key configuration:

- Build with `connectTimeout(Duration.ofSeconds(20))`.
- Set per-request `.timeout(Duration.ofSeconds(20))`.
- Use `Redirect.NEVER`; implement a manual redirect loop (~30 lines) — Spring's interceptors cannot block redirects mid-flight, so raw `HttpClient` is the correct approach.
- Read response body via `BodyHandlers.ofByteArray()` (or similar) into memory; cap at 5 MB during read.

## Error handling

`RecipeFetchService.fetch()` throws `RecipeFetchException` with a `FetchErrorCode` enum:

- `INVALID_URL`
- `UNSAFE_TARGET`
- `UNREACHABLE_HOST`
- `TIMEOUT`
- `REDIRECT_FAILURE`
- `UNSUPPORTED_CONTENT_TYPE`
- `RESPONSE_TOO_LARGE`
- `NON_SUCCESS_STATUS`
- `FETCH_FAILED`

Each code carries a concise user-safe message. The controller catches the exception and sets it as a single `error` model attribute, displayed as a banner on the index page.

Logs may include URL, final URL, status, content type, elapsed time, and error code — but never full body content.

## LLM step note

The subsequent LLM extraction step must return clear structured responses even when HTML is unusable (e.g., `status: "unusable"`, `reason: "..."`) rather than returning garbage output. This ensures the UI can handle bad fetch results gracefully.

## Testing plan

- **Unit tests only** (no integration-level fetch tests for MVP):
  - `UrlSafetyValidatorTest`
    - rejects non-URLs and relative paths
    - rejects unsupported schemes (`file:`, `ftp:`, `data:`)
    - rejects localhost, private IPs, loopback, link-local via mocked `InetAddress` results
    - accepts representative public hosts/IPs
  - Manual testing against real recipe URLs for fetch flow (timeout, body size, redirect, content type, error messages)

## Implementation remarks

- **Pipeline is fully synchronous**: single `POST /recipes` request → fetch → LLM (MVP2) → return response. No hidden fields, no sessions, no multi-stage UI.
- Keep implementation synchronous for the MVP; do not add browser automation or JS rendering.
- Prefer immutable records and small classes over a generic fetch framework.
- Do not strip the body aggressively in this step; LLM prompt/content reduction belongs to MVP step 2.
- Avoid storing fetched body in logs or persistent files.
- Validate DNS immediately before each request and redirect; do not cache DNS results for MVP.
- Store decoded body text plus byte count (exact raw bytes not required).
- Keep user-facing messages practical, e.g. "The page was too large to process" rather than exposing low-level exceptions.
