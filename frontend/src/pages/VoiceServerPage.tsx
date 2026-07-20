/**
 * VoiceServerPage — Aggregated voice servers visible to the current user.
 *
 * Lists every voice server the user can access:
 * - Their organization's configured server (if any)
 * - Any federation server their org belongs to
 * - Any organization/federation server shared with them via whitelist
 *
 * Each card shows live status, online users, channel tree, and connect info.
 * Status is enriched server-side so we only issue one query for the page.
 */

import {
  Business as BusinessIcon,
  Headset as HeadsetIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { AccessibleVoiceServer } from '@sc-fleet-manager/shared-types';
import React from 'react';

import { VoiceServerChannelTree } from '@/components/voice/VoiceServerChannelTree';
import { VoiceServerStatsPanel } from '@/components/voice/VoiceServerStatsPanel';
import { useAccessibleVoiceServers } from '@/hooks/queries/useVoiceServerQueries';

const VoiceServerCard: React.FC<{ readonly server: AccessibleVoiceServer }> = ({ server }) => {
  const theme = useTheme();
  const Icon = server.ownerType === 'federation' ? PublicIcon : BusinessIcon;
  const title = server.config.displayName ?? server.ownerName;
  const statusError = server.status === null ? new Error('Status unavailable') : null;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Icon sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6">{title}</Typography>
          {server.scope === 'shared' && (
            <Chip
              size="small"
              label="Shared with you"
              color="info"
              variant="outlined"
              sx={{ ml: 1 }}
            />
          )}
          <Chip
            size="small"
            label={server.ownerType === 'federation' ? 'Federation' : 'Organization'}
            variant="outlined"
            sx={{ ml: 'auto' }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Hosted by {server.ownerName}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <VoiceServerStatsPanel
              status={server.status ?? undefined}
              isLoading={false}
              error={statusError}
              connectUrl={server.config.connectUrl}
              serverType={server.config.serverType}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Channel Tree
                </Typography>
                <VoiceServerChannelTree channels={server.status?.channels} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export const VoiceServerPage: React.FC = () => {
  const theme = useTheme();
  const { data: servers, isLoading } = useAccessibleVoiceServers();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasServers = servers && servers.length > 0;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <HeadsetIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Voice Servers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor voice server status, online users, and activity statistics
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {hasServers &&
          servers.map(server => (
            <Grid key={`${server.ownerType}:${server.ownerId}`} size={{ xs: 12 }}>
              <VoiceServerCard server={server} />
            </Grid>
          ))}
        {!hasServers && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <HeadsetIcon sx={{ fontSize: 64, color: theme.palette.text.disabled, mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No voice servers accessible
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Your organization can configure one in Organization Settings → Voice Server, or
                  join a federation that has one configured.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};
