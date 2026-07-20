import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import GroupIcon from '@mui/icons-material/Group';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import TimerIcon from '@mui/icons-material/Timer';
import VerifiedIcon from '@mui/icons-material/Verified';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  LinearProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  useSCStatsOrgAnalytics,
  useSCStatsPublicOrgAnalytics,
} from '@/hooks/queries/useSCStatsQueries';
import type { SkillDistribution } from '@/services/scstatsService';
import { getCareerColor } from '@/utils/shipColorUtils';

interface SCStatsOrgDashboardProps {
  organizationId: string;
  /** When true, uses the public (unauthenticated) endpoint and shows
   *  a friendly info message instead of an error when stats are unavailable. */
  isPublicView?: boolean;
  /** Controls which sections are visible. All visible when undefined/null. */
  visibility?: {
    showVerification?: boolean;
    showSkills?: boolean;
    showTimezone?: boolean;
    showAnalytics?: boolean;
  } | null;
}

const TIER_COLORS = ['error', 'warning', 'success', 'info'] as const;
const TIER_LABELS = ['Low', 'Med', 'High', 'Expert'] as const;

/** Compact single-row distribution bar for one career. */
const CompactBar: React.FC<{ label: string; data: SkillDistribution }> = ({ label, data }) => {
  const theme = useTheme();
  const total = data.low + data.medium + data.high + data.expert;
  if (total === 0) return null;

  const segments = [
    { value: data.low, color: theme.palette.error.main, label: 'Low' },
    { value: data.medium, color: theme.palette.warning.main, label: 'Med' },
    { value: data.high, color: theme.palette.success.main, label: 'High' },
    { value: data.expert, color: theme.palette.info.main, label: 'Expert' },
  ];

  const careerColor = getCareerColor(label, theme);

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        fontWeight={600}
        sx={{ minWidth: 80, color: careerColor, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Tooltip
        title={segments
          .filter(s => s.value > 0)
          .map(s => `${s.label}: ${s.value}`)
          .join(' · ')}
        arrow
      >
        <Box sx={{ display: 'flex', borderRadius: 0.5, overflow: 'hidden', height: 14, flex: 1 }}>
          {segments.map(
            seg =>
              seg.value > 0 && (
                <Box
                  key={seg.label}
                  sx={{
                    width: `${(seg.value / total) * 100}%`,
                    bgcolor: seg.color,
                    minWidth: 4,
                  }}
                />
              )
          )}
        </Box>
      </Tooltip>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20, textAlign: 'right' }}>
        {total}
      </Typography>
    </Stack>
  );
};

export const SCStatsOrgDashboard: React.FC<SCStatsOrgDashboardProps> = ({
  organizationId,
  isPublicView = false,
  visibility,
}) => {
  const theme = useTheme();

  // Compute which sections to show (default: all visible)
  const show = {
    verification: visibility?.showVerification !== false,
    skills: visibility?.showSkills !== false,
    timezone: visibility?.showTimezone !== false,
    analytics: visibility?.showAnalytics !== false,
  };

  // Use the appropriate React Query hook based on view type
  const authenticatedQuery = useSCStatsOrgAnalytics(
    isPublicView ? undefined : organizationId
  );
  const publicQuery = useSCStatsPublicOrgAnalytics(
    isPublicView ? organizationId : undefined
  );

  const activeQuery = isPublicView ? publicQuery : authenticatedQuery;
  const analytics = activeQuery.data;
  const loading = activeQuery.isLoading;
  const error = activeQuery.error;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    if (isPublicView) {
      return (
        <Alert severity="info" sx={{ m: 2 }}>
          Organization stats are only available to members.
        </Alert>
      );
    }
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error instanceof Error ? error.message : 'Failed to load SCStats analytics'}
      </Alert>
    );
  }

  if (isPublicView && !analytics) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        Organization stats are only available to members.
      </Alert>
    );
  }

  if (!analytics || analytics.memberCount === 0) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No member data available for SCStats analytics.
      </Alert>
    );
  }

  const summaryStats = [
    {
      label: 'Members',
      value: analytics.memberCount,
      icon: <GroupIcon />,
      color: theme.palette.info.main,
    },
    {
      label: 'Verified',
      value: `${analytics.verifiedCount} (${analytics.verificationRate.toFixed(0)}%)`,
      icon: <VerifiedIcon />,
      color: theme.palette.success.main,
    },
    {
      label: 'Avg K/D',
      value: analytics.averageKD.toFixed(2),
      icon: <GpsFixedIcon />,
      color: theme.palette.error.main,
    },
    {
      label: 'Avg Hours',
      value: analytics.averageTotalHours.toFixed(0),
      icon: <TimerIcon />,
      color: theme.palette.warning.main,
    },
    {
      label: 'Avg Missions',
      value: analytics.averageMissionsCompleted.toFixed(0),
      icon: <MilitaryTechIcon />,
      color: theme.palette.secondary.main,
    },
  ];

  return (
    <Stack spacing={3}>
      <Typography variant="h6">SCStats Organization Analytics</Typography>

      {/* Summary Stats */}
      {show.analytics && (
        <Grid container spacing={2}>
          {summaryStats.map(stat => (
            <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={stat.label}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Box sx={{ color: stat.color, mb: 0.5 }}>{stat.icon}</Box>
                  <Typography variant="h6" fontWeight={700}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Verification Progress */}
      {show.verification && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Verification Rate
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={analytics.verificationRate}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Typography variant="body2" fontWeight={600}>
                {analytics.verificationRate.toFixed(1)}%
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {analytics.verifiedCount} of {analytics.memberCount} members have verified SCStats
              data
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Skill Distribution */}
      {show.skills && (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Skill Distribution</Typography>
              <Stack direction="row" spacing={1.5}>
                {TIER_LABELS.map((tier, i) => (
                  <Stack key={tier} direction="row" spacing={0.5} alignItems="center">
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: `${TIER_COLORS[i]}.main`,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {tier}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
            <Stack spacing={0.75}>
              {Object.entries(analytics.skillDistribution)
                .filter(([career, data]) => {
                  if (career.toLowerCase() === 'unknown') return false;
                  return data.low + data.medium + data.high + data.expert > 0;
                })
                .sort(([, a], [, b]) => {
                  const totalA = a.low + a.medium + a.high + a.expert;
                  const totalB = b.low + b.medium + b.high + b.expert;
                  return totalB - totalA;
                })
                .map(([career, data]) => (
                  <CompactBar key={career} label={career} data={data} />
                ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Top Performers */}
      {analytics.topPerformers.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Top Performers (by K/D)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Member</TableCell>
                    <TableCell align="right">K/D Ratio</TableCell>
                    <TableCell align="right">Total Hours</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.topPerformers.map((performer, index) => (
                    <TableRow key={performer.userId}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Link
                          component={RouterLink}
                          to={`/profile/${performer.userId}`}
                          underline="none"
                          color="primary"
                          variant="body2"
                        >
                          Member #{index + 1}
                        </Link>
                      </TableCell>
                      <TableCell align="right">{performer.kdRatio.toFixed(2)}</TableCell>
                      <TableCell align="right">{performer.totalHours.toFixed(0)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};
