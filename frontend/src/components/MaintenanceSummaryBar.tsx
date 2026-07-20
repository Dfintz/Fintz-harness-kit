/**
 * Maintenance Summary Bar Component
 * Displays summary counts of maintenance records by status
 */

import { useMaintenanceSummary } from '@/hooks/queries/useShipMaintenanceQueries';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { Box, Paper, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';

interface SummaryCardProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const SummaryCard: React.FC<Readonly<SummaryCardProps>> = ({
  label,
  count,
  color,
  bgColor,
  icon,
}) => (
  <Paper
    variant="outlined"
    sx={{
      flex: 1,
      p: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      backgroundColor: bgColor,
      borderColor: color,
      borderWidth: 1,
      minWidth: 140,
    }}
  >
    <Box sx={{ color }}>{icon}</Box>
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ color }}>
        {count}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  </Paper>
);

interface MaintenanceSummaryBarProps {
  refreshKey?: number;
}

export const MaintenanceSummaryBar: React.FC<Readonly<MaintenanceSummaryBarProps>> = ({
  refreshKey: _refreshKey,
}) => {
  const theme = useTheme();
  const { data: summary, isLoading: loading } = useMaintenanceSummary();

  if (loading) {
    return (
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
        {['overdue', 'scheduled', 'in-progress', 'completed'].map(label => (
          <Skeleton key={label} variant="rounded" height={72} sx={{ flex: 1, minWidth: 140 }} />
        ))}
      </Stack>
    );
  }

  if (!summary) return null;

  const cards: SummaryCardProps[] = [
    {
      label: 'Overdue',
      count: summary.overdue,
      color: theme.palette.error.main,
      bgColor: theme.palette.error.dark + '14',
      icon: <ErrorIcon />,
    },
    {
      label: 'Scheduled',
      count: summary.scheduled,
      color: theme.palette.info.main,
      bgColor: theme.palette.info.dark + '14',
      icon: <ScheduleIcon />,
    },
    {
      label: 'In Progress',
      count: summary.inProgress,
      color: theme.palette.warning.main,
      bgColor: theme.palette.warning.dark + '14',
      icon: <BuildIcon />,
    },
    {
      label: 'Completed',
      count: summary.completed,
      color: theme.palette.success.main,
      bgColor: theme.palette.success.dark + '14',
      icon: <CheckCircleIcon />,
    },
  ];

  return (
    <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
      {cards.map(card => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </Stack>
  );
};
