# HiFi Design

High-fidelity design specifications and visual guidelines for the application.

## Purpose

This directory contains complete visual design specifications needed for implementation:
- Design tokens (colors, fonts, spacing)
- Component designs and variations
- Page mockups and layouts
- Interaction patterns and animations
- Accessibility specifications

## Directory Structure

```
hifi-design/
├── README.md              ← You are here
├── design-tokens.md       ← Core design values (colors, fonts, spacing)
├── inspiration/           ← Reference images and visual inspiration
│   └── README.md
├── v1/                    ← Version 1 designs (tool-specific)
├── v2/                    ← Version 2 designs (tool-specific)
└── v[N]/                  ← Future iterations
```

## Workflow

### 1. Gather Inspiration
- Add reference images to `inspiration/` folder
- Document what aspects are relevant (colors, layouts, patterns)
- Use these to inform design token decisions

### 2. Define Design Tokens
- Update `design-tokens.md` with concrete values
- Choose color palette from inspiration references
- Select typography (fonts, sizes, weights)
- Define spacing, shadows, and other core values

### 3. Create Version Designs
- Create designs in subfolders: `v1/`, `v2/`, etc.
- Each version can use different tools (Figma, Sketch, Penpot, etc.)
- Document tool used and export formats in version README

### 4. Component Specifications
Within each version folder, organize by:
- **Components/** - Individual UI components
- **Pages/** - Full page layouts
- **States/** - Interaction states and variations
- **Responsive/** - Breakpoint specifications

## Design Tokens

Core design values are defined in `design-tokens.md`:

```
Design Tokens
├── Colors          → Primary, secondary, neutral, semantic
├── Typography      → Fonts, sizes, weights, line heights
├── Spacing         → 4px base scale (xs, sm, md, lg, xl...)
├── Border Radius   → Corner rounding values
├── Shadows         → Elevation system
├── Z-Index         → Layering system
└── Transitions     → Animation timing
```

All implementation should reference these tokens for consistency.

## Version Management

### Creating a New Version

1. Create folder: `v[N]/`
2. Add `README.md` documenting:
   - Design tool used (Figma, Penpot, etc.)
   - Export formats and locations
   - Key changes from previous version
   - Link to design file (if applicable)
3. Export assets following naming conventions
4. Update this README with version notes

### Version Notes

**v1/** - Initial design iteration
**v2/** - Second iteration (if needed)

*Add notes here as versions are created*

## Export Guidelines

For each version, export:
- **SVG** - Icons, logos, vector graphics
- **PNG** - Screenshots, mockups (2x for retina)
- **Design files** - Source files or links to cloud tools

### Naming Convention
```
[component]-[variant]-[state].[ext]
Examples:
  button-primary-default.svg
  button-primary-hover.svg
  card-product-mobile.png
```

## Implementation Reference

Developers should:
1. Check `design-tokens.md` for core values
2. Reference version-specific designs for layout/composition
3. Consult `inspiration/` to understand visual direction
4. Ask for clarification before deviating from specs

## Tools & Resources

### Recommended Tools
- **Figma** - Collaborative web-based design
- **Penpot** - Open-source design tool
- **Sketch** - Mac-based design tool
- **Adobe XD** - Adobe's design platform

### Design System Resources
- Material Design: https://material.io
- Human Interface Guidelines: https://developer.apple.com/design
- Tailwind Color Palette: https://tailwindcss.com/docs/customizing-colors
