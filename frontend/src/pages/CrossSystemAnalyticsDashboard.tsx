import GroupsIcon from '@mui/icons-material/Groups';
import SpeedIcon from '@mui/icons-material/Speed';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkIcon from '@mui/icons-material/Work';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useCrossSystemAnalytics } from '@/hooks/queries/useCrossSystemAnalyticsQueries';
import type { CrossSystemAnalyticsParams } from '@/services/crossSystemAnalyticsService';

// ==================== KPI Card ====================

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}

const KpiCard: React.FC<Readonly<KpiCardProps>> = ({ title, value, subtitle, icon }) => {
  const theme = useTheme();
  return (
    <Card sx={{ flex: 1, minWidth: 200 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ==================== Main Dashboard ====================

export const CrossSystemAnalyticsDashboard: React.FC = () => {
  const theme = useTheme();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const params = useMemo<CrossSystemAnalyticsParams>(() => ({ period }), [period]);
  const { data, isLoading, error } = useCrossSystemAnalytics(params);

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 400 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading analytics...</Typography>
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load cross-system analytics</Alert>;
  }

  if (!data) return null;

  const { crewFormation, formationSpeed, jobPlacement, lfgConversion } = data;

  const formattedCrewTrends = crewFormation.trends.map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    formations: t.count,
  }));

  const formattedPlacementTrend = jobPlacement.trend.map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    placements: t.count,
  }));

  const formattedLfgTrend = lfgConversion.trend.map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    conversions: t.count,
  }));

  const periodLabel = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Cross-System Participation Analytics
        </Typography>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Period</InputLabel>
          <Select<'daily' | 'weekly' | 'monthly'>
            value={period}
            label="Period"
            onChange={e => setPeriod(e.target.value)}
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* KPI Row */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <KpiCard
          title="Total Crew Formations"
          value={crewFormation.totalFormations}
          subtitle={`~${crewFormation.averagePerPeriod} per ${periodLabel}`}
          icon={<GroupsIcon />}
        />
        <KpiCard
          title="Avg Formation Speed"
          value={
            formationSpeed.averageMinutes > 60
              ? `${Math.round(formationSpeed.averageMinutes / 60)}h`
              : `${formationSpeed.averageMinutes}m`
          }
          subtitle={`Median: ${formationSpeed.medianMinutes}m`}
          icon={<SpeedIcon />}
        />
        <KpiCard
          title="Job Placement Rate"
          value={`${jobPlacement.placementRate}%`}
          subtitle={`${jobPlacement.completedJobs}/${jobPlacement.totalJobs} jobs`}
          icon={<WorkIcon />}
        />
        <KpiCard
          title="LFG Conversion"
          value={`${lfgConversion.conversionRate}%`}
          subtitle={`${lfgConversion.converted}/${lfgConversion.totalLfg} converted`}
          icon={<TrendingUpIcon />}
        />
      </Stack>

      {/* Charts Row 1: Crew Formation Trends + Formation Speed Distribution */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Crew Formation Trends
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={100}>
                <LineChart data={formattedCrewTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="formations"
                    stroke={theme.palette.primary.main}
                    name="Formations"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Formation Speed Distribution
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={100}>
                <BarChart data={formationSpeed.distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={theme.palette.secondary.main} name="Activities" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Stack>

      {/* Charts Row 2: Job Placement + LFG Conversion */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Job Placements Over Time
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={100}>
                <LineChart data={formattedPlacementTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="placements"
                    stroke={theme.palette.success.main}
                    name="Placements"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              LFG Conversions Over Time
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={100}>
                <LineChart data={formattedLfgTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="conversions"
                    stroke={theme.palette.warning.main}
                    name="Conversions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Stack>

      {/* Breakdown Tables Row */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {/* Job Placement by Type */}
        {jobPlacement.byType.length > 0 && (
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Placement Rate by Job Type
              </Typography>
              <Stack spacing={1}>
                {jobPlacement.byType.map(bt => (
                  <Stack key={bt.type} direction="row" justifyContent="space-between">
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {bt.type.replace('_', ' ')}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {bt.rate}% ({bt.completed}/{bt.total})
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* LFG by Activity/Location */}
        {lfgConversion.byActivity.length > 0 && (
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                LFG Conversion by Location
              </Typography>
              <Stack spacing={1}>
                {lfgConversion.byActivity.map(ba => (
                  <Stack key={ba.activity} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{ba.activity}</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {ba.rate}% ({ba.converted}/{ba.total})
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Formation Speed Summary */}
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Formation Speed Summary
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Fastest</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formationSpeed.fastestMinutes}m
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Median</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formationSpeed.medianMinutes}m
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Average</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formationSpeed.averageMinutes}m
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Slowest</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formationSpeed.slowestMinutes}m
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Last updated: {new Date(data.generatedAt).toLocaleString()}
      </Typography>
    </Box>
  );
};
