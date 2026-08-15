# Phase 3: LLM Client (Package `ingestion`)

## Goal
Port the Llama client and extraction pipeline with retry logic.

## Steps

### Step 4.1 — Port LlamaClient + prompt building
- Create `llm-client.ts` using Node.js native `fetch()` API
  - Build OpenAI-compatible chat completion request JSON
  - Inline JSON schema in `response_format.json_schema`
  - Disable thinking for Qwen3 (`chat_template_kwargs.enable_thinking: false`)
  - Handle response parsing (choices[0].message.content)

### Step 4.2 — Port extraction pipeline with retry logic
- Create `llm-extraction.ts` → port `RecipeExtractionService.extract()`
  - Content reduction → request building → HTTP call with retry (max 2 attempts, 500ms backoff)
  - Response parsing + code fence stripping (` ```json ... ``` `)
  - JSON Schema validation against recipe-extraction schema
  - Metadata tracking: duration, tokens, prompt version, etc.
  - Error mapping to `LlmErrorCode`

### Step 4.3 — Tests
- Mock HTTP responses for LLM calls
- Test retry logic (success on attempt 1 vs 2)
- Test error scenarios: timeout, connection refused, bad response, schema mismatch
- Test code fence stripping edge cases

## Dependencies
Phase 0 (`@recing/schema`) — needs all type definitions and error codes.
Phase 1 (`content-reducer`) — the pipeline calls content reduction first.
