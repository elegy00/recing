# Phase 5: Frontend (Package `web`)

## Goal
Build the React SPA — written from scratch, using hi-fi designs as visual reference only.

## Status: ✅ Done

## Implementation

### Architecture
```
packages/web/
├── src/
│   ├── index.html           ← Vite entry point (Google Fonts: EB Garamond + Inter)
│   ├── main.tsx             ← React 19 root render
│   ├── App.tsx              ← React Router setup, Header/Footer shell
│   ├── GlobalStyles.tsx     ← CSS variables (terracotta #D9665B, warm canvas #f5f4f0)
│   ├── api.ts               ← Typed fetch wrapper for all /api/ endpoints
│   ├── components/
│   │   └── Header.tsx       ← Logo + nav links (Submit / Recipes), active indicator
│   ├── pages/
│   │   ├── SubmitPage.tsx   ← URL form, submit → auto-redirect to /recipes
│   │   └── RecipeListPage.tsx ← Filterable grid of recipe cards by status
│   └── index.ts             ← Dev: Vite middleware + Hono API (same port)
│                              Prod: Hono API + static file serving from dist/client/
├── vite.config.ts           ← React plugin, proxy /api → localhost:3000 in dev
└── tsconfig.json            ← extends base, JSX react-jsx, DOM lib
```

### Key Design Decisions
- **No routing library**: Uses `react-router-dom` with HashRouter (no server config needed)
- **CSS-in-TSX**: Global styles via single injected `<style>` tag — no CSS modules, no Tailwind
- **No client-side polling**: Submit → POST → redirect. Manual refresh button on list page.
- **Dev/prod unified entry**: Single `index.ts` that detects mode (`--mode dev`) and configures accordingly

### Pages Built

| Component | Purpose |
|-----------|---------|
| `<SubmitPage />` | URL input form with validation, submit state (idle/submitting/submitted/error), auto-redirect to /recipes on success |
| `<RecipeListPage />` | Filterable grid (All/Completed/Pending/Processing/Failed). Each card shows recipe name, source hostname, ingredients list (top 5), instructions (top 3), status badge, delete button. Loading and empty states handled. |
| `<Header />` | Sticky top bar with logo, Submit/Recipes nav links, active-page underline indicator |

### API Client (`api.ts`)
Typed wrappers for all 4 REST endpoints:
- `submitRecipe(url)` → POST /api/recipes → `{ jobId }`
- `listRecipes(status?)` → GET /api/recipes?status= → `Job[]`
- `deleteRecipe(id)` → DELETE /api/recipes/:id

### Tests
No unit tests for UI components — presentational React components with straightforward logic. API contract is covered by Phase 4's 13 integration tests (memory-backed).

## Verification
```bash
# Type check passes
npx tsc --noEmit          # ✅ no errors

# Existing API tests still pass
npx vitest run            # ✅ 13/13 passed

# Vite client build succeeds
npx vite build            # ✅ → dist/client/index.html + assets/

# Production server serves both API and SPA on one port
node dist/index.js        # ✅ /health returns JSON, / returns HTML with React bundle
```
