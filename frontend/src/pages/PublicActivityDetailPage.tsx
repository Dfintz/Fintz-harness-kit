/**
 * PublicActivityDetailPage — Public activity detail page
 *
 * Renders at /opportunities/activities/:id
 * Fetches a public activity and renders a detail dialog.
 */

import DurationIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import LocationIcon from '@mui/icons-material/LocationOn';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useParams } from 'react-router-dom';

import { SEOHead } from '@/components/SEOHead';

import { getActivityStatusConfig, getActivityTypeConfig } from '@sc-fleet-manager/shared-types';

import { usePublicActivity } from '@/hooks/queries/usePublicDirectoryQueries';
import { getStatusChipSx } from '@/utils/statusStyles';

function formatDate(dateString?: string): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export const PublicActivityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const { data: activity, isLoading, error } = usePublicActivity(id);

  if (isLoading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !activity) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Activity not found'}
        </Alert>
      </Box>
    );
  }

  const typeCfg = getActivityTypeConfig(activity.type);
  const statusCfg = getActivityStatusConfig(activity.status);
  const accent = typeCfg.color;

  const effectiveStartDate = activity.scheduledStartDate || activity.startDate;
  const effectiveEndDate = activity.scheduledEndDate || activity.endDate;
  let duration: string | null = null;
  if (activity.estimatedDuration) {
    duration = formatDuration(activity.estimatedDuration);
  } else if (effectiveStartDate && effectiveEndDate) {
    const diffMinutes = Math.round(
      (new Date(effectiveEndDate).getTime() - new Date(effectiveStartDate).getTime()) / 60000
    );
    duration = formatDuration(diffMinutes);
  }

  const currentParticipants = activity.currentParticipants ?? 0;
  const maxParticipants = activity.maxParticipants ?? 0;
  const openSlots = maxParticipants - currentParticipants;
  const participantsPct = maxParticipants > 0 ? (currentParticipants / maxParticipants) * 100 : 0;

  return (
    <Dialog open onClose={() => globalThis.history.back()} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: `3px solid ${accent}`,
          pb: 1.5,
        }}
      >
        <SEOHead
          title={`${activity.title} — ${typeCfg.label}`}
          description={
            activity.description ||
            `${activity.title} — a ${typeCfg.label} activity on Fringe Core.${openSlots > 0 ? ` ${openSlots} slots open.` : ''}`
          }
          canonical={`https://fringecore.space/opportunities/activities/${id}`}
          keywords={['activity', typeCfg.label, 'Star Citizen event', activity.title]}
        />
        <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{typeCfg.emoji}</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
            {activity.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {activity.organizationName ?? 'Public Activity'}
          </Typography>
        </Box>
        <IconButton onClick={() => globalThis.history.back()} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Badges */}
        <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip
            label={`${typeCfg.emoji} ${typeCfg.label}`}
            size="small"
            sx={{
              bgcolor: alpha(accent, 0.13),
              color: accent,
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
          <Chip
            label={`${statusCfg.emoji} ${statusCfg.label}`}
            size="small"
            sx={{
              ...getStatusChipSx(activity.status, theme),
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        </Stack>

        {/* Description */}
        {activity.description && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              bgcolor: alpha(theme.palette.common.white, 0.03),
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
              Description
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {activity.description}
            </Typography>
          </Box>
        )}

        {/* Schedule & Location */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          {effectiveStartDate && (
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
              <Typography variant="body2">
                <strong>Start:</strong> {formatDate(effectiveStartDate)}
              </Typography>
            </Stack>
          )}
          {effectiveEndDate && (
            <Stack direction="row" spacing={1} alignItems="center">
              <ScheduleIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
              <Typography variant="body2">
                <strong>End:</strong> {formatDate(effectiveEndDate)}
              </Typography>
            </Stack>
          )}
          {duration && (
            <Stack direction="row" spacing={1} alignItems="center">
              <DurationIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
              <Typography variant="body2">
                <strong>Duration:</strong> {duration}
              </Typography>
            </Stack>
          )}
          {activity.location && (
            <Stack direction="row" spacing={1} alignItems="center">
              <LocationIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
              <Typography variant="body2">
                <strong>Location:</strong> {activity.location}
              </Typography>
            </Stack>
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Participants */}
        {maxParticipants > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <GroupsIcon
                sx={{
                  fontSize: 18,
                  color: openSlots > 0 ? theme.palette.info.light : theme.palette.warning.main,
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {openSlots > 0 ? `${openSlots} Open Spot${openSlots > 1 ? 's' : ''}` : 'Full'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
                {currentParticipants}/{maxParticipants} joined
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={participantsPct}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.common.white, 0.06),
                '& .MuiLinearProgress-bar': {
                  bgcolor:
                    currentParticipants >= maxParticipants
                      ? theme.palette.warning.main
                      : theme.palette.info.light,
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        )}

        {/* Tags */}
        {(activity as unknown as { tags?: string[] }).tags &&
          (activity as unknown as { tags?: string[] }).tags!.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {(activity as unknown as { tags?: string[] }).tags!.map((tag: string) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.common.white, 0.06),
                    color: theme.palette.text.secondary,
                    fontSize: '0.7rem',
                    height: 22,
                  }}
                />
              ))}
            </Stack>
          )}

        {/* Posted date */}
        {activity.createdAt && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', textAlign: 'center', mt: 2 }}
          >
            Posted {new Date(activity.createdAt).toLocaleDateString()}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
