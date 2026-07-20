import LoginIcon from '@mui/icons-material/Login';
import { Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';

import { selectIsAuthenticated, useAuthStore } from '@/store';

export interface SignInGateProps {
  /** Text shown in the heading, e.g. "apply to jobs" → "Sign in to apply to jobs" */
  actionLabel: string;
  /** Longer description shown below the heading */
  description: string;
  /** Content to render when the user IS authenticated */
  children: React.ReactNode;
}

/**
 * SignInGate — renders children when the user is authenticated,
 * or a styled "Sign in to …" prompt when they are not.
 *
 * Follows the same visual pattern as ContactFormModal's unauthenticated state.
 * Can be used inside any Dialog/Card to gate actions behind auth.
 */
export const SignInGate: React.FC<SignInGateProps> = ({ actionLabel, description, children }) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Stack direction="column" alignItems="center" spacing={3} sx={{ py: 4, px: 2 }}>
      <LoginIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography align="center" variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
        Sign in to {actionLabel}
      </Typography>
      <Typography align="center" sx={{ color: 'text.secondary', maxWidth: 400 }}>
        {description}
      </Typography>
      <Button
        variant="contained"
        href="/login"
        startIcon={<LoginIcon />}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
        }}
      >
        Sign In
      </Button>
    </Stack>
  );
};

/**
 * Inline sign-in prompt for use in DialogActions or similar compact areas.
 * Shows a single "Sign In" button instead of the full gate.
 */
export const SignInButton: React.FC<{ label?: string }> = ({ label = 'Sign in to continue' }) => {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (isAuthenticated) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Button
        variant="contained"
        size="small"
        href="/login"
        startIcon={<LoginIcon />}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Sign In
      </Button>
    </Box>
  );
};
