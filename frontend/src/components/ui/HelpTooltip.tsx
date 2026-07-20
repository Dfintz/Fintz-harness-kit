/**
 * HelpTooltip Component - Contextual help tooltips for UI elements
 *
 * A modern tooltip component for providing contextual help with:
 * - Multiple positioning options with auto-flip
 * - Hover and focus triggers
 * - Delayed show/hide for better UX
 * - Glass morphism styling
 * - Full accessibility support (ARIA)
 * - Keyboard navigation
 *
 * @example
 * <HelpTooltip content="Click here to add a new ship to your fleet">
 *   <Button>Add Ship</Button>
 * </HelpTooltip>
 *
 * @example
 * <HelpTooltip
 *   content="This shows your total credits available for trading"
 *   position="right"
 *   icon
 * />
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import './HelpTooltip.css';

// ============================================
// Types
// ============================================

export type TooltipPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface HelpTooltipProps {
  /** Tooltip content - can be text or rich content */
  content: React.ReactNode;
  /** Preferred position of the tooltip */
  position?: TooltipPosition;
  /** Delay before showing tooltip (ms) */
  showDelay?: number;
  /** Delay before hiding tooltip (ms) */
  hideDelay?: number;
  /** Whether to show a help icon trigger instead of wrapping children */
  icon?: boolean;
  /** Custom icon size (when icon=true) */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Maximum width of the tooltip */
  maxWidth?: number;
  /** Whether the tooltip is disabled */
  disabled?: boolean;
  /** Trigger element(s) - required if icon is false */
  children?: React.ReactNode;
  /** Additional class name for the container */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

// ============================================
// Help Icon Component
// ============================================

interface HelpIconProps {
  size?: 'sm' | 'md' | 'lg';
}

function HelpIcon({ size = 'md' }: Readonly<HelpIconProps>): React.ReactElement {
  const dimensions = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  const dim = dimensions[size];

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="help-tooltip__icon-svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

// ============================================
// Main Component
// ============================================

export function HelpTooltip({
  content,
  position = 'top',
  showDelay = 200,
  hideDelay = 100,
  icon = false,
  iconSize = 'md',
  maxWidth = 280,
  disabled = false,
  children,
  className = '',
  testId,
}: Readonly<HelpTooltipProps>): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(position);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement | HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tooltipId = useId();

  // Apply dynamic positioning via CSS custom properties
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      const el = tooltipRef.current;
      el.style.setProperty(
        '--tooltip-top',
        typeof coords.top === 'number' ? `${coords.top}px` : String(coords.top)
      );
      el.style.setProperty(
        '--tooltip-left',
        typeof coords.left === 'number' ? `${coords.left}px` : String(coords.left)
      );
      el.style.setProperty(
        '--tooltip-max-width',
        typeof maxWidth === 'number' ? `${maxWidth}px` : String(maxWidth)
      );
    }
  }, [isVisible, coords.top, coords.left, maxWidth]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Calculate position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;

    let top = 0;
    let left = 0;
    let finalPosition = position;

    // Calculate initial position
    const positions: Record<TooltipPosition, { top: number; left: number }> = {
      top: {
        top: triggerRect.top - tooltipRect.height - gap,
        left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
      },
      bottom: {
        top: triggerRect.bottom + gap,
        left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
      },
      left: {
        top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
        left: triggerRect.left - tooltipRect.width - gap,
      },
      right: {
        top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
        left: triggerRect.right + gap,
      },
      'top-left': {
        top: triggerRect.top - tooltipRect.height - gap,
        left: triggerRect.left,
      },
      'top-right': {
        top: triggerRect.top - tooltipRect.height - gap,
        left: triggerRect.right - tooltipRect.width,
      },
      'bottom-left': {
        top: triggerRect.bottom + gap,
        left: triggerRect.left,
      },
      'bottom-right': {
        top: triggerRect.bottom + gap,
        left: triggerRect.right - tooltipRect.width,
      },
    };

    ({ top, left } = positions[position]);

    // Check if tooltip fits in viewport and flip if needed
    const fitsTop = top >= viewportPadding;
    const fitsBottom = top + tooltipRect.height <= window.innerHeight - viewportPadding;
    const fitsLeft = left >= viewportPadding;
    const fitsRight = left + tooltipRect.width <= window.innerWidth - viewportPadding;

    // Flip logic for vertical positions
    if (position.includes('top') && !fitsTop && fitsBottom) {
      const flipped = position.replace('top', 'bottom') as TooltipPosition;
      ({ top, left } = positions[flipped]);
      finalPosition = flipped;
    } else if (position.includes('bottom') && !fitsBottom && fitsTop) {
      const flipped = position.replace('bottom', 'top') as TooltipPosition;
      ({ top, left } = positions[flipped]);
      finalPosition = flipped;
    }

    // Flip logic for horizontal positions
    if (position === 'left' && !fitsLeft) {
      ({ top, left } = positions.right);
      finalPosition = 'right';
    } else if (position === 'right' && !fitsRight) {
      ({ top, left } = positions.left);
      finalPosition = 'left';
    }

    // Keep within viewport bounds
    top = Math.max(
      viewportPadding,
      Math.min(window.innerHeight - tooltipRect.height - viewportPadding, top)
    );
    left = Math.max(
      viewportPadding,
      Math.min(window.innerWidth - tooltipRect.width - viewportPadding, left)
    );

    setActualPosition(finalPosition);
    setCoords({ top, left });
  }, [position]);

  // Update position when visible
  useEffect(() => {
    if (isVisible) {
      calculatePosition();

      const handleScroll = () => calculatePosition();
      const handleResize = () => calculatePosition();

      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isVisible, calculatePosition]);

  // Show tooltip
  const show = useCallback(() => {
    if (disabled) return;

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, showDelay);
  }, [disabled, showDelay]);

  // Hide tooltip
  const hide = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, hideDelay);
  }, [hideDelay]);

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isVisible) {
      setIsVisible(false);
    }
  };

  // Render trigger
  const triggerProps = {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onKeyDown: handleKeyDown,
    'aria-describedby': isVisible ? tooltipId : undefined,
    className: icon
      ? `help-tooltip__trigger help-tooltip__trigger--icon help-tooltip__trigger--${iconSize} ${className}`.trim()
      : `help-tooltip__trigger ${className}`.trim(),
    'data-testid': testId,
  };

  return (
    <>
      {icon ? (
        <button
          type="button"
          {...triggerProps}
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          aria-label="Help"
        >
          <HelpIcon size={iconSize} />
        </button>
      ) : (
        <span {...triggerProps} ref={triggerRef as React.RefObject<HTMLSpanElement>}>
          {children}
        </span>
      )}

      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={`help-tooltip__popup help-tooltip__popup--${actualPosition}`}
          data-testid={testId ? `${testId}-tooltip` : undefined}
        >
          <div className="help-tooltip__backdrop" aria-hidden="true" />
          <div className="help-tooltip__content">{content}</div>
          <div className="help-tooltip__arrow" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
