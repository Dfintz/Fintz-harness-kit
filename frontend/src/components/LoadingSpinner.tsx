import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  /** When true, fills the entire viewport height (used for app-level loading). */
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  fullScreen = false,
}) => {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: 4,
        ...(fullScreen && { minHeight: '100vh', width: '100%' }),
      }}
    >
      <CircularProgress size={48} />
      <Typography variant="body1" sx={{ color: 'text.secondary' }}>
        {message}
      </Typography>
    </Box>
  );
};
