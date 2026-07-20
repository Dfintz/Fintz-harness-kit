# CSS Naming Conventions

**Version:** 1.0  
**Date:** January 12, 2026  
**Status:** Active

---

## Overview

This document defines the CSS naming conventions used in the Star Citizen Fleet Manager project. We
use a hybrid approach combining BEM methodology for global styles with CSS Modules for
component-scoped styles.

---

## Table of Contents

1. [CSS Modules Naming](#css-modules-naming)
2. [Design Token Naming](#design-token-naming)
3. [Utility Class Naming](#utility-class-naming)
4. [Legacy BEM Naming](#legacy-bem-naming)
5. [Examples](#examples)

---

## CSS Modules Naming

### Core Principle

CSS Modules use **camelCase** naming to align with JavaScript conventions and enable clean property
access.

### Component Root Classes

The root element of a component should use the component name in camelCase:

```css
/* TrendIndicator.module.css */
.trendIndicator {
}

/* GlassCard.module.css */
.glassCard {
}

/* EmptyState.module.css */
.emptyState {
}
```

### Element Classes

Child elements within a component use simple, semantic names:

```css
/* Card.module.css */
.card {
} /* Root */
.header {
} /* Child element */
.body {
} /* Child element */
.footer {
} /* Child element */
.title {
} /* Nested element */
.subtitle {
} /* Nested element */
```

### Modifier Classes

Modifiers indicate variants or states and use descriptive camelCase names:

```css
/* Button.module.css */
.button {
} /* Base */
.primary {
} /* Variant */
.secondary {
} /* Variant */
.large {
} /* Size */
.small {
} /* Size */
.disabled {
} /* State */
.loading {
} /* State */
.success {
} /* Context */
.error {
} /* Context */
```

### State Classes

Boolean states should use `is` or `has` prefixes:

```css
.isActive {
}
.isSelected {
}
.isDisabled {
}
.isLoading {
}
.isOpen {
}
.isClosed {
}
.hasError {
}
.hasWarning {
}
```

### Usage in TypeScript/React

```tsx
import styles from './Button.module.css';

function Button({ variant, size, disabled }) {
  return (
    <button
      className={`
        ${styles.button}
        ${styles[variant]}
        ${styles[size]}
        ${disabled ? styles.disabled : ''}
      `}
    >
      Click me
    </button>
  );
}
```

---

## Design Token Naming

### Structure

Design tokens follow this pattern:

```
--{category}-{property}-{variant}-{state}
```

### Categories

| Prefix       | Purpose      | Examples                                    |
| ------------ | ------------ | ------------------------------------------- |
| `color-`     | Color values | `--color-primary-bg`, `--color-text-accent` |
| `font-`      | Typography   | `--font-size-lg`, `--font-weight-bold`      |
| `spacing-`   | Space values | `--spacing-md`, `--spacing-section`         |
| `border-`    | Borders      | `--border-color`, `--border-radius-md`      |
| `shadow-`    | Shadows      | `--shadow-md`, `--shadow-glow`              |
| `animation-` | Animations   | `--animation-duration-fast`                 |

### Examples

**Colors:**

```css
--color-primary-bg
--color-secondary-bg
--color-text-primary
--color-text-secondary
--color-border-default
--color-border-accent
--color-success
--color-error
```

**Typography:**

```css
--font-size-sm
--font-size-base
--font-size-lg
--font-weight-normal
--font-weight-bold
--line-height-body
--line-height-heading
```

**Spacing:**

```css
--spacing-xs
--spacing-sm
--spacing-md
--spacing-lg
--spacing-xl
```

**Component-Specific Tokens:**

```css
--button-primary-bg
--button-primary-hover-bg
--card-border-radius
--modal-max-width
```

### Usage

```css
.myComponent {
  background: var(--color-primary-bg);
  color: var(--color-text-primary);
  padding: var(--spacing-md);
  font-size: var(--font-size-base);
  border-radius: var(--border-radius-md);
}
```

---

## Utility Class Naming

### Naming Pattern

Utility classes use **kebab-case** and follow a functional naming pattern:

```
.{property}-{value}
```

### Layout Utilities

```css
.container
.flex
.flex-col
.flex-mobile-column
.gap-2
.gap-4
```

### Spacing Utilities

```css
/* Margin */
.mt-1    /* margin-top: 0.5rem */
.mt-2    /* margin-top: 1rem */
.mb-1    /* margin-bottom: 0.5rem */
.mb-2    /* margin-bottom: 1rem */

/* Responsive */
@media (max-width: 768px) {
  .mt-md-2  /* margin-top on medium screens */
}
```

### Text Utilities

```css
.text-center
.text-left
.text-right
```

### Status Badges

```css
.badge
.badge-success
.badge-warning
.badge-error
```

### Usage

```tsx
<div className="container flex gap-4">
  <div className="mt-2 mb-4">
    <span className="badge badge-success">Active</span>
  </div>
</div>
```

---

## Legacy BEM Naming

**Note:** BEM is being phased out in favor of CSS Modules for component styles. It's retained only
in legacy code and global styles.

### BEM Structure

```
.block__element--modifier
```

### Components

```css
/* Block */
.card {
}

/* Elements */
.card__header {
}
.card__body {
}
.card__footer {
}
.card__title {
}

/* Modifiers */
.card--primary {
}
.card--large {
}
.card--highlighted {
}

/* Element modifiers */
.card__header--sticky {
}
.card__title--large {
}
```

### When to Use BEM

- ✅ Global styles in `global.css`
- ✅ Legacy components (during migration)
- ❌ New component development (use CSS Modules instead)

---

## Examples

### Example 1: Button Component

**CSS Module:**

```css
/* Button.module.css */
.button {
  padding: var(--spacing-button-v) var(--spacing-button-h);
  border-radius: var(--border-radius-button);
  font-weight: var(--font-weight-button);
  transition: all var(--animation-duration-fast);
}

.primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.secondary {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
}

.large {
  font-size: var(--font-size-lg);
  padding: var(--spacing-lg) var(--spacing-xl);
}

.small {
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
}

.isLoading {
  opacity: 0.6;
  cursor: wait;
}

.isDisabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**React Component:**

```tsx
import styles from './Button.module.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  children,
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size !== 'medium' && styles[size],
    loading && styles.isLoading,
    disabled && styles.isDisabled,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading}>
      {loading ? 'Loading...' : children}
    </button>
  );
}
```

### Example 2: Card Component

**CSS Module:**

```css
/* Card.module.css */
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--border-radius-card);
  padding: var(--spacing-card-padding);
  box-shadow: var(--shadow-card);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.body {
  color: var(--color-text-primary);
}

.footer {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-subtle);
}

.isClickable {
  cursor: pointer;
  transition: transform var(--animation-duration-fast);
}

.isClickable:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

**React Component:**

```tsx
import styles from './Card.module.css';

interface CardProps {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  clickable?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Card({ title, subtitle, footer, clickable = false, onClick, children }: CardProps) {
  return (
    <div
      className={`${styles.card} ${clickable ? styles.isClickable : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {(title || subtitle) && (
        <div className={styles.header}>
          <div>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
      )}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
```

### Example 3: Status Indicator

**CSS Module:**

```css
/* StatusIndicator.module.css */
.statusIndicator {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.success .dot {
  background: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

.warning .dot {
  background: var(--color-warning);
  box-shadow: 0 0 8px var(--color-warning);
}

.error .dot {
  background: var(--color-error);
  box-shadow: 0 0 8px var(--color-error);
}

.neutral .dot {
  background: var(--color-text-muted);
}

.label {
  color: var(--color-text-secondary);
}
```

---

## Dos and Don'ts

### ✅ DO

- Use camelCase for CSS Module class names
- Use semantic, descriptive names
- Leverage design tokens for values
- Keep selectors flat (avoid nesting)
- Use state prefixes (`is`, `has`)
- Group related modifiers logically

### ❌ DON'T

- Use kebab-case in CSS Modules (harder to access in JS)
- Use presentational names (`blueButton`, `bigText`)
- Hardcode values (use tokens instead)
- Create deep selector hierarchies
- Mix BEM and CSS Modules in the same file
- Use global class names for component-specific styles

---

## Migration Checklist

When converting legacy CSS to CSS Modules:

- [ ] Rename file: `Component.css` → `Component.module.css`
- [ ] Convert class names: kebab-case → camelCase
- [ ] Remove BEM prefixes (`.card__header` → `.header`)
- [ ] Update import: `import './Component.css'` → `import styles from './Component.module.css'`
- [ ] Update className usage: `className="card"` → `className={styles.card}`
- [ ] Replace hardcoded values with design tokens
- [ ] Test component rendering
- [ ] Update tests if needed

---

## Related Documentation

- [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) - Overall CSS structure
- [UI_DESIGN_TOKENS.md](../docs/UI_DESIGN_TOKENS.md) - Token reference
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines

---

**Document Version:** 1.0  
**Last Updated:** January 12, 2026  
**Next Review:** February 2026
