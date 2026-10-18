# UI Improvement Plan — Recing Web App

Verified live with Playwright CLI against `http://localhost:3000` (desktop 1280×720,
mobile 390×844). Screenshots in `/tmp/{desk,mob}-*.png`. Data used: 1 completed recipe,
2 failed photo jobs (~47 days old).

```
Severity  P0 = broken / unusable      P1 = misleading / unreadable
          P2 = structural             P3 = polish
```

## Status: DONE (branch `optimize-ui-workflows`)

| Step | Items | Commit |
|------|-------|--------|
| Nav restructure + mobile header | P0-1, P2-6 | `c67a1ab` |
| Ingest table → cards on mobile | P0-2 | `63b62e2` |
| Time & status readability | P1-3, P1-4, P1-5 (+ formatDuration off-by-one fix) | `63b5eb3` |
| Polish sweep | P3 7–13 | `1c2680e` |

Notes: routes use English slugs (`/import`, `/import/photos`, `/import/queue`); German
labels only. Old routes redirect. 32 unit tests green, tsc + biome clean.

## P0 — Mobile is currently broken (fix first)

### 1. Header navigation collapses at phone width
Evidence (390px): logo renders as `R/e/c/i/n/g` one letter per line; every nav link
wraps to 2–3 lines (`Verar/beitu/ng`, `Foto-/Uplo/ad`). No `whitespace-nowrap` anywhere,
no mobile menu. The app is effectively unusable on a phone.

Fix:
- Add `whitespace-nowrap` + `shrink-0` to logo and nav links.
- Reduce top level to 2 items (see P2-6) → both pills fit at 390px without a hamburger.
- Verify at 360px, 390px, 768px.

### 2. Ingest table overflows and clips on mobile
Evidence (390px): `EINGEREICHT` header wraps one letter per line; the time cell is cut
mid-value; the `AKTIONEN` column (retry button) is clipped by `.card { overflow-hidden }`
→ **retry is unreachable on mobile**.

Fix: below `sm`, render rows as stacked cards instead of a `<table>`
(URL + source dot / status badge / time / retry action). Keep the table from `sm` up.
Pure presentation split inside the `IngestTable` organism — no data changes.

## P1 — Unreadable values (user-visible bugs)

### 3. Raw ISO-8601 durations shown to users
Evidence: recipe card chips show `PT25M PT25M`; detail page shows
`Vorbereitung: PT25M`, `Kochen: PT25M`. Cook-mode step timers (`⏱ {step.timer}`) have
the same problem. `formatDuration()` in `src/utils/formatTime.ts` **exists but is never
called** (dead code).

Fix: run all duration values through `formatDuration()` at the display layer
(`RecipeCard`, `RecipeDetail`, `CookMode`). Add unit tests for `formatDuration`
(minutes, hours+minutes, edge cases) — none exist yet.

### 4. Relative time produces absurd labels
Evidence: ingest rows show `1140h 39m` (≈ 47 days). `timeAgo()` only knows minutes/hours
and uses English units (`h`, `m`) in a German UI.

Fix: roll up by magnitude with `Intl.RelativeTimeFormat("de")`:
`<60s` → "gerade eben", minutes, hours (< 48 h), days; older → absolute date (de-CH).
Extend existing `timeAgo.test.ts`.

### 5. Status badges leak English enum values
Evidence: ingest table shows `FAILED` while the UI is German — translations already exist
(`ingest_pending/processing/failed`) but `StatusBadge` renders the raw status string.

Fix: map status → i18n label inside `StatusBadge`.

## P2 — Navigation structure (also improves mobile)

### 6. Consolidate import-related pages under one top-level item
Current top level has 4 items, three of which are "get a recipe in":

```
NOW                                PROPOSED
┌──────────────────────────┐       ┌──────────────────────────────┐
│ Recing │ Rezepte │        │       │ Recing │  Rezepte │ Import   │
│ Verarbeitung │ Foto-Upload│      └──────────────────────────────┘
│ │ Einreichen             │                second level (tabs):
└──────────────────────────┘       URL │ Fotos │ Warteschlange
                                       /import/url  (was /submit)
                                       /import/fotos (was /upload)
                                       /import/warteschlange (was /ingest)
```

- New `Import` section: second-level tab bar under the page header; default tab = URL
  form (it is the primary CTA, also linked from the empty state).
- Keep old routes as redirects (`/submit`, `/upload`, `/ingest`) so links keep working.
- `NavLink` active-state logic must switch from exact match to prefix match for
  `/import/*`.
- Side benefit: top level shrinks to 2 items → P0-1 fix stays simple (no hamburger).

## P3 — Polish & small bugs found during review

| # | Issue | Evidence / Fix |
|---|-------|----------------|
| 7 | Detail page footer shows **today's** date, always (`new Date().toLocaleDateString()`) instead of the recipe's `createdAt` | pass `job.createdAt` into `RecipeDetail`, format de-CH |
| 8 | `Portionen: 4 Personen` is redundant (value already contains "Personen") | drop the label or strip "Personen" from display |
| 9 | Typo in submit description: "eines **Rezeits**" → "Rezepts" (`i18n/de.ts`) | one-line fix |
| 10 | Photo upload affordance is a bare `+` tile; no text, no drag & drop, page looks empty on desktop | label the tile ("Foto hinzufügen"), add drop handler + `dragover` highlight |
| 11 | Failed jobs give no reason: `job.error` is stored but never rendered | show error under the status badge (card view) / as tooltip in table |
| 12 | `favicon.ico` 404 (console error on every load) | add favicon to `public/` |
| 13 | Recipe detail doesn't link the source URL (`result.sourceUrl`) — hurts trust in AI extraction | small "Quelle" link under the description when present |

## Suggested order of work

```
1. P0-1 + P2-6   nav restructure (one change set, fixes mobile header)
2. P0-2          ingest table → cards on mobile
3. P1-3/4/5      time & status readability (small, testable utils)
4. P3            polish sweep (7–13, each ≤ 1 h)
```

Each step ships independently; steps 1 and 2 are the only blocking ones for mobile use.
All changes stay inside `packages/web` except redirects, which are route files there too.
