import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useDebounce hook - Consistent debouncing for inputs and actions
 * Issue #160: useDebounce Hook - Consistent debouncing
 */

/**
 * Debounce a value
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * Debounce with leading edge (fires immediately on first call)
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns A debounced version of the callback that fires on leading edge
 */
export function useLeadingDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leadingRef = useRef(true);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (leadingRef.current) {
        callbackRef.current(...args);
        leadingRef.current = false;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        leadingRef.current = true;
      }, delay);
    },
    [delay]
  );
}

/**
 * Throttle a callback function (rate limit)
 * @param callback - The function to throttle
 * @param limit - Minimum time between calls in milliseconds (default: 300ms)
 * @returns A throttled version of the callback
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limit: number = 300
): (...args: Parameters<T>) => void {
  const lastRanRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRanRef.current >= limit) {
        callbackRef.current(...args);
        lastRanRef.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args);
          lastRanRef.current = Date.now();
        }, limit - (now - lastRanRef.current));
      }
    },
    [limit]
  );
}

/**
 * Search input with debounce - common use case
 * @param initialValue - Initial search value
 * @param delay - Debounce delay in milliseconds
 * @returns Object with value, debouncedValue, and onChange handler
 */
export function useSearchInput(initialValue: string = '', delay: number = 300) {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, delay);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const clear = useCallback(() => {
    setValue('');
  }, []);

  return {
    value,
    debouncedValue,
    onChange,
    clear,
    setValue,
  };
}
