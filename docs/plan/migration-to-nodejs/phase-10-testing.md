# Phase 10: Testing & Validation

## Goal
Port all existing Java tests to TypeScript and add integration testing.

## Steps

### Step 10.1 — Port existing Java tests to Vitest

| Java Test File | TypeScript Equivalent | Coverage |
|---|---|---|
| `RecipeContentReducerTest.java` | `content-reducer.test.ts` | Strip scripts, styles, comments; preserve JSON-LD; title extraction; truncation |
| `UrlSafetyValidatorTest.java` | `url-safety.test.ts` | Reject invalid URLs, localhost, private IPs, bad schemes |
| `RecipeFetchServiceTest.java` | `url-fetcher.test.ts` | Redirects, content-type validation, size limits |
| `JobSubmissionTest.java` | `job-submission.test.ts` | Job lifecycle transitions |
| `RecipeControllerTest.java` | `recipe-controller.test.ts` | API endpoints with mock MongoDB |

### Step 10.2 — Integration test for full pipeline
```typescript
// Full extraction flow (mocked LLM response)
it('extracts recipe from URL end-to-end', async () => {
  // 1. Mock fetch to return known HTML
  // 2. Mock LLM to return valid JSON extraction
  // 3. Call pipeline
  // 4. Verify result matches expected structure
});
```

## Dependencies
Phases 1–7 — all components need to exist before tests can be written.
