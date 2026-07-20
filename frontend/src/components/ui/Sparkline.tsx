/**
 * Sparkline Component - Mini inline chart for visualizing trends
 *
 * A lightweight sparkline chart using recharts for displaying trend data
 * in compact spaces like dashboard cards.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Line, LineChart, ReferenceLine } from 'recharts';
import { colors } from './tokens';

export interface SparklineDataPoint {
  /** X-axis value (typically timestamp or index) */
  x: number | string;
  /** Y-axis value */
  y: number;
}

export interface SparklineProps {
  /** Array of data points to display */
  data: SparklineDataPoint[];
  /** Width of the sparkline container */
  width?: number | string;
  /** Height of the sparkline container */
  height?: number;
  /** Color of the line/area */
  color?: string;
  /** Whether to show as filled area chart */
  showArea?: boolean;
  /** Whether to show a reference line at the first value */
  showReference?: boolean;
  /** Whether to show dots on data points */
  showDots?: boolean;
  /** Line thickness */
  strokeWidth?: number;
  /** Whether to animate on initial render */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Custom class name */
  className?: string;
  /** Accessible label for the chart */
  ariaLabel?: string;
}

/**
 * Determines if the trend is positive based on data
 */
function calculateTrend(data: SparklineDataPoint[]): 'up' | 'down' | 'neutral' {
  if (data.length < 2) return 'neutral';
  const first = data[0].y;
  const last = data[data.length - 1].y;
  if (last > first) return 'up';
  if (last < first) return 'down';
  return 'neutral';
}

/**
 * Gets the color based on trend if not explicitly set
 */
function getTrendColor(trend: 'up' | 'down' | 'neutral', customColor?: string): string {
  if (customColor) return customColor;
  switch (trend) {
    case 'up':
      return colors.success[500];
    case 'down':
      return colors.error[500];
    default:
      return colors.primary[500];
  }
}

/**
 * Sparkline component for displaying trend data in a compact format
 *
 * @example
 * // Basic sparkline
 * <Sparkline
 *   data={[
 *     { x: 1, y: 10 },
 *     { x: 2, y: 15 },
 *     { x: 3, y: 12 },
 *     { x: 4, y: 18 },
 *   ]}
 * />
 *
 * @example
 * // Sparkline with custom color and area fill
 * <Sparkline
 *   data={data}
 *   color="#00d9ff"
 *   showArea
 *   height={40}
 * />
 */
export function Sparkline({
  data,
  width = '100%',
  height = 32,
  color,
  showArea = false,
  showReference = false,
  showDots = false,
  strokeWidth = 2,
  animate = true,
  animationDuration = 500,
  className,
  ariaLabel,
}: SparklineProps): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Calculate trend for automatic coloring
  const trend = useMemo(() => calculateTrend(data), [data]);
  const lineColor = useMemo(() => getTrendColor(trend, color), [trend, color]);

  // Measure container dimensions directly — avoids ResponsiveContainer width(-1) warnings
  useEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    // Check immediately
    measure();

    // Also check after a small delay to handle layout shifts
    const timeoutId = setTimeout(measure, 50);

    // Track resize
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate min/max for proper scaling
  const {
    minY: _minY,
    maxY: _maxY,
    referenceValue,
  } = useMemo(() => {
    if (data.length === 0) {
      return { minY: 0, maxY: 100, referenceValue: 0 };
    }
    const values = data.map(d => d.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Add padding to prevent lines from touching edges
    const padding = (max - min) * 0.1 || 1;
    return {
      minY: min - padding,
      maxY: max + padding,
      referenceValue: values[0],
    };
  }, [data]);

  // Don't render if no data
  if (data.length === 0) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: `${height}px`,
    minHeight: `${height}px`,
    maxHeight: `${height}px`,
    minWidth: '50px',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'stretch',
    overflow: 'hidden',
  };

  const chartProps = {
    data,
    margin: { top: 2, right: 2, bottom: 2, left: 2 },
  };

  const animationProps = animate
    ? {
        isAnimationActive: true,
        animationDuration,
        animationEasing: 'ease-out' as const,
      }
    : { isAnimationActive: false };

  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  if (showArea) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={containerStyle}
        role="img"
        aria-label={ariaLabel || `Sparkline chart showing ${trend} trend`}
      >
        {dimensions && (
          <AreaChart width={dimensions.width} height={dimensions.height} {...chartProps}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {showReference && (
              <ReferenceLine
                y={referenceValue}
                stroke={lineColor}
                strokeDasharray="3 3"
                strokeOpacity={0.3}
              />
            )}
            <Area
              type="monotone"
              dataKey="y"
              stroke={lineColor}
              strokeWidth={strokeWidth}
              fill={`url(#${gradientId})`}
              dot={showDots ? { r: 2, fill: lineColor } : false}
              {...animationProps}
            />
          </AreaChart>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      role="img"
      aria-label={ariaLabel || `Sparkline chart showing ${trend} trend`}
    >
      {dimensions && (
        <LineChart width={dimensions.width} height={dimensions.height} {...chartProps}>
          {showReference && (
            <ReferenceLine
              y={referenceValue}
              stroke={lineColor}
              strokeDasharray="3 3"
              strokeOpacity={0.3}
            />
          )}
          <Line
            type="monotone"
            dataKey="y"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            dot={showDots ? { r: 2, fill: lineColor } : false}
            {...animationProps}
          />
        </LineChart>
      )}
    </div>
  );
}

/**
 * Generates sample sparkline data for demos/testing
 */
export function generateSparklineData(
  points: number = 7,
  baseValue: number = 100,
  volatility: number = 20
): SparklineDataPoint[] {
  const data: SparklineDataPoint[] = [];
  let currentValue = baseValue;

  for (let i = 0; i < points; i++) {
    currentValue += (Math.random() - 0.5) * volatility;
    currentValue = Math.max(0, currentValue);
    data.push({
      x: i,
      y: Math.round(currentValue * 10) / 10,
    });
  }

  return data;
}
