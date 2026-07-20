/**
 * User Badges Display
 *
 * Displays a user's awarded badges/titles as a horizontal row of chips.
 * Used on member profiles and member list items.
 */

import { useUserBadges } from '@/hooks/queries/useBadgeQueries';
import type { UserAchievement } from '@/services/badgeService';
import { sanitizeImageUrl } from '@/utils/sanitize';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

interface UserBadgesDisplayProps {
  userId: string;
  maxDisplay?: number;
  size?: 'small' | 'medium';
}

function BadgeChip({ ua, size }: { ua: UserAchievement; size: 'small' | 'medium' }) {
  const achievement = ua.achievement;
  if (!achievement) return null;

  const icon = achievement.icon ? (
    <Avatar src={sanitizeImageUrl(achievement.icon)} sx={{ width: 18, height: 18 }} />
  ) : achievement.type === 'title' ? (
    <MilitaryTechIcon fontSize="small" />
  ) : (
    <EmojiEventsIcon fontSize="small" />
  );

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2" fontWeight="bold">
            {achievement.name}
          </Typography>
          {achievement.description && (
            <Typography variant="caption">{achievement.description}</Typography>
          )}
          <Typography variant="caption" display="block" color="inherit" sx={{ opacity: 0.7 }}>
            {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
          </Typography>
        </Box>
      }
    >
      <Chip
        icon={icon}
        label={achievement.name}
        size={size}
        variant="outlined"
        color={achievement.type === 'title' ? 'primary' : 'default'}
      />
    </Tooltip>
  );
}

export const UserBadgesDisplay: React.FC<Readonly<UserBadgesDisplayProps>> = ({
  userId,
  maxDisplay = 5,
  size = 'small',
}) => {
  const { data: userBadges, isLoading } = useUserBadges(userId);

  if (isLoading) return <CircularProgress size={16} />;

  const displayed = userBadges?.filter(ua => ua.isDisplayed) ?? [];
  if (displayed.length === 0) return null;

  const visible = displayed.slice(0, maxDisplay);
  const remaining = displayed.length - maxDisplay;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map(ua => (
        <BadgeChip key={ua.id} ua={ua} size={size} />
      ))}
      {remaining > 0 && <Chip label={`+${remaining}`} size={size} variant="outlined" />}
    </Box>
  );
};
