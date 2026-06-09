# Hi-Fi Design — v1

**Tool:** tldraw (interactive canvas mockup) via Vite + React  
**Page:** Recipe Submit  
**Breakpoint:** Tablet (≥640px, iPad Air-like: 820×1180 canvas with bezel)

## Setup & Run

```bash
cd docs/ui/hifi-design/v1/
npm install          # first time only
npm run dev          # starts Vite dev server on port 5173
open http://localhost:5173
```

## Files

```
v1/
├── index.html              ← HTML shell (Vite entry)
├── package.json            ← Vite + React + tldraw dependencies
├── tsconfig*.json          ← TypeScript config
├── vite.config.ts          ← Vite config
├── src/
│   ├── main.tsx            ← React root mount
│   ├── App.tsx             ← Hi-fi mockup: tablet frame + recipe submit page
│   └── index.css           ← Global styles (hide tldraw chrome)
├── README.md               ← This file
└── components/             ← Component-level specs for implementation reference
    ├── input-field.md      ← URL input field spec
    └── submit-button.md    ← Primary CTA button spec
```

## How It Works

`tldraw` renders on an infinite canvas. The mockup uses the tldraw Editor API to programmatically create shapes that form a tablet device frame containing the recipe submit page:

- **rect()** — geo rectangle (tablet bezel, screen bg, header bar, input field, button)
- **ellipse()** — geo ellipse (decorative circles, nav dots, icon circle)
- **lineShape()** — line shape (blueprint grid lines, divider)
- **text()** — text shape (titles, labels, annotations)

All shapes are placed using the tldraw coordinate system, zoomed to fit the tablet frame. Default UI is hidden via `hideUi` prop for a clean mockup view.

## Design Decisions (v1)

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `bg` | `#F5F1E8` | Warm beige — page background |
| `accent` | `#D9665B` | Terracotta — CTA button, link icon |
| `textPri` | `'black'` | Headlines, active elements (tldraw color name) |
| `textSec` | `'#5a5650'` | Secondary text, descriptions (custom hex) |
| `border` | `'#c8bfb2'` | Subtle borders, grid lines |

### Typography
| Role | Font | Size | Weight |
|------|------|------|--------|
| Page title | Cormorant Garamond (serif) | xl (36px) | 700 |
| Nav links | Inter (sans-serif) | m (14px) | 500 |
| Body/description | Inter | m (15px) | 400 |
| Status hints | Inter italic | s (12px) | 400 |

### Layout Structure
```
┌─────────────────────────────────────────┐ ← iPad bezel (dark, rounded)
│ ┌─────────────────────────────────────┐ │
│ │ HEADER: "Recing"    [About]         │ │ ← serif logo, sans-serif nav
│ ├─────────────────────────────────────┤ │
│ │                                     │ │
│ │ SUBMIT A RECIPE URL                 │ ← Garamond headline (serif xl)
│ │ Paste the URL of any recipe...      │ ← Inter body text
│ │ ─────────────────────────────────── │ ← divider line
│ │                                     │ │
│ │ [🔗] https://example.com/...  [→]   │ ← input + terracotta button
│ │                                     │ │
│ │ Status: idle                        │ ← hint text, italic muted
│ │                                     │ │
│ │ ── decorative circles & annotations │ │ ← blueprint ornaments
│ │ RECING v0.1.0 · TABLET VIEW         │ ← vertical edge annotation
│ │                                     │ │
│ │ © 2026 Recing · Terms · Help        │ ← footer
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Ornamentation (per inspiration)
- **Blueprint grid**: subtle horizontal/vertical lines every 80px
- **Vertical annotations** on left/right edges ("SHEET 01 · SUBMIT", "RECING v0.1.0")
- **Circular decoration** in bottom-right area
- **Fine divider line** between title and input section

## Status

- [x] Recipe Submit page — tablet view (idle state)
- [ ] Recipe Submit — validation error state
- [ ] Recipe Submit — loading/processing state  
- [ ] Recipe Detail page — tablet view
- [ ] Error View page — tablet view
- [ ] History/List page — tablet view

## Next Steps

1. Validate mockup with team (open `http://localhost:5173`)
2. Add remaining states (error, loading) as toggleable views in App.tsx
3. Create component-level specs in `components/` folder
4. Export final designs for implementation reference
