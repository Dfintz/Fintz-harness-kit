/**
 * MissionTypeBadge
 * Colored chip indicating mission type with icon
 */

import ExploreIcon from '@mui/icons-material/Explore';
import FlightIcon from '@mui/icons-material/Flight';
import GavelIcon from '@mui/icons-material/Gavel';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import RadarIcon from '@mui/icons-material/Radar';
import RecyclingIcon from '@mui/icons-material/Recycling';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import ShieldIcon from '@mui/icons-material/Shield';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Chip from '@mui/material/Chip';
import type { MissionType } from '@sc-fleet-manager/shared-types';
import React from 'react';

const TYPE_CONFIG: Record<MissionType, { label: string; icon: React.ReactElement }> = {
  combat: { label: 'Combat', icon: <GavelIcon fontSize="small" /> },
  mining: { label: 'Mining', icon: <PrecisionManufacturingIcon fontSize="small" /> },
  trading: { label: 'Trading', icon: <StorefrontIcon fontSize="small" /> },
  exploration: { label: 'Exploration', icon: <ExploreIcon fontSize="small" /> },
  logistics: { label: 'Logistics', icon: <LocalShippingIcon fontSize="small" /> },
  rescue: { label: 'Rescue', icon: <SecurityIcon fontSize="small" /> },
  reconnaissance: { label: 'Recon', icon: <RadarIcon fontSize="small" /> },
  escort: { label: 'Escort', icon: <ShieldIcon fontSize="small" /> },
  salvage: { label: 'Salvage', icon: <RecyclingIcon fontSize="small" /> },
  custom: { label: 'Custom', icon: <SettingsIcon fontSize="small" /> },
};

interface MissionTypeBadgeProps {
  missionType: MissionType;
  size?: 'small' | 'medium';
}

export const MissionTypeBadge: React.FC<Readonly<MissionTypeBadgeProps>> = ({
  missionType,
  size = 'small',
}) => {
  const config = TYPE_CONFIG[missionType] || {
    label: missionType,
    icon: <FlightIcon fontSize="small" />,
  };

  return <Chip label={config.label} icon={config.icon} size={size} variant="outlined" />;
};
