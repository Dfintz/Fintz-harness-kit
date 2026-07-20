/**
 * useIdleTimeout Hook
 * 
 * Tracks user activity and triggers callbacks when user becomes idle.
 * Monitors mouse movement, keyboard input, and touch events.
 * 
 * @module hooks/useIdleTimeout
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface IdleTimeoutOptions {
  /** Idle timeout in milliseconds before warning appears */
  idleTimeout: number;
  /** Warning duration in milliseconds before auto-logout */
  warningTimeout: number;
  /** Callback when user becomes idle (warning should be shown) */
  onIdle: () => void;
  /** Callback when warning timeout expires (user should be logged out) */
  onTimeout: () => void;
  /** Callback when user becomes active again */
  onActive?: () => void;
  /** Whether the idle detection is enabled */
  enabled?: boolean;
}

/**
 * Hook to detect user idle state and manage session timeout
 * 
 * @example
 * ```tsx
 * const { isIdle, remainingTime, reset } = useIdleTimeout({
 *   idleTimeout: 15 * 60 * 1000, // 15 minutes
 *   warningTimeout: 60 * 1000, // 1 minute warning
 *   onIdle: () => setShowWarning(true),
 *   onTimeout: () => logout(),
 *   enabled: isAuthenticated
 * });
 * ```
 */
export function useIdleTimeout({
  idleTimeout,
  warningTimeout,
  onIdle,
  onTimeout,
  onActive,
  enabled = true,
}: IdleTimeoutOptions) {
  const [isIdle, setIsIdle] = useState(false);
  const [remainingTime, setRemainingTime] = useState(warningTimeout);
  
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const warningTimerRef = useRef<NodeJS.Timeout>();
  const countdownIntervalRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
  }, []);

  /**
   * Start countdown when in warning state
   */
  const startCountdown = useCallback(() => {
    const warningStartTime = Date.now();
    setRemainingTime(warningTimeout);

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - warningStartTime;
      const remaining = Math.max(0, warningTimeout - elapsed);
      setRemainingTime(remaining);
    }, 100); // Update every 100ms for smooth countdown

    warningTimerRef.current = setTimeout(() => {
      clearTimers();
      setIsIdle(false);
      onTimeout();
    }, warningTimeout);
  }, [warningTimeout, onTimeout, clearTimers]);

  /**
   * Reset idle timer and mark user as active
   */
  const reset = useCallback(() => {
    clearTimers();
    lastActivityRef.current = Date.now();

    if (isIdle) {
      setIsIdle(false);
      if (onActive) {
        onActive();
      }
    }

    if (!enabled) {
      return;
    }

    // Set new idle timer
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
      onIdle();
      startCountdown();
    }, idleTimeout);
  }, [enabled, isIdle, idleTimeout, onIdle, onActive, startCountdown, clearTimers]);

  /**
   * Handle user activity events
   */
  const handleActivity = useCallback(() => {
    const now = Date.now();
    // Throttle activity detection to avoid excessive resets (min 1 second between resets)
    if (now - lastActivityRef.current > 1000) {
      reset();
    }
  }, [reset]);

  // Set up event listeners for user activity
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Events that indicate user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    reset();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [enabled, handleActivity, reset, clearTimers]);

  return {
    /** Whether user is currently idle (warning state) */
    isIdle,
    /** Remaining time in milliseconds before auto-logout */
    remainingTime,
    /** Manually reset the idle timer (e.g., when user clicks "Keep Session") */
    reset,
  };
}
