/**
 * MissionCard
 * Card component for displaying mission info in list/grid views.
 * Shows title, type, status, difficulty, priority, dates, and participant count.
 *
 * Sprint 1 — Wave 3.1
 */

import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FlagIcon from '@mui/icons-material/Flag';
import GroupIcon from '@mui/icons-material/Group';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import type { Mission, MissionDifficulty } from '@sc-fleet-manager/shared-types';
import React, { useCallback } from 'react';

import { MissionPriorityBadge } from './MissionPriorityBadge';
import { MissionStatusBadge } from './MissionStatusBadge';
import { MissionTypeBadge } from './MissionTypeBadge';

function getDifficultyColor(difficulty: MissionDifficulty, theme: Theme): string {
  switch (difficulty) {
    case 'easy':
      return theme.palette.success.main;
    case 'medium':
      return theme.palette.warning.main;
    case 'hard':
    case 'extreme':
      return theme.palette.error.main;
    case 'trivial':
    default:
      return theme.palette.text.secondary;
  }
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

interface MissionCardProps {
  mission: Mission;
  onClick?: (missionId: string) => void;
  compact?: boolean;
}

export const MissionCard: React.FC<Readonly<MissionCardProps>> = ({
  mission,
  onClick,
  compact = false,
}) => {
  const theme = useTheme();
  const handleClick = useCallback(() => {
    onClick?.(mission.id);
  }, [onClick, mission.id]);

  const completedObjectives =
    mission.objectives?.filter((o: { completed?: boolean }) => o.completed).length ?? 0;
  const totalObjectives = mission.objectives?.length ?? 0;
  const confirmedParticipants =
    mission.participants?.filter((p: { status: string }) => p.status === 'confirmed').length ?? 0;
  const totalParticipants = mission.participants?.length ?? 0;
  const difficultyColor = getDifficultyColor(mission.difficulty, theme);

  const cardContent = (
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      {/* Top row: badges */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
        <MissionStatusBadge status={mission.status} />
        <MissionTypeBadge missionType={mission.missionType} />
        <MissionPriorityBadge priority={mission.priority} />
      </Stack>

      {/* Title */}
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 700,
          lineHeight: 1.3,
          mb: 0.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {mission.title}
      </Typography>

      {/* Description */}
      {mission.description && !compact && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 1.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.5,
          }}
        >
          {mission.description}
        </Typography>
      )}

      {/* Info row: difficulty, location, dates */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}
      >
        <Tooltip title={`Difficulty: ${mission.difficulty}`}>
          <Chip
            icon={<FlagIcon sx={{ fontSize: 14, color: `${difficultyColor} !important` }} />}
            label={mission.difficulty.charAt(0).toUpperCase() + mission.difficulty.slice(1)}
            size="small"
            variant="outlined"
            sx={{
              borderColor: alpha(difficultyColor, 0.27),
              color: difficultyColor,
              fontSize: '0.75rem',
              height: 24,
            }}
          />
        </Tooltip>

        {mission.location && (
          <Stack direction="row" spacing={0.3} alignItems="center">
            <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
              {mission.location}
            </Typography>
          </Stack>
        )}

        {mission.startDate && (
          <Stack direction="row" spacing={0.3} alignItems="center">
            <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {formatDate(mission.startDate)}
              {mission.endDate ? ` – ${formatDate(mission.endDate)}` : ''}
            </Typography>
          </Stack>
        )}
      </Stack>

      {/* Bottom row: objectives progress, participants, created */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}
      >
        {totalObjectives > 0 && (
          <Tooltip title={`${completedObjectives} of ${totalObjectives} objectives completed`}>
            <Stack direction="row" spacing={0.3} alignItems="center">
              <CheckCircleOutlineIcon
                sx={{
                  fontSize: 16,
                  color:
                    completedObjectives === totalObjectives ? 'success.main' : 'text.secondary',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {completedObjectives}/{totalObjectives}
              </Typography>
            </Stack>
          </Tooltip>
        )}

        {totalParticipants > 0 && (
          <Tooltip
            title={`${confirmedParticipants} confirmed of ${totalParticipants} participants`}
          >
            <Stack direction="row" spacing={0.3} alignItems="center">
              <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {confirmedParticipants}/{totalParticipants}
              </Typography>
            </Stack>
          </Tooltip>
        )}

        <Box sx={{ flex: 1 }} />

        <Typography variant="caption" color="text.disabled">
          {formatRelativeTime(mission.createdAt)}
        </Typography>
      </Stack>

      {/* Tags */}
      {mission.tags && mission.tags.length > 0 && !compact && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {mission.tags.slice(0, 3).map((tag: string) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{ fontSize: '0.68rem', height: 20 }}
              variant="outlined"
            />
          ))}
          {mission.tags.length > 3 && (
            <Chip
              label={`+${mission.tags.length - 3}`}
              size="small"
              sx={{ fontSize: '0.68rem', height: 20 }}
              variant="outlined"
            />
          )}
        </Stack>
      )}
    </CardContent>
  );

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: theme.transitions.create('all', { duration: 200 }),
        '&:hover': {
          boxShadow: 4,
          transform: onClick ? 'translateY(-2px)' : undefined,
        },
      }}
    >
      {onClick ? (
        <CardActionArea onClick={handleClick} sx={{ flex: 1, alignItems: 'stretch' }}>
          {cardContent}
        </CardActionArea>
      ) : (
        cardContent
      )}
    </Card>
  );
};
