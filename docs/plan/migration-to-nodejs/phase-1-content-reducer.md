# Phase 1: Content Reducer (Package `ingestion`)

## Goal
Port the HTML content reduction logic that strips noise and preserves recipe data.

## Steps

### Step 2.1 — Port content reduction logic
- Port `RecipeContentReducer.reduce()` → `content-reducer.ts`
  - Regex patterns for script/style/comment/SVG stripping
  - JSON-LD preservation logic
  - Title extraction
  - HTML tag stripping with `<br>`, `<li>` preservation
  - Whitespace collapsing + truncation

### Tests
- Port existing `RecipeContentReducerTest.java` → Vitest

## Dependencies
Phase 0 (`@recing/schema`) — needs the type definitions.
