import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';

interface SCStatsVerificationBadgeProps {
  lastImport?: string | Date | null;
  isStale?: boolean;
}

export const SCStatsVerificationBadge: React.FC<SCStatsVerificationBadgeProps> = ({
  lastImport,
  isStale,
}) => {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const tooltipTitle = `Verified by SCStats${
    lastImport ? ` • Last updated: ${formatDate(lastImport)}` : ''
  }${isStale ? ' • Data is stale (>30 days old)' : ''}`;

  return (
    <Tooltip title={tooltipTitle}>
      <Chip
        icon={<VerifiedIcon />}
        label="Verified"
        size="small"
        color={isStale ? 'warning' : 'success'}
        sx={{ ml: 1 }}
      />
    </Tooltip>
  );
};
