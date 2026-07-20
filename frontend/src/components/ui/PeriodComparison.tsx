/**
 * PeriodComparison Component - Compare values across time periods
 *
 * Displays a comparison of current value vs previous period with
 * trend indicator and formatted percentage change.
 */

import React, { useMemo } from 'react';
import styles from './PeriodComparison.module.css';
import {
  TrendIndicator,
  calculatePercentageChange,
  calculateTrendDirection,
} from './TrendIndicator';

export type ComparisonPeriod = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodComparisonProps {
  /** Current period value */
  current: number;
  /** Previous period value */
  previous: number;
  /** Period being compared */
  period?: ComparisonPeriod;
  /** Custom period label (used when period is 'custom') */
  customPeriodLabel?: string;
  /** Format for displaying values */
  format?: 'number' | 'currency' | 'percent';
  /** Currency symbol for currency format */
  currencySymbol?: string;
  /** Decimal places for percentage display */
  decimals?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether decrease is good (inverts colors) */
  decreaseIsGood?: boolean;
  /** Show the previous value */
  showPreviousValue?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Gets human-readable label for a comparison period
 */
function getPeriodLabel(period: ComparisonPeriod, customLabel?: string): string {
  if (period === 'custom' && customLabel) {
    return customLabel;
  }

  const labels: Record<ComparisonPeriod, string> = {
    hour: 'vs last hour',
    day: 'vs yesterday',
    week: 'vs last week',
    month: 'vs last month',
    quarter: 'vs last quarter',
    year: 'vs last year',
    custom: '',
  };

  return labels[period];
}

/**
 * Formats a number based on the specified format
 */
function formatNumber(
  value: number,
  format: 'number' | 'currency' | 'percent',
  currencySymbol: string = '$',
  decimals: number = 0
): string {
  switch (format) {
    case 'currency':
      return `${currencySymbol}${value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    case 'percent':
      return `${value.toFixed(decimals)}%`;
    default:
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  }
}

/**
 * PeriodComparison component for showing value changes over time
 *
 * @example
 * // Basic comparison
 * <PeriodComparison
 *   current={125}
 *   previous={100}
 *   period="week"
 * />
 *
 * @example
 * // Currency comparison with previous value shown
 * <PeriodComparison
 *   current={2500000}
 *   previous={2100000}
 *   period="month"
 *   format="currency"
 *   showPreviousValue
 * />
 *
 * @example
 * // Inverted colors (e.g., for costs or errors)
 * <PeriodComparison
 *   current={12}
 *   previous={18}
 *   period="day"
 *   decreaseIsGood
 * />
 */
export function PeriodComparison({
  current,
  previous,
  period = 'week',
  customPeriodLabel,
  format = 'number',
  currencySymbol = '$',
  decimals = 1,
  size = 'md',
  decreaseIsGood = false,
  showPreviousValue = false,
  className = '',
}: PeriodComparisonProps): React.ReactElement {
  const {
    direction,
    percentChange: _percentChange,
    formattedPercent,
    periodLabel,
  } = useMemo(() => {
    const dir = calculateTrendDirection(current, previous);
    const pctChange = calculatePercentageChange(current, previous);
    const formattedPct = `${Math.abs(pctChange).toFixed(decimals)}%`;
    const label = getPeriodLabel(period, customPeriodLabel);

    return {
      direction: dir,
      percentChange: pctChange,
      formattedPercent: formattedPct,
      periodLabel: label,
    };
  }, [current, previous, period, customPeriodLabel, decimals]);

  const sizeClass = styles[size];

  return (
    <div className={`${styles.periodComparison} ${sizeClass} ${className}`}>
      <TrendIndicator
        direction={direction}
        value={formattedPercent}
        label={periodLabel}
        size={size}
        invertColors={decreaseIsGood}
      />
      {showPreviousValue && (
        <span className={styles.previous}>
          from {formatNumber(previous, format, currencySymbol, 0)}
        </span>
      )}
    </div>
  );
}

/**
 * Helper hook to manage comparison data
 */
export function usePeriodComparison(currentData: number[], previousData: number[]) {
  return useMemo(() => {
    const currentSum = currentData.reduce((a, b) => a + b, 0);
    const previousSum = previousData.reduce((a, b) => a + b, 0);
    const direction = calculateTrendDirection(currentSum, previousSum);
    const percentChange = calculatePercentageChange(currentSum, previousSum);

    return {
      current: currentSum,
      previous: previousSum,
      direction,
      percentChange,
    };
  }, [currentData, previousData]);
}
