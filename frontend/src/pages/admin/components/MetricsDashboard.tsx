/**
 * Metrics Dashboard Component
 * Displays system metrics with charts and aggregated data
 */

import { adminKeys } from '@/hooks/queries/queryKeys';
import { apiClient } from '@/services/apiClient';
import {
  adminTableContainerStyles,
  adminTableDataCellCompactStyles,
  adminTableHeaderCellCompactStyles,
} from '@/utils/adminTableStyles';
import { logger } from '@/utils/logger';
import { InfoOutlined } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
interface SystemMetrics {
  users: {
    total: number;
    active24h: number;
    active7d: number;
    active30d: number;
    newUsers24h: number;
    newUsers7d: number;
    newUsers30d: number;
  };
  organizations: {
    total: number;
    active: number;
    inactive: number;
    avgMembersPerOrg: number;
  };
  activities: {
    total: number;
    created24h: number;
    created7d: number;
    created30d: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  performance: {
    cacheHitRate: number;
    avgResponseTime: number;
    totalQueries24h: number;
    errorRate: number;
  };
  health: {
    databaseStatus: string;
    cacheStatus: string;
    uptime: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

interface TimeSeriesData {
  date: string;
  value: number;
}

export const MetricsDashboard: React.FC = () => {
  const theme = useTheme();

  const { data: metrics, error: metricsError } = useQuery({
    queryKey: adminKeys.metrics(),
    queryFn: async () => {
      try {
        return await apiClient.getData<SystemMetrics>('/api/v2/admin/metrics/system');
      } catch (err) {
        logger.error(
          'Failed to fetch metrics:',
          err instanceof Error ? err : new Error(String(err))
        );
        throw err;
      }
    },
  });

  const { data: timeSeriesData } = useQuery({
    queryKey: adminKeys.metricsTimeseries(),
    queryFn: async () => {
      try {
        const [userActivity, performance] = await Promise.all([
          apiClient.getData<TimeSeriesData[]>('/api/v2/admin/metrics/timeseries', {
            params: { metric: 'users', days: 30 },
          }),
          apiClient.getData<TimeSeriesData[]>('/api/v2/admin/metrics/timeseries', {
            params: { metric: 'errors', days: 30 },
          }),
        ]);
        return { userActivity, performance };
      } catch (err) {
        logger.error(
          'Failed to fetch time series data:',
          err instanceof Error ? err : new Error(String(err))
        );
        throw err;
      }
    },
  });

  const userActivityData = timeSeriesData?.userActivity ?? [];
  const performanceData = timeSeriesData?.performance ?? [];
  const error = metricsError
    ? metricsError instanceof Error
      ? metricsError.message
      : String(metricsError)
    : null;

  if (error) {
    return (
      <Stack justifyContent="center" alignItems="center" sx={{ height: 200 }}>
        <Typography color="error">{error}</Typography>
      </Stack>
    );
  }

  if (!metrics) {
    return (
      <Stack justifyContent="center" alignItems="center" sx={{ height: 200 }}>
        <CircularProgress aria-label="Loading metrics" size={24} />
      </Stack>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          borderColor: theme.palette.primary.main,
          marginBottom: '24px',
        }}
      >
        <Stack direction="row" gap={1} alignItems="center">
          <InfoOutlined sx={{ color: 'primary.main' }} />
          <Typography>
            <strong>Aggregated Data Only:</strong> All metrics are aggregated counts and averages.
            No individual user data is exposed.
          </Typography>
        </Stack>
      </Box>

      {/* User Metrics */}
      <Typography variant="h3" sx={{ mb: 2 }}>
        User Metrics
      </Typography>
      <Stack direction="row" gap={2} sx={{ mb: 4 }} flexWrap="wrap">
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Total Users</Typography>
            <Typography variant="h2">{metrics.users.total.toLocaleString()}</Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Active (24h)</Typography>
            <Typography variant="h2">{metrics.users.active24h.toLocaleString()}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {metrics.users.newUsers24h} new today
            </Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Active (7d)</Typography>
            <Typography variant="h2">{metrics.users.active7d.toLocaleString()}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {metrics.users.newUsers7d} new this week
            </Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Active (30d)</Typography>
            <Typography variant="h2">{metrics.users.active30d.toLocaleString()}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              {metrics.users.newUsers30d} new this month
            </Typography>
          </Box>
        </Box>
      </Stack>

      {/* User Activity Chart */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Active Users (30 Days)
        </Typography>
        <Box sx={{ height: '400px', display: 'flex' }}>
          <div
            role="img"
            aria-label="Active users over the last 30 days line chart"
            style={{ width: '100%', height: '100%' }}
          >
            <ResponsiveContainer width="100%" height={400} minWidth={100} minHeight={100}>
              <LineChart data={userActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="date" stroke={theme.palette.text.secondary} />
                <YAxis stroke={theme.palette.text.secondary} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={theme.palette.primary.main}
                  name="Active Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Box>
      </Box>

      {/* Organization Metrics */}
      <Typography variant="h3" sx={{ mb: 2 }}>
        Organization Metrics
      </Typography>
      <Stack direction="row" gap={2} sx={{ mb: 4 }} flexWrap="wrap">
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Total Organizations</Typography>
            <Typography variant="h2">{metrics.organizations.total.toLocaleString()}</Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Active Organizations</Typography>
            <Typography variant="h2">{metrics.organizations.active.toLocaleString()}</Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Avg Members/Org</Typography>
            <Typography variant="h2">
              {(metrics.organizations.avgMembersPerOrg ?? 0).toFixed(1)}
            </Typography>
          </Box>
        </Box>
      </Stack>

      {/* Activity Breakdown */}
      <Stack direction="row" gap={2} sx={{ mb: 4 }} flexWrap="wrap">
        <Box flex={1} sx={{ minWidth: 360 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Activities by Type
            </Typography>
            <Box sx={adminTableContainerStyles}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={adminTableHeaderCellCompactStyles('left')}>Type</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles('right')}>Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metrics.activities.byType).map(([type, count]) => (
                    <TableRow key={type}>
                      <TableCell sx={adminTableDataCellCompactStyles('left')}>{type}</TableCell>
                      <TableCell sx={adminTableDataCellCompactStyles('right')}>
                        {count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 360 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Activities by Status
            </Typography>
            <Box sx={adminTableContainerStyles}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={adminTableHeaderCellCompactStyles('left')}>Status</TableCell>
                    <TableCell sx={adminTableHeaderCellCompactStyles('right')}>Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metrics.activities.byStatus).map(([status, count]) => (
                    <TableRow key={status}>
                      <TableCell sx={adminTableDataCellCompactStyles('left')}>{status}</TableCell>
                      <TableCell sx={adminTableDataCellCompactStyles('right')}>
                        {count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Box>
      </Stack>

      {/* Performance Metrics */}
      <Typography variant="h3" sx={{ mb: 2 }}>
        Performance Metrics
      </Typography>
      <Stack direction="row" gap={2} sx={{ mb: 4 }} flexWrap="wrap">
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Cache Hit Rate</Typography>
            <Typography variant="h2">
              {((metrics.performance.cacheHitRate ?? 0) * 100).toFixed(1)}%
            </Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Avg Response Time</Typography>
            <Typography variant="h2">
              {(metrics.performance.avgResponseTime ?? 0).toFixed(0)}ms
            </Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Queries (24h)</Typography>
            <Typography variant="h2">
              {(metrics.performance.totalQueries24h ?? 0).toLocaleString()}
            </Typography>
          </Box>
        </Box>
        <Box flex={1} sx={{ minWidth: 240 }}>
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography sx={{ color: 'text.secondary' }}>Error Rate</Typography>
            <Typography variant="h2">
              {((metrics.performance.errorRate ?? 0) * 100).toFixed(2)}%
            </Typography>
          </Box>
        </Box>
      </Stack>

      {/* Response Time Chart */}
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Error Trend (30 Days)
        </Typography>
        <Box sx={{ height: '400px', display: 'flex' }}>
          <div
            role="img"
            aria-label="Error trend over the last 30 days line chart"
            style={{ width: '100%', height: '100%' }}
          >
            <ResponsiveContainer width="100%" height={400} minWidth={100} minHeight={100}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="date" stroke={theme.palette.text.secondary} />
                <YAxis stroke={theme.palette.text.secondary} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={theme.palette.error.main}
                  name="Errors"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Box>
      </Box>
    </Box>
  );
};
