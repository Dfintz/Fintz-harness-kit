/**
 * usePerformanceMonitor Hook
 *
 * Monitors component render performance and provides metrics
 * Useful for identifying performance bottlenecks in navigation
 */

import { useEffect, useRef } from 'react';

interface _PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
}

export function usePerformanceMonitor(
  componentName: string,
  enabled = process.env.NODE_ENV === 'development'
) {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const lastRenderStart = useRef<number>(performance.now());

  useEffect(() => {
    if (!enabled) return;

    renderCount.current += 1;
    const renderTime = performance.now() - lastRenderStart.current;
    renderTimes.current.push(renderTime);

    // Keep only last 10 render times for average calculation
    if (renderTimes.current.length > 10) {
      renderTimes.current.shift();
    }

    const _avgRenderTime =
      renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length;

    // Performance metrics tracking (silently collect data)
    // Can be viewed via React DevTools Profiler in development
  });

  // Mark start of next render
  lastRenderStart.current = performance.now();

  return {
    renderCount: renderCount.current,
    averageRenderTime:
      renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length || 0,
  };
}

/**
 * useNavigationTiming Hook
 *
 * Tracks navigation timing metrics using Performance API
 */
export function useNavigationTiming(label: string) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const mark = `${label}-start`;
    performance.mark(mark);

    return () => {
      const endMark = `${label}-end`;
      performance.mark(endMark);

      try {
        performance.measure(label, mark, endMark);
        // Navigation timing metrics available via Performance API
        // Can be viewed in browser DevTools Performance tab

        // Clean up marks and measures
        performance.clearMarks(mark);
        performance.clearMarks(endMark);
        performance.clearMeasures(label);
      } catch (error) {
        // Silently fail if marks don't exist
      }
    };
  }, [label]);
}
