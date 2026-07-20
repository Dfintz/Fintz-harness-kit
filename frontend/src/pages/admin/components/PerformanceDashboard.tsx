/**
 * Performance Dashboard
 *
 * Displays Web Vitals metrics, performance trends, and budget indicators
 * with live auto-refresh and theme-aware styling.
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { PERFORMANCE_BUDGETS } from '@/services/performanceMonitoring';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  FiberManualRecord as LiveIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  alpha,
  Box,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

const LIVE_REFRESH_MS = 30_000;

/**
 * Aggregated Web Vitals statistics
 */
interface WebVitalsStats {
  metric: string;
  average: number;
  p75: number;
  p95: number;
  p99: number;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
  totalCount: number;
}

/**
 * Historical trend data point
 */
interface TrendDataPoint {
  timestamp: string;
  LCP: number;
  INP: number;
  CLS: number;
  TTFB: number;
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
  LCP: 'Largest Contentful Paint — loading performance',
  INP: 'Interaction to Next Paint — responsiveness',
  CLS: 'Cumulative Layout Shift — visual stability',
  TTFB: 'Time to First Byte — server response time',
};

function generateMockStats(): WebVitalsStats[] {
  return [
    {
      metric: 'LCP',
      average: 2100,
      p75: 2400,
      p95: 3200,
      p99: 4500,
      goodCount: 850,
      needsImprovementCount: 120,
      poorCount: 30,
      totalCount: 1000,
    },
    {
      metric: 'INP',
      average: 180,
      p75: 210,
      p95: 320,
      p99: 480,
      goodCount: 880,
      needsImprovementCount: 90,
      poorCount: 30,
      totalCount: 1000,
    },
    {
      metric: 'CLS',
      average: 0.08,
      p75: 0.09,
      p95: 0.15,
      p99: 0.22,
      goodCount: 900,
      needsImprovementCount: 70,
      poorCount: 30,
      totalCount: 1000,
    },
    {
      metric: 'TTFB',
      average: 600,
      p75: 720,
      p95: 1200,
      p99: 1600,
      goodCount: 870,
      needsImprovementCount: 100,
      poorCount: 30,
      totalCount: 1000,
    },
  ];
}

function generateMockTrends(): TrendDataPoint[] {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now - (23 - i) * 60 * 60 * 1000);
    return {
      timestamp: hour.toISOString().substring(11, 16),
      // NOSONAR: Math.random is acceptable for mock/demo visualization data
      LCP: 2000 + Math.random() * 500, // NOSONAR
      INP: 170 + Math.random() * 60, // NOSONAR
      CLS: 0.05 + Math.random() * 0.08, // NOSONAR
      TTFB: 550 + Math.random() * 200, // NOSONAR
    };
  });
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

function getMetricStatus(metric: string, value: number): 'positive' | 'notice' | 'negative' {
  const budget = PERFORMANCE_BUDGETS[metric as keyof typeof PERFORMANCE_BUDGETS];
  if (!budget) return 'positive';
  if (value <= budget.good) return 'positive';
  if (value <= budget.poor) return 'notice';
  return 'negative';
}

const goodPercent = (stat: WebVitalsStats) => Math.round((stat.goodCount / stat.totalCount) * 100);
const needsPercent = (stat: WebVitalsStats) =>
  Math.round((stat.needsImprovementCount / stat.totalCount) * 100);
const poorPercent = (stat: WebVitalsStats) => Math.round((stat.poorCount / stat.totalCount) * 100);

export const PerformanceDashboard: React.FC = () => {
  const theme = useTheme();
  const [liveEnabled, setLiveEnabled] = useState(true);

  const {
    data,
    error: queryError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: adminKeys.performance(),
    queryFn: () => {
      return { stats: generateMockStats(), trendData: generateMockTrends() };
    },
    refetchInterval: liveEnabled ? LIVE_REFRESH_MS : false,
  });

  const stats = data?.stats ?? [];
  const trendData = data?.trendData ?? [];
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  let error: string | null = null;
  if (queryError) {
    error = queryError instanceof Error ? queryError.message : String(queryError);
  }

  const statusColors = useMemo(
    () => ({
      positive: theme.palette.success.main,
      notice: theme.palette.warning.main,
      negative: theme.palette.error.main,
    }),
    [theme]
  );

  /** Shared card styling — frosted glass panels */
  const cardSx = {
    background: alpha(theme.palette.background.paper, 0.6),
    backdropFilter: 'blur(12px)',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
    borderRadius: 2,
    p: 3,
  };

  /** Chart axis / grid colours that work in dark and light themes */
  const gridStroke = alpha(theme.palette.text.secondary, 0.15);
  const axisTickColor = theme.palette.text.secondary;

  /** Chart palette */
  const chartColors = {
    lcp: theme.palette.primary.main,
    inp: theme.palette.warning.main,
    ttfb: theme.palette.error.light,
    good: theme.palette.success.main,
    needsImprovement: theme.palette.warning.main,
    poor: theme.palette.error.main,
  };

  /** Stable legend formatter that renders with theme text colour */
  const legendFormatter = (value: string) => (
    <Box component="span" sx={{ color: 'text.primary', fontSize: 13 }}>
      {value}
    </Box>
  );

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: alpha(theme.palette.background.paper, 0.92),
      border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
      borderRadius: 8,
      color: theme.palette.text.primary,
      backdropFilter: 'blur(8px)',
    },
    itemStyle: { color: theme.palette.text.primary },
    labelStyle: { color: theme.palette.text.secondary, fontWeight: 600 },
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ ...cardSx, borderColor: alpha(theme.palette.error.main, 0.3) }}>
          <Typography variant="h6">Performance Dashboard</Typography>
          <Typography color="error">{error}</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        minHeight: '100vh',
        background: `linear-gradient(145deg, ${alpha(theme.palette.background.default, 0.97)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
      }}
    >
      {/* Live-refresh progress bar */}
      {isFetching && (
        <LinearProgress
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar + 1,
            height: 2,
          }}
        />
      )}

      <Stack direction="column" spacing={3}>
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <SpeedIcon
              sx={{
                fontSize: 32,
                color: 'primary.main',
                filter: `drop-shadow(0 0 6px ${alpha(theme.palette.primary.main, 0.5)})`,
              }}
            />
            <Stack direction="column" spacing={0.25}>
              <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                Performance Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Core Web Vitals monitoring and performance budgets
                {lastUpdated && ` · Last updated: ${lastUpdated.toLocaleTimeString()}`}
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={
                <LiveIcon
                  sx={{
                    fontSize: 10,
                    animation: liveEnabled ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.3 },
                    },
                  }}
                />
              }
              label={liveEnabled ? 'Live' : 'Paused'}
              size="small"
              color={liveEnabled ? 'success' : 'default'}
              variant={liveEnabled ? 'filled' : 'outlined'}
              onClick={() => setLiveEnabled(prev => !prev)}
              sx={{ fontWeight: 600, cursor: 'pointer' }}
            />
            <Tooltip title="Refresh now">
              <IconButton
                onClick={() => refetch()}
                aria-label="Refresh data"
                size="small"
                sx={{
                  color: 'primary.main',
                  '&:hover': { background: alpha(theme.palette.primary.main, 0.08) },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* ── Metric Cards ── */}
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Current Performance
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {stats.map(stat => {
            const status = getMetricStatus(stat.metric, stat.average);
            const statusColor = statusColors[status];
            return (
              <Paper
                key={stat.metric}
                elevation={0}
                sx={{
                  ...cardSx,
                  borderLeft: `3px solid ${statusColor}`,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 20px ${alpha(statusColor, 0.15)}`,
                  },
                }}
              >
                <Stack direction="column" spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                      {stat.metric}
                    </Typography>
                    <Tooltip title={METRIC_DESCRIPTIONS[stat.metric] ?? ''}>
                      <InfoIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    </Tooltip>
                  </Stack>

                  {/* Big value */}
                  <Stack direction="row" alignItems="baseline" spacing={0.75}>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 800,
                        color: statusColor,
                        lineHeight: 1,
                        filter: `drop-shadow(0 0 4px ${alpha(statusColor, 0.35)})`,
                      }}
                    >
                      {formatMetricValue(stat.metric, stat.average)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      avg
                    </Typography>
                  </Stack>

                  {/* Percentiles */}
                  <Typography variant="caption" color="text.secondary">
                    P75: {formatMetricValue(stat.metric, stat.p75)} · P95:{' '}
                    {formatMetricValue(stat.metric, stat.p95)}
                  </Typography>

                  <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.08) }} />

                  {/* Distribution bar */}
                  <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    <Box
                      sx={{
                        width: `${goodPercent(stat)}%`,
                        backgroundColor: chartColors.good,
                        transition: 'width 0.4s ease',
                      }}
                    />
                    <Box
                      sx={{
                        width: `${needsPercent(stat)}%`,
                        backgroundColor: chartColors.needsImprovement,
                        transition: 'width 0.4s ease',
                      }}
                    />
                    <Box
                      sx={{
                        width: `${poorPercent(stat)}%`,
                        backgroundColor: chartColors.poor,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>

                  {/* Breakdown */}
                  <Stack direction="row" spacing={1.5}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {goodPercent(stat)}%
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {needsPercent(stat)}%
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <CancelIcon sx={{ fontSize: 14, color: 'error.main' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {poorPercent(stat)}%
                      </Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Box>

        {/* ── Rating Distribution ── */}
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Rating Distribution
        </Typography>
        <Paper elevation={0} sx={cardSx}>
          <div
            role="img"
            aria-label="Rating distribution stacked bar chart showing good, needs improvement, and poor counts per metric"
          >
            <ResponsiveContainer width="100%" height={360} minWidth={100} minHeight={100}>
              <BarChart data={stats} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="metric"
                  tick={{ fill: axisTickColor, fontSize: 13, fontWeight: 600 }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisTickColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: 12 }} formatter={legendFormatter} />
                <Bar
                  dataKey="goodCount"
                  stackId="a"
                  fill={chartColors.good}
                  name="Good"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="needsImprovementCount"
                  stackId="a"
                  fill={chartColors.needsImprovement}
                  name="Needs Improvement"
                />
                <Bar
                  dataKey="poorCount"
                  stackId="a"
                  fill={chartColors.poor}
                  name="Poor"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Paper>

        {/* ── Performance Trends (24h) ── */}
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Performance Trends (24 hours)
        </Typography>
        <Paper elevation={0} sx={cardSx}>
          <div
            role="img"
            aria-label="Performance trends over 24 hours area chart showing LCP, INP, and TTFB metrics"
          >
            <ResponsiveContainer width="100%" height={360} minWidth={100} minHeight={100}>
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradLCP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.lcp} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColors.lcp} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradINP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.inp} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColors.inp} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradTTFB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.ttfb} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColors.ttfb} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisTickColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: 12 }} formatter={legendFormatter} />
                <Area
                  type="monotone"
                  dataKey="LCP"
                  stroke={chartColors.lcp}
                  fill="url(#gradLCP)"
                  strokeWidth={2}
                  name="LCP (ms)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="INP"
                  stroke={chartColors.inp}
                  fill="url(#gradINP)"
                  strokeWidth={2}
                  name="INP (ms)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="TTFB"
                  stroke={chartColors.ttfb}
                  fill="url(#gradTTFB)"
                  strokeWidth={2}
                  name="TTFB (ms)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Paper>

        {/* ── Performance Budgets ── */}
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Performance Budgets
        </Typography>
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="column" spacing={0}>
            {Object.entries(PERFORMANCE_BUDGETS).map(([metric, budget], idx, arr) => {
              const currentStat = stats.find(s => s.metric === metric);
              const currentVal = currentStat?.average ?? 0;
              const status = getMetricStatus(metric, currentVal);
              const ratio = Math.min(currentVal / budget.poor, 1);
              return (
                <React.Fragment key={metric}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: statusColors[status],
                          boxShadow: `0 0 6px ${alpha(statusColors[status], 0.5)}`,
                        }}
                      />
                      <Typography sx={{ fontWeight: 600 }}>{metric}</Typography>
                      {currentStat && (
                        <Typography variant="caption" color="text.secondary">
                          {formatMetricValue(metric, currentVal)}
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction="row" spacing={3} alignItems="center">
                      {/* Budget bar */}
                      <Box
                        sx={{
                          width: 120,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: alpha(theme.palette.text.disabled, 0.12),
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${ratio * 100}%`,
                            height: '100%',
                            borderRadius: 3,
                            backgroundColor: statusColors[status],
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </Box>
                      <Stack direction="row" spacing={2}>
                        <Typography variant="caption">
                          <CheckCircleIcon
                            sx={{
                              fontSize: 14,
                              mr: 0.5,
                              verticalAlign: 'middle',
                              color: 'success.main',
                            }}
                          />
                          ≤ {metric === 'CLS' ? budget.good.toFixed(2) : `${budget.good}ms`}
                        </Typography>
                        <Typography variant="caption">
                          <CancelIcon
                            sx={{
                              fontSize: 14,
                              mr: 0.5,
                              verticalAlign: 'middle',
                              color: 'error.main',
                            }}
                          />
                          &gt; {metric === 'CLS' ? budget.poor.toFixed(2) : `${budget.poor}ms`}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                  {idx < arr.length - 1 && (
                    <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.08) }} />
                  )}
                </React.Fragment>
              );
            })}
          </Stack>
        </Paper>

        {/* ── Info Section ── */}
        <Paper
          elevation={0}
          sx={{
            ...cardSx,
            borderColor: alpha(theme.palette.info.main, 0.2),
            background: alpha(theme.palette.info.main, 0.06),
          }}
        >
          <Stack direction="column" spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <InfoIcon sx={{ color: 'info.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                About Web Vitals
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              <strong>LCP (Largest Contentful Paint):</strong> Loading performance — measures how
              long it takes for the largest content element to become visible.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>INP (Interaction to Next Paint):</strong> Responsiveness — measures the
              latency of all interactions on the page.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>CLS (Cumulative Layout Shift):</strong> Visual stability — measures unexpected
              layout shifts during page load.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>TTFB (Time to First Byte):</strong> Server response time — measures the time
              from request to first byte of response.
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};
