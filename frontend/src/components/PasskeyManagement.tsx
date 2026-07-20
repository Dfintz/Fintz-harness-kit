/**
 * PasskeyManagement Component
 *
 * UI for managing WebAuthn credentials (passkeys, security keys).
 * Allows users to register, Box, rename, and remove credentials.
 */

import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import {
  ButtonGroup,
  Content,
  DialogContainer,
  TypographyField,
} from '@/components/ui/SpectrumCompat';
import { WebAuthnCredential, webAuthnService } from '@/services/webAuthnService';
import { logger } from '@/utils/logger';
import DeleteIcon from '@mui/icons-material/Delete';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import EditIcon from '@mui/icons-material/Edit';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { Alert, Box, Chip, CircularProgress, Dialog, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
export const PasskeyManagement: React.FC = () => {
  const theme = useTheme();
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Registration dialog state
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingCredential, setRenamingCredential] = useState<WebAuthnCredential | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCredential, setDeletingCredential] = useState<WebAuthnCredential | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check WebAuthn support
  useEffect(() => {
    setIsSupported(webAuthnService.isSupported());
  }, []);

  // Fetch credentials
  const fetchCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await webAuthnService.getCredentials();
      setCredentials(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      logger.error('Failed to fetch passkeys:', err);
      setError('Failed to load passkeys');
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSupported) {
      fetchCredentials();
    } else {
      setLoading(false);
    }
  }, [isSupported]);

  // Register new passkey
  const handleRegister = async () => {
    try {
      setIsRegistering(true);
      setError(null);

      // Start registration
      const options = await webAuthnService.startRegistration();

      // Complete registration
      await webAuthnService.completeRegistration(options, deviceName || undefined);

      setRegisterDialogOpen(false);
      setDeviceName('');
      await fetchCredentials();
    } catch (err: unknown) {
      logger.error('Failed to register passkey:', err);
      setError(webAuthnService.getErrorMessage(err) || 'Failed to register passkey');
    } finally {
      setIsRegistering(false);
    }
  };

  // Rename credential
  const handleRename = async () => {
    if (!renamingCredential || !newName) return;

    try {
      setIsRenaming(true);
      setError(null);
      await webAuthnService.updateCredentialName(renamingCredential.id, newName);
      setRenameDialogOpen(false);
      setRenamingCredential(null);
      setNewName('');
      await fetchCredentials();
    } catch (err: unknown) {
      logger.error('Failed to rename passkey:', err);
      setError('Failed to rename passkey');
    } finally {
      setIsRenaming(false);
    }
  };

  // Delete credential
  const handleDelete = async () => {
    if (!deletingCredential) return;

    try {
      setIsDeleting(true);
      setError(null);
      await webAuthnService.removeCredential(deletingCredential.id);
      setDeleteDialogOpen(false);
      setDeletingCredential(null);
      await fetchCredentials();
    } catch (err: unknown) {
      logger.error('Failed to delete passkey:', err);
      setError('Failed to delete passkey');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open rename dialog
  const openRenameDialog = (credential: WebAuthnCredential) => {
    setRenamingCredential(credential);
    setNewName(credential.deviceName || '');
    setRenameDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (credential: WebAuthnCredential) => {
    setDeletingCredential(credential);
    setDeleteDialogOpen(true);
  };

  if (!isSupported) {
    return (
      <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.error.main }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Alert sx={{ color: theme.palette.error.main }} />
          <Typography>
            Passkeys are not supported in your browser. Please use a modern browser that supports
            WebAuthn.
          </Typography>
        </Stack>
      </Box>
    );
  }

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
            <Typography variant="h6">Passkeys & Security Keys</Typography>
            <Typography sx={{ color: theme.palette.text.secondary }}>
              Use passkeys for passwordless sign-in with your device's biometrics or security key
            </Typography>
          </Stack>
          <Button
            variant="primary"
            onClick={() => setRegisterDialogOpen(true)}
            leftIcon={<VpnKeyIcon />}
          >
            Add Passkey
          </Button>
        </Stack>

        {error && (
          <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.error.main }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Alert sx={{ color: theme.palette.error.main }} />
              <Typography>{error}</Typography>
            </Stack>
          </Box>
        )}

        <Divider />

        {/* Credentials List */}
        {credentials?.length > 0 ? (
          <Stack direction="column" spacing={2}>
            {credentials.map(credential => (
              <Box key={credential.id} sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="start">
                  <Stack direction="column" spacing={1} flex={1}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <DesktopWindowsIcon />
                      <Typography sx={{ fontWeight: 'bold' }}>
                        {credential.deviceName || 'Security Key'}
                      </Typography>
                      {credential.backedUp && <Chip label="Synced" color="success" size="small" />}
                    </Stack>

                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      <Typography
                        sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}
                      >
                        Added: {new Date(credential.createdAt).toLocaleDateString()}
                      </Typography>
                      {credential.lastUsedAt && (
                        <Typography
                          sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}
                        >
                          Last used: {new Date(credential.lastUsedAt).toLocaleDateString()}
                        </Typography>
                      )}
                      <Typography
                        sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}
                      >
                        Used {credential.useCount} {credential.useCount === 1 ? 'time' : 'times'}
                      </Typography>
                    </Stack>

                    {credential.transports && credential.transports.length > 0 && (
                      <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.disabled }}>
                        Transports: {credential.transports.join(', ')}
                      </Typography>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="sm"
                      aria-label="Edit passkey"
                      onClick={() => openRenameDialog(credential)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label="Delete passkey"
                      onClick={() => openDeleteDialog(credential)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Stack direction="column" alignItems="center" spacing={2} p={4}>
              <VpnKeyIcon sx={{ fontSize: 48, color: theme.palette.text.secondary }} />
              <Typography variant="subtitle1">No passkeys registered</Typography>
              <Typography sx={{ textAlign: 'center', color: theme.palette.text.secondary }}>
                Add a passkey to sign in quickly and securely using your device's biometrics (like
                Face ID or fingerprint) or a security key.
              </Typography>
              <Button
                variant="primary"
                onClick={() => setRegisterDialogOpen(true)}
                leftIcon={<VpnKeyIcon />}
              >
                Add Your First Passkey
              </Button>
            </Stack>
          </Box>
        )}

        {/* Info Section */}
        <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.info.main }}>
          <Stack direction="column" spacing={2}>
            <Typography sx={{ fontWeight: 'bold' }}>What are passkeys?</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
              Passkeys are a secure, passwordless way to sign in. They use your device's biometrics
              (like Face ID or fingerprint) or a security key, so you don't need to remember
              passwords.
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: theme.palette.text.secondary }}>
              Passkeys are more secure than passwords because they can't be phished, stolen, or
              reused across sites. They're backed by industry standards (WebAuthn/FIDO2) and
              supported by all modern browsers.
            </Typography>
          </Stack>
        </Box>
      </Stack>

      {/* Register Dialog */}
      <DialogContainer onDismiss={() => setRegisterDialogOpen(false)}>
        {registerDialogOpen && (
          <Dialog open={true}>
            <Typography>Add Passkey</Typography>
            <Divider />
            <Content>
              <Stack direction="column" spacing={3}>
                <Typography>
                  Give your passkey a name to help you remember which device or security key it is.
                </Typography>

                <TypographyField
                  label="Device Name (Optional)"
                  value={deviceName}
                  onChange={setDeviceName}
                  placeholder="e.g., MacBook Touch ID, YubiKey, iPhone"
                  description="You can leave this empty to use an auto-detected name"
                />

                <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.info.main }}>
                  <Stack direction="row" spacing={1} alignItems="start">
                    <VpnKeyIcon sx={{ color: theme.palette.info.main }} />
                    <Typography sx={{ fontSize: '0.875rem' }}>
                      When you click "Continue", your browser will prompt you to use your device's
                      biometrics or insert a security key.
                    </Typography>
                  </Stack>
                </Box>

                {error && (
                  <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.error.main }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Alert sx={{ color: theme.palette.error.main }} />
                      <Typography>{error}</Typography>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Content>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRegister} disabled={isRegistering}>
                {isRegistering ? (
                  <>
                    <CircularProgress size={20} />
                    <Typography>Registering...</Typography>
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Rename Dialog */}
      <DialogContainer onDismiss={() => setRenameDialogOpen(false)}>
        {renameDialogOpen && renamingCredential && (
          <Dialog open={true}>
            <Typography>Rename Passkey</Typography>
            <Divider />
            <Content>
              <TypographyField
                label="Device Name"
                value={newName}
                onChange={setNewName}
                autoFocus
              />
            </Content>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRename} disabled={isRenaming || !newName}>
                {isRenaming ? (
                  <>
                    <CircularProgress size={20} />
                    <Typography>Saving...</Typography>
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>

      {/* Delete Dialog */}
      <DialogContainer onDismiss={() => setDeleteDialogOpen(false)}>
        {deleteDialogOpen && deletingCredential && (
          <Dialog open={true}>
            <Typography>Remove Passkey</Typography>
            <Divider />
            <Content>
              <Stack direction="column" spacing={2}>
                <Typography>
                  Are you sure you want to remove{' '}
                  <strong>{deletingCredential.deviceName || 'this passkey'}</strong>?
                </Typography>
                <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.warning.main }}>
                  <Stack direction="row" spacing={1} alignItems="start">
                    <Alert sx={{ color: theme.palette.warning.main }} />
                    <Typography sx={{ fontSize: '0.875rem' }}>
                      You won't be able to use this passkey to sign in anymore.
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </Content>
            <ButtonGroup>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <CircularProgress size={20} />
                    <Typography>Removing...</Typography>
                  </>
                ) : (
                  'Remove'
                )}
              </Button>
            </ButtonGroup>
          </Dialog>
        )}
      </DialogContainer>
    </Box>
  );
};
