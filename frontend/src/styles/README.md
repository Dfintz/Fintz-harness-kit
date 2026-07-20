# Styles Directory

This directory contains the organized CSS architecture for the Star Citizen Fleet Manager frontend
application.

## Structure

```
styles/
├── tokens.css              # Design tokens (CSS custom properties)
├── global.css              # Global styles and base elements
├── a11y.css               # Accessibility styles (WCAG 2.1 AA)
├── utilities.css           # Reusable utility classes
├── CSS_ARCHITECTURE.md     # Complete architecture guide
├── CSS_NAMING_CONVENTIONS.md  # Naming conventions
└── TAILWIND_MIGRATION.md   # Tailwind CSS evaluation
```

## Quick Start

### Using Design Tokens

Design tokens are CSS custom properties defined in `tokens.css`. Use them instead of hardcoding
values:

```css
.my-component {
  background: var(--primary-bg);
  color: var(--text-primary);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
}
```

### Creating Component Styles

Use CSS Modules for component-specific styling:

1. **Create the CSS Module file:**

   ```
   components/MyComponent.module.css
   ```

2. **Use camelCase for class names:**

   ```css
   .myComponent {
     display: flex;
     gap: var(--spacing-md);
   }

   .header {
     font-size: var(--font-size-lg);
   }

   .primary {
     background: var(--accent-blue);
   }
   ```

3. **Import and use in your component:**

   ```tsx
   import styles from './MyComponent.module.css';

   export function MyComponent() {
     return (
       <div className={styles.myComponent}>
         <h2 className={styles.header}>Title</h2>
       </div>
     );
   }
   ```

### Using Utility Classes

For simple, reusable patterns, use utility classes:

```tsx
<div className="container flex gap-4">
  <div className="mt-2 mb-4">
    <span className="badge badge-success">Active</span>
  </div>
</div>
```

## CSS Layers

The CSS is organized into distinct layers, imported in this order in `src/index.css`:

1. **Tokens** - Design decisions (colors, typography, spacing)
2. **Global** - Base element styling (body, headings, links)
3. **Accessibility** - Focus states, screen reader utilities
4. **Utilities** - Reusable functional classes
5. **Components** - Component-scoped styles (CSS Modules)

## Benefits

- ✅ **Scoped Styling:** CSS Modules prevent class name conflicts
- ✅ **Design Consistency:** Design tokens ensure consistent styling
- ✅ **Type Safety:** TypeScript integration with CSS Modules
- ✅ **Maintainability:** Clear organization and naming conventions
- ✅ **Accessibility:** WCAG 2.1 AA compliant styles built-in
- ✅ **Performance:** Tree-shaking removes unused styles

## Documentation

- **[CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md)** - Complete guide to the CSS architecture
- **[CSS_NAMING_CONVENTIONS.md](./CSS_NAMING_CONVENTIONS.md)** - Naming conventions and best
  practices
- **[TAILWIND_MIGRATION.md](./TAILWIND_MIGRATION.md)** - Evaluation of Tailwind CSS migration

## Examples

### Example 1: Button Component

```tsx
// Button.tsx
import styles from './Button.module.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children }: ButtonProps) {
  return <button className={`${styles.button} ${styles[variant]}`}>{children}</button>;
}
```

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
```

### Example 2: Using Utilities

```tsx
// Quick layout without custom CSS
<div className="container">
  <div className="flex gap-4 mt-4 mb-2">
    <span className="badge badge-success">Active</span>
    <span className="badge badge-warning">Pending</span>
  </div>
</div>
```

## Migration Guide

Converting legacy CSS to CSS Modules:

1. **Rename file:** `Component.css` → `Component.module.css`
2. **Convert class names:** `kebab-case` → `camelCase`
3. **Remove BEM prefixes:** `.card__header` → `.header`
4. **Update imports:** `import './Component.css'` → `import styles from './Component.module.css'`
5. **Update className usage:** `className="card"` → `className={styles.card}`
6. **Replace hardcoded values with design tokens**

See [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) for detailed migration steps.

## Contributing

When adding new styles:

1. ✅ Use design tokens for all values
2. ✅ Use CSS Modules for component-specific styles
3. ✅ Use utility classes for simple, reusable patterns
4. ✅ Follow camelCase naming in CSS Modules
5. ✅ Document complex styling decisions
6. ❌ Don't hardcode colors, spacing, or font sizes
7. ❌ Don't use global styles for component-specific patterns

## Questions?

- Read the full [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) guide
- Check [CSS_NAMING_CONVENTIONS.md](./CSS_NAMING_CONVENTIONS.md) for naming guidance
- See existing components for examples
- Ask in the development channel

---

**Last Updated:** January 12, 2026
