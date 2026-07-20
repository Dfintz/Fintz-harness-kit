/**
 * VoiceServerStatsPanel — Displays voice server status + statistics.
 *
 * Shows: online indicator, user count, peak stats, channel tree preview.
 * Reusable in both org settings and federation management pages.
 */

import {
  Headset as HeadsetIcon,
  Login as LoginIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { VoiceServerStats, VoiceServerStatus } from '@sc-fleet-manager/shared-types';
import React from 'react';

interface VoiceServerStatsPanelProps {
  status?: VoiceServerStatus;
  stats?: VoiceServerStats | null;
  isLoading?: boolean;
  error?: Error | null;
  connectUrl?: string;
  /** Fallback server type when stats is not available (e.g. platform server) */
  serverType?: string;
}

export const VoiceServerStatsPanel: React.FC<Readonly<VoiceServerStatsPanelProps>> = ({
  status,
  stats,
  isLoading,
  error,
  connectUrl,
  serverType,
}) => {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load voice server status</Alert>;
  }

  const isOnline = status?.online ?? false;

  return (
    <Card
      sx={{
        border: `1px solid ${alpha(
          isOnline ? theme.palette.success.main : theme.palette.error.main,
          0.3
        )}`,
      }}
    >
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HeadsetIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="h6">{stats?.displayName ?? 'Voice Server'}</Typography>
          </Stack>
          <Chip
            icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
            label={isOnline ? 'Online' : 'Offline'}
            color={isOnline ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
        </Stack>

        {/* Current Users */}
        <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
          <Stack alignItems="center">
            <Typography variant="h3" color="primary" fontWeight="bold">
              {status?.currentUsers ?? 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Users Online
            </Typography>
          </Stack>
          <Stack alignItems="center">
            <Typography variant="h3" color="text.secondary">
              {status?.maxUsers ?? 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Max Slots
            </Typography>
          </Stack>
          {status?.bandwidthKbps !== undefined && (
            <Stack alignItems="center">
              <Typography variant="h4" color="text.secondary">
                {Math.round(status.bandwidthKbps / 1000)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Mbps
              </Typography>
            </Stack>
          )}
        </Stack>

        {connectUrl && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                color="success"
                startIcon={<LoginIcon />}
                href={connectUrl}
                size="medium"
                sx={{ textTransform: 'none', fontWeight: 600 }}
                disabled={!isOnline}
              >
                {isOnline ? 'Join Server' : 'Server Offline'}
              </Button>
              <Tooltip title="Opens in your Mumble/TeamSpeak client">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace' }}
                >
                  {connectUrl}
                </Typography>
              </Tooltip>
            </Stack>
          </>
        )}

        {/* Peak Stats */}
        {stats && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              <TrendingUpIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
              Peak Users
            </Typography>
            <Stack direction="row" spacing={3}>
              <Tooltip title="Peak users in last 24 hours">
                <Stack alignItems="center">
                  <Typography variant="h6">{stats.peakUsers24h ?? 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    24h
                  </Typography>
                </Stack>
              </Tooltip>
              <Tooltip title="Peak users in last 7 days">
                <Stack alignItems="center">
                  <Typography variant="h6">{stats.peakUsers7d ?? 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    7d
                  </Typography>
                </Stack>
              </Tooltip>
              <Tooltip title="Peak users in last 30 days">
                <Stack alignItems="center">
                  <Typography variant="h6">{stats.peakUsers30d ?? 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    30d
                  </Typography>
                </Stack>
              </Tooltip>
              {stats.uniqueUsersMonth !== undefined && (
                <Tooltip title="Unique users this month">
                  <Stack alignItems="center">
                    <Typography variant="h6">
                      <PeopleIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                      {stats.uniqueUsersMonth}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Unique/mo
                    </Typography>
                  </Stack>
                </Tooltip>
              )}
            </Stack>
          </>
        )}

        {/* Server Type Badge */}
        <Box sx={{ mt: 2 }}>
          <Chip
            label={(stats?.serverType ?? serverType ?? 'unknown').toUpperCase()}
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
          />
          {stats?.totalVoiceMinutesMonth !== undefined && stats.totalVoiceMinutesMonth > 0 && (
            <Chip
              label={`${Math.round(stats.totalVoiceMinutesMonth / 60)}h voice this month`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
