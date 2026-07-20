import type { Theme } from '@mui/material/styles';
import React, { type ReactNode } from 'react';

import ConstructionIcon from '@mui/icons-material/Construction';
import ExploreIcon from '@mui/icons-material/Explore';
import GavelIcon from '@mui/icons-material/Gavel';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import HandymanIcon from '@mui/icons-material/Handyman';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MergeIcon from '@mui/icons-material/Merge';
import PaidIcon from '@mui/icons-material/Paid';
import ShieldIcon from '@mui/icons-material/Shield';

const ICON_SX = { fontSize: 16 } as const;

export interface FleetTypeMeta {
  icon: ReactNode;
  label: string;
  themeColor: 'error' | 'warning' | 'success' | 'info' | 'secondary' | 'primary';
}

/**
 * Fleet type metadata — single source of truth.
 * Uses MUI theme palette keys instead of hardcoded hex colors.
 * Icons are MUI icon components created via React.createElement
 * so they are valid ReactNode values at module scope.
 */
export const FLEET_TYPE_META: Record<string, FleetTypeMeta> = {
  combat: {
    icon: React.createElement(GavelIcon, { sx: ICON_SX }),
    label: 'Combat',
    themeColor: 'error',
  },
  mining: {
    icon: React.createElement(ConstructionIcon, { sx: ICON_SX }),
    label: 'Mining',
    themeColor: 'warning',
  },
  trading: {
    icon: React.createElement(PaidIcon, { sx: ICON_SX }),
    label: 'Trading',
    themeColor: 'success',
  },
  exploration: {
    icon: React.createElement(ExploreIcon, { sx: ICON_SX }),
    label: 'Exploration',
    themeColor: 'info',
  },
  salvage: {
    icon: React.createElement(HandymanIcon, { sx: ICON_SX }),
    label: 'Salvage',
    themeColor: 'warning',
  },
  escort: {
    icon: React.createElement(ShieldIcon, { sx: ICON_SX }),
    label: 'Escort',
    themeColor: 'primary',
  },
  reconnaissance: {
    icon: React.createElement(GpsFixedIcon, { sx: ICON_SX }),
    label: 'Recon',
    themeColor: 'secondary',
  },
  medical: {
    icon: React.createElement(LocalHospitalIcon, { sx: ICON_SX }),
    label: 'Medical',
    themeColor: 'info',
  },
  mixed: {
    icon: React.createElement(MergeIcon, { sx: ICON_SX }),
    label: 'Mixed',
    themeColor: 'primary',
  },
};

/**
 * Resolve a fleet type to its theme-aware color string.
 * Returns a hex color from the MUI palette for the given fleet type.
 */
export function getFleetTypeColor(type: string | undefined, theme: Theme): string {
  const meta = FLEET_TYPE_META[type ?? 'mixed'] ?? FLEET_TYPE_META.mixed;
  return theme.palette[meta.themeColor].main;
}

/**
 * Get complete fleet type metadata with a resolved color for a given theme.
 */
export function getFleetTypeMeta(
  type: string | undefined,
  theme: Theme
): { icon: ReactNode; label: string; color: string } {
  const meta = FLEET_TYPE_META[type ?? 'mixed'] ?? FLEET_TYPE_META.mixed;
  return {
    icon: meta.icon,
    label: meta.label,
    color: theme.palette[meta.themeColor].main,
  };
}
