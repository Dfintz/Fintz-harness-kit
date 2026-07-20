/**
 * MissionPriorityBadge
 * Visual indicator for mission priority level
 */

import Chip from '@mui/material/Chip';
import type { MissionPriority } from '@sc-fleet-manager/shared-types';
import React from 'react';

const PRIORITY_CONFIG: Record<
  MissionPriority,
  { label: string; color: 'default' | 'info' | 'warning' | 'error' }
> = {
  low: { label: 'Low', color: 'default' },
  normal: { label: 'Normal', color: 'info' },
  high: { label: 'High', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
};

interface MissionPriorityBadgeProps {
  priority: MissionPriority;
  size?: 'small' | 'medium';
}

export const MissionPriorityBadge: React.FC<Readonly<MissionPriorityBadgeProps>> = ({
  priority,
  size = 'small',
}) => {
  const config = PRIORITY_CONFIG[priority] || { label: priority, color: 'default' as const };

  return <Chip label={config.label} color={config.color} size={size} variant="outlined" />;
};
