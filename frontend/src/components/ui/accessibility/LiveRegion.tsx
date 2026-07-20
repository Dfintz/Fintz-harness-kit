/**
 * LiveRegion Component - ARIA live region for screen reader announcements
 *
 * This component creates an ARIA live region that announces dynamic content
 * changes to screen reader users. Use this for notifications, status updates,
 * error messages, and other dynamic content that users need to be aware of.
 *
 * @example
 * // For status messages
 * <LiveRegion politeness="polite">
 *   {loadingMessage}
 * </LiveRegion>
 *
 * // For urgent alerts
 * <LiveRegion politeness="assertive">
 *   {errorMessage}
 * </LiveRegion>
 */

import React, { useEffect, useRef, useState } from 'react';

export type LiveRegionPoliteness = 'off' | 'polite' | 'assertive';

export interface LiveRegionProps {
  /** Content to be announced */
  children?: React.ReactNode;
  /** ARIA live politeness setting */
  politeness?: LiveRegionPoliteness;
  /** Whether to clear the message after announcement */
  clearOnAnnounce?: boolean;
  /** Delay before clearing (ms) */
  clearDelay?: number;
  /** ARIA atomic - whether to announce entire region or just changes */
  atomic?: boolean;
  /** ARIA relevant - what types of changes to announce */
  relevant?: 'additions' | 'removals' | 'text' | 'all' | 'additions text';
  /** Additional class name */
  className?: string;
  /** Role attribute (status, alert, log, timer) */
  role?: 'status' | 'alert' | 'log' | 'timer';
}

/**
 * Visually hidden styles for the live region
 */
const visuallyHiddenStyles: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * LiveRegion component for screen reader announcements
 */
export function LiveRegion({
  children,
  politeness = 'polite',
  clearOnAnnounce = false,
  clearDelay = 1000,
  atomic = true,
  relevant = 'additions text',
  className = '',
  role,
}: LiveRegionProps): React.ReactElement {
  const [content, setContent] = useState<React.ReactNode>(children);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Determine role based on politeness if not provided
  const computedRole = role || (politeness === 'assertive' ? 'alert' : 'status');

  useEffect(() => {
    setContent(children);

    if (clearOnAnnounce && children) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Set new timeout to clear content
      timeoutRef.current = setTimeout(() => {
        setContent(null);
      }, clearDelay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [children, clearOnAnnounce, clearDelay]);

  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      role={computedRole}
      className={`live-region ${className}`.trim()}
      style={visuallyHiddenStyles}
    >
      {content}
    </div>
  );
}

/**
 * Hook for managing live region announcements imperatively
 */
export interface UseLiveRegionOptions {
  politeness?: LiveRegionPoliteness;
  clearDelay?: number;
}

export interface UseLiveRegionReturn {
  announce: (message: string) => void;
  clear: () => void;
  LiveRegionComponent: React.ReactElement;
}

export function useLiveRegion(
  options: UseLiveRegionOptions = {}
): UseLiveRegionReturn {
  const { politeness = 'polite', clearDelay = 1000 } = options;
  const [message, setMessage] = useState<string>('');

  const announce = (newMessage: string) => {
    // Clear first to ensure re-announcement of same message
    setMessage('');
    setTimeout(() => setMessage(newMessage), 50);
  };

  const clear = () => setMessage('');

  const LiveRegionComponent = (
    <LiveRegion
      politeness={politeness}
      clearOnAnnounce
      clearDelay={clearDelay}
    >
      {message}
    </LiveRegion>
  );

  return { announce, clear, LiveRegionComponent };
}
