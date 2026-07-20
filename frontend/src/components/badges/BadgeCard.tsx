/**
 * Badge Card
 *
 * Displays a single achievement (badge or title) in a card format.
 * Used in both the management list and user profile display.
 */

import type { Achievement } from '@/services/badgeService';
import { sanitizeImageUrl } from '@/utils/sanitize';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import React from 'react';
import { BadgeRarityChip } from './BadgeRarityChip';

interface BadgeCardProps {
  achievement: Achievement;
  onClick?: (achievement: Achievement) => void;
  selected?: boolean;
}

export const BadgeCard: React.FC<Readonly<BadgeCardProps>> = ({
  achievement,
  onClick,
  selected = false,
}) => {
  return (
    <Card
      variant={selected ? 'elevation' : 'outlined'}
      elevation={selected ? 4 : 0}
      sx={{ height: '100%' }}
    >
      <CardActionArea
        onClick={() => onClick?.(achievement)}
        disabled={!onClick}
        sx={{ height: '100%' }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Avatar
              src={sanitizeImageUrl(achievement.icon) || undefined}
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'action.hover',
              }}
            >
              {achievement.type === 'title' ? (
                <MilitaryTechIcon color="primary" />
              ) : (
                <EmojiEventsIcon color="warning" />
              )}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {achievement.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Chip
                  label={achievement.type === 'title' ? 'Title' : 'Badge'}
                  size="small"
                  variant="outlined"
                  color={achievement.type === 'title' ? 'primary' : 'warning'}
                />
                <BadgeRarityChip rarity={achievement.rarity} />
              </Box>
            </Box>
          </Box>
          {achievement.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {achievement.description}
            </Typography>
          )}
          {achievement.category && (
            <Box sx={{ mt: 1 }}>
              <Chip label={achievement.category} size="small" variant="outlined" />
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
