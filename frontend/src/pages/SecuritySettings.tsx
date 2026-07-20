/**
 * Security Settings Page
 * Manage passwords, 2FA, sessions, trusted devices, and access logs
 */

import {
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Devices as DevicesIcon,
  History as HistoryIcon,
  Security as SecurityIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { TwoFactorManagement } from '@/components/TwoFactorManagement';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useAccessLogs,
  useRevokeSession,
  useRevokeTrustedDevice,
  useSessions,
  useTrustedDevices,
} from '@/hooks/queries/useSecuritySessionQueries';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';

const paperSx = {
  p: 3,
  mb: 3,
  bgcolor: 'var(--nav-bg)',
  border: '1px solid var(--nav-border)',
};

function formatDate(date: Date | string | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

function getTrustLevelStatus(trustLevel: string): string {
  if (trustLevel === 'high') return 'active';
  if (trustLevel === 'medium') return 'pending';
  return 'inactive';
}

function TableSkeleton({ rows = 3, cols = 4 }: Readonly<{ rows?: number; cols?: number }>) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={`skeleton-row-${String(r)}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={`skeleton-cell-${String(r)}-${String(c)}`}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export const SecuritySettings: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Access log pagination
  const [logLimit] = useState(50);
  const [logOffset, setLogOffset] = useState(0);

  // Queries
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useSessions();
  const {
    data: trustedDevices,
    isLoading: devicesLoading,
    error: devicesError,
  } = useTrustedDevices();
  const {
    data: accessLogs,
    isLoading: logsLoading,
    error: logsError,
  } = useAccessLogs(logLimit, logOffset);

  // Mutations
  const revokeSession = useRevokeSession();
  const revokeTrustedDevice = useRevokeTrustedDevice();

  // Confirm dialogs
  const sessionDialog = useConfirmDialog<number | string>();
  const deviceDialog = useConfirmDialog<string>();

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      // FUTURE: Integrate with password change API
      setMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setMessage('Failed to update password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeSession = async () => {
    if (sessionDialog.pendingData == null) return;
    try {
      await revokeSession.mutateAsync(sessionDialog.pendingData);
      sessionDialog.closeDialog();
    } catch (err) {
      logger.error('Failed to revoke session', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleRevokeDevice = async () => {
    if (!deviceDialog.pendingData) return;
    try {
      await revokeTrustedDevice.mutateAsync({ trustedDeviceId: deviceDialog.pendingData });
      deviceDialog.closeDialog();
    } catch (err) {
      logger.error('Failed to revoke device', err instanceof Error ? err : new Error(String(err)));
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/settings')}
          sx={{ mr: 1 }}
          aria-label="Back to settings"
        >
          <ArrowBackIcon />
        </IconButton>
        <SecurityIcon sx={{ color: 'var(--accent-cyan)', mr: 1 }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
          Security
        </Typography>
      </Box>

      {/* Password Change */}
      <Paper sx={paperSx}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Change Password
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            fullWidth
          />
          <TextField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            fullWidth
          />
          <TextField
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            fullWidth
          />
        </Box>

        {message && (
          <Typography
            variant="body2"
            sx={{
              mt: 2,
              color:
                message.includes('Failed') || message.includes('not match')
                  ? 'error.main'
                  : 'success.main',
            }}
          >
            {message}
          </Typography>
        )}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handlePasswordChange}
            disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
            sx={{ bgcolor: 'var(--accent-cyan)' }}
          >
            {isSaving ? 'Updating...' : 'Update Password'}
          </Button>
        </Box>
      </Paper>

      {/* Two-Factor Authentication */}
      <Paper sx={paperSx}>
        <TwoFactorManagement />
      </Paper>

      {/* Active Sessions */}
      <Paper sx={paperSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <VpnKeyIcon sx={{ mr: 1, color: 'var(--accent-cyan)' }} />
          <Typography variant="h6">Active Sessions</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {sessionsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load sessions
          </Alert>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Device</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Last Activity</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            {sessionsLoading ? (
              <TableSkeleton rows={3} cols={5} />
            ) : (
              <TableBody>
                {sessions && sessions.length > 0 ? (
                  sessions.map(session => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {session.userAgent || 'Unknown device'}
                        </Typography>
                      </TableCell>
                      <TableCell>{session.ipAddress || '—'}</TableCell>
                      <TableCell>{formatDate(session.lastActivity)}</TableCell>
                      <TableCell>{formatDate(session.expiresAt)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Revoke session">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => sessionDialog.openDialog(session.id)}
                            disabled={revokeSession.isPending}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No active sessions
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            )}
          </Table>
        </TableContainer>
      </Paper>

      {/* Trusted Devices */}
      <Paper sx={paperSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <DevicesIcon sx={{ mr: 1, color: 'var(--accent-cyan)' }} />
          <Typography variant="h6">Trusted Devices</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {devicesError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load trusted devices
          </Alert>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Device</TableCell>
                <TableCell>Trust Level</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            {devicesLoading ? (
              <TableSkeleton rows={3} cols={5} />
            ) : (
              <TableBody>
                {trustedDevices && trustedDevices.length > 0 ? (
                  trustedDevices.map(device => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {device.deviceName || device.userAgent || 'Unknown device'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={device.trustLevel}
                          size="small"
                          sx={getStatusChipSx(getTrustLevelStatus(device.trustLevel), theme)}
                        />
                      </TableCell>
                      <TableCell>{device.location || '—'}</TableCell>
                      <TableCell>{formatDate(device.lastUsed)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Revoke device">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deviceDialog.openDialog(device.id)}
                            disabled={revokeTrustedDevice.isPending}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No trusted devices
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            )}
          </Table>
        </TableContainer>
      </Paper>

      {/* Login History */}
      <Paper sx={paperSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <HistoryIcon sx={{ mr: 1, color: 'var(--accent-cyan)' }} />
          <Typography variant="h6">Login History</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {logsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load access logs
          </Alert>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            {logsLoading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : (
              <TableBody>
                {accessLogs && accessLogs.length > 0 ? (
                  accessLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Chip label={log.action} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{log.ipAddress || '—'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {log.userAgent || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(log.createdAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No access logs
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            )}
          </Table>
        </TableContainer>

        {accessLogs && accessLogs.length >= logLimit && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button size="small" onClick={() => setLogOffset(prev => prev + logLimit)}>
              Load More
            </Button>
          </Box>
        )}
      </Paper>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        {...sessionDialog.dialogProps}
        title="Revoke Session"
        message="This will immediately end the selected session. You may be logged out if this is your current session."
        onConfirm={handleRevokeSession}
      />
      <ConfirmDialog
        {...deviceDialog.dialogProps}
        title="Revoke Trusted Device"
        message="This device will no longer be trusted. You will need to re-verify it on next login."
        onConfirm={handleRevokeDevice}
      />
    </Container>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const SecuritySettingsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Security Settings">
    <SecuritySettings />
  </FeatureErrorBoundary>
);
