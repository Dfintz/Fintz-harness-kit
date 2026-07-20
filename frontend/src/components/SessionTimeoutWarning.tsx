/**
 * SessionTimeoutWarning Component
 *
 * Modal dialog that appears when user becomes idle, warning them of impending logout.
 * Displays a countdown timer and provides options to keep session active or logout.
 *
 * @module components/SessionTimeoutWarning
 */

import { Warning as WarningIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
interface SessionTimeoutWarningProps {
  /** Whether the warning dialog is shown */
  isOpen: boolean;
  /** Remaining time in milliseconds before auto-logout */
  remainingTime: number;
  /** Total warning time in milliseconds */
  totalTime: number;
  /** Callback when user clicks "Keep Session" */
  onKeepSession: () => void;
  /** Callback when user clicks "Log Out" */
  onLogout: () => void;
}

/**
 * Format milliseconds to MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Session timeout warning dialog
 *
 * @example
 * ```tsx
 * <SessionTimeoutWarning
 *   open={showWarning}
 *   remainingTime={45000}
 *   totalTime={60000}
 *   onKeepSession={() => resetIdle()}
 *   onLogout={() => logout()}
 * />
 * ```
 */
export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isOpen,
  remainingTime,
  totalTime,
  onKeepSession,
  onLogout,
}) => {
  const percentage = Math.max(0, Math.min(100, (remainingTime / totalTime) * 100));
  const isUrgent = remainingTime < 10000; // Last 10 seconds

  return (
    <Dialog open={isOpen} onClose={onKeepSession} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1}>
          <WarningIcon color="warning" />
          Session Timeout Warning
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack direction="column" gap={2} alignItems="center" sx={{ py: 2 }}>
          <Alert severity="warning" sx={{ width: '100%' }}>
            Your session is about to expire
          </Alert>

          <Typography variant="body1" textAlign="center">
            You've been inactive for a while. For security reasons, you'll be automatically logged
            out in:
          </Typography>

          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              backgroundColor: isUrgent ? 'error.light' : 'grey.100',
              minWidth: '120px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontWeight: 'bold',
                fontFamily: 'monospace',
                color: isUrgent ? 'error.dark' : 'text.primary',
              }}
            >
              {formatTime(remainingTime)}
            </Typography>

            <CircularProgress
              aria-label="Time remaining"
              variant="determinate"
              value={percentage}
              size={20}
              color={isUrgent ? 'error' : 'primary'}
            />
          </Box>

          <Typography variant="body2" textAlign="center">
            Click <strong>"Keep Session"</strong> to continue working or <strong>"Log Out"</strong>{' '}
            to end your session now.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onLogout} variant="outlined" color="error">
          Log Out
        </Button>
        <Button onClick={onKeepSession} variant="contained" color="primary" autoFocus>
          Keep Session
        </Button>
      </DialogActions>
    </Dialog>
  );
};
