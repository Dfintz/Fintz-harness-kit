import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';

import { useFleetHealth } from '@/hooks/queries/useFleetQueries';
import type { FleetHealth } from '@/types/apiV2';
import { getStatusChipSx } from '@/utils/statusStyles';

const STATUS_CONFIG = {
  green: { label: 'Healthy', color: 'success' as const, Icon: CheckCircleIcon },
  yellow: { label: 'Degraded', color: 'warning' as const, Icon: WarningIcon },
  red: { label: 'Critical', color: 'error' as const, Icon: ErrorIcon },
};

function ScoreBar({
  label,
  value,
  color,
}: Readonly<{ label: string; value: number; color: 'success' | 'warning' | 'error' | 'primary' }>) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>
          {value}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value}
        color={color}
        sx={{ height: 8, borderRadius: 1 }}
      />
    </Box>
  );
}

function scoreColor(value: number): 'success' | 'warning' | 'error' {
  if (value >= 75) return 'success';
  if (value >= 50) return 'warning';
  return 'error';
}

function HealthContent({ health }: Readonly<{ health: FleetHealth }>) {
  const theme = useTheme();
  const cfg = STATUS_CONFIG[health.status];
  const StatusIcon = cfg.Icon;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
              width: 80,
              height: 80,
            }}
          >
            <CircularProgress
              variant="determinate"
              value={health.healthScore}
              size={80}
              thickness={5}
              color={cfg.color}
            />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h5" fontWeight={700}>
                {health.healthScore}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{health.fleetName}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <StatusIcon color={cfg.color} fontSize="small" />
              <Chip label={cfg.label} color={cfg.color} size="small" />
              <Chip
                label={health.details.fleetStatus}
                size="small"
                sx={getStatusChipSx(health.details.fleetStatus, theme)}
              />
            </Stack>
          </Box>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ScoreBar
              label="Ship Readiness"
              value={health.breakdown.readinessScore}
              color={scoreColor(health.breakdown.readinessScore)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ScoreBar
              label="Crew Fill Rate"
              value={health.breakdown.crewFillRate ?? health.breakdown.memberFillRate ?? 0}
              color={scoreColor(
                health.breakdown.crewFillRate ?? health.breakdown.memberFillRate ?? 0
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ScoreBar
              label="Capability Diversity"
              value={health.breakdown.capabilityScore}
              color={scoreColor(health.breakdown.capabilityScore)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <ScoreBar
              label="Operational Status"
              value={health.breakdown.operationalScore}
              color={scoreColor(health.breakdown.operationalScore)}
            />
          </Grid>
        </Grid>

        <Stack
          direction="row"
          spacing={3}
          sx={{
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Ships: {health.details.flightReadyShips}/{health.details.totalShips} flight-ready
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crew: {health.details.crewFilled ?? health.details.memberCount ?? 0}/
            {health.details.totalCrewPositions ?? health.details.maxMembers ?? 0}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface FleetHealthCardProps {
  fleetId: string | undefined;
}

export const FleetHealthCard: React.FC<Readonly<FleetHealthCardProps>> = ({ fleetId }) => {
  const { data: health, isLoading, error } = useFleetHealth(fleetId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load fleet health</Alert>;
  }

  if (!health) return null;

  return <HealthContent health={health} />;
};
