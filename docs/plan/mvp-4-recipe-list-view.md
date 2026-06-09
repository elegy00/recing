# MVP 4 — Recipe List View

## ASCII Overview

```
┌───────────────────────────┐
│  Header: Recing | Submit   │ ← index page (existing)
│          Recipes           │ ← NEW nav link
├───────────────────────────┤
│                           │
│   SUBMIT A RECIPE URL     │
│   [ url input ] [Submit]  │
│                           │
└───────────────────────────┘

Click "Recipes" →

┌───────────────────────────┐
│  Header: Recing | Submit   │
│          Recipes           │ ← active
├───────────────────────────┤
│                           │
│   ALL RECIPES             │
│                           │
│   ┌─ Pancakes ───────────┐│  ← link → /recipes/{jobId}
│   │ Prep: 5 min · Cook: 10││     (result page)
│   │ https://.../pancake   ││
│   ├───────────────────────┤│
│   ┌─ Chocolate Cake ─────┐│
│   │ ...                   ││
│   └───────────────────────┘│
│                           │
│   (empty state if none)   │
│                           │
└───────────────────────────┘
```

## What changes

| Layer | Change |
|-------|--------|
| **Controller** | New `@GetMapping("/recipes")` returning `"recipe-list"` view. Queries all jobs with status COMPLETED via the existing repo. |
| **Template** | New file `templates/recipe-list.html`. List of recipe name + URL links to the result page. Follows existing CSS design system (terracotta accent, Inter font). |
| **Index template** | Add `<a href="/recipes" class="header__link">Recipes</a>` in header nav. Move "Submit" and "About" into proper `<a>` tags instead of plain spans. |

## Data flow

```
JobSubmissionRepository.findAll()
  → filter: status == COMPLETED && result != null && result.isValid()
  → pass list to Thymeleaf model as attribute "recipes"
  → template renders each as a row linking to /recipes/{jobId}
```

## Files to create/modify

### Create
- `src/main/resources/templates/recipe-list.html` — the new view

### Modify
- `RecipeController.java` — add `/recipes` GET endpoint (HTML, not JSON)
- `index.html` — header nav: "Submit" → `<a href="/">`, "Recipes" → `<a href="/recipes">`, "About" stays as `#about` for now

## Implementation notes

- **Simple**: no pagination, no search, no CSS framework. Just a Thymeleaf `<ul>` or table loop.
- **Reuses existing repo**: `JobSubmissionRepository.findAll()` — no new repository methods needed.
- **Filtering logic in controller**: only show jobs that are COMPLETED and have a valid extraction (not unusable).
- **Link target**: each recipe row links to `/recipes/{jobId}` which already exists and shows the full result page.
- **Empty state**: show "No recipes yet" when list is empty.

## Validation (tests)

1. `GET /recipes` → view name `"recipe-list"` with model attribute `"recipes"` as a List
2. Empty repo → 200 OK, renders template, model contains empty list
3. Completed jobs with valid results → those recipes appear in the model
4. Failed/pending/completed-but-unusable jobs → excluded from list
