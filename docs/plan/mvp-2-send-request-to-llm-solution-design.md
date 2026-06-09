# MVP 2 Solution Design: Send Recipe Content to Local LLM

## Requirement source

Implements `docs/requirements/mvp/2_send-request-to-llm.md` only.

## Objective

Add a synchronous LLM extraction step after MVP1 fetch: reduce fetched HTML/text as needed, send one bounded OpenAI-compatible chat completion request to local llama.cpp, parse the model JSON, and return either a structured recipe extraction or a controlled LLM error.

## Structural JSON files

Implementation should keep these structures versioned and testable:

- Recipe extraction response schema: `mvp-2-llm-extraction-structures/recipe-extraction.schema.json`
- Outgoing chat request schema subset: `mvp-2-llm-extraction-structures/chat-completion-request.schema.json`
- Sample outgoing request: `mvp-2-llm-extraction-structures/chat-completion-request.sample.json`
- Sample llama.cpp response: `mvp-2-llm-extraction-structures/chat-completion-response.sample.json`
- Valid extraction sample: `mvp-2-llm-extraction-structures/recipe-extraction-valid.sample.json`
- Unusable-page extraction sample: `mvp-2-llm-extraction-structures/recipe-extraction-unusable.sample.json`
- Metadata sample: `mvp-2-llm-extraction-structures/llm-extraction-metadata.sample.json`

Note: the sample request uses `$ref` to keep docs readable. The runtime request must inline the recipe schema object inside `response_format.json_schema.schema` because the OpenAI-compatible API receives one JSON request body.

## Proposed shape

### Main components

- `RecipeController`
  - Keeps one synchronous `POST /recipes` flow: fetch → extract → render.
  - Catches fetch and LLM controlled exceptions separately for user-safe errors.
- `llm/RecipeExtractionService`
  - Public method: `LlmExtractionResult extract(RecipeFetchResult fetchResult)`.
  - Owns content reduction, prompt construction, OpenAI request execution, response parsing, and metadata creation.
- `llm/LlamaClient`
  - Small wrapper around Java 17 `HttpClient` for `POST /v1/chat/completions`.
  - No provider abstraction for MVP; local llama.cpp only.
- `llm/RecipeContentReducer`
  - Removes clearly unrelated page noise and caps the text sent to the model.
- `llm/RecipeExtractionPrompt`
  - Static prompt constants with `recipe_extraction_prompt.v1`.
- `llm/RecipeExtraction`, `RecipeIngredient`, `RecipeInstruction`
  - Records matching `recipe-extraction.schema.json`.
- `llm/LlmExtractionResult`
  - Record containing parsed extraction plus endpoint/model/duration/schema metadata.
- `llm/LlmExtractionException`
  - Controlled exception with `LlmErrorCode` and safe user message.

### Package layout

```text
web/src/main/java/dev/recing/web/
  RecipeController.java
  llm/
    LlamaClient.java
    LlmErrorCode.java
    LlmExtractionException.java
    LlmExtractionResult.java
    RecipeContentReducer.java
    RecipeExtraction.java
    RecipeExtractionPrompt.java
    RecipeExtractionService.java
    RecipeIngredient.java
    RecipeInstruction.java
```

## Pipeline

```mermaid
flowchart LR
  A[POST /recipes url] --> B[MVP1 fetch]
  B --> C[Reduce HTML/text]
  C --> D[Build chat completion JSON]
  D --> E[llama.cpp /v1/chat/completions]
  E --> F[Parse assistant content as JSON]
  F --> G[Validate against recipe_extraction.v1 shape]
  G --> H[Render extraction or controlled error]
```

## LLM request flow

1. Receive `RecipeFetchResult` from MVP1. Current MVP1 does not extract title; send final URL, content type, and body only.
2. Reduce content before prompting:
   - strip `<script>`, `<style>`, comments, SVG, and obvious navigation/footer blocks with simple regex/string logic;
   - collapse whitespace;
   - preserve recipe JSON-LD, headings, lists, tables, and ordered text;
   - cap request content by characters using a conservative limit configurable in properties.
3. Build two chat messages:
   - `system`: extraction rules, no invention, strict JSON only, schema/prompt versions;
   - `user`: source URL, content type, truncated flag, and reduced page content.
4. Build request JSON matching `chat-completion-request.schema.json` with:
   - endpoint default: `http://localhost:8080/v1/chat/completions`;
   - model default: `qwen3.6`;
   - `temperature: 0`, `top_p: 1`, `max_tokens: 1024`;
   - `response_format.type: json_schema` using inlined `recipe-extraction.schema.json`.
5. Send one POST request using Java 17 `HttpClient` with connect and request timeouts.
6. Retry only once for transient connection failure or 5xx response; do not retry malformed JSON/schema failures.
7. Parse the OpenAI-compatible response and read `choices[0].message.content`.
8. Parse content as JSON into the extraction records.
9. Validate required fields and strict shape. If full JSON Schema validation is not added yet, implement equivalent record-level checks for MVP.
10. Return `LlmExtractionResult` with extraction and metadata from `llm-extraction-metadata.sample.json`.

## Extraction schema rules

- Schema version is `recipe_extraction.v1`.
- `status` is `extracted` or `unusable`.
- For `extracted`, `recipeName`, at least one ingredient, and at least one instruction are required.
- For `unusable`, ingredients/instructions are empty and `unusableReason` explains why.
- Optional fields use `null`; optional lists use `[]`.
- Ingredients stay close to the page wording: split quantity, unit, name, note, and keep `originalText`.
- Instructions are ordered and include `stepNumber` starting at 1.

## Error handling

`RecipeExtractionService.extract()` throws `LlmExtractionException` with one of:

- `LLM_UNAVAILABLE`
- `LLM_TIMEOUT`
- `LLM_HTTP_ERROR`
- `LLM_BAD_RESPONSE`
- `LLM_SCHEMA_MISMATCH`
- `LLM_CONTENT_TOO_LARGE`
- `LLM_FAILED`

The controller displays one concise banner, for example: `The local recipe extractor is unavailable. Start llama.cpp and try again.` Logs may include endpoint, model, duration, schema version, status code, and error code, but not full recipe page content.

## Configuration

Add simple Spring properties only:

```properties
recing.llm.endpoint=http://localhost:8080/v1/chat/completions
recing.llm.model=qwen3.6
recing.llm.timeout-seconds=180
recing.llm.max-content-chars=300000
```

## Testing plan

- `RecipeContentReducerTest`: strips scripts/styles and caps content while preserving recipe-like text.
- `RecipeExtractionServiceTest`: builds deterministic request JSON from a sample fetch result and includes schema/prompt versions.
- `RecipeExtractionServiceTest`: parses `chat-completion-response.sample.json` into records.
- `RecipeExtractionServiceTest`: turns malformed JSON, schema mismatch, timeout, and unavailable endpoint into controlled errors.
- Manual test: run llama.cpp locally, submit a public recipe URL, verify a rendered extraction or clear error.

## Implementation remarks

- Keep the flow synchronous; no queue, streaming UI, persistence, or provider abstraction for MVP.
- Do not log full prompt bodies, fetched HTML, or model output containing full recipe text.
- Do not add unit normalization, alternative ingredients, DB storage, or result verification here; those are later requirements.
