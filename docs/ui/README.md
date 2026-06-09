# UI Documentation

This directory contains comprehensive documentation of the application's user interface structure, layout, and design.

## Design Values Reference

All spacing, breakpoints, sizing, and layout values defined in these wireframes align with [Tailwind CSS defaults](https://tailwindcss.com/docs/theme) as a sane baseline. Tailwind CSS is **not** used in this project — the values are simply adopted from it as our reference standard.

| Wireframe Token | Tailwind Equivalent |
|-----------------|--------------------|
| Breakpoints: 480px, 1024px | `sm`, `md` (mobile-first) |
| Max widths: 640, 768, 1024, 1200 | `max-w-sm/md/lg/xl/2xl` |
| Spacing scale: 4, 8, 16, 24, 32 | `px-1 / px-2 / px-4 / px-6 / px-8` |
| Component heights: 40, 48, 56 | `h-10 / h-12 / h-14` |

When in doubt about a value, check Tailwind's default theme config first.

## Overview

```
UI Documentation
├── Wireframes     → Layout system + Page views (submit, detail, error, list)
└── HiFi Design    → Visual design details (colors, typography, component specs)
```

The sitemap was merged into wireframes — page definitions live alongside the layout system in `wireframes/content/`.

## Structure

### [Wireframes](./wireframes/)
Low-fidelity diagrams split into two concerns:
- **[Layout](./wireframes/layout/)** — Header, navigation patterns, content area behavior, footer, spacing & sizing reference
- **[Content](./wireframes/content/)** — Page-specific views: submit new recipe, view recipe detail, error states, history list, loading overlay

### [HiFi Design](./hifi-design/README.md)
High-fidelity design specifications including:
- Visual styling and color schemes
- Typography and font specifications
- Component designs and interactions
- Detailed UI specifications

## Getting Started

Start with **Wireframes → Layout** for the structural system, then browse **Content** for page-specific views. When ready to define visual details, reference **HiFi Design**.
