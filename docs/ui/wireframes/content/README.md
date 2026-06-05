# Wireframes — Content

Page-specific views and their states. Layout chrome (header, nav, footer, spacing) is defined in [../layout](../).

---

## 1. Submit New Recipe

```
┌──────────────────────────────────────────────────────────┐
│ HEADER: Recing   Submit (active)   History    About      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ SUBMIT A RECIPE URL                                      │ ← page title, `lg` bottom margin
│                                                          │
│ ┌─────────────────────────────────────┐┌───────────────┐│
│ │ <input type="url"                   ││   [ Submit ]  ││ ← desktop: full-width input + button row
│ │   placeholder="https://.../recipe"   │└───────────────┘│
│ └─────────────────────────────────────┘                 │
│                                                         │
│ Status: idle                                            │ ← hidden initially, shows after interaction
│                                                         │
├──────────────────────────────────────────────────────────┤
│ FOOTER: v0.1.0                                          │
└──────────────────────────────────────────────────────────┘

Validation states (shown inline below input):
  Valid:   <input> ✓  — green check, `sm` left padding before icon
  Invalid: <input> ⚠ URL must start with https://  — red border + text below field
  Required:<input> ⚠ Please enter a URL             — same styling, different message
```

## 2. View Recipe (Detail)

```
┌──────────────────────────────────────────────────────────┐
│ HEADER: Recing   Submit    History (active)  About       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ RECIPE RESULT                                            │ ← page title
│ ──────────────────────────────────────────────────────── │ ← `md` bottom margin, divider line
│ https://example.com/chocolate-cake                       │ ← source URL, clickable link
│                                                          │
│ Title:  Chocolate Cake          Cook time: 30 min        │ ← metadata grid, `sm` gap between columns
│ Servings: 8                     Prep time: 15 min        │
│ Category: Dessert                                        │
│                                                          │
│ ┌────── Ingredients ─────────┐ ┌── Instructions ────────┐│ ← desktop two-column layout
│ │ • 2 cups flour             │ │ 1. Preheat oven to      ││   `md` gap between columns
│ │ • 1 cup sugar              │ │    350°F (175°C)        ││
│ │ • 3 eggs                   │ │ 2. Mix dry ingredients  ││
│ └────────────────────────────┘ └─────────────────────────┘│
│                                                          │
│ [ Submit New Recipe ]   (link → History)                 │ ← CTA button + secondary link
├──────────────────────────────────────────────────────────┤
│ FOOTER                                                   │
└──────────────────────────────────────────────────────────┘

Mobile: single column — ingredients and instructions stacked vertically, each full-width.
Empty state (no data returned): show placeholder text "No details available for this recipe." in muted color.
```

## 3. Error View

```
┌──────────────────────────────────────────────────────────┐
│ HEADER: Recing   Submit    History    About              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ERROR                                                    │ ← page title, red accent on icon
│ ┌─────────────────────────────────────────────────────┐  │ ← error card, `lg` padding, subtle bg tint
│ │ ⚠ Failed to fetch recipe                           │  │
│ │                                                      │  │
│ │ The URL could not be fetched.                        │  │
│ │ Details: Connection refused to example.com           │  │ ← optional expandable details (hidden by default)
│ │ ────────────────────────────────────────────────     │  │
│ │ [ Show Details ▼ ]                                 │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ What you can try:                                        │ ← recovery suggestions heading
│ • Check the URL is correct and publicly accessible       │
│ • Ensure the local LLM service (llama.cpp) is running    │
│ [ Try Again ]      [ Submit New Recipe ]                 │ ← primary + secondary actions, `md` gap between buttons
├──────────────────────────────────────────────────────────┤
│ FOOTER                                                   │
└──────────────────────────────────────────────────────────┘

Error types and their messages:
  - Invalid URL:      "Please enter a valid https:// URL" (shown inline on submit, not full error page)
  - Fetch failed:     "Failed to fetch recipe — {reason}" (full error view as above)
  - LLM unavailable:  "Recipe extraction service is offline — is llama.cpp running?"
```

## 4. List / History View

```
┌──────────────────────────────────────────────────────────┐
│ HEADER: Recing   Submit    History (active)  About       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ RECIPE HISTORY                                           │ ← page title
│ ──────────────────────────────────────────────────────── │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Chocolate Cake           Jun 5, 2026    ⚠ Failed   │  ← list item card
│ │ https://example.com/...                              │  │     status badge (green/red/yellow)
│ ├─────────────────────────────────────────────────────┤  │
│ │ Tiramisu                 Jun 4, 2026    ✓ Saved    │  │
│ │ https://tasty.co/...                                 │  │
│ └─────────────────────────────────────────────────────┘  │ ← items stacked with `sm` gap
│                                                          │
│ (Empty state) No recipes extracted yet.                  │ ← shown when list is empty
│ [ Submit Your First Recipe → ]                           │ ← CTA to submit page
├──────────────────────────────────────────────────────────┤
│ FOOTER                                                   │
└──────────────────────────────────────────────────────────┘

List item layout:
  Row structure: [Title (bold, left)]  [Date]  [Status badge]
  Sub-row:       [Source URL (truncated with ellipsis)]
  Clickable area: entire card → navigates to recipe detail
```

## 5. Loading State (Transient Overlay)

A transient overlay that appears between submit and result/error — not a separate page:

```
┌───────────────────────────────────────────────────────┐
│ HEADER                                                │
├───────────────────────────────────────────────────────┤
│ PROCESSING RECIPE                                     │ ← replaces page title temporarily
│                                                       │
│ URL ✓ → Fetching ⋯ → LLM Processing ░               │ ← horizontal step tracker, `md` bottom margin
│ [================>                          ]         │ ← progress bar, fills available width
│ Fetching page content from example.com...             │ ← status message updates per pipeline stage
│ ████████████████████░░░░░░░░ 62%                      │ ← optional percentage indicator
├───────────────────────────────────────────────────────┤
│ FOOTER                                                │
└───────────────────────────────────────────────────────┘

Pipeline stages and status messages:
  Stage       | Message                                    | Indicator
  -------------|--------------------------------------------|------------------
  URL valid   | "Validating URL..."                        | ✓ (instant)
  Fetching    | "Fetching page content from example.com"   | ⋯ spinner
  LLM         | "Extracting recipe with local model"       | ░ in-progress bar
  Complete    | → transitions to Result view               | ✓ all stages
  Failed      | → transitions to Error view                | ✗ at failure stage

Mobile: step tracker collapses to vertical dots (● ○ ○), progress bar narrows.