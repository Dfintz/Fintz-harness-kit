/**
 * FocusTrap Component - Trap focus within a container
 *
 * This component traps keyboard focus within its children, preventing users
 * from tabbing outside of modals, dialogs, and other overlay content.
 * This is essential for WCAG 2.1 AA compliance for modal dialogs.
 *
 * @example
 * <FocusTrap active={isModalOpen}>
 *   <div className="modal">
 *     <button>Close</button>
 *     <input type="text" />
 *     <button>Submit</button>
 *   </div>
 * </FocusTrap>
 */

import React, { useCallback, useEffect, useRef } from 'react';

export interface FocusTrapProps {
  /** Content to trap focus within */
  children: React.ReactNode;
  /** Whether the focus trap is active */
  active?: boolean;
  /** Whether to focus the first focusable element on mount */
  autoFocus?: boolean;
  /** Whether to restore focus to the previously focused element on unmount */
  restoreFocus?: boolean;
  /** Element to focus initially (by ref or selector) */
  initialFocus?: React.RefObject<HTMLElement> | string;
  /** Element to focus when trap is deactivated */
  returnFocus?: React.RefObject<HTMLElement>;
  /** Callback when user tries to escape the trap */
  onEscapeKey?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Selector for all focusable elements
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(elements).filter((el) => {
    // Check if element is visible
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      !el.hasAttribute('aria-hidden')
    );
  });
}

/**
 * FocusTrap component for modal accessibility
 */
export function FocusTrap({
  children,
  active = true,
  autoFocus = true,
  restoreFocus = true,
  initialFocus,
  returnFocus,
  onEscapeKey,
  className = '',
}: FocusTrapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  /**
   * Handle Tab key to trap focus
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active || !containerRef.current) return;

      // Handle Escape key
      if (e.key === 'Escape' && onEscapeKey) {
        e.preventDefault();
        onEscapeKey();
        return;
      }

      // Only handle Tab key
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift+Tab on first element -> focus last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
        return;
      }

      // Tab on last element -> focus first
      if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
        return;
      }

      // Tab when focus is outside container -> focus first/last
      if (!containerRef.current.contains(document.activeElement)) {
        e.preventDefault();
        if (e.shiftKey) {
          lastElement.focus();
        } else {
          firstElement.focus();
        }
      }
    },
    [active, onEscapeKey]
  );

  /**
   * Focus the initial element
   */
  const focusInitialElement = useCallback(() => {
    if (!containerRef.current || !autoFocus) return;

    let elementToFocus: HTMLElement | null = null;

    // Check for initialFocus prop
    if (initialFocus) {
      if (typeof initialFocus === 'string') {
        elementToFocus = containerRef.current.querySelector(initialFocus);
      } else if (initialFocus.current) {
        elementToFocus = initialFocus.current;
      }
    }

    // Fall back to first focusable element
    if (!elementToFocus) {
      const focusableElements = getFocusableElements(containerRef.current);
      elementToFocus = focusableElements[0] || containerRef.current;
    }

    // Make container focusable if no focusable children
    if (elementToFocus === containerRef.current) {
      containerRef.current.setAttribute('tabindex', '-1');
    }

    // Small delay to ensure DOM is ready
    setTimeout(() => {
      elementToFocus?.focus();
    }, 10);
  }, [autoFocus, initialFocus]);

  /**
   * Set up focus trap
   */
  useEffect(() => {
    if (!active) return;

    // Store currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus initial element
    focusInitialElement();

    // Add keydown listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus on cleanup
      if (restoreFocus) {
        const elementToRestore =
          returnFocus?.current || previousActiveElement.current;
        if (elementToRestore && typeof elementToRestore.focus === 'function') {
          // Small delay to prevent focus race conditions
          setTimeout(() => {
            elementToRestore.focus();
          }, 10);
        }
      }
    };
  }, [active, focusInitialElement, handleKeyDown, restoreFocus, returnFocus]);

  return (
    <div ref={containerRef} className={`focus-trap ${className}`.trim()}>
      {children}
    </div>
  );
}
