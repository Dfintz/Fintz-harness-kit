/**
 * User Badges Dock
 *
 * Displays a user's awarded titles and badges in a profile section.
 * Shows badge name, type, rarity, awarding organization, and award date.
 * Supports visibility toggle for own profile.
 */

import { useToggleBadgeDisplay, useUserBadges } from '@/hooks/queries/useBadgeQueries';
import type { UserAchievement } from '@/services/badgeService';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback } from 'react';
import { BadgeRarityChip } from './BadgeRarityChip';

interface UserBadgesDockProps {
  userId: string;
  isOwnProfile?: boolean;
}

function BadgeDockItem({
  ua,
  isOwnProfile,
  onToggleDisplay,
  isToggling,
}: {
  ua: UserAchievement;
  isOwnProfile: boolean;
  onToggleDisplay: (userAchievementId: string, isDisplayed: boolean) => void;
  isToggling: boolean;
}) {
  const achievement = ua.achievement;
  if (!achievement) return null;

  const orgName = achievement.organization?.name;

  const icon = achievement.icon ? (
    <Avatar src={sanitizeImageUrl(achievement.icon)} sx={{ width: 36, height: 36 }} />
  ) : achievement.type === 'title' ? (
    <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
      <MilitaryTechIcon fontSize="small" />
    </Avatar>
  ) : (
    <Avatar sx={{ width: 36, height: 36, bgcolor: 'warning.main' }}>
      <EmojiEventsIcon fontSize="small" />
    </Avatar>
  );

  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
        opacity: ua.isDisplayed ? 1 : 0.6,
      }}
    >
      {icon}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography fontWeight={600} noWrap>
            {achievement.name}
          </Typography>
          <Chip
            label={achievement.type === 'title' ? 'Title' : 'Badge'}
            size="small"
            variant="outlined"
            color={achievement.type === 'title' ? 'primary' : 'default'}
          />
          <BadgeRarityChip rarity={achievement.rarity} size="small" />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.5 }}>
          {orgName && (
            <Typography variant="caption" color="text.secondary">
              From: <strong>{orgName}</strong>
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Awarded {new Date(ua.awardedAt).toLocaleDateString()}
          </Typography>
        </Stack>
        {achievement.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mt: 0.25,
            }}
          >
            {achievement.description}
          </Typography>
        )}
      </Box>
      {isOwnProfile && (
        <Tooltip title={ua.isDisplayed ? 'Hide from profile' : 'Show on profile'}>
          <IconButton
            size="small"
            onClick={() => onToggleDisplay(ua.id, !ua.isDisplayed)}
            disabled={isToggling}
          >
            {ua.isDisplayed ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

export const UserBadgesDock: React.FC<Readonly<UserBadgesDockProps>> = ({
  userId,
  isOwnProfile = false,
}) => {
  const { data: userBadges, isLoading } = useUserBadges(userId);
  const toggleDisplay = useToggleBadgeDisplay();

  const handleToggleDisplay = useCallback(
    async (userAchievementId: string, isDisplayed: boolean) => {
      try {
        await toggleDisplay.mutateAsync({ userAchievementId, isDisplayed, userId });
      } catch (err) {
        logger.error(
          'Failed to toggle badge display',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [toggleDisplay, userId]
  );

  // For viewing others, only show displayed badges
  const badges = isOwnProfile
    ? (userBadges ?? [])
    : (userBadges?.filter(ua => ua.isDisplayed) ?? []);

  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiEventsIcon color="primary" />
            <Typography variant="h6">Titles & Badges</Typography>
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        </Stack>
      </Paper>
    );
  }

  if (badges.length === 0) {
    if (!isOwnProfile) return null;
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiEventsIcon color="primary" />
            <Typography variant="h6">Titles & Badges</Typography>
          </Stack>
          <Typography color="text.secondary" fontStyle="italic">
            No titles or badges awarded yet.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <EmojiEventsIcon color="primary" />
          <Typography variant="h6">Titles & Badges</Typography>
          <Chip label={badges.length} size="small" />
        </Stack>
        {isOwnProfile && (
          <Typography variant="body2" color="text.secondary">
            Toggle visibility to control which badges appear on your public profile.
          </Typography>
        )}
        <Stack spacing={1}>
          {badges.map(ua => (
            <BadgeDockItem
              key={ua.id}
              ua={ua}
              isOwnProfile={isOwnProfile}
              onToggleDisplay={handleToggleDisplay}
              isToggling={toggleDisplay.isPending}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
};
