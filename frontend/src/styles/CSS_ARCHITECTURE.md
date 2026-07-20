# CSS Architecture

**Version:** 1.0  
**Date:** January 12, 2026  
**Status:** Active

---

## Overview

The Star Citizen Fleet Manager uses an organized CSS architecture that separates concerns into
distinct layers. This document describes the structure, conventions, and best practices for styling
the application.

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [CSS Organization Layers](#css-organization-layers)
3. [CSS Modules](#css-modules)
4. [Import Order](#import-order)
5. [Migration from Legacy CSS](#migration-from-legacy-css)
6. [Best Practices](#best-practices)

---

## Directory Structure

```
frontend/src/
├── styles/
│   ├── tokens.css          # Design tokens (CSS custom properties)
│   ├── global.css          # Global styles and resets
│   ├── a11y.css           # Accessibility styles (WCAG 2.1 AA)
│   └── utilities.css       # Utility classes
├── components/
│   └── [ComponentName]/
│       ├── Component.tsx
│       └── Component.module.css  # Component-scoped styles
└── index.css               # Main entry point (imports above)
```

---

## CSS Organization Layers

### Layer 1: Design Tokens (`styles/tokens.css`)

**Purpose:** Single source of truth for design decisions.

Design tokens are CSS custom properties that define the visual language of the application:

- **Colors:** Brand colors, backgrounds, text, borders, status colors
- **Typography:** Font sizes, weights, line heights, letter spacing
- **Spacing:** Margins, padding, gaps
- **Shadows:** Box shadows and glow effects
- **Animation:** Timing functions and durations

**Example:**

```css
:root {
  --primary-bg: #0a1628;
  --accent-blue: #0099cc;
  --font-size-lg: 1.25rem;
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

**Usage:**

```css
.my-component {
  background: var(--primary-bg);
  color: var(--accent-blue);
  font-size: var(--font-size-lg);
  box-shadow: var(--shadow-md);
}
```

**See also:** [UI_DESIGN_TOKENS.md](../docs/UI_DESIGN_TOKENS.md)

### Layer 2: Global Styles (`styles/global.css`)

**Purpose:** Base styling for HTML elements and application-wide patterns.

Contains:

- CSS reset (`* { margin: 0; padding: 0; }`)
- Base element styles (body, headings, links, buttons, forms, tables)
- Global component patterns (cards, error messages, loading states)
- Theme toggle styles

**Characteristics:**

- Applies to bare HTML elements
- No component-specific styling
- Uses design tokens for values

### Layer 3: Accessibility (`styles/a11y.css`)

**Purpose:** WCAG 2.1 AA compliant accessibility styles.

Contains:

- Focus indicators for all interactive elements
- Screen reader utilities (`.sr-only`)
- Skip navigation link
- High contrast mode support
- Reduced motion preferences
- Touch target sizing

**Key Features:**

- All focus states use `--a11y-focus-ring-*` tokens
- Supports `prefers-reduced-motion` media query
- Supports `forced-colors` (high contrast) mode

### Layer 4: Utilities (`styles/utilities.css`)

**Purpose:** Reusable utility classes for common styling patterns.

Contains:

- Layout utilities (`.container`, `.flex`, `.gap-*`)
- Spacing utilities (`.mt-*`, `.mb-*`)
- Text utilities (`.text-center`)
- Status badges (`.badge-success`, `.badge-error`)
- Responsive utilities

**Philosophy:**

- Functional CSS approach for rapid development
- Avoids deep selector specificity
- Mobile-first responsive design

### Layer 5: Component Styles (CSS Modules)

**Purpose:** Component-scoped styles using CSS Modules.

**Naming:** `ComponentName.module.css`

**Benefits:**

- **Scoped:** Styles are locally scoped to the component
- **No conflicts:** Automatic class name hashing prevents collisions
- **Type-safe:** TypeScript integration with module imports
- **Maintainable:** Co-located with component logic

**Example:**

```css
/* Button.module.css */
.button {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  background: var(--accent-blue);
}

.primary {
  background: var(--accent-blue);
}

.secondary {
  background: var(--secondary-bg);
}
```

```tsx
// Button.tsx
import styles from './Button.module.css';

export function Button({ variant = 'primary' }) {
  return <button className={`${styles.button} ${styles[variant]}`}>Click me</button>;
}
```

---

## CSS Modules

### Naming Convention

CSS Modules use **camelCase** for class names to match JavaScript conventions:

```css
/* Good - camelCase */
.trendIndicator {
}
.animatedUp {
}
.cardHeader {
}

/* Avoid - kebab-case (harder to use in JS) */
.trend-indicator {
}
.animated-up {
}
```

### Class Name Structure

Follow BEM-inspired naming within modules:

```css
/* Block (component root) */
.card {
}

/* Elements (parts of the component) */
.header {
}
.body {
}
.footer {
}

/* Modifiers (variants/states) */
.primary {
}
.secondary {
}
.disabled {
}
.large {
}
```

### Composing Styles

Use composition for reusability:

```css
.baseButton {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-weight: 600;
}

.primaryButton {
  composes: baseButton;
  background: var(--accent-blue);
}

.secondaryButton {
  composes: baseButton;
  background: var(--secondary-bg);
}
```

### TypeScript Integration

CSS Modules are typed automatically by Vite:

```tsx
import styles from './Component.module.css';

// TypeScript knows all available classes
<div className={styles.container} />;
```

---

## Import Order

### In index.css (Application Entry Point)

```css
/* 1. Design Tokens */
@import './styles/tokens.css';

/* 2. Global Styles */
@import './styles/global.css';

/* 3. Accessibility */
@import './styles/a11y.css';

/* 4. Utilities */
@import './styles/utilities.css';
```

### In Component Files

```tsx
// 1. React imports
import React from 'react';

// 2. Third-party libraries
import { View } from '@adobe/react-spectrum';

// 3. Internal imports
import { someUtil } from '@/utils';

// 4. CSS Module import (last)
import styles from './Component.module.css';
```

---

## Migration from Legacy CSS

### Before (Legacy CSS)

```
src/components/ui/TrendIndicator.css
src/components/ui/TrendIndicator.tsx
```

```css
/* TrendIndicator.css */
.trend-indicator {
}
.trend-indicator__icon {
}
.trend-indicator--sm {
}
```

```tsx
// TrendIndicator.tsx
import './TrendIndicator.css';

<span className="trend-indicator trend-indicator--sm">
```

### After (CSS Modules)

```
src/components/ui/TrendIndicator.module.css
src/components/ui/TrendIndicator.tsx
```

```css
/* TrendIndicator.module.css */
.trendIndicator {
}
.icon {
}
.sm {
}
```

```tsx
// TrendIndicator.tsx
import styles from './TrendIndicator.module.css';

<span className={`${styles.trendIndicator} ${styles.sm}`}>
```

### Migration Steps

1. **Create CSS Module file:** Rename `Component.css` → `Component.module.css`
2. **Convert class names:** Change kebab-case to camelCase
3. **Simplify selectors:** Remove BEM-style prefixes (handled by scoping)
4. **Update imports:** Change from `import './Component.css'` to
   `import styles from './Component.module.css'`
5. **Update className usage:** Use `styles.className` instead of string literals
6. **Test:** Verify styles still apply correctly

---

## Best Practices

### 1. Use Design Tokens

**✅ Good:**

```css
.card {
  background: var(--primary-bg);
  border: 1px solid var(--border-color);
  padding: var(--spacing-lg);
}
```

**❌ Avoid:**

```css
.card {
  background: #0a1628;
  border: 1px solid #2a3f5f;
  padding: 24px;
}
```

### 2. Component-Scoped Styles

**✅ Good:** CSS Modules for component-specific styling

```tsx
import styles from './Card.module.css';
<div className={styles.card} />;
```

**❌ Avoid:** Global styles for component-specific patterns

```css
/* global.css - Don't do this */
.my-special-card {
}
```

### 3. Avoid Deep Nesting

**✅ Good:**

```css
.card {
}
.cardHeader {
}
.cardTitle {
}
```

**❌ Avoid:**

```css
.card .header .title {
}
```

### 4. Use Semantic Class Names

**✅ Good:**

```css
.primaryButton {
}
.errorMessage {
}
.isLoading {
}
```

**❌ Avoid:**

```css
.blueButton {
}
.redText {
}
.spinny {
}
```

### 5. Mobile-First Responsive Design

**✅ Good:**

```css
.container {
  padding: 1rem; /* Mobile default */
}

@media (min-width: 768px) {
  .container {
    padding: 2rem; /* Desktop override */
  }
}
```

### 6. Leverage Utility Classes

For simple, reusable patterns, use utility classes instead of creating new components:

```tsx
// Simple spacing - use utilities
<div className="mt-2 mb-4">

// Complex component - use CSS Module
<Card className={styles.specialCard}>
```

### 7. Accessibility First

- Always include focus states
- Use semantic HTML elements
- Provide ARIA labels when needed
- Test with screen readers

### 8. Performance Considerations

- Keep selectors simple (1-2 levels max)
- Avoid expensive properties (box-shadow, filter) in animations
- Use `will-change` sparingly for animations
- Prefer `transform` and `opacity` for animations (GPU-accelerated)

---

## Related Documentation

- [CSS_NAMING_CONVENTIONS.md](./CSS_NAMING_CONVENTIONS.md) - Detailed naming guide
- [UI_DESIGN_TOKENS.md](../docs/UI_DESIGN_TOKENS.md) - Complete token reference
- [CONTRIBUTING.md](../CONTRIBUTING.md) - General contribution guidelines

---

**Document Version:** 1.0  
**Last Updated:** January 12, 2026  
**Next Review:** February 2026
