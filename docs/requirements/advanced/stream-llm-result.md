## Stream local LLM extraction responses

### Goal
Improve perceived responsiveness and reduce HTTP timeout risk by consuming llama.cpp chat completion responses as a stream.

### Scope
- Input: the same reduced recipe page content used by the MVP LLM request.
- Output: a complete parsed recipe extraction, plus optional progress text while generation is running.
- Out of scope: changing model providers, background queues, persistence, or prompt experimentation UI.

### Functional requirements
1. The application shall support llama.cpp/OpenAI-compatible streaming chat completions for recipe extraction.
2. The request shall use `stream: true` when streaming mode is enabled.
3. The application shall collect streamed content chunks until the model finishes.
4. The final collected assistant content shall be parsed and validated with the same recipe extraction schema as the non-streaming flow.
5. The UI should show a controlled in-progress state while the model is generating.
6. The application shall surface timeout, disconnect, malformed output, and schema validation failures as controlled errors.
7. The existing non-streaming flow shall remain available until streaming is proven stable locally.

### Quality requirements
- Do not display partial JSON as a final result.
- Keep prompt/schema versions and timing metadata in logs.
- Avoid adding persistence or async job infrastructure unless a separate requirement needs it.

### Acceptance criteria
- Given a slow local llama.cpp model, the browser receives visible progress before the final extraction is ready.
- Given a complete streamed response, the final result matches the existing recipe extraction rendering path.
- Given an interrupted stream, the user sees a safe error instead of a hanging request.
