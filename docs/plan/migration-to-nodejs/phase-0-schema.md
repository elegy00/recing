# Phase 0: Foundation (Package `schema`)

## Goal
Create the shared types and validation layer that all other packages depend on.

## Steps

### Step 1.1 — Port data types & validation
- Create shared `@recing/schema` package
- Port all Java records → TypeScript interfaces + Zod schemas
- Include existing JSON schema from `recipe-extraction.schema.json` as source of truth
- Export validated types:
  - `RecipeExtraction` (with `isValid()`, `isUnusable()` helpers)
  - `JobSubmission` / `JobStatus` enum
  - `LlmExtractionResult.Metadata`
  - `RecipeIngredient`, `RecipeInstruction`

### Step 1.2 — Port error codes
- Port `FetchErrorCode` and `LlmErrorCode` → TypeScript enums with user-friendly messages
- Create a unified `AppError` base class with code, message, and HTTP status mapping

## Dependencies
None — this is the foundation package.
