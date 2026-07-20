/**
 * Attendance Dashboard Page
 *
 * Provides three views:
 * 1. Leaderboard — top members by reliability score
 * 2. My History — current user's attendance history
 * 3. Activity Report — stats + attendee list for a specific event
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import {
  Cancel as CancelIcon,
  EventAvailable as EventAvailableIcon,
  ExitToApp as ExitIcon,
  HelpOutline as PendingIcon,
  Schedule as ScheduleIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { useMyActivities } from '@/hooks/queries/useActivityQueries';
import {
  useActivityAttendanceReport,
  useAttendanceLeaderboard,
  useUserAttendanceHistory,
  type AttendanceReportAttendee,
  type AttendanceStatus,
  type LeaderboardEntry,
} from '@/hooks/queries/useAttendanceQueries';
import { useAuthStore } from '@/store/authStore';
import type { ActivityV2 } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import type { Theme } from '@mui/material';

// ============================================================================
// Status Config
// ============================================================================

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: string;
    color: 'success' | 'error' | 'warning' | 'info' | 'default';
    icon: React.ReactElement;
  }
> = {
  attended: { label: 'Attended', color: 'success', icon: <EventAvailableIcon fontSize="small" /> },
  no_show: { label: 'No Show', color: 'error', icon: <CancelIcon fontSize="small" /> },
  late: { label: 'Late', color: 'warning', icon: <ScheduleIcon fontSize="small" /> },
  early_departure: {
    label: 'Early Departure',
    color: 'warning',
    icon: <ExitIcon fontSize="small" />,
  },
  pending_confirmation: {
    label: 'Pending',
    color: 'default',
    icon: <PendingIcon fontSize="small" />,
  },
};

function getStatusChip(status: AttendanceStatus) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_confirmation;
  return <Chip label={config.label} color={config.color} size="small" icon={config.icon} />;
}

function getReliabilityColor(score: number, theme: Theme): string {
  if (score >= 80) return theme.palette.success.main;
  if (score >= 60) return theme.palette.warning.main;
  return theme.palette.error.main;
}

// ============================================================================
// Leaderboard Tab
// ============================================================================

interface LeaderboardTabProps {
  organizationId: string | undefined;
}

const LeaderboardTab: React.FC<Readonly<LeaderboardTabProps>> = ({ organizationId }) => {
  const theme = useTheme();
  const [monthsBack, setMonthsBack] = useState(3);
  const {
    data: leaderboard,
    isLoading,
    error,
  } = useAttendanceLeaderboard(organizationId, { monthsBack, limit: 25 });

  if (isLoading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  if (error) return <Alert severity="error">Failed to load leaderboard</Alert>;
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No attendance data yet. Attendance is tracked for organization events.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          <TrophyIcon sx={{ verticalAlign: 'middle', mr: 1, color: theme.palette.warning.main }} />
          Attendance Leaderboard
        </Typography>
        <TextField
          id="leaderboard-period"
          select
          size="small"
          label="Period"
          value={monthsBack}
          onChange={e => setMonthsBack(Number(e.target.value))}
          slotProps={{ select: { native: true } }}
          inputProps={{ 'aria-label': 'Leaderboard period' }}
          sx={{ minWidth: 140 }}
        >
          <option value={1}>Last Month</option>
          <option value={3}>Last 3 Months</option>
          <option value={6}>Last 6 Months</option>
          <option value={12}>Last Year</option>
        </TextField>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={60}>#</TableCell>
              <TableCell>Member</TableCell>
              <TableCell align="center">Events</TableCell>
              <TableCell align="center">Attended</TableCell>
              <TableCell align="center">No-Shows</TableCell>
              <TableCell align="center">Late</TableCell>
              <TableCell align="right">Reliability</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaderboard.map((entry: LeaderboardEntry, idx: number) => {
              const trophyColors = ['warning.main', 'grey.400', 'warning.dark'] as const;
              return (
                <TableRow key={entry.userId} hover>
                  <TableCell>
                    {idx < 3 ? (
                      <TrophyIcon
                        fontSize="small"
                        sx={{
                          color: trophyColors[idx],
                        }}
                      />
                    ) : (
                      idx + 1
                    )}
                  </TableCell>
                  <TableCell>{entry.displayName ?? entry.userId}</TableCell>
                  <TableCell align="center">{entry.totalEvents}</TableCell>
                  <TableCell align="center">{entry.attended}</TableCell>
                  <TableCell align="center">{entry.noShows}</TableCell>
                  <TableCell align="center">{entry.late}</TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 1,
                      }}
                    >
                      <LinearProgress
                        variant="determinate"
                        value={entry.reliabilityScore}
                        sx={{
                          width: 80,
                          height: 8,
                          borderRadius: 4,
                          bgcolor: theme.palette.action.disabledBackground,
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getReliabilityColor(entry.reliabilityScore, theme),
                            borderRadius: 4,
                          },
                        }}
                      />
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{
                          color: getReliabilityColor(entry.reliabilityScore, theme),
                          minWidth: 36,
                        }}
                      >
                        {Math.round(entry.reliabilityScore)}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ============================================================================
// My History Tab
// ============================================================================

interface MyHistoryTabProps {
  userId: string | undefined;
}

const MyHistoryTab: React.FC<Readonly<MyHistoryTabProps>> = ({ userId }) => {
  const theme = useTheme();
  const [monthsBack, setMonthsBack] = useState(6);
  const { data: history, isLoading, error } = useUserAttendanceHistory(userId, { monthsBack });

  if (isLoading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  if (error) return <Alert severity="error">Failed to load your attendance history</Alert>;
  if (!history) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No attendance history yet.
      </Alert>
    );
  }

  const stats = [
    { label: 'Total Events', value: history.totalEvents, color: theme.palette.text.primary },
    { label: 'Attended', value: history.attended, color: theme.palette.success.main },
    { label: 'No-Shows', value: history.noShows, color: theme.palette.error.main },
    { label: 'Late', value: history.late, color: theme.palette.warning.main },
    { label: 'Excused', value: history.excusedAbsences, color: theme.palette.info.main },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">My Attendance History</Typography>
        <TextField
          id="history-period"
          select
          size="small"
          label="Period"
          value={monthsBack}
          onChange={e => setMonthsBack(Number(e.target.value))}
          slotProps={{ select: { native: true } }}
          inputProps={{ 'aria-label': 'History period' }}
          sx={{ minWidth: 140 }}
        >
          <option value={3}>Last 3 Months</option>
          <option value={6}>Last 6 Months</option>
          <option value={12}>Last Year</option>
        </TextField>
      </Box>

      {/* Reliability score card */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="overline" color="text.secondary">
            Reliability Score
          </Typography>
          <Typography
            variant="h2"
            fontWeight="bold"
            sx={{ color: getReliabilityColor(history.reliabilityScore, theme) }}
          >
            {Math.round(history.reliabilityScore)}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={history.reliabilityScore}
            sx={{
              mt: 1,
              height: 10,
              borderRadius: 5,
              bgcolor: theme.palette.action.disabledBackground,
              '& .MuiLinearProgress-bar': {
                bgcolor: getReliabilityColor(history.reliabilityScore, theme),
                borderRadius: 5,
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Stats grid */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {stats.map(stat => (
          <Card key={stat.label} variant="outlined" sx={{ flex: '1 1 140px', minWidth: 120 }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight="bold" sx={{ color: stat.color }}>
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {history.averageRating != null && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Average Performance Rating
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {history.averageRating.toFixed(1)} / 5.0
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

// ============================================================================
// Activity Report Tab
// ============================================================================

const ActivityReportTab: React.FC = () => {
  const theme = useTheme();
  const [activityId, setActivityId] = useState('');
  const [submittedId, setSubmittedId] = useState<string | undefined>(undefined);

  const { data: report, isLoading, error } = useActivityAttendanceReport(submittedId);
  const { data: myActivities, isLoading: isLoadingActivities } = useMyActivities(
    { status: 'completed' },
    { staleTime: 5 * 60 * 1000 }
  );

  const handleLookup = () => {
    const trimmed = activityId.trim();
    if (trimmed) {
      setSubmittedId(trimmed);
    }
  };

  const handleSelectActivity = (id: string) => {
    setActivityId(id);
    setSubmittedId(id);
  };

  const activityList = myActivities?.items ?? [];

  const getActivityDate = (activity: { startDate?: string; scheduledStartDate?: string }) => {
    if (activity.startDate) return new Date(activity.startDate).toLocaleDateString();
    if (activity.scheduledStartDate)
      return new Date(activity.scheduledStartDate).toLocaleDateString();
    return null;
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Activity Attendance Report
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          size="small"
          label="Activity / Event ID"
          value={activityId}
          onChange={e => setActivityId(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleLookup();
          }}
          placeholder="Enter an activity ID"
          sx={{ flex: 1 }}
        />
        <Chip label="Look Up" color="primary" onClick={handleLookup} sx={{ height: 40 }} />
      </Box>

      {/* List of user's activities for quick selection */}
      {!submittedId && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Your Activities
          </Typography>
          {isLoadingActivities && (
            <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} />
          )}
          {!isLoadingActivities && activityList.length === 0 && (
            <Alert severity="info">No activities found.</Alert>
          )}
          {!isLoadingActivities && activityList.length > 0 && (
            <Card variant="outlined">
              <List disablePadding dense>
                {activityList.map((activity: ActivityV2, idx: number) => (
                  <ListItemButton
                    key={activity.id}
                    onClick={() => handleSelectActivity(activity.id)}
                    divider={idx < activityList.length - 1}
                    sx={{
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <ListItemText
                      primary={activity.title}
                      secondary={[activity.type, getActivityDate(activity)]
                        .filter(Boolean)
                        .join(' — ')}
                      slotProps={{
                        primary: { variant: 'body2', fontWeight: 500 },
                        secondary: { variant: 'caption' },
                      }}
                    />
                    <Chip label={activity.status ?? 'completed'} size="small" variant="outlined" />
                  </ListItemButton>
                ))}
              </List>
            </Card>
          )}
        </Box>
      )}

      {isLoading && <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />}
      {error && <Alert severity="error">Failed to load report. Check the activity ID.</Alert>}

      {report && (
        <>
          {/* Activity header */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">{report.activity.title}</Typography>
              {report.activity.startTime && (
                <Typography variant="body2" color="text.secondary">
                  {new Date(report.activity.startTime).toLocaleString()}
                  {report.activity.endTime &&
                    ` — ${new Date(report.activity.endTime).toLocaleString()}`}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Stats summary */}
          <StatsRow stats={report.stats} />

          <Divider sx={{ my: 2 }} />

          {/* Attendee table */}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Score</TableCell>
                  <TableCell>Check-In</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.attendees.map((a: AttendanceReportAttendee) => (
                  <TableRow key={a.userId} hover>
                    <TableCell>{a.displayName ?? a.userId}</TableCell>
                    <TableCell>{getStatusChip(a.status)}</TableCell>
                    <TableCell align="center">{a.score}</TableCell>
                    <TableCell>
                      {a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell>
                      {a.durationMinutes == null ? '—' : `${a.durationMinutes} min`}
                    </TableCell>
                    <TableCell>{a.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

// ============================================================================
// Shared Stats Row
// ============================================================================

interface StatsRowProps {
  stats: {
    total: number;
    attended: number;
    noShow: number;
    late: number;
    earlyDeparture: number;
    pending: number;
    attendanceRate: number;
  };
}

const StatsRow: React.FC<Readonly<StatsRowProps>> = ({ stats }) => {
  const theme = useTheme();
  const items = [
    { label: 'Total', value: stats.total, color: theme.palette.text.primary },
    { label: 'Attended', value: stats.attended, color: theme.palette.success.main },
    { label: 'No-Show', value: stats.noShow, color: theme.palette.error.main },
    { label: 'Late', value: stats.late, color: theme.palette.warning.main },
    { label: 'Early Departure', value: stats.earlyDeparture, color: theme.palette.warning.dark },
    { label: 'Pending', value: stats.pending, color: theme.palette.text.secondary },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {items.map(item => (
        <Card key={item.label} variant="outlined" sx={{ flex: '1 1 100px', minWidth: 90 }}>
          <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ color: item.color }}>
              {item.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
          </CardContent>
        </Card>
      ))}
      <Card variant="outlined" sx={{ flex: '1 1 100px', minWidth: 90 }}>
        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ color: theme.palette.primary.main }}>
            {Math.round(stats.attendanceRate)}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Rate
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const AttendancePage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [tab, setTab] = useState(0);

  logger.debug('AttendancePage rendered', { userId: user?.id });

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Attendance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Track event attendance, view leaderboards, and review your personal reliability score.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Leaderboard" />
        <Tab label="My History" />
        <Tab label="Activity Report" />
      </Tabs>

      {tab === 0 && <LeaderboardTab organizationId={user?.organizationId} />}
      {tab === 1 && <MyHistoryTab userId={user?.id} />}
      {tab === 2 && <ActivityReportTab />}
    </Box>
  );
};

export const AttendancePageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Attendance">
    <AttendancePage />
  </FeatureErrorBoundary>
);
