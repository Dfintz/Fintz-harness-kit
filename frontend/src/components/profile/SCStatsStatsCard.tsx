import FlightIcon from '@mui/icons-material/Flight';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import TimerIcon from '@mui/icons-material/Timer';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Card, CardContent, Chip, Divider, Grid, Stack, Typography } from '@mui/material';
import React from 'react';

import type { SCStatsMetrics } from '@/services/scstatsService';

interface SCStatsStatsCardProps {
  metrics: SCStatsMetrics;
  lastImport?: string | null;
  isStale?: boolean;
}

export const SCStatsStatsCard: React.FC<SCStatsStatsCardProps> = ({
  metrics,
  lastImport,
  isStale,
}) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const stats = [
    {
      label: 'Total Hours',
      value: metrics.totalHours != null ? `${metrics.totalHours.toFixed(1)}h` : '—',
      icon: <TimerIcon />,
      color: 'primary.main',
    },
    {
      label: 'K/D Ratio',
      value: metrics.kdRatio != null ? metrics.kdRatio.toFixed(2) : '—',
      icon: <GpsFixedIcon />,
      color: 'error.light',
    },
    {
      label: 'Missions',
      value: metrics.missionsCompleted != null ? String(metrics.missionsCompleted) : '—',
      icon: <MilitaryTechIcon />,
      color: 'warning.light',
    },
    {
      label: 'Favorite Ship',
      value: metrics.favoriteVehicle ?? '—',
      icon: <FlightIcon />,
      color: 'success.light',
    },
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">SCStats Gameplay Metrics</Typography>
            {isStale && (
              <Chip
                icon={<WarningAmberIcon />}
                label="Stale data (>30 days)"
                color="warning"
                size="small"
              />
            )}
          </Stack>

          <Grid container spacing={2}>
            {stats.map(stat => (
              <Grid size={{ xs: 6, sm: 3 }} key={stat.label}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Box sx={{ color: stat.color, mb: 0.5 }}>{stat.icon}</Box>
                  <Typography variant="h6" fontWeight={700}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {lastImport && (
            <>
              <Divider />
              <Typography variant="caption" color="text.secondary">
                Last imported: {formatDate(lastImport)}
              </Typography>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
