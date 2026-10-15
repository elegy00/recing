# Design Tokens

Implemented in `packages/web/src/styles.css` (CSS variables + Tailwind v4 `@theme`).
This document describes the **actual** tokens — keep it in sync when changing styles.

## Concept

Warm Mediterranean kitchen: cream paper, terracotta clay, olive green, fig purple.
Serif display type (EB Garamond) for headings, Inter for UI text.
Primary target: **iPad in the kitchen** → large base size, big touch targets,
no hover-dependent interactions.

```
        ┌─────────────────────────────────────────────┐
        │  🫒 Recing          Rezepte  Verarbeitung   │  header: cream, olive sprig mark
        ├─────────────────────────────────────────────┤
        │                                             │
        │  Rezepte ─── (terracotta rule)              │  H1: EB Garamond 2.5rem
        │  Alle extrahierten Rezepte ...      🍑🍑    │  fig motif, decorative
        │                                             │
        │  ┌─────────────────────────────────────┐   │
        │  │ (Vorbereitung · 25h) (Kochen · 25h) │   │  chips: olive-soft pills
        │  │ Bündner Gratin                       │   │  card title: serif 1.5rem
        │  │ Die schnellste Art, Capuns ...       │   │
        │  └─────────────────────────────────────┘   │  card: cream surface, sand border
        │                                             │
        │      [ Kochen ]  (terracotta pill button)   │
        └─────────────────────────────────────────────┘
```

## Color Palette

### Warm neutrals
```
--bg:             #f4eee0   page background (warm cream)
--card-bg:        #fcf9f1   cards & surfaces (lighter cream)
--text-primary:   #2c2822   warm near-black
--text-secondary: #6f675a   warm taupe
--border:         #e2d8c4   sand
```

### Terracotta — primary accent (actions, emphasis)
```
--accent:      #b04e33   buttons, active nav, rules, list markers
--accent-deep: #96402a   hover states
--accent-soft: #f2ded3   tinted backgrounds (badges, selection)
```

### Olive — secondary accent (meta info, success-ish states)
```
--olive:      #5c6b3c   sprig motif, links
--olive-deep: #4c5931   hover / emphasis
--olive-soft: #e7e6d2   chip backgrounds
```

### Fig — tertiary accent (decorative only)
```
--fig: #7a4a5f   fig motif, photo-job markers
```

## Typography

```
Serif (display):  "EB Garamond", Georgia, serif    headings, recipe names, step text
Sans (UI):        "Inter", system-ui, sans-serif   body, buttons, meta
```

- Root font size: **17px** (kitchen readability; all rem sizes scale with it)
- Page title: `text-4xl` serif · Card title: `text-2xl` serif · Body: `text-base`
- Eyebrow labels: uppercase, `tracking-[0.18em]`, terracotta (`.eyebrow`)

Fonts load via a single `<link>` in `routes/__root.tsx` with preconnects to
`fonts.googleapis.com` / `fonts.gstatic.com`. Do not add CSS `@import` for fonts.

## Components (in `styles.css`, `@layer components`)

```
.card         cream surface, sand border, rounded-xl, shadow-sm
.btn-primary  terracotta pill, white text, hover → accent-deep
.btn-outline  cream pill, sand border, hover → terracotta text/border
.chip         olive-soft pill for meta (times, servings)
.eyebrow      uppercase terracotta label above section titles
```

## Motifs

Inline SVGs in `src/components/Motifs.tsx` (no image assets):

```
OliveSprig    header logo mark + footer divider accent
Figs          decorative fig pair on the recipe list page
SprigDivider  thin olive branch used as a section divider
```

Keep motifs subtle: small, low-contrast, never blocking content.

## Interaction rules (touch-first)

- No hover-only affordances (e.g. remove buttons must be always visible)
- Touch targets ≥ ~44px (buttons use `py-3` + `text-base`)
- Active nav state is a persistent pill, not a hover effect
