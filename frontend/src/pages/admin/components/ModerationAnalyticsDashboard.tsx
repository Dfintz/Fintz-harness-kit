/**
 * Moderation Analytics Dashboard Component
 *
 * Phase 4: Cross-Discord Blacklist System - Analytics Dashboard
 * Displays moderation trends, repeat offenders, and GDPR compliance features
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { apiClient } from '@/services/apiClient';
import { selectToken, useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import {
  AccessTime,
  CalendarMonth as CalendarMonthIcon,
  Schedule as Clock,
  CompareArrows as CompareArrowsIcon,
  Delete,
  Download,
  ErrorOutline,
  BarChart as GraphBarVertical,
  ListAlt,
  Refresh,
  Security as Shield,
  TrendingUp,
  Person as User,
  WarningAmber,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import { type Theme, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';

import { useAdminGdprRequests } from '@/hooks/queries/useGdprAdminQueries';

import { Box, Button, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import './admin-tables.css';
/**
 * Chart scaling configuration for trend visualizations
 * Multipliers are used to scale bar heights based on data density
 */
const CHART_SCALING = {
  /** Daily trend: higher multiplier for sparse daily data */
  DAILY_MULTIPLIER: 10,
  /** Weekly trend: medium multiplier for weekly aggregates */
  WEEKLY_MULTIPLIER: 5,
  /** Monthly trend: lower multiplier for larger monthly totals */
  MONTHLY_MULTIPLIER: 2,
  /** Minimum bar height to ensure visibility */
  MIN_HEIGHT: 10,
};

function getStatusLightVariant(status: string): 'positive' | 'notice' | 'neutral' {
  switch (status) {
    case 'active':
      return 'positive';
    case 'revoked':
      return 'notice';
    default:
      return 'neutral';
  }
}

const variantToColor: Record<string, string> = {
  positive: 'success.main',
  notice: 'warning.main',
  neutral: 'grey.500',
  negative: 'error.main',
  info: 'info.main',
};

interface TrendDataPoint {
  date: string;
  count: number;
  label?: string;
}

interface RepeatOffender {
  targetDiscordId: string;
  targetUsername?: string;
  totalIncidents: number;
  activeIncidents: number;
  highestSeverity: number;
  riskScore: number;
  isHighRisk: boolean;
}

interface MirrorStats {
  totalMirrors: number;
  confirmedMirrors: number;
  pendingMirrors: number;
  cancelledMirrors: number;
  failedMirrors: number;
}

interface ModerationAnalytics {
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  sharedIncidents: number;
  autoDetectedIncidents: number;
  byType: Record<string, number>;
  bySeverity: Record<number, number>;
  byStatus: Record<string, number>;
  dailyTrend: TrendDataPoint[];
  weeklyTrend: TrendDataPoint[];
  monthlyTrend: TrendDataPoint[];
  uniqueTargets: number;
  uniqueModerators: number;
  averageSeverity: number;
  repeatOffenders: RepeatOffender[];
  repeatOffenderCount: number;
  mirrorStats: MirrorStats;
  incidentsLast24Hours: number;
  incidentsLast7Days: number;
  incidentsLast30Days: number;
  generatedAt: string;
}

export const ModerationAnalyticsDashboard: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'overBox' | 'trends' | 'offenders' | 'gdpr'>(
    'overBox'
  );
  const token = useAuthStore(selectToken);
  const theme = useTheme();

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: adminKeys.moderationAnalytics(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ModerationAnalytics>(
          '/api/v2/admin/moderation/analytics'
        );

        const defaults: ModerationAnalytics = {
          totalIncidents: 0,
          activeIncidents: 0,
          resolvedIncidents: 0,
          byType: {},
          bySeverity: {},
          byStatus: {},
          dailyTrend: [],
          weeklyTrend: [],
          monthlyTrend: [],
          uniqueTargets: 0,
          uniqueModerators: 0,
          averageSeverity: 0,
          repeatOffenders: [],
          repeatOffenderCount: 0,
          sharedIncidents: 0,
          autoDetectedIncidents: 0,
          incidentsLast24Hours: 0,
          incidentsLast7Days: 0,
          incidentsLast30Days: 0,
          generatedAt: new Date().toISOString(),
          mirrorStats: {
            totalMirrors: 0,
            confirmedMirrors: 0,
            pendingMirrors: 0,
            cancelledMirrors: 0,
            failedMirrors: 0,
          },
        };
        const analytics = { ...defaults, ...response.data };

        return { analytics };
      } catch (err) {
        if (import.meta.env.DEV) {
          logger.warn('API not available, using demo data for moderation analytics');
          return { analytics: getMockAnalytics() };
        }
        throw err;
      }
    },
    enabled: !!token,
  });

  const analytics = data?.analytics ?? null;

  const { data: gdprData, isLoading: gdprLoading } = useAdminGdprRequests(!!token);
  const gdprRequests = gdprData?.requests ?? [];
  const gdprSummary = gdprData?.summary ?? null;

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : String(queryError)
    : null;

  const getSeverityLabel = (severity: number): string => {
    switch (severity) {
      case 1:
        return 'Warning';
      case 2:
        return 'Timeout';
      case 3:
        return 'Long Timeout';
      case 4:
        return 'Kick';
      case 5:
        return 'Ban';
      default:
        return 'Unknown';
    }
  };

  const getSeverityColor = (severity: number, t: Theme): string => {
    switch (severity) {
      case 1:
        return t.palette.success.main;
      case 2:
        return t.palette.warning.light;
      case 3:
        return t.palette.warning.main;
      case 4:
        return t.palette.error.main;
      case 5:
        return t.palette.error.dark;
      default:
        return t.palette.text.secondary;
    }
  };

  const getRiskColor = (riskScore: number, t: Theme): string => {
    if (riskScore >= 70) return t.palette.error.main;
    if (riskScore >= 40) return t.palette.warning.main;
    return t.palette.success.main;
  };

  const getStatusVariant = (status: string): 'positive' | 'notice' | 'negative' | 'info' => {
    switch (status) {
      case 'completed':
        return 'positive';
      case 'pending':
        return 'notice';
      case 'processing':
        return 'info';
      case 'failed':
        return 'negative';
      default:
        return 'notice';
    }
  };

  if (loading) {
    return (
      <Stack justifyContent="center" alignItems="center" sx={{ height: 200 }}>
        <CircularProgress aria-label="Loading" size={24} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.error.main }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ErrorOutline sx={{ color: theme.palette.error.main }} />
          <Typography>{error}</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h3">
          <GraphBarVertical sx={{ fontSize: 28, mr: 0.5, verticalAlign: 'middle' }} /> Moderation
          Analytics Dashboard
        </Typography>
        <Stack spacing={2}>
          <Button variant="outlined" onClick={() => refetch()}>
            <Refresh />
            <Typography>Refresh</Typography>
          </Button>
        </Stack>
      </Stack>

      {/* Tab Navigation */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Button
          variant={selectedTab === 'overBox' ? 'contained' : 'outlined'}
          onClick={() => setSelectedTab('overBox')}
        >
          <GraphBarVertical />
          <Typography>OverBox</Typography>
        </Button>
        <Button
          variant={selectedTab === 'trends' ? 'contained' : 'outlined'}
          onClick={() => setSelectedTab('trends')}
        >
          <Clock />
          <Typography>Trends</Typography>
        </Button>
        <Button
          variant={selectedTab === 'offenders' ? 'contained' : 'outlined'}
          onClick={() => setSelectedTab('offenders')}
        >
          <WarningAmberIcon />
          <Typography>Repeat Offenders</Typography>
        </Button>
        <Button
          variant={selectedTab === 'gdpr' ? 'contained' : 'outlined'}
          onClick={() => setSelectedTab('gdpr')}
        >
          <Shield />
          <Typography>GDPR Compliance</Typography>
        </Button>
      </Stack>

      {/* OverBox Tab */}
      {selectedTab === 'overBox' && analytics && (
        <Box>
          {/* Summary Cards */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
            <Box flex={1} sx={{ minWidth: 240 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <GraphBarVertical sx={{ color: theme.palette.primary.main, fontSize: 32 }} />
                  <Box>
                    <Typography variant="h2">{analytics.totalIncidents}</Typography>
                    <Typography sx={{ color: theme.palette.text.secondary }}>
                      Total Incidents
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
            <Box flex={1} sx={{ minWidth: 240 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <ErrorOutline sx={{ color: theme.palette.success.main, fontSize: '2rem' }} />
                  <Box>
                    <Typography variant="h2">{analytics.activeIncidents}</Typography>
                    <Typography sx={{ color: theme.palette.text.secondary }}>
                      Active Incidents
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
            <Box flex={1} sx={{ minWidth: 240 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <User sx={{ color: theme.palette.warning.main, fontSize: 32 }} />
                  <Box>
                    <Typography variant="h2">{analytics.uniqueTargets}</Typography>
                    <Typography sx={{ color: theme.palette.text.secondary }}>
                      Unique Targets
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
            <Box flex={1} sx={{ minWidth: 240 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Shield sx={{ color: theme.palette.error.main, fontSize: 32 }} />
                  <Box>
                    <Typography variant="h2">{analytics.repeatOffenderCount}</Typography>
                    <Typography sx={{ color: theme.palette.text.secondary }}>
                      Repeat Offenders
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Stack>

          {/* Recent Activity */}
          <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              <AccessTime sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Recent Activity
            </Typography>
            <Stack direction="row" spacing={4} flexWrap="wrap">
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Last 24 Hours</Typography>
                <Typography variant="h3">{analytics.incidentsLast24Hours}</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Last 7 Days</Typography>
                <Typography variant="h3">{analytics.incidentsLast7Days}</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Last 30 Days</Typography>
                <Typography variant="h3">{analytics.incidentsLast30Days}</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Avg. Severity</Typography>
                <Typography variant="h3">{(analytics.averageSeverity ?? 0).toFixed(2)}</Typography>
              </Box>
            </Stack>
          </Box>

          {/* Breakdown by Type and Status */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
            <Box flex={1} sx={{ minWidth: 300 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  <ListAlt sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> By Type
                </Typography>
                {Object.entries(analytics.byType).map(([type, count]) => (
                  <Stack key={type} direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography>{type.replace('_', ' ').toUpperCase()}</Typography>
                    <Typography sx={{ fontWeight: 'bold' }}>{count}</Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
            <Box flex={1} sx={{ minWidth: 300 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  <GraphBarVertical sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> By
                  Status
                </Typography>
                {Object.entries(analytics.byStatus).map(([status, count]) => (
                  <Stack key={status} direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Box
                      component="span"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
                    >
                      <Box
                        component="span"
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: variantToColor[getStatusLightVariant(status)],
                        }}
                      />
                      {status.toUpperCase()}
                    </Box>
                    <Typography sx={{ fontWeight: 'bold' }}>{count}</Typography>
                  </Stack>
                ))}
              </Box>
            </Box>
          </Stack>

          {/* Mirror Action Stats */}
          <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompareArrowsIcon /> Mirror Action Statistics
            </Typography>
            <Stack direction="row" spacing={4} flexWrap="wrap">
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Total</Typography>
                <Typography variant="h3">{analytics.mirrorStats.totalMirrors}</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Confirmed</Typography>
                <Typography variant="h3" sx={{ color: theme.palette.success.main }}>
                  {analytics.mirrorStats.confirmedMirrors}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Pending</Typography>
                <Typography variant="h3" sx={{ color: theme.palette.warning.main }}>
                  {analytics.mirrorStats.pendingMirrors}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: theme.palette.text.secondary }}>Failed</Typography>
                <Typography variant="h3" sx={{ color: theme.palette.error.main }}>
                  {analytics.mirrorStats.failedMirrors}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}

      {/* Trends Tab */}
      {selectedTab === 'trends' && analytics && (
        <Box>
          <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              <TrendingUp sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Daily Trend
              (Last 7 Days)
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Stack direction="row" spacing={1} alignItems="end" sx={{ minHeight: 160 }}>
                {analytics.dailyTrend.map(point => (
                  <Stack key={point.date} direction="column" alignItems="center" flex={1}>
                    <Box
                      sx={{
                        width: '100%',
                        height: `${Math.max(point.count * CHART_SCALING.DAILY_MULTIPLIER, CHART_SCALING.MIN_HEIGHT)}px`,
                        backgroundColor: theme.palette.primary.main,
                        borderRadius: '4px 4px 0 0',
                        minWidth: '40px',
                      }}
                    />
                    <Typography sx={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      {point.count}
                    </Typography>
                    <Typography sx={{ fontSize: '0.625rem', color: theme.palette.text.secondary }}>
                      {point.label || point.date}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>

          <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              <GraphBarVertical sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle' }} /> Weekly
              Trend (Last 4 Weeks)
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Stack direction="row" spacing={1} alignItems="end" sx={{ minHeight: 160 }}>
                {analytics.weeklyTrend.map(point => (
                  <Stack key={point.date} direction="column" alignItems="center" flex={1}>
                    <Box
                      sx={{
                        width: '100%',
                        height: `${Math.max(point.count * CHART_SCALING.WEEKLY_MULTIPLIER, CHART_SCALING.MIN_HEIGHT)}px`,
                        backgroundColor: theme.palette.success.main,
                        borderRadius: '4px 4px 0 0',
                        minWidth: '60px',
                      }}
                    />
                    <Typography sx={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      {point.count}
                    </Typography>
                    <Typography sx={{ fontSize: '0.625rem', color: theme.palette.text.secondary }}>
                      {point.label || point.date}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>

          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="h4" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonthIcon /> Monthly Trend (Last 3 Months)
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Stack direction="row" spacing={1} alignItems="end" sx={{ minHeight: 160 }}>
                {analytics.monthlyTrend.map(point => (
                  <Stack key={point.date} direction="column" alignItems="center" flex={1}>
                    <Box
                      sx={{
                        width: '100%',
                        height: `${Math.max(point.count * CHART_SCALING.MONTHLY_MULTIPLIER, CHART_SCALING.MIN_HEIGHT)}px`,
                        backgroundColor: theme.palette.warning.main,
                        borderRadius: '4px 4px 0 0',
                        minWidth: '80px',
                      }}
                    />
                    <Typography sx={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      {point.count}
                    </Typography>
                    <Typography sx={{ fontSize: '0.625rem', color: theme.palette.text.secondary }}>
                      {point.label || point.date}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      )}

      {/* Repeat Offenders Tab */}
      {selectedTab === 'offenders' && analytics && (
        <Box>
          <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              <WarningAmber
                sx={{ fontSize: 22, mr: 0.5, verticalAlign: 'middle', color: 'warning.main' }}
              />{' '}
              Repeat Offenders ({analytics.repeatOffenderCount})
            </Typography>
            {analytics.repeatOffenders.length === 0 ? (
              <Typography sx={{ color: theme.palette.text.secondary }}>
                No repeat offenders detected in the current time window.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th className="text-center">Total Incidents</th>
                      <th className="text-center">Active</th>
                      <th className="text-center">Highest Severity</th>
                      <th className="text-center">Risk Score</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.repeatOffenders.map(offender => (
                      <tr key={offender.targetDiscordId}>
                        <td>
                          <Stack direction="column">
                            <Typography sx={{ fontWeight: 'bold' }}>
                              {offender.targetUsername || 'Unknown User'}
                            </Typography>
                            <Typography
                              sx={{
                                color: theme.palette.text.secondary,
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {offender.targetDiscordId}
                            </Typography>
                          </Stack>
                        </td>
                        <td className="text-center">
                          <Typography sx={{ fontWeight: 'bold' }}>
                            {offender.totalIncidents}
                          </Typography>
                        </td>
                        <td className="text-center">
                          <Typography
                            sx={{
                              color:
                                offender.activeIncidents > 0
                                  ? theme.palette.error.main
                                  : theme.palette.text.secondary,
                            }}
                          >
                            {offender.activeIncidents}
                          </Typography>
                        </td>
                        <td className="text-center">
                          <Typography
                            sx={{ color: getSeverityColor(offender.highestSeverity, theme) }}
                          >
                            {getSeverityLabel(offender.highestSeverity)}
                          </Typography>
                        </td>
                        <td className="text-center">
                          <Stack direction="column" alignItems="center">
                            <LinearProgress
                              variant="determinate"
                              value={offender.riskScore}
                              sx={{ width: 60 }}
                            />
                            <Typography
                              sx={{
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                color: getRiskColor(offender.riskScore, theme),
                              }}
                            >
                              {offender.riskScore}%
                            </Typography>
                          </Stack>
                        </td>
                        <td className="text-center">
                          <Box
                            component="span"
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
                          >
                            <Box
                              component="span"
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: offender.isHighRisk ? 'error.main' : 'warning.main',
                              }}
                            />
                            {offender.isHighRisk ? 'High Risk' : 'Watch'}
                          </Box>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </Box>

          <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.warning.main }}>
            <Stack direction="row" spacing={1} alignItems="start">
              <WarningAmber sx={{ color: theme.palette.warning.main }} />
              <Typography>
                <strong>Repeat Offender Detection:</strong> Users with 3+ incidents within the last
                90 days are flagged as repeat offenders. Risk scores are calculated based on
                incident count, severity, recency, and active status.
              </Typography>
            </Stack>
          </Box>
        </Box>
      )}

      {/* GDPR Compliance Tab */}
      {selectedTab === 'gdpr' && (
        <Box>
          {gdprLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {!gdprLoading && (
            <>
              {/* GDPR Summary */}
              <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
                <Box flex={1} sx={{ minWidth: 240 }}>
                  <Box sx={{ borderRadius: 1, p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Download sx={{ color: theme.palette.primary.main, fontSize: 32 }} />
                      <Box>
                        <Typography variant="h2">{gdprSummary?.exportCount ?? 0}</Typography>
                        <Typography sx={{ color: theme.palette.text.secondary }}>
                          Data Export Requests
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Box>
                <Box flex={1} sx={{ minWidth: 240 }}>
                  <Box sx={{ borderRadius: 1, p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Delete sx={{ color: theme.palette.error.main, fontSize: 32 }} />
                      <Box>
                        <Typography variant="h2">{gdprSummary?.deletionCount ?? 0}</Typography>
                        <Typography sx={{ color: theme.palette.text.secondary }}>
                          Deletion Requests
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Box>
                <Box flex={1} sx={{ minWidth: 240 }}>
                  <Box sx={{ borderRadius: 1, p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Clock sx={{ color: theme.palette.warning.main, fontSize: 32 }} />
                      <Box>
                        <Typography variant="h2">{gdprSummary?.pendingCount ?? 0}</Typography>
                        <Typography sx={{ color: theme.palette.text.secondary }}>
                          Pending Requests
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Box>
              </Stack>

              {/* Recent GDPR Requests */}
              <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
                <Typography variant="h4" sx={{ mb: 2 }}>
                  Recent GDPR Requests
                </Typography>
                {gdprRequests.length === 0 ? (
                  <Typography sx={{ color: theme.palette.text.secondary }}>
                    No GDPR requests found.
                  </Typography>
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>Type</th>
                          <th>User (Anonymized)</th>
                          <th>Status</th>
                          <th>Requested</th>
                          <th>Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gdprRequests.map(request => (
                          <tr key={request.id}>
                            <td>
                              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                REQ-{request.id.substring(0, 8)}
                              </Typography>
                            </td>
                            <td>
                              <Stack direction="row" spacing={1} alignItems="center">
                                {request.type === 'export' ? (
                                  <Download
                                    sx={{ color: theme.palette.primary.main, fontSize: 16 }}
                                  />
                                ) : (
                                  <Delete sx={{ color: theme.palette.error.main, fontSize: 16 }} />
                                )}
                                <Box
                                  component="span"
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
                                >
                                  <Box
                                    component="span"
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      bgcolor:
                                        request.type === 'export' ? 'info.main' : 'error.main',
                                    }}
                                  />
                                  {request.type}
                                </Box>
                              </Stack>
                            </td>
                            <td>
                              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                {request.userId ? `***${request.userId.slice(-4)}` : '—'}
                              </Typography>
                            </td>
                            <td>
                              <Box
                                component="span"
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: variantToColor[getStatusVariant(request.status)],
                                  }}
                                />
                                {request.status}
                              </Box>
                            </td>
                            <td>{new Date(request.requestedAt).toLocaleString()}</td>
                            <td>
                              {request.completedAt
                                ? new Date(request.completedAt).toLocaleString()
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                )}
              </Box>

              {/* Data Retention Notice */}
              <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.primary.main }}>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  <ListAlt sx={{ fontSize: 20, mr: 0.5, verticalAlign: 'middle' }} /> Data Retention
                  Policies
                </Typography>
                <Stack direction="column" spacing={1}>
                  <Typography>
                    • <strong>Active Incidents:</strong> Retained for 2 years
                  </Typography>
                  <Typography>
                    • <strong>Expired/Revoked Incidents:</strong> Retained for 1 year
                  </Typography>
                  <Typography>
                    • <strong>Mirror Actions:</strong> Retained for 1 year
                  </Typography>
                  <Typography>
                    • <strong>Anonymized Data:</strong> Retained for 3 years for analytics
                  </Typography>
                </Stack>
              </Box>

              {/* GDPR Compliance Notice */}
              <Box sx={{ borderRadius: 1, p: 2, mt: 3, borderColor: theme.palette.success.main }}>
                <Stack direction="row" spacing={1} alignItems="start">
                  <Shield sx={{ color: theme.palette.success.main }} />
                  <Typography>
                    <strong>GDPR Compliance Notice:</strong> Data export requests are fulfilled
                    within 30 days as required by GDPR Article 20 (Right to Data Portability).
                    Deletion requests are processed within 30 days per GDPR Article 17 (Right to
                    Erasure). All Discord user identifiers are anonymized for privacy protection.
                  </Typography>
                </Stack>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* Footer */}
      {analytics && (
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
            Last updated: {new Date(analytics.generatedAt).toLocaleString()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Mock data for demonstration
const getMockAnalytics = (): ModerationAnalytics => ({
  totalIncidents: 156,
  activeIncidents: 42,
  resolvedIncidents: 114,
  sharedIncidents: 28,
  autoDetectedIncidents: 67,
  byType: {
    warning: 45,
    timeout: 52,
    long_timeout: 18,
    kick: 25,
    ban: 16,
  },
  bySeverity: {
    1: 45,
    2: 52,
    3: 18,
    4: 25,
    5: 16,
  },
  byStatus: {
    active: 42,
    expired: 85,
    revoked: 29,
  },
  dailyTrend: [
    { date: '2024-01-08', count: 5, label: 'Mon' },
    { date: '2024-01-09', count: 8, label: 'Tue' },
    { date: '2024-01-10', count: 3, label: 'Wed' },
    { date: '2024-01-11', count: 12, label: 'Thu' },
    { date: '2024-01-12', count: 6, label: 'Fri' },
    { date: '2024-01-13', count: 4, label: 'Sat' },
    { date: '2024-01-14', count: 7, label: 'Sun' },
  ],
  weeklyTrend: [
    { date: '2023-12-25', count: 25, label: 'Week 52' },
    { date: '2024-01-01', count: 32, label: 'Week 1' },
    { date: '2024-01-08', count: 45, label: 'Week 2' },
    { date: '2024-01-15', count: 38, label: 'Week 3' },
  ],
  monthlyTrend: [
    { date: '2023-11', count: 98, label: 'November' },
    { date: '2023-12', count: 120, label: 'December' },
    { date: '2024-01', count: 156, label: 'January' },
  ],
  uniqueTargets: 89,
  uniqueModerators: 12,
  averageSeverity: 2.4,
  repeatOffenders: [
    {
      targetDiscordId: '123456789012345678',
      targetUsername: 'ProblemUser123',
      totalIncidents: 8,
      activeIncidents: 2,
      highestSeverity: 5,
      riskScore: 85,
      isHighRisk: true,
    },
    {
      targetDiscordId: '234567890123456789',
      targetUsername: 'TroubleMaker42',
      totalIncidents: 5,
      activeIncidents: 1,
      highestSeverity: 4,
      riskScore: 62,
      isHighRisk: false,
    },
    {
      targetDiscordId: '345678901234567890',
      targetUsername: 'RuleBreaker99',
      totalIncidents: 4,
      activeIncidents: 0,
      highestSeverity: 3,
      riskScore: 45,
      isHighRisk: false,
    },
  ],
  repeatOffenderCount: 3,
  mirrorStats: {
    totalMirrors: 24,
    confirmedMirrors: 18,
    pendingMirrors: 4,
    cancelledMirrors: 1,
    failedMirrors: 1,
  },
  incidentsLast24Hours: 7,
  incidentsLast7Days: 45,
  incidentsLast30Days: 156,
  generatedAt: new Date().toISOString(),
});
