# Accessibility Guide - WCAG 2.1 AA Compliance

This document outlines the accessibility features, guidelines, and tools implemented in the SC Fleet Manager frontend application to ensure WCAG 2.1 AA compliance.

## Table of Contents

1. [Overview](#overview)
2. [Accessibility Components](#accessibility-components)
3. [Accessibility Hooks](#accessibility-hooks)
4. [Color Palette](#color-palette)
5. [Focus Management](#focus-management)
6. [Screen Reader Support](#screen-reader-support)
7. [Keyboard Navigation](#keyboard-navigation)
8. [User Preferences](#user-preferences)
9. [Testing](#testing)
10. [Checklist](#checklist)

## Overview

Our accessibility implementation follows WCAG 2.1 Level AA guidelines, organized around the POUR principles:

- **Perceivable**: Information is presented in ways all users can perceive
- **Operable**: Interface components are operable by all users
- **Understandable**: Information and UI operation are understandable
- **Robust**: Content is compatible with assistive technologies

## Accessibility Components

### SkipLink

Allows keyboard users to bypass navigation and jump directly to main content.

```tsx
import { SkipLink } from '@/components/ui';

// Place at the top of your layout
<SkipLink targetId="main-content" />
<nav>...</nav>
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

**WCAG Criterion**: 2.4.1 Bypass Blocks (Level A)

### VisuallyHidden

Renders content visible only to screen readers.

```tsx
import { VisuallyHidden } from '@/components/ui';

// Add context to icon buttons
<button>
  <IconDelete />
  <VisuallyHidden>Delete item</VisuallyHidden>
</button>

// Add table cell context
<td>
  <VisuallyHidden>Price: </VisuallyHidden>
  $1,234.56
</td>
```

### LiveRegion

Announces dynamic content changes to screen readers.

```tsx
import { LiveRegion } from '@/components/ui';

// Status updates (polite)
<LiveRegion politeness="polite">
  {statusMessage}
</LiveRegion>

// Urgent alerts (assertive)
<LiveRegion politeness="assertive">
  {errorMessage}
</LiveRegion>
```

**WCAG Criterion**: 4.1.3 Status Messages (Level AA)

### FocusTrap

Traps keyboard focus within a container (essential for modals).

```tsx
import { FocusTrap } from '@/components/ui';

<FocusTrap 
  active={isModalOpen} 
  onEscapeKey={() => setIsModalOpen(false)}
>
  <div role="dialog" aria-modal="true">
    {modalContent}
  </div>
</FocusTrap>
```

**WCAG Criterion**: 2.4.3 Focus Order (Level A)

## Accessibility Hooks

### useFocusTrap

Programmatic focus trapping for custom implementations.

```tsx
import { useFocusTrap } from '@/components/ui';

function Modal({ isOpen, children }) {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  return isOpen ? (
    <div ref={trapRef} role="dialog">
      {children}
    </div>
  ) : null;
}
```

### useAnnounce

Screen reader announcements for dynamic content.

```tsx
import { useAnnounce } from '@/components/ui';

function SearchResults({ results }) {
  const announce = useAnnounce();
  
  useEffect(() => {
    announce(`Found ${results.length} results`);
  }, [results, announce]);
  
  return <ResultsList results={results} />;
}
```

### useArrowNavigation

Keyboard navigation for menus and lists.

```tsx
import { useArrowNavigation } from '@/components/ui';

function Menu({ items }) {
  const { activeIndex, getItemProps } = useArrowNavigation(items.length, {
    vertical: true,
    loop: true,
  });
  
  return (
    <ul role="menu">
      {items.map((item, index) => (
        <li 
          key={item.id} 
          role="menuitem" 
          {...getItemProps(index)}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

### useFocusVisible

Track keyboard-only focus for styling.

```tsx
import { useFocusVisible } from '@/components/ui';

function Button({ children }) {
  const { isFocusVisible, focusProps } = useFocusVisible();
  
  return (
    <button 
      {...focusProps}
      className={isFocusVisible ? 'focus-ring' : ''}
    >
      {children}
    </button>
  );
}
```

### useReducedMotion

Respect user's motion preferences.

```tsx
import { useReducedMotion } from '@/components/ui';

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();
  
  const animationDuration = prefersReducedMotion ? 0 : 300;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: animationDuration / 1000 }}
    />
  );
}
```

**WCAG Criterion**: 2.3.3 Animation from Interactions (Level AAA)

### useHighContrast

Detect high contrast mode preference.

```tsx
import { useHighContrast } from '@/components/ui';

function Icon({ color }) {
  const prefersHighContrast = useHighContrast();
  
  // Use higher contrast colors when preferred
  const iconColor = prefersHighContrast ? '#ffffff' : color;
  
  return <svg fill={iconColor}>...</svg>;
}
```

## Color Palette

All colors meet WCAG 2.1 AA contrast requirements:

| Color | Value | Contrast | Use |
|-------|-------|----------|-----|
| Primary Text | `#ffffff` | 15.3:1 | Main content text |
| Secondary Text | `#94a3b8` | 5.7:1 | Supporting text |
| Accent Cyan | `#00d9ff` | 8.5:1 | Links, interactive |
| Success | `#22c55e` | 6.7:1 | Success states |
| Warning | `#f59e0b` | 7.8:1 | Warning states |
| Error | `#ef4444` | 5.3:1 | Error states |

**Usage:**

```tsx
import { a11yColors, getContrastColor } from '@/components/ui';

// Get accessible text color for a background
const textColor = getContrastColor('#0a1628'); // Returns '#ffffff'

// Access pre-defined colors
const cyanColor = a11yColors.accentCyan.value;
const contrastRatio = a11yColors.accentCyan.contrastRatio;
```

**WCAG Criterion**: 1.4.3 Contrast (Minimum) (Level AA)

## Focus Management

### CSS Focus Styles

Import the accessibility CSS in your main entry point:

```tsx
import '@/components/ui/accessibility/a11y.css';
```

This provides:

- **Skip navigation**: `.skip-link` class
- **Focus visible**: `.a11y-focus-visible` class
- **Screen reader only**: `.sr-only` class
- **Focusable SR content**: `.sr-focusable` class

### Focus Indicator Standards

- Minimum 2px solid outline
- Contrast ratio ≥ 3:1 against adjacent colors
- Additional visual indicator (glow, background change)
- Clear distinction between focus and hover states

**WCAG Criterion**: 2.4.7 Focus Visible (Level AA)

## Screen Reader Support

### ARIA Landmarks

```html
<header role="banner">
<nav role="navigation">
<main role="main">
<aside role="complementary">
<footer role="contentinfo">
```

### ARIA Labels

```tsx
// For interactive elements without visible text
<button aria-label="Close dialog">
  <IconClose />
</button>

// For elements described by other content
<input aria-labelledby="field-label" aria-describedby="field-help" />
<label id="field-label">Email</label>
<span id="field-help">We'll never share your email</span>

// For modals
<div 
  role="dialog" 
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Action</h2>
  <p id="dialog-description">Are you sure you want to proceed?</p>
</div>
```

**WCAG Criterion**: 4.1.2 Name, Role, Value (Level A)

## Keyboard Navigation

### Required Keyboard Support

| Key | Action |
|-----|--------|
| Tab | Move to next focusable element |
| Shift+Tab | Move to previous focusable element |
| Enter/Space | Activate buttons, links |
| Escape | Close modals, dropdowns |
| Arrow Keys | Navigate menus, lists |
| Home/End | Jump to first/last item |

### Focus Order

Elements should receive focus in a logical order that follows the visual layout:

1. Skip link (when focused)
2. Header/Navigation
3. Main content
4. Sidebar (if present)
5. Footer

**WCAG Criterion**: 2.4.3 Focus Order (Level A)

## User Preferences

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### High Contrast

```css
@media (prefers-contrast: more) {
  :root {
    --border-default: 2px solid currentColor;
    --focus-ring: 4px solid #fff;
  }
}
```

## Testing

### Automated Testing

Run accessibility tests:

```bash
cd frontend
npm test -- --testPathPatterns="accessibility"
```

### Manual Testing Checklist

1. **Keyboard Navigation**
   - [ ] All interactive elements are reachable via Tab
   - [ ] Focus order is logical
   - [ ] Focus indicator is visible
   - [ ] Modals trap focus correctly
   - [ ] Escape key closes modals/dropdowns

2. **Screen Reader**
   - [ ] All images have alt text
   - [ ] Form inputs have labels
   - [ ] Buttons have accessible names
   - [ ] Dynamic content is announced
   - [ ] Landmarks are properly defined

3. **Visual**
   - [ ] Text contrast meets 4.5:1 ratio
   - [ ] UI component contrast meets 3:1 ratio
   - [ ] Content is readable at 200% zoom
   - [ ] No information lost in grayscale

### Recommended Tools

- **axe DevTools**: Browser extension for automated testing
- **WAVE**: Web accessibility evaluation tool
- **NVDA/VoiceOver**: Screen reader testing
- **Chrome DevTools**: Accessibility inspector

## Checklist

### WCAG 2.1 AA Compliance Checklist

#### Perceivable

- [x] 1.1.1 Non-text Content (A)
- [x] 1.3.1 Info and Relationships (A)
- [x] 1.3.2 Meaningful Sequence (A)
- [x] 1.3.3 Sensory Characteristics (A)
- [x] 1.4.1 Use of Color (A)
- [x] 1.4.2 Audio Control (A)
- [x] 1.4.3 Contrast (Minimum) (AA) ✅
- [x] 1.4.4 Resize Text (AA)
- [x] 1.4.5 Images of Text (AA)
- [x] 1.4.10 Reflow (AA)
- [x] 1.4.11 Non-text Contrast (AA) ✅
- [x] 1.4.12 Text Spacing (AA)
- [x] 1.4.13 Content on Hover or Focus (AA)

#### Operable

- [x] 2.1.1 Keyboard (A) ✅
- [x] 2.1.2 No Keyboard Trap (A) ✅
- [x] 2.1.4 Character Key Shortcuts (A)
- [x] 2.4.1 Bypass Blocks (A) ✅
- [x] 2.4.2 Page Titled (A)
- [x] 2.4.3 Focus Order (A) ✅
- [x] 2.4.4 Link Purpose (In Context) (A)
- [x] 2.4.5 Multiple Ways (AA)
- [x] 2.4.6 Headings and Labels (AA)
- [x] 2.4.7 Focus Visible (AA) ✅
- [x] 2.5.1 Pointer Gestures (A)
- [x] 2.5.2 Pointer Cancellation (A)
- [x] 2.5.3 Label in Name (A)
- [x] 2.5.4 Motion Actuation (A)

#### Understandable

- [x] 3.1.1 Language of Page (A)
- [x] 3.1.2 Language of Parts (AA)
- [x] 3.2.1 On Focus (A)
- [x] 3.2.2 On Input (A)
- [x] 3.2.3 Consistent Navigation (AA)
- [x] 3.2.4 Consistent Identification (AA)
- [x] 3.3.1 Error Identification (A)
- [x] 3.3.2 Labels or Instructions (A)
- [x] 3.3.3 Error Suggestion (AA)
- [x] 3.3.4 Error Prevention (Legal, Financial, Data) (AA)

#### Robust

- [x] 4.1.1 Parsing (A)
- [x] 4.1.2 Name, Role, Value (A) ✅
- [x] 4.1.3 Status Messages (AA) ✅

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Accessible Rich Internet Applications (ARIA)](https://www.w3.org/TR/wai-aria-1.2/)
- [Inclusive Components](https://inclusive-components.design/)

