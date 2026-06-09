# Wireframes — Layout

Structural elements and chrome shared across all pages. Page-specific content lives in [../content](../).

---

## Application Shell (all breakpoints)

```
┌───────────────────────────────────┐
│ HEADER                            │ ← fixed height, see below
├───────────────────────────────────┤
│                                   │
│ ── CONTENT AREA ────────────────  │ ← responsive, max-width centered on tablet/desktop
│                                   │
│ [Page Title]                      │
│                                   │
│ ┌──────────┐ ┌─────────────────┐  │
│ │          │ │                 │  │
│ │ Sidebar  │ │   Main Content  │  │ ← optional sidebar (context dependent)
│ │          │ │                 │  │
│ └──────────┘ └─────────────────┘  │
│                                   │
├───────────────────────────────────┤
│ FOOTER                            │ ← minimal, consistent across pages
└───────────────────────────────────┘
```

## Header Variations by Breakpoint

### Mobile (< sm / 640px) — hamburger nav
```
┌──────────────┐
│ [☰] Recing   │ ← h-14 (56px), logo left, menu icon right
└──────────────┘
```

### Tablet (≥ sm / 640px – < lg / 1024px) — link-based nav
```
┌─────────────────────────────┐
│ Recing     [About]          │ ← links appear, still compact
└─────────────────────────────┘
```

### Desktop (≥ lg / 1024px) — full nav bar
```
┌───────────────────────────────────────────────────────┐
│ Recing   Submit    History    About           [⚙]     │ ← active page highlighted
└───────────────────────────────────────────────────────┘
```

## Navigation States

| State              | Mobile        | Tablet       | Desktop      |
|--------------------|---------------|--------------|--------------|
| Unauthenticated    | hamburger → drawer | links in header | full nav bar |
| Active page        | highlighted   | bold/underline | underline + accent line |
| Settings           | in drawer     | link         | gear icon (right) |

## Content Area Behavior

| Breakpoint | Max Width | Centered? | Padding        |
|------------|-----------|-----------|----------------|
| Mobile     | none      | No        | p-2 (8px)      |
| Tablet     | max-w-md  | Yes       | p-4 (16px)     |
| Desktop    | max-w-xl  | Yes       | px-8 py-6      |

## Footer

Minimal across all breakpoints — version text or link to about/help. No functional elements in MVP.

```
┌──────────────┐ ┌─────────────────────────────┐ ┌───────────────────────────────────┐
│ FOOTER       │ │ FOOTER                      │ │ FOOTER                            │
│ v0.1.0       │ │ © 2026 Recing               │ │ Recing · Terms · Help · v0.1.0    │
└──────────────┘ └─────────────────────────────┘ └───────────────────────────────────┘
```

## Spacing & Sizing Reference

Values in px, 4px base scale → use as CSS tokens.

### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| `xs`  | 4     | Tight inline gaps (icon+label) |
| `sm`  | 8     | Field padding, small gaps |
| `md`  | 16    | Default gap between sections |
| `lg`  | 24    | Section margins, card padding |

### Component Heights & Touch Targets (all breakpoints)
| Element       | Height | Notes |
|---------------|--------|-------|
| Header        | 56     | Fixed across all breakpoints |
| Input field   | 48     | Includes padding, border |
| Button        | 48     | Min touch target |
| Nav link      | 40     | Min hit area |
| List items    | —      | 12px top/bottom padding (≈44px hit) |

### Column & Gutter (desktop two-column pages)
- Grid: `1fr / 1fr`, gap: `md` (16px), col padding: `sm` (8px) internal, `lg` (24px) from surrounding content
