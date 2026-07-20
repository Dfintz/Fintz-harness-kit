/**
 * Badge Rarity Chip
 *
 * Displays a badge's rarity as a colored MUI Chip.
 * Uses MUI theme palette, no hardcoded colors.
 */

import type { AchievementRarity } from '@/services/badgeService';
import Chip from '@mui/material/Chip';
import type { Theme } from '@mui/material/styles';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

interface BadgeRarityChipProps {
  rarity: AchievementRarity;
  size?: 'small' | 'medium';
}

function getRaritySx(rarity: AchievementRarity, theme: Theme) {
  switch (rarity) {
    case 'legendary':
      return {
        backgroundColor: alpha(theme.palette.warning.main, 0.15),
        color: theme.palette.warning.dark,
        borderColor: theme.palette.warning.main,
      };
    case 'epic':
      return {
        backgroundColor: alpha(theme.palette.secondary.main, 0.15),
        color: theme.palette.secondary.dark,
        borderColor: theme.palette.secondary.main,
      };
    case 'rare':
      return {
        backgroundColor: alpha(theme.palette.info.main, 0.15),
        color: theme.palette.info.dark,
        borderColor: theme.palette.info.main,
      };
    case 'uncommon':
      return {
        backgroundColor: alpha(theme.palette.success.main, 0.15),
        color: theme.palette.success.dark,
        borderColor: theme.palette.success.main,
      };
    case 'common':
    default:
      return {
        backgroundColor: alpha(theme.palette.text.secondary, 0.08),
        color: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
      };
  }
}

export const BadgeRarityChip: React.FC<Readonly<BadgeRarityChipProps>> = ({
  rarity,
  size = 'small',
}) => {
  const theme = useTheme();

  return (
    <Chip
      label={rarity.charAt(0).toUpperCase() + rarity.slice(1)}
      size={size}
      variant="outlined"
      sx={getRaritySx(rarity, theme)}
    />
  );
};
