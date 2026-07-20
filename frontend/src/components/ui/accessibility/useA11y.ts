/**
 * Accessibility Hooks for WCAG 2.1 AA Compliance
 *
 * This module provides React hooks for implementing accessible UI patterns:
 * - Focus management
 * - Keyboard navigation
 * - Screen reader announcements
 * - Reduced motion detection
 * - Focus trapping for modals
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook to detect if user prefers reduced motion
 *
 * @returns boolean indicating if reduced motion is preferred
 *
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion();
 * const animationDuration = prefersReducedMotion ? 0 : 300;
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery.matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to manage focus within a container (focus trap)
 * Essential for modals, dialogs, and dropdown menus
 *
 * @param isActive - Whether the focus trap is active
 * @returns ref to attach to the container element
 *
 * @example
 * function Modal({ isOpen, onClose, children }) {
 *   const focusTrapRef = useFocusTrap(isOpen);
 *   return isOpen ? (
 *     <div ref={focusTrapRef} role="dialog">
 *       {children}
 *     </div>
 *   ) : null;
 * }
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isActive: boolean
): React.RefObject<T> {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store currently focused element
    previousActiveElement.current = document.activeElement;

    // Get all focusable elements
    const getFocusableElements = () => {
      if (!containerRef.current) return [];
      return Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
    };

    // Focus the first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Handle Tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous element
      (previousActiveElement.current as HTMLElement)?.focus();
    };
  }, [isActive]);

  return containerRef as React.RefObject<T>;
}

/**
 * Hook to manage arrow key navigation within a list
 * Useful for menus, listboxes, and tab panels
 *
 * @param itemCount - Number of items in the list
 * @param options - Configuration options
 * @returns Current index and handlers
 *
 * @example
 * function Menu({ items }) {
 *   const { activeIndex, getItemProps, setActiveIndex } = useArrowNavigation(items.length);
 *   return (
 *     <ul role="menu">
 *       {items.map((item, index) => (
 *         <li
 *           key={item.id}
 *           role="menuitem"
 *           {...getItemProps(index)}
 *         >
 *           {item.label}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 */
export function useArrowNavigation(
  itemCount: number,
  options: {
    /** Initial active index */
    initialIndex?: number;
    /** Whether navigation is vertical (default) or horizontal */
    vertical?: boolean;
    /** Whether to loop around when reaching the end */
    loop?: boolean;
    /** Callback when active index changes */
    onIndexChange?: (index: number) => void;
  } = {}
) {
  const { initialIndex = 0, vertical = true, loop = true, onIndexChange } = options;
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const goToIndex = useCallback(
    (index: number) => {
      let newIndex = index;
      if (loop) {
        newIndex = ((index % itemCount) + itemCount) % itemCount;
      } else {
        newIndex = Math.max(0, Math.min(index, itemCount - 1));
      }
      setActiveIndex(newIndex);
      onIndexChange?.(newIndex);
    },
    [itemCount, loop, onIndexChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';

      switch (e.key) {
        case prevKey:
          e.preventDefault();
          goToIndex(activeIndex - 1);
          break;
        case nextKey:
          e.preventDefault();
          goToIndex(activeIndex + 1);
          break;
        case 'Home':
          e.preventDefault();
          goToIndex(0);
          break;
        case 'End':
          e.preventDefault();
          goToIndex(itemCount - 1);
          break;
      }
    },
    [activeIndex, goToIndex, itemCount, vertical]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      'aria-selected': index === activeIndex,
      onFocus: () => setActiveIndex(index),
      onKeyDown: handleKeyDown,
    }),
    [activeIndex, handleKeyDown]
  );

  return {
    activeIndex,
    setActiveIndex: goToIndex,
    getItemProps,
    handleKeyDown,
  };
}

/**
 * Hook for making live announcements to screen readers
 *
 * @returns announce function
 *
 * @example
 * function SearchResults({ results }) {
 *   const announce = useAnnounce();
 *
 *   useEffect(() => {
 *     announce(`Found ${results.length} results`);
 *   }, [results, announce]);
 *
 *   return <div>{...}</div>;
 * }
 */
export function useAnnounce() {
  const regionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region if it doesn't exist
    let region = document.getElementById('a11y-announcements') as HTMLDivElement;
    if (!region) {
      region = document.createElement('div');
      region.id = 'a11y-announcements';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      document.body.appendChild(region);
    }
    regionRef.current = region;

    return () => {
      // Only remove if we created it
      if (region && region.parentNode) {
        region.parentNode.removeChild(region);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!regionRef.current) return;

    regionRef.current.setAttribute('aria-live', priority);
    // Clear and set message to trigger announcement
    regionRef.current.textContent = '';
    // Use setTimeout to ensure the DOM update triggers the announcement
    setTimeout(() => {
      if (regionRef.current) {
        regionRef.current.textContent = message;
      }
    }, 50);
  }, []);

  return announce;
}

/**
 * Hook to detect if user is navigating with keyboard
 * Useful for showing focus indicators only on keyboard navigation
 *
 * @returns boolean indicating if keyboard navigation is detected
 *
 * @example
 * function Button({ children }) {
 *   const isKeyboardUser = useKeyboardNavigation();
 *   return (
 *     <button className={isKeyboardUser ? 'show-focus' : ''}>
 *       {children}
 *     </button>
 *   );
 * }
 */
export function useKeyboardNavigation(): boolean {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return isKeyboardUser;
}

/**
 * Hook to manage roving tabindex for a group of elements
 * (ARIA pattern for managing focus in widget groups)
 *
 * @param itemRefs - Refs to the items in the group
 * @returns handlers and current focused index
 */
export function useRovingTabIndex<T extends HTMLElement>(itemRefs: React.RefObject<T>[]) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const focusItem = useCallback(
    (index: number) => {
      const validIndex = Math.max(0, Math.min(index, itemRefs.length - 1));
      setFocusedIndex(validIndex);
      itemRefs[validIndex]?.current?.focus();
    },
    [itemRefs]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          focusItem((focusedIndex + 1) % itemRefs.length);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          focusItem((focusedIndex - 1 + itemRefs.length) % itemRefs.length);
          break;
        case 'Home':
          e.preventDefault();
          focusItem(0);
          break;
        case 'End':
          e.preventDefault();
          focusItem(itemRefs.length - 1);
          break;
      }
    },
    [focusedIndex, focusItem, itemRefs.length]
  );

  const getTabIndex = useCallback(
    (index: number) => (index === focusedIndex ? 0 : -1),
    [focusedIndex]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    focusItem,
    handleKeyDown,
    getTabIndex,
  };
}

/**
 * Hook to manage escape key to close modals/dropdowns
 *
 * @param onEscape - Callback when escape is pressed
 * @param isActive - Whether the handler is active
 */
export function useEscapeKey(onEscape: () => void, isActive: boolean = true): void {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onEscape]);
}

/**
 * Hook to manage click outside to close modals/dropdowns
 *
 * @param onClickOutside - Callback when click outside occurs
 * @param isActive - Whether the handler is active
 * @returns ref to attach to the container
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  onClickOutside: () => void,
  isActive: boolean = true
): React.RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isActive) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isActive, onClickOutside]);

  return ref as React.RefObject<T>;
}

/**
 * Hook to get unique IDs for ARIA attributes
 *
 * @param prefix - Prefix for the ID
 * @returns Object with id values for label, description, etc.
 *
 * @example
 * function TextField({ label, helpText }) {
 *   const ids = useId('text-field');
 *   return (
 *     <div>
 *       <label id={ids.label} htmlFor={ids.input}>{label}</label>
 *       <input
 *         id={ids.input}
 *         aria-labelledby={ids.label}
 *         aria-describedby={helpText ? ids.description : undefined}
 *       />
 *       {helpText && <p id={ids.description}>{helpText}</p>}
 *     </div>
 *   );
 * }
 */
export function useA11yId(prefix: string = 'a11y') {
  const uniqueId = useRef(`${prefix}-${Math.random().toString(36).slice(2, 9)}`);

  return {
    /** Main element ID */
    id: uniqueId.current,
    /** Label element ID */
    label: `${uniqueId.current}-label`,
    /** Description element ID */
    description: `${uniqueId.current}-description`,
    /** Input/control element ID */
    input: `${uniqueId.current}-input`,
    /** Error message ID */
    error: `${uniqueId.current}-error`,
    /** Help text ID */
    help: `${uniqueId.current}-help`,
  };
}

export const UseA11y = {
  usePrefersReducedMotion,
  useFocusTrap,
  useArrowNavigation,
  useAnnounce,
  useKeyboardNavigation,
  useRovingTabIndex,
  useEscapeKey,
  useClickOutside,
  useA11yId,
};

// ============================================================================
// Additional exports for API compatibility
// ============================================================================

/**
 * Type exports for hook options and returns
 */
export interface UseFocusTrapOptions {
  active?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  onEscapeKey?: () => void;
}

export interface UseArrowNavigationOptions {
  selector?: string;
  loop?: boolean;
  vertical?: boolean;
  horizontal?: boolean;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

export interface UseAnnounceReturn {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  LiveRegion: React.ReactElement;
}

export interface UseFocusVisibleReturn {
  isFocusVisible: boolean;
  focusProps: {
    onFocus: () => void;
    onBlur: () => void;
  };
}

/**
 * Counter for generating unique IDs
 */
let idCounter = 0;

/**
 * Generate a unique ID with optional prefix
 * Useful for ARIA relationships between elements
 */
export function generateId(prefix: string = 'a11y'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Alias for usePrefersReducedMotion for API consistency
 */
export function useReducedMotion(): boolean {
  return usePrefersReducedMotion();
}

/**
 * Hook to detect high contrast mode preference
 */
export function useHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false;
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    return mediaQuery.matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    const handler = (event: MediaQueryListEvent) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersHighContrast;
}

/**
 * Hook to track focus-visible state (keyboard focus vs mouse focus)
 */
export function useFocusVisible(): UseFocusVisibleReturn {
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const focusProps = {
    onFocus: () => setIsFocusVisible(isKeyboardUser),
    onBlur: () => setIsFocusVisible(false),
  };

  return { isFocusVisible, focusProps };
}

/**
 * Alternative arrow navigation hook that takes a container ref
 */
export function useArrowNavigationRef<T extends HTMLElement = HTMLDivElement>(
  options: UseArrowNavigationOptions = {}
): React.RefObject<T> {
  const { selector = 'button, [role="menuitem"], [role="option"]', loop = true, vertical = true } = options;
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
      if (items.length === 0) return;

      const currentIndex = items.findIndex((item) => item === document.activeElement);
      let newIndex = currentIndex;

      const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';

      switch (e.key) {
        case prevKey:
          e.preventDefault();
          newIndex = currentIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? items.length - 1 : 0;
          }
          break;
        case nextKey:
          e.preventDefault();
          newIndex = currentIndex + 1;
          if (newIndex >= items.length) {
            newIndex = loop ? 0 : items.length - 1;
          }
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = items.length - 1;
          break;
      }

      if (newIndex !== currentIndex && items[newIndex]) {
        items[newIndex].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [selector, loop, vertical]);

  return containerRef as React.RefObject<T>;
}

// Re-export as alias for compatibility
export { useArrowNavigationRef as useArrowNavigation_v2 };
