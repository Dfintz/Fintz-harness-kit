/**
 * TrendIndicator Component - Visual indicator for trend direction
 *
 * Displays an animated arrow indicator with percentage change,
 * automatically colored based on trend direction.
 */

import React from 'react';
import { colors } from './tokens';
import styles from './TrendIndicator.module.css';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface TrendIndicatorProps {
  /** Trend direction */
  direction: TrendDirection;
  /** Value to display (e.g., "15%" or "+12.5%") */
  value?: string | number;
  /** Optional label (e.g., "vs last week") */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the arrow icon */
  showIcon?: boolean;
  /** Whether to animate the icon */
  animated?: boolean;
  /** Override automatic color based on direction */
  color?: string;
  /** Invert colors (make 'down' green for metrics where decrease is good) */
  invertColors?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Gets the color for a trend direction
 */
function getTrendColor(
  direction: TrendDirection,
  invertColors: boolean,
  customColor?: string
): string {
  if (customColor) return customColor;

  if (direction === 'neutral') {
    return colors.neutral[500];
  }

  const isPositive = invertColors ? direction === 'down' : direction === 'up';
  return isPositive ? colors.success[500] : colors.error[500];
}

/**
 * Gets the arrow character for a trend direction
 */
function getTrendIcon(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    default:
      return '→';
  }
}

/**
 * Formats the value for display
 */
function formatValue(value: string | number | undefined, direction: TrendDirection): string {
  if (value === undefined || value === null) return '';

  const strValue = String(value);

  // If already has a sign, return as-is
  if (strValue.startsWith('+') || strValue.startsWith('-')) {
    return strValue;
  }

  // Add sign based on direction
  if (direction === 'up') {
    return `+${strValue}`;
  }
  if (direction === 'down') {
    return `-${strValue}`;
  }

  return strValue;
}

/**
 * TrendIndicator component for showing trend direction with optional value
 *
 * @example
 * // Basic trend indicator
 * <TrendIndicator direction="up" value="15%" />
 *
 * @example
 * // With label and custom size
 * <TrendIndicator
 *   direction="down"
 *   value="8.3%"
 *   label="vs last month"
 *   size="lg"
 * />
 *
 * @example
 * // Inverted colors (for metrics where decrease is good)
 * <TrendIndicator
 *   direction="down"
 *   value="12%"
 *   invertColors
 * />
 */
export function TrendIndicator({
  direction,
  value,
  label,
  size = 'md',
  showIcon = true,
  animated = true,
  color,
  invertColors = false,
  className = '',
}: TrendIndicatorProps): React.ReactElement {
  const trendColor = getTrendColor(direction, invertColors, color);
  const formattedValue = formatValue(value, direction);

  const sizeClass = styles[size];

  const animationClass =
    animated && direction !== 'neutral'
      ? direction === 'up'
        ? styles.animatedUp
        : styles.animatedDown
      : '';

  return (
    <span
      className={`${styles.trendIndicator} ${sizeClass} ${animationClass} ${className}`}
      style={{ color: trendColor }}
      role="status"
      aria-label={`Trend ${direction}${formattedValue ? `: ${formattedValue}` : ''}${label ? ` ${label}` : ''}`}
    >
      {showIcon && (
        <span className={styles.icon} aria-hidden="true">
          {getTrendIcon(direction)}
        </span>
      )}
      {formattedValue && <span className={styles.value}>{formattedValue}</span>}
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}

/**
 * Helper to calculate trend direction from two values
 */
export function calculateTrendDirection(
  current: number,
  previous: number,
  threshold: number = 0.001
): TrendDirection {
  const diff = current - previous;
  if (Math.abs(diff) < threshold) return 'neutral';
  return diff > 0 ? 'up' : 'down';
}

/**
 * Helper to calculate percentage change
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
