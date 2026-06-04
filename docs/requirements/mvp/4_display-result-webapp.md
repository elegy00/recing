## 4. Display the recipe result in the web application

### Goal
Provide a simple synchronous web page where the user submits a recipe URL and receives either the verified recipe JSON or a clear failure state.

### Scope
- Input: verified recipe JSON from step 3, or a controlled error from any previous step.
- Output: a web page containing the raw verified JSON result or an error message.
- Out of scope for MVP: polished recipe rendering, user accounts, recipe editing, saving to a database, sharing links, print layout, mobile app, history, and asynchronous job status pages.

### Functional requirements
1. The web application shall provide a single synchronous form page where the user can submit one recipe URL.
2. The submitted URL shall remain visible after submission so the user can confirm the source.
3. While processing, the UI shall prevent duplicate accidental submissions or otherwise make repeated submissions harmless.
4. On success, the application shall dump the verified recipe JSON to the frontend.
5. The JSON dump shall preserve the verified structure returned by schema validation.
6. On failure, the application shall display a concise user-facing error message mapped from the failed stage: fetch, LLM request, verification, or unexpected application error.
7. The UI shall not expose stack traces, raw prompts, internal network details, or full logs to the user.
8. The MVP shall process the request synchronously from the user's perspective.
9. If processing takes longer than the HTTP request budget, the application shall show a controlled timeout/error rather than hanging indefinitely.
10. Recipe editing is not supported in the MVP.

### Quality requirements
- The UI should be simple and optimized for validating the end-to-end recipe extraction flow.
- The JSON result should be readable enough for development validation, for example via indentation or a preformatted block.
- Error messages should tell the user what they can try next, such as checking the URL or retrying when the local LLM is running.

### Acceptance criteria
- A user can submit a recipe URL and see verified recipe JSON on success.
- Fetch, LLM, and verification failures are displayed as clear error states.
- Missing optional recipe fields appear according to the JSON Schema without breaking the page.
- The displayed JSON includes the source URL for traceability.
- The page does not provide recipe editing controls.
