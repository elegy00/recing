# Phase 5: Frontend (Package `web`)

## Goal
Build the React SPA — written from scratch, using hi-fi designs as visual reference only.

## Steps

### Step 6.1 — UI Framework Selection
**React + Vite** (confirmed)

Rationale:
- Hi-fi designs already exist in React format → ~50% less migration effort
- Largest ecosystem, most stable, proven at scale on fly.io

Alternatives considered but rejected:
- **SvelteKit**: smaller ecosystem, existing React assets would need rewriting
- **SolidJS**: faster runtime, but smaller community

### Step 6.2 — Port page components (from scratch)

| Java (Thymeleaf) | TypeScript (React) | Purpose |
|---|---|---|
| `index.html` | `<SubmitPage />` | URL submission form |
| `recipe-list.html` | `<RecipeListPage />` | Grid of all recipes, filterable by status |
| `result.html` | `<ResultCard />` | Single recipe card with ingredients + instructions |

**Removed:** No job-loading page. Submit → store → redirect to overview immediately.

### Step 6.3 — Visual design reference (not code)
- Terracotta accent: `#D9665B`
- Font stack: EB Garamond (headings) + Inter (body)
- Warm neutral canvas: `#f5f4f0`
- **Do NOT copy code** from `docs/ui/hifi-design/v1/`

### Step 6.4 — No client-side polling
```
SubmitPage → POST /api/recipes → redirect → RecipeListPage
```
RecipeListPage shows all jobs with their current status (PENDING, PROCESSING, COMPLETED, FAILED). Optional: manual "refresh" button.

## Dependencies
Phase 0 (`@recing/schema`) — needs type definitions for rendering results.
Phase 4 (Web API) — needs the REST endpoints to exist.
