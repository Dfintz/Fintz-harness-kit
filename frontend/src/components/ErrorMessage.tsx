import { ErrorOutline as AlertIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { Button, Paper, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss, onRetry }) => {
  const theme = useTheme();
  return (
    <Paper elevation={2}>
      <Stack
        direction="column"
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{ padding: 4 }}
      >
        <AlertIcon sx={{ fontSize: 64, color: theme.palette.error.main }} />
        <Typography sx={{ fontSize: '1.25rem', color: theme.palette.error.main }}>Error</Typography>
        <Typography
          sx={{ color: theme.palette.text.secondary, textAlign: 'center', maxWidth: 500 }}
        >
          {message}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          {onRetry && (
            <Button
              variant="contained"
              color="primary"
              onClick={onRetry}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button variant="outlined" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};
