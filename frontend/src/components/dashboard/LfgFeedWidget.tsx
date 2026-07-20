import {
  Groups as LfgIcon,
  GpsFixed as MissionIcon,
  RocketLaunch as RocketIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useRecommendedActivities } from '@/hooks/queries';
import type { ActivityV2 } from '@/types/apiV2';

function formatRelativeStart(dateString?: string): string {
  if (!dateString) return '';
  const diff = new Date(dateString).getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Started';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days}d`;
}

interface LfgRowProps {
  activity: ActivityV2;
  onClick: (id: string) => void;
}

const LfgRow: React.FC<Readonly<LfgRowProps>> = ({ activity, onClick }) => {
  const theme = useTheme();
  const open = (activity.maxParticipants ?? 0) - (activity.currentParticipants ?? 0);
  const startLabel = formatRelativeStart(activity.scheduledStartDate ?? activity.startDate);

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'background-color 150ms',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
      }}
      onClick={() => onClick(activity.id)}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        {activity.type === 'lfg' ? (
          <MissionIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
        ) : (
          <RocketIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
        )}
        <Stack flex={1} spacing={0.2} sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activity.title}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: theme.palette.text.secondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activity.organizationName ?? 'Open Group'}
          </Typography>
        </Stack>
        {open > 0 && (
          <Chip
            label={`${open} open`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              bgcolor: alpha(theme.palette.info.main, 0.09),
              color: theme.palette.info.light,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
            }}
          />
        )}
        {startLabel && (
          <Stack direction="row" spacing={0.3} alignItems="center">
            <TimeIcon sx={{ fontSize: 12, color: theme.palette.text.secondary }} />
            <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary }}>
              {startLabel}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

/**
 * LfgFeedWidget — dashboard widget showing recent/upcoming LFG posts.
 * Uses useRecommendedActivities filtered to lfg type.
 */
export const LfgFeedWidget: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data, isLoading } = useRecommendedActivities(20);

  const lfgActivities = (data?.activities ?? [])
    .filter((a: ActivityV2) => a.type === 'lfg' && a.status === 'open')
    .slice(0, 5);

  if (isLoading) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        Loading LFG posts...
      </Typography>
    );
  }

  if (lfgActivities.length === 0) {
    return (
      <Stack spacing={1} alignItems="center" sx={{ py: 3 }}>
        <LfgIcon sx={{ fontSize: 32, color: theme.palette.text.disabled }} />
        <Typography variant="body2" color="text.secondary">
          No active LFG posts right now
        </Typography>
        <Button size="small" variant="outlined" onClick={() => navigate('/activities')}>
          Browse Activities
        </Button>
      </Stack>
    );
  }

  return (
    <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
      <Stack spacing={0}>
        {lfgActivities.map((activity: ActivityV2) => (
          <LfgRow
            key={activity.id}
            activity={activity}
            onClick={id => navigate(`/activities/${id}`)}
          />
        ))}
        <Box sx={{ textAlign: 'center', pt: 1 }}>
          <Button size="small" onClick={() => navigate('/activities')}>
            View All →
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};
