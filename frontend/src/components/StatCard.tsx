import { Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import './StatCard.css';
import { ComparisonPeriod } from './ui/PeriodComparison';
import { Sparkline, SparklineDataPoint } from './ui/Sparkline';
import {
  TrendIndicator,
  calculatePercentageChange,
  calculateTrendDirection,
} from './ui/TrendIndicator';

export interface StatCardProps {
  /** Card label/title */
  label: string;
  /** Primary value to display */
  value: string | number;
  /** Optional subtitle text */
  subtitle?: string;
  /** Optional icon component */
  icon?: React.ComponentType<{
    size?: 'S' | 'M' | 'L' | 'XL';
    className?: string;
    style?: React.CSSProperties;
    sx?: Record<string, unknown>;
  }>;
  /** Accent color for the card */
  color?: string;
  /** Trend direction (legacy support) */
  trend?: 'up' | 'down' | 'neutral';
  /** Trend value text (legacy support, e.g., "+12%") */
  trendValue?: string;
  /** Data points for sparkline visualization */
  sparklineData?: SparklineDataPoint[];
  /** Previous period value for automatic comparison */
  previousValue?: number;
  /** Period for comparison label */
  comparisonPeriod?: ComparisonPeriod;
  /** Whether decrease is positive (for metrics like errors) */
  decreaseIsGood?: boolean;
  /** Whether to show area fill in sparkline */
  sparklineArea?: boolean;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** Additional class name */
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  color = 'var(--accent-blue)',
  trend,
  trendValue,
  sparklineData,
  previousValue,
  comparisonPeriod = 'week',
  decreaseIsGood = false,
  sparklineArea = true,
  onClick,
  className = '',
}) => {
  // Calculate trend from sparkline data or previousValue if not explicitly provided
  const calculatedTrend = useMemo(() => {
    if (trend) return { direction: trend, value: trendValue };

    // Try to calculate from previousValue
    if (previousValue !== undefined && typeof value === 'number') {
      const direction = calculateTrendDirection(value, previousValue);
      const pctChange = calculatePercentageChange(value, previousValue);
      return {
        direction,
        value: `${Math.abs(pctChange).toFixed(1)}%`,
      };
    }

    // Try to calculate from sparkline data
    if (sparklineData && sparklineData.length >= 2) {
      const first = sparklineData[0].y;
      const last = sparklineData[sparklineData.length - 1].y;
      const direction = calculateTrendDirection(last, first);
      const pctChange = calculatePercentageChange(last, first);
      return {
        direction,
        value: `${Math.abs(pctChange).toFixed(1)}%`,
      };
    }

    return null;
  }, [trend, trendValue, previousValue, value, sparklineData]);

  // Get period label
  const getPeriodLabel = (): string => {
    const labels: Record<ComparisonPeriod, string> = {
      hour: 'vs last hour',
      day: 'vs yesterday',
      week: 'vs last week',
      month: 'vs last month',
      quarter: 'vs last quarter',
      year: 'vs last year',
      custom: '',
    };
    return labels[comparisonPeriod];
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.boxShadow = `0 8px 24px rgba(0, 0, 0, 0.4), 0 0 20px ${color}20`;
    e.currentTarget.style.borderColor = `${color}40`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.borderColor = 'rgba(42, 63, 95, 0.6)';
  };

  const hasSparkline = sparklineData && sparklineData.length > 0;
  const hasTrend = calculatedTrend && calculatedTrend.direction && calculatedTrend.value;

  return (
    <div
      className={`stat-card ${hasSparkline ? 'stat-card--with-sparkline' : ''} ${onClick ? 'stat-card--clickable' : ''} ${className}`}
      style={{ '--stat-card-color': color } as React.CSSProperties}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Accent line at top */}
      <div
        className="stat-card__accent-line"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />

      <Stack direction="column" gap={1}>
        {/* Header: Label and Icon */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography className="stat-card__label">{label}</Typography>
          {Icon && (
            <div className="stat-card__icon-wrapper" style={{ background: `${color}15` }}>
              <Icon size="S" style={{ color }} />
            </div>
          )}
        </Stack>

        {/* Main Value */}
        <Typography
          className="stat-card__value"
          sx={{
            color,
            textShadow: `0 0 30px ${color}30`,
          }}
        >
          {value}
        </Typography>

        {/* Sparkline Chart */}
        {hasSparkline && (
          <div className="stat-card__sparkline">
            <Sparkline
              data={sparklineData}
              height={36}
              color={color}
              showArea={sparklineArea}
              animate={true}
              animationDuration={800}
              ariaLabel={`${label} trend chart`}
            />
          </div>
        )}

        {/* Footer: Subtitle and Trend */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
          {subtitle && <Typography className="stat-card__subtitle">{subtitle}</Typography>}
          {hasTrend && (
            <TrendIndicator
              direction={calculatedTrend.direction}
              value={calculatedTrend.value}
              label={previousValue !== undefined ? getPeriodLabel() : undefined}
              size="sm"
              invertColors={decreaseIsGood}
            />
          )}
        </Stack>
      </Stack>
    </div>
  );
};

export type { SparklineDataPoint };
