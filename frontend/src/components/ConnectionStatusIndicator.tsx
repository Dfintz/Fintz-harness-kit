import { CheckCircle, Error as ErrorIcon, Refresh } from '@mui/icons-material';
import { Box, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import { getStatusColor } from '@/utils/statusStyles';

interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  isReconnecting?: boolean;
  error?: string | null;
  compact?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  isConnected,
  isReconnecting = false,
  error = null,
  compact = false,
}) => {
  const theme = useTheme();

  const statusColor = (() => {
    if (error) return getStatusColor('error', theme);
    if (isReconnecting) return getStatusColor('reconnecting', theme);
    if (isConnected) return getStatusColor('connected', theme);
    return getStatusColor('disconnected', theme);
  })();

  const getStatusText = () => {
    if (error) return 'Error';
    if (isReconnecting) return 'Reconnecting';
    if (isConnected) return 'Live';
    return 'Offline';
  };

  const getTooltipText = () => {
    if (error) return `Connection error: ${error}`;
    if (isReconnecting) return 'Reconnecting to server...';
    if (isConnected) return 'Real-time connection active';
    return 'Disconnected from server';
  };

  const getStatusIcon = () => {
    if (error) return ErrorIcon;
    if (isReconnecting) return Refresh;
    if (isConnected) return CheckCircle;
    return ErrorIcon;
  };

  const StatusIcon = getStatusIcon();
  const animating = isReconnecting;

  if (compact) {
    return (
      <Tooltip title={getTooltipText()} arrow>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: statusColor,
              animation: animating ? 'csi-pulse 1.5s ease-in-out infinite' : 'none',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
          <style>{`@keyframes csi-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={getTooltipText()} arrow>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: '12px',
          backgroundColor: alpha(statusColor, 0.1),
          border: `1px solid ${alpha(statusColor, 0.3)}`,
          transition: theme.transitions.create(['background-color', 'border-color'], {
            duration: 300,
          }),
          cursor: 'default',
          '&:hover': {
            backgroundColor: alpha(statusColor, 0.15),
          },
        }}
      >
        <StatusIcon
          sx={{
            fontSize: 14,
            color: statusColor,
            animation: animating ? 'csi-spin 1s linear infinite' : 'none',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: statusColor,
            lineHeight: 1,
            letterSpacing: '0.02em',
          }}
        >
          {getStatusText()}
        </Typography>
        <style>{`@keyframes csi-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </Box>
    </Tooltip>
  );
};
