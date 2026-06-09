# Design Tokens

Core design values used throughout the application for consistent implementation.

## Color Palette

### Primary Colors
```
Primary-900:   #[HEX]  // Darkest - hover states, emphasis
Primary-700:   #[HEX]  // Dark - primary actions
Primary-500:   #[HEX]  // Base - main brand color
Primary-300:   #[HEX]  // Light - backgrounds, subtle elements
Primary-100:   #[HEX]  // Lightest - tints, very subtle backgrounds
```

### Secondary Colors
```
Secondary-900: #[HEX]
Secondary-700: #[HEX]
Secondary-500: #[HEX]
Secondary-300: #[HEX]
Secondary-100: #[HEX]
```

### Neutral Colors
```
Gray-900:      #[HEX]  // Near black - primary text
Gray-700:      #[HEX]  // Dark gray - secondary text
Gray-500:      #[HEX]  // Mid gray - borders, dividers
Gray-300:      #[HEX]  // Light gray - disabled states
Gray-100:      #[HEX]  // Very light gray - backgrounds
White:         #FFFFFF
Black:         #000000
```

### Semantic Colors
```
Success-700:   #[HEX]  // Dark green
Success-500:   #[HEX]  // Base green
Success-100:   #[HEX]  // Light green background

Warning-700:   #[HEX]  // Dark yellow/orange
Warning-500:   #[HEX]  // Base yellow/orange
Warning-100:   #[HEX]  // Light yellow/orange background

Error-700:     #[HEX]  // Dark red
Error-500:     #[HEX]  // Base red
Error-100:     #[HEX]  // Light red background

Info-700:      #[HEX]  // Dark blue
Info-500:      #[HEX]  // Base blue
Info-100:      #[HEX]  // Light blue background
```

## Typography

### Font Families
```
Primary:       "[Font Name]", sans-serif
Secondary:     "[Font Name]", serif  // If needed for headings/special use
Monospace:     "Courier New", monospace  // For code, data
```

### Font Sizes
```
Display:       48px / 3rem     // Large marketing headings
H1:            32px / 2rem     // Page titles
H2:            24px / 1.5rem   // Section headings
H3:            20px / 1.25rem  // Subsection headings
H4:            18px / 1.125rem // Component headings
Body-Large:    16px / 1rem     // Emphasis text
Body:          14px / 0.875rem // Standard text
Body-Small:    12px / 0.75rem  // Helper text, captions
```

### Font Weights
```
Light:         300
Regular:       400
Medium:        500
Semibold:      600
Bold:          700
```

### Line Heights
```
Tight:         1.2   // Headings
Normal:        1.5   // Body text
Relaxed:       1.75  // Long form content
```

## Spacing Scale

Based on 4px base unit:
```
xs:   4px   / 0.25rem
sm:   8px   / 0.5rem
md:   16px  / 1rem
lg:   24px  / 1.5rem
xl:   32px  / 2rem
2xl:  48px  / 3rem
3xl:  64px  / 4rem
```

## Border Radius
```
none:   0px
sm:     2px
md:     4px
lg:     8px
xl:     12px
full:   9999px  // Pills, circular elements
```

## Shadows
```
sm:   0 1px 2px rgba(0, 0, 0, 0.05)
md:   0 4px 6px rgba(0, 0, 0, 0.1)
lg:   0 10px 15px rgba(0, 0, 0, 0.1)
xl:   0 20px 25px rgba(0, 0, 0, 0.15)
```

## Z-Index Layers
```
Base:          0
Dropdown:      1000
Sticky:        1020
Modal:         1030
Popover:       1040
Tooltip:       1050
```

## Transitions
```
Fast:          150ms ease-in-out
Normal:        300ms ease-in-out
Slow:          500ms ease-in-out
```

## Implementation Notes

- All values should be defined as CSS variables or design tokens
- Use semantic naming (e.g., `color-primary` not `color-blue`)
- Maintain consistency across all UI components
- Update version-specific files (v1/, v2/) with concrete values
- Reference inspiration images when making color/font decisions
