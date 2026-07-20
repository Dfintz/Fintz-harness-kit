/**
 * Accessibility Module - WCAG 2.1 AA Compliant Utilities
 *
 * This module provides comprehensive accessibility utilities for building
 * WCAG 2.1 AA compliant user interfaces.
 *
 * Components:
 * - SkipLink: Skip navigation link for keyboard users
 * - VisuallyHidden: Screen reader only content
 * - LiveRegion: ARIA live region for announcements
 * - FocusTrap: Keyboard focus trap for modals
 *
 * Hooks:
 * - useFocusTrap: Programmatic focus trapping
 * - useArrowNavigation: Keyboard navigation for lists/menus
 * - useAnnounce: Screen reader announcements
 * - useFocusVisible: Track focus-visible state
 * - useReducedMotion: Detect motion preferences
 * - useHighContrast: Detect contrast preferences
 *
 * Utilities:
 * - a11yColors: WCAG AA compliant color palette
 * - generateId: Unique ID generation for ARIA
 *
 * Styles:
 * - Import './accessibility/a11y.css' for focus styles and utilities
 *
 * @example
 * // Import components
 * import { SkipLink, VisuallyHidden, LiveRegion, FocusTrap } from './accessibility';
 *
 * // Import hooks
 * import { useFocusTrap, useAnnounce, useReducedMotion } from './accessibility';
 *
 * // Import colors
 * import { a11yColors, getContrastColor } from './accessibility';
 */

// Components
export { SkipLink } from './SkipLink';
export type { SkipLinkProps } from './SkipLink';

export { VisuallyHidden, withVisuallyHiddenLabel } from './VisuallyHidden';
export type { VisuallyHiddenProps } from './VisuallyHidden';

export { LiveRegion, useLiveRegion } from './LiveRegion';
export type {
    LiveRegionPoliteness, LiveRegionProps, UseLiveRegionOptions,
    UseLiveRegionReturn
} from './LiveRegion';

export { FocusTrap } from './FocusTrap';
export type { FocusTrapProps } from './FocusTrap';

// Hooks
export {
    generateId, useAnnounce, useArrowNavigation, useFocusTrap, useFocusVisible, useHighContrast, useReducedMotion
} from './useA11y';
export type {
    UseAnnounceReturn, UseArrowNavigationOptions, UseFocusTrapOptions, UseFocusVisibleReturn
} from './useA11y';

// Colors
export {
    a11yColors, getAccessibleTextColor, getContrastColor
} from './a11y-colors';
export type { A11yColorPalette, ColorWithContrast } from './a11y-colors';

// Note: Import './accessibility/a11y.css' in your main entry point for styles
