/**
 * MissionStatusBadge
 * Colored chip indicating mission status
 */

import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import type { MissionStatus } from '@sc-fleet-manager/shared-types';
import React from 'react';

import { getStatusChipSx } from '@/utils/statusStyles';

const STATUS_CONFIG: Record<
  MissionStatus,
  {
    label: string;
  }
> = {
  draft: { label: 'Draft' },
  planned: { label: 'Planned' },
  briefed: { label: 'Briefed' },
  in_progress: { label: 'In Progress' },
  completed: { label: 'Completed' },
  failed: { label: 'Failed' },
  cancelled: { label: 'Cancelled' },
};

interface MissionStatusBadgeProps {
  status: MissionStatus;
  size?: 'small' | 'medium';
}

export const MissionStatusBadge: React.FC<Readonly<MissionStatusBadgeProps>> = ({
  status,
  size = 'small',
}) => {
  const theme = useTheme();
  const config = STATUS_CONFIG[status] || { label: status };

  return <Chip label={config.label} sx={getStatusChipSx(status, theme)} size={size} />;
};
