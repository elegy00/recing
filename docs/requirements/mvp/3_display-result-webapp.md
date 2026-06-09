## 3. Display the recipe result in the web application

### Goal
Provide a simple synchronous web page where the user submits a recipe URL and receives the raw LLM text response or a clear failure state.

### Scope
- Input: plain text response from the LLM (step 2), or a controlled error from any previous step.
- Output: a web page showing the raw LLM text or an error message.
- Out of scope for MVP: JSON parsing or schema validation, polished recipe rendering, user accounts, recipe editing, saving to a database, sharing links, print layout, mobile app, history, and asynchronous job status pages.

### Functional requirements
1. The web application shall provide a single synchronous form page where the user can submit one recipe URL.
2. The submitted URL shall remain visible after submission so the user can confirm the source.
3. While processing, the UI shall prevent duplicate accidental submissions or otherwise make repeated submissions harmless.
4. On success, the application shall dump the raw LLM text response to the frontend as-is, with no retries or post-processing.
5. On failure, the application shall display a concise user-facing error message mapped from the failed stage: fetch, LLM request, or unexpected application error.
6. The UI shall not expose stack traces, raw prompts, internal network details, or full logs to the user.
7. The MVP shall process the request synchronously from the user's perspective.
8. If processing takes longer than the HTTP request budget, the application shall show a controlled timeout/error rather than hanging indefinitely.

### Quality requirements
- The UI should be simple and optimized for validating the end-to-end recipe extraction flow.
- The LLM text response should be displayed in a preformatted block for readability.
- Error messages should tell the user what they can try next, such as checking the URL or retrying when the local LLM is running.

### Acceptance criteria
- A user can submit a recipe URL and see the raw LLM text response on success.
- Fetch and LLM failures are displayed as clear error states.
- The page shows the source URL for traceability.
- The LLM response is rendered as plain text with no parsing or validation.
- The page does not provide recipe editing controls.
