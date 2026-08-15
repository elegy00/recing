# Phase 2: URL Fetcher (Package `ingestion`)

## Goal
Port the URL fetching service with SSRF protection and content validation.

## Steps

### Step 3.1 — Port fetch service
- Create `url-fetcher.ts` using Node.js native `fetch()` API
  - Manual redirect loop with hop counter (max 5)
  - Content-type validation
  - Size limit enforcement (5 MB)
  - Charset detection from Content-Type header
  - Error mapping to `FetchErrorCode`

### Step 3.2 — Tests
- Port existing fetch tests + add edge cases:
  - Non-redirectable responses (4xx, 5xx)
  - Too many redirects
  - Unsupported content types
  - Response too large
  - Unreachable hosts

## Dependencies
Phase 0 (`@recing/schema`) — needs `FetchErrorCode` and type definitions.
