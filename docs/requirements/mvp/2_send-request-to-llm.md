## 2. Send recipe page content to the local LLM

### Goal
Transform the fetched recipe page content into a deterministic OpenAI-compatible request to the local llama.cpp model and receive a strict JSON recipe extraction.

### Scope
- Input: fetch result from step 1, including final URL, title, content type, and page HTML/text.
- Output: one LLM response containing a proposed structured recipe extraction that conforms to the configured JSON Schema.
- Assumed model: Qwen 3.6 running locally through llama.cpp with a 98k token context window.
- Out of scope for MVP: model selection UI, remote/cloud LLM providers, prompt experimentation UI, streaming display, and multi-model comparison.

### Functional requirements
1. The application shall call the locally running llama.cpp service through its OpenAI-compatible API.
2. The application shall target the OpenAI-compatible chat completions flow, such as `/v1/chat/completions`.
3. The application shall fail fast with a clear error if the local LLM service is unavailable or returns an error.
4. The application shall clean or reduce the fetched page content before sending it when needed to fit the 98k context window.
5. The prompt shall instruct the model to extract only recipe information supported by the submitted page content.
6. The request shall require a strict JSON Schema response with at least:
   - recipe name
   - source URL
   - servings or yield when present
   - preparation time when present
   - cooking time when present
   - ingredients as separate items
   - instructions as ordered steps
   - notes when present
7. The schema and prompt shall require `null` or an empty collection for missing optional fields instead of invented values.
8. The LLM request shall use bounded timeout and retry behavior so a stuck model request does not block the application indefinitely.
9. The application shall keep enough request/response metadata for verification, including model endpoint, duration, schema version, and whether the response parsed as the expected format.

### Quality requirements
- Prompts and JSON Schemas should be versioned or identifiable in logs so extraction changes can be traced.
- The request must not include unrelated assets or more page content than necessary.
- LLM failures must produce actionable user-facing errors without exposing stack traces.

### Acceptance criteria
- Given a fetched recipe page, the application sends one bounded OpenAI-compatible request to the local llama.cpp endpoint.
- The model receives extraction instructions and a strict JSON Schema response requirement.
- The model returns JSON that can be parsed and passed to schema verification, or a controlled error is raised.
- Missing optional recipe fields are represented as missing/null or empty collections rather than fabricated text.
