/**
 * TwoFactorManagement Component
 *
 * UI for managing Two-Factor Authentication (2FA) settings.
 * Allows users to enable, disable, and regenerate backup codes.
 */

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import {
  ButtonGroup,
  Content,
  DialogContainer,
  TypographyField,
} from '@/components/ui/SpectrumCompat';
import { twoFactorService, TwoFactorSetup, TwoFactorStatus } from '@/services/twoFactorService';
import { logger } from '@/utils/logger';
import DeleteIcon from '@mui/icons-material/Delete';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockIcon from '@mui/icons-material/Lock';
import Refresh from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Chip, CircularProgress, Dialog, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
export const TwoFactorManagement: React.FC = () => {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup dialog state
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Disable dialog state
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);

  // Backup codes dialog state
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Regenerate backup codes dialog state
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Fetch 2FA status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await twoFactorService.getStatus();
      setStatus(data);
    } catch (err: unknown) {
      logger.error('Failed to fetch 2FA status:', err);
      setError('Failed to load 2FA status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Start 2FA setup
  const handleStartSetup = async () => {
    try {
      setError(null);
      const data = await twoFactorService.setup();
      setSetupData(data);
      setBackupCodes(data.backupCodes);
      setSetupDialogOpen(true);
    } catch (err: unknown) {
      logger.error('Failed to start 2FA setup:', err);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to start 2FA setup');
      setError(msg);
    }
  };

  // Verify and enable 2FA
  const handleVerifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);
      await twoFactorService.verifyAndEnable(verificationCode, backupCodes);
      setSetupDialogOpen(false);
      setBackupCodesDialogOpen(true);
      await fetchStatus();
    } catch (err: unknown) {
      logger.error('Failed to verify 2FA:', err);
      setError('Invalid verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Disable 2FA
  const handleDisable = async () => {
    if (!disablePassword) {
      setError('Please enter your password');
      return;
    }

    try {
      setIsDisabling(true);
      setError(null);
      await twoFactorService.disable(disablePassword);
      setDisableDialogOpen(false);
      setDisablePassword('');
      await fetchStatus();
    } catch (err: unknown) {
      logger.error('Failed to disable 2FA:', err);
      setError('Failed to disable 2FA. Check your password.');
    } finally {
      setIsDisabling(false);
    }
  };

  // Regenerate backup codes
  const handleRegenerateBackupCodes = () => {
    setRegenerateCode('');
    setRegenerateDialogOpen(true);
  };

  const handleRegenerateConfirm = async () => {
    if (!regenerateCode || regenerateCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsRegenerating(true);
      setError(null);
      const result = await twoFactorService.regenerateBackupCodes(regenerateCode);
      setBackupCodes(result.backupCodes);
      setRegenerateDialogOpen(false);
      setRegenerateCode('');
      setBackupCodesDialogOpen(true);
      await fetchStatus();
    } catch (err: unknown) {
      logger.error('Failed to regenerate backup codes:', err);
      setError('Failed to regenerate backup codes. Check your 2FA code.');
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <Stack justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress aria-label="Loading..." size={40} />
      </Stack>
    );
  }

  return (
    <Box>
      <Stack direction="column" spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="column" spacing={1}>
            <Typography variant="h6">Two-Factor Authentication</Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              Add an extra layer of security to your account
            </Typography>
          </Stack>
          {status?.twoFactorEnabled ? (
            <Chip label="Enabled" color="success" size="small" />
          ) : (
            <Chip label="Disabled" size="small" />
          )}
        </Stack>

        {error && (
          <Box sx={{ borderRadius: 1, p: 2, borderColor: 'error.main' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ErrorOutlineIcon sx={{ color: 'error.main' }} />
              <Typography>{error}</Typography>
            </Stack>
          </Box>
        )}

        <Divider />

        {/* Status Section */}
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="column" spacing={2}>
            {status?.twoFactorEnabled ? (
              <>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LockIcon sx={{ color: 'success.main' }} />
                  <Typography sx={{ fontWeight: 'bold' }}>
                    Two-factor authentication is active
                  </Typography>
                </Stack>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Your account is protected with an authenticator app. You'll need to enter a code
                  from your app when signing in.
                </Typography>

                {status.hasBackupCodes && (
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                    Backup codes remaining: {status.backupCodesCount || 0}
                  </Typography>
                )}

                <Stack direction="row" spacing={2} mt={2}>
                  <Button
                    variant="outline"
                    onClick={handleRegenerateBackupCodes}
                    leftIcon={<Refresh />}
                  >
                    Regenerate Backup Codes
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDisableDialogOpen(true)}
                    leftIcon={<DeleteIcon />}
                  >
                    Disable 2FA
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon sx={{ color: 'warning.main' }} />
                  <Typography sx={{ fontWeight: 'bold' }}>
                    Two-factor authentication is not enabled
                  </Typography>
                </Stack>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Enable 2FA to protect your account from unauthorized access. You'll use an
                  authenticator app like Google Authenticator or Authy.
                </Typography>

                <Button variant="primary" onClick={handleStartSetup} leftIcon={<LockIcon />}>
                  Enable Two-Factor Authentication
                </Button>
              </>
            )}
          </Stack>
        </Box>
      </Stack>

      {/* Setup Dialog */}
      <DialogContainer onDismiss={() => setSetupDialogOpen(false)}>
        {setupDialogOpen && setupData && (
          <Dialog open={true}>
            <Typography>Enable Two-Factor Authentication</Typography>
            <Divider />
            <Content>
              <Stack direction="column" spacing={3}>
                <Typography>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </Typography>

                {/* QR Code */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '16px',
                  }}
                >
                  <img
                    src={setupData.qrCodeUrl}
                    alt="2FA QR Code"
                    style={{ width: '256px', height: '256px' }}
                  />
                </Box>

                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                  Can't scan? Enter this secret manually: <code>{setupData.secret}</code>
                </Typography>

                <Divider />

                <Typography sx={{ fontWeight: 'bold' }}>
                  Enter the 6-digit code from your authenticator app:
                </Typography>

                <TypographyField
                  label="Verification Code"
                  value={verificationCode}
                  onChange={setVerificationCode}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  validationState={error ? 'invalid' : undefined}
                  errorMessage={error || undefined}
                />
              </Stack>
            </Content>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleVerifyAndEnable}
                disabled={isVerifying || verificationCode.length !== 6}
              >
                {isVerifying ? (
                  <>
                    <CircularProgress size={20} />
                    <Typography>Verifying...</Typography>
                  </>
                ) : (
                  'Enable 2FA'
                )}
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Backup Codes Dialog */}
      <DialogContainer onDismiss={() => setBackupCodesDialogOpen(false)}>
        {backupCodesDialogOpen && backupCodes.length > 0 && (
          <Dialog open={true}>
            <Typography>Backup Codes</Typography>
            <Divider />
            <Content>
              <Stack direction="column" spacing={3}>
                <Box sx={{ borderRadius: 1, p: 2, borderColor: 'warning.main' }}>
                  <Stack direction="row" spacing={1} alignItems="start">
                    <WarningAmberIcon sx={{ color: 'warning.main' }} />
                    <Typography>
                      Save these backup codes in a safe place. You can use them to access your
                      account if you lose your authenticator device.
                    </Typography>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    backgroundColor: 'action.hover',
                    p: 2,
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                  }}
                >
                  <Stack direction="column" spacing={1}>
                    {backupCodes.map((code, index) => (
                      <Typography key={index}>{code}</Typography>
                    ))}
                  </Stack>
                </Box>

                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                  Each code can only be used once. After using a backup code, it will be
                  invalidated.
                </Typography>
              </Stack>
            </Content>
            <ButtonGroup>
              <Button variant="primary" onClick={() => setBackupCodesDialogOpen(false)}>
                I've Saved My Codes
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Disable Dialog */}
      <DialogContainer onDismiss={() => setDisableDialogOpen(false)}>
        {disableDialogOpen && (
          <Dialog open={true}>
            <Typography>Disable Two-Factor Authentication</Typography>
            <Divider />
            <Content>
              <Stack direction="column" spacing={3}>
                <Box sx={{ borderRadius: 1, p: 2, borderColor: 'error.main' }}>
                  <Stack direction="row" spacing={1} alignItems="start">
                    <ErrorOutlineIcon sx={{ color: 'error.main' }} />
                    <Typography>
                      Disabling 2FA will make your account less secure. Are you sure?
                    </Typography>
                  </Stack>
                </Box>

                <TypographyField
                  label="Password"
                  type="password"
                  value={disablePassword}
                  onChange={setDisablePassword}
                  description="Enter your account password to confirm"
                  autoComplete="current-password"
                />
              </Stack>
            </Content>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDisable}
                disabled={isDisabling || !disablePassword}
              >
                {isDisabling ? (
                  <>
                    <CircularProgress size={20} />
                    <Typography>Disabling...</Typography>
                  </>
                ) : (
                  'Disable 2FA'
                )}
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Regenerate Backup Codes Dialog */}
      <DialogContainer onDismiss={() => setRegenerateDialogOpen(false)}>
        {regenerateDialogOpen && (
          <Dialog open={true}>
            <Typography>Regenerate Backup Codes</Typography>
            <Divider />
            <Content>
              <Stack direction="column" spacing={3}>
                <Box sx={{ borderRadius: 1, p: 2, borderColor: 'warning.main' }}>
                  <Stack direction="row" spacing={1} alignItems="start">
                    <WarningAmberIcon sx={{ color: 'warning.main' }} />
                    <Typography>
                      Regenerating backup codes will invalidate all existing backup codes. Make sure
                      to save the new codes after regeneration.
                    </Typography>
                  </Stack>
                </Box>

                <TypographyField
                  label="2FA Verification Code"
                  value={regenerateCode}
                  onChange={setRegenerateCode}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  description="Enter your 6-digit 2FA code to confirm"
                  validationState={error ? 'invalid' : undefined}
                  errorMessage={error || undefined}
                />
              </Stack>
            </Content>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRegenerateConfirm}
                disabled={isRegenerating || regenerateCode.length !== 6}
              >
                {isRegenerating ? (
                  <>
                    <CircularProgress size={20} />
                    <Typography>Regenerating...</Typography>
                  </>
                ) : (
                  'Regenerate Codes'
                )}
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>
    </Box>
  );
};
