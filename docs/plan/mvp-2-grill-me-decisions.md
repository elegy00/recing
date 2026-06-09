# MVP 2 Grill-Me Decisions

Design review of `mvp-2-send-request-to-llm-solution-design.md`. All decisions finalized.

## 1. Controller & Rendering Flow
- **Decision:** New `result.html` template for successful extraction; error banner on `index.html` for failures. No intermediate feedback — user sees only the final result or an error.
- **Controller changes:** Two catch blocks (`RecipeFetchException` and `LlmExtractionException`). On success, pass extraction fields to `result.html`.

## 2. JSON Parsing
- **Decision:** Use Jackson (`ObjectMapper`, `JsonNode`) — already available via Spring Boot starter. Build outgoing request as JsonNode tree; deserialize response into domain records. No extra dependency needed.

## 3. Content Reducer
- **Decision:** Regex/string operations only — no Jsoup, no DOM parser. Strip `<script>` (except `type="application/ld+json"`), `<style>`, HTML comments, SVG blocks. Collapse whitespace. Skip nav/footer stripping for MVP.
- **No early exit check** even for near-empty results (overengineering).
- **Front-loaded cap only:** take first ~60k chars after stripping. No heuristics for buried recipe content in MVP.

## 4. Content Cap Size
- **Decision:** Default `recing.llm.max-content-chars=60000` (was 300k). Conservative to fit Qwen 3.6's ~98k token context window with room for system prompt, schema, and response.

## 5. DI Pattern
- **Decision:** Keep `new RecipeExtractionService(...)` inside controller for MVP speed. Add a follow-up doc task to refactor to proper Spring constructor injection later (inject both fetch and extraction services).

## 6. Error Handling Integration
- **Decision:** Controller catches `RecipeFetchException` and `LlmExtractionException` separately. Each has its own error banner/message path. No stack traces exposed to user.

## 7. Title Extraction
- **Decision:** Extract `<title>` via regex in MVP 2 (helper method or reducer). Don't modify `RecipeFetchResult`. Pass title directly to LLM prompt only if found and non-empty.

## 8. Retry Logic
- **Retried on:** Connection refused, HTTP 502/503, malformed JSON response.
- **Not retried:** Timeout (60s), 4xx errors, schema validation failures.
- **Behavior:** Single retry with bounded user message replacement (don't append incrementally). Max 2 attempts total. Retry loop is internal to `RecipeExtractionService`.

## 9. Schema Files Location
- **Decision:** Move from `docs/plan/mvp-2-llm-extraction-structures/` → `src/main/resources/mvp-2-llm-extraction-structures/` for classpath access via `getClass().getResource()`.

## 10. Validation Approach
- **Decision:** Use full JSON Schema validator — no manual record-level checks. Add dependency on networknt/json-schema-validator (supports draft 2020-12).

## 11. JSON Schema Library
- **Decision:** `com.networknt:json-schema-validator` — supports our schema's draft 2020-12 with conditional `if/then`, works directly with Jackson `JsonNode`.

## 12. Prompt Storage
- **Decision:** Java string constants in `RecipeExtractionPrompt` class. No external `.txt` files for MVP. Versioned as `recipe_extraction_prompt.v1`.

## 13. Metadata Fields
- **Fields:** `modelEndpoint`, `model`, `durationMs`, `promptVersion`, `schemaVersion`, `requestContentChars`, `truncatedInput`, `parsedAsExpected`, `httpStatusCode`, `errorCode`, plus token usage (`promptTokens`, `completionTokens`).

## 14. Timeout Configuration
- **Decision:** Single `recing.llm.timeout-seconds=180` property. Applied as both connect timeout and request (read) timeout on the Java HTTP client. No separate properties.

## 15. LLM_FAILED Error Code
- **Decision:** Only for truly broken responses (empty content, unexpected shape). When schema validates with `status: "unusable"`, return it as a normal result — not an exception. Controller shows "No recipe found on this page."

## 16. User Message Format
```
Source URL: <url>
Content-Type: <type>
Truncated: true/false

<content>
```
- Include `truncated` flag when content was capped. No URL metadata (originalUrl/finalUrl) to keep LLM layer decoupled from MVP 1 internals.

## 17. Test Plan Additions
- **Added tests:**
  - Unusable page flow: valid JSON with `status: "unusable"` returns normal result (not exception).
  - Retry with bad JSON fix: mock returns malformed first, valid on retry — verify success and metadata shows 2 attempts.

## 18. Records + Jackson Annotations
- **Decision:** Java `record` types with `@JsonInclude(JsonInclude.Include.NON_NULL)` at class level and `@JsonProperty("fieldName")` where naming differs from JSON. No separate DTO layer.

## 19. @ConfigurationProperties for Config
- **Decision:** Create `RecingLlmProperties` record via `@ConfigurationProperties(prefix = "recing.llm")`. Inject into controller (Spring bean), pass to service constructor via `new`.

## 20. Logging Strategy
- **Log at WARN/ERROR level:** retry count, HTTP status code, first ~200 chars of malformed response body, duration per attempt vs total. Never log full content, prompts, or model output.

## 21. No URL Metadata in User Message
- **Decision:** Only pass final URL (not originalUrl). Keeps LLM layer independent from MVP 1's redirect-following internals. If URL handling changes later, prompt format doesn't break.

## 22. Hybrid Dependency Injection
- **Decision:** Spring injects `@ConfigurationProperties` into controller. Controller uses `new RecipeExtractionService(properties)` — no DI of service instances themselves for MVP.

## 23. LlamaClient Testing
- **Decision:** No dedicated `LlamaClientTest`. All HTTP error cases tested through `RecipeExtractionServiceTest` (where retry logic lives). Separate test only needed when multiple providers exist.

---

**Follow-up Task (DI Refactoring):** Document a separate task to refactor `RecipeController` from inline `new` instantiation to proper Spring constructor injection for both `RecipeFetchService` and `RecipeExtractionService`. This improves testability and sets up the codebase for future DI needs (e.g., when adding cloud LLM providers).
