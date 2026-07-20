import {
  CheckCircle as CheckmarkCircleIcon,
  AccessTime as ClockIcon,
  Cancel as CloseCircleIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Place as LocationIcon,
  ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import React from 'react';

import { scColors } from '@/components/ui/tokens';

interface LegacyIconProps {
  size?: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  UNSAFE_style?: React.CSSProperties;
  color?: string;
  [key: string]: unknown;
}

const sizePx: Record<NonNullable<LegacyIconProps['size']>, number> = {
  S: 16,
  M: 20,
  L: 24,
  XL: 32,
  XXL: 40,
};

const colorMap: Record<string, string> = {
  positive: scColors.success,
  negative: scColors.error,
  notice: scColors.warning,
  info: scColors.info,
};

const resolveColor = (color?: string): string | undefined => {
  if (!color) return undefined;
  return colorMap[color] || color;
};

const makeLegacyIcon = (IconComponent: typeof CheckmarkCircleIcon) =>
  function LegacyIcon({ size = 'M', UNSAFE_style, color, ...rest }: LegacyIconProps) {
    return (
      <IconComponent
        sx={{
          fontSize: sizePx[size] ?? sizePx.M,
          color: resolveColor(color),
          ...(UNSAFE_style || {}),
        }}
        {...rest}
      />
    );
  };

const legacyIcons: Record<string, React.ComponentType<LegacyIconProps>> = {
  CheckmarkCircle: makeLegacyIcon(CheckmarkCircleIcon),
  CloseCircle: makeLegacyIcon(CloseCircleIcon),
  Clock: makeLegacyIcon(ClockIcon),
  Location: makeLegacyIcon(LocationIcon),
  DeleteIcon: makeLegacyIcon(DeleteIcon),
  Shield: makeLegacyIcon(ShieldIcon),
  Link: makeLegacyIcon(LinkIcon),
};

const globalIcons = globalThis as unknown as Record<string, unknown>;

Object.entries(legacyIcons).forEach(([name, Component]) => {
  if (!globalIcons[name]) {
    globalIcons[name] = Component;
  }
});

export { legacyIcons };
