/**
 * Encryption Management Dashboard
 * Allows organization leaders to manage encryption settings, key claims, and key distribution
 */

import { DEKManagementPanel } from '@/components/encryption/DEKManagementPanel';
import { useEncryptionKeys } from '@/components/encryption/EncryptionKeyProvider';
import { HybridMigrationTab } from '@/components/encryption/HybridMigrationTab';
import { KeyPairManager } from '@/components/encryption/KeyPairManager';
import { SecureNotes } from '@/components/encryption/SecureNotes';
import { encryptionKeys } from '@/hooks/queries/queryKeys';
import {
    useEncryptionAuditLog,
    useReEncryptionProgress,
} from '@/hooks/queries/useEncryptionQueries';
import {
    AuditLogEntry,
    encryptionApiService,
    EncryptionStatus,
    KeyClaimResponse,
} from '@/services/crypto/encryptionApiService';
import {
    generateClaimPassphrase,
    parseKeyWrapper,
    unwrapKeyWithPassphrase,
    unwrapKeyWithPassword,
    wrapKeyWithPassphrase,
    wrapKeyWithPassword,
} from '@/services/crypto/encryptionService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
    ContentCopy as CopyIcon,
    Delete as DeleteIcon,
    Key as KeyIcon,
    Lock as LockIcon,
    LockOpen as LockOpenIcon,
    PersonAdd as PersonAddIcon,
    Refresh as RefreshIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    LinearProgress,
    Paper,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';

interface ReEncryptionProgress {
  totalItems: number;
  reEncryptedItems: number;
  pendingItems: number;
  percentComplete: number;
}

interface EncryptionManagementDashboardProps {
  organizationId: string;
  organizationName: string;
  currentUserId: string;
  isOwner: boolean;
  onSetupEncryption: () => void;
  /** When true, auto-open the setup wizard on first load if encryption is not yet enabled */
  autoTriggerSetup?: boolean;
}

function getEventTypeColor(
  eventType: string
): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  if (eventType.includes('ENABLED') || eventType.includes('COMPLETED')) return 'success';
  if (
    eventType.includes('DENIED') ||
    eventType.includes('DELETED') ||
    eventType.includes('DISABLED') ||
    eventType.includes('REVOKED')
  ) {
    return 'error';
  }
  if (
    eventType.includes('ROTATED') ||
    eventType.includes('SHARED') ||
    eventType.includes('REENCRYPTED') ||
    eventType.includes('CREATED')
  ) {
    return 'warning';
  }
  return 'primary';
}

function formatTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

const EncryptionHeader: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const theme = useTheme();

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
      <Typography variant="h5" fontWeight="bold">
        Encryption Management
      </Typography>
      {enabled ? (
        <Chip
          icon={<LockIcon />}
          label="Encryption Enabled"
          sx={getStatusChipSx('enabled', theme)}
          variant="filled"
        />
      ) : (
        <Chip icon={<LockOpenIcon />} label="Encryption Disabled" variant="outlined" />
      )}
    </Box>
  );
};

const StatusAlerts: React.FC<{
  error: string | null;
  onClearError: () => void;
}> = ({ error, onClearError }) => (
  <>
    {error && (
      <Alert severity="error" onClose={onClearError} sx={{ mb: 3 }}>
        {error}
      </Alert>
    )}
  </>
);

const KeyAccessBanner: React.FC<{ onClaim: () => void }> = ({ onClaim }) => (
  <Alert
    severity="info"
    sx={{ mb: 3 }}
    action={
      <Button color="inherit" size="small" onClick={onClaim}>
        Claim Key
      </Button>
    }
  >
    <AlertTitle>Encryption is enabled but you don't have access yet</AlertTitle>
    <Typography variant="body2">
      Ask an organization admin for a claim passphrase, then click "Claim Key" to gain access to
      encrypted data.
    </Typography>
  </Alert>
);

const ReEncryptionBanner: React.FC<{ progress: ReEncryptionProgress }> = ({ progress }) => (
  <Alert severity="warning" sx={{ mb: 3 }}>
    <AlertTitle>Key Rotation: Re-encryption In Progress</AlertTitle>
    <Typography variant="body2" sx={{ mb: 1 }}>
      {progress.pendingItems} of {progress.totalItems} data items are still encrypted with a
      previous key and need to be re-encrypted.
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
      <LinearProgress
        variant="determinate"
        value={progress.percentComplete}
        sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
      />
      <Typography variant="body2" fontWeight="bold">
        {progress.percentComplete}%
      </Typography>
    </Box>
  </Alert>
);

const VaultUnlockBanner: React.FC = () => {
  const { isUnlocked, unlock, lock, unlockError, isUnlocking } = useEncryptionKeys();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    await unlock(password);
    setPassword('');
  };

  if (isUnlocked) {
    return (
      <Alert
        severity="success"
        sx={{ mb: 3 }}
        icon={<LockOpenIcon />}
        action={
          <Button color="inherit" size="small" startIcon={<LockIcon />} onClick={lock}>
            Lock Vault
          </Button>
        }
      >
        Encryption vault is unlocked. Keys and encrypted data are accessible.
      </Alert>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3, border: 1, borderColor: 'warning.main' }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <LockIcon color="warning" />
        <Typography variant="subtitle1" fontWeight="bold">
          Encryption Vault Locked
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter your encryption password to unlock the vault and access encrypted data, key pairs, and
        secure notes.
      </Typography>
      {unlockError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {unlockError}
        </Alert>
      )}
      <Box component="form" onSubmit={handleUnlock} display="flex" gap={1} alignItems="flex-start">
        <TextField
          type={showPassword ? 'text' : 'password'}
          size="small"
          label="Encryption Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={isUnlocking}
          autoComplete="current-password"
          sx={{ minWidth: 300 }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowPassword(v => !v)}
                    edge="end"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={isUnlocking || !password.trim()}
          startIcon={isUnlocking ? <CircularProgress size={16} /> : <LockOpenIcon />}
        >
          {isUnlocking ? 'Unlocking...' : 'Unlock'}
        </Button>
      </Box>
    </Paper>
  );
};

const EncryptionDisabledCard: React.FC<{ isOwner: boolean; onSetup: () => void }> = ({
  isOwner,
  onSetup,
}) => (
  <Paper sx={{ p: 4, textAlign: 'center' }}>
    <LockIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
    <Typography variant="h6" gutterBottom>
      Encryption Not Enabled
    </Typography>
    <Typography color="text.secondary" component="p" sx={{ mb: 2 }}>
      Enable end-to-end encryption to protect sensitive organizational data.
    </Typography>
    <Button
      variant="contained"
      size="large"
      startIcon={<LockIcon />}
      onClick={onSetup}
      disabled={!isOwner}
    >
      Enable Encryption
    </Button>
    {isOwner ? null : (
      <Typography variant="caption" display="block" mt={2} color="error">
        Only organization owners can enable encryption
      </Typography>
    )}
  </Paper>
);

interface OverviewTabProps {
  status: EncryptionStatus;
  hasKeyAccess: boolean | null;
  isOwner: boolean;
  claims: KeyClaimResponse[];
  onInvite: () => void;
  onClaim: () => void;
  onRotate: () => void;
  onRevoke: () => void;
  onRevokeClaim: (claimId: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  status,
  hasKeyAccess,
  isOwner,
  claims,
  onInvite,
  onClaim,
  onRotate,
  onRevoke,
  onRevokeClaim,
}) => {
  const theme = useTheme();

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Encryption Details
        </Typography>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>
                <strong>Status</strong>
              </TableCell>
              <TableCell>
                <Chip label="Active" color="success" size="small" />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <strong>Algorithm</strong>
              </TableCell>
              <TableCell>{status.algorithm}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <strong>Key Version</strong>
              </TableCell>
              <TableCell>v{status.version}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <strong>Key Holders</strong>
              </TableCell>
              <TableCell>{status.numKeyHolders} users have access</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <strong>Your Access</strong>
              </TableCell>
              <TableCell>
                {hasKeyAccess ? (
                  <Chip label="You hold the key" color="success" size="small" icon={<KeyIcon />} />
                ) : (
                  <Chip label="No key access" color="warning" size="small" />
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <strong>Enabled Since</strong>
              </TableCell>
              <TableCell>
                {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : 'Unknown'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Zero-Knowledge Encryption</AlertTitle>
        <Typography variant="body2">
          Your organizational data is encrypted end-to-end. The server stores encrypted data but
          cannot decrypt it. Only users with the encryption key can access encrypted information.
        </Typography>
      </Alert>

      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        {isOwner && hasKeyAccess && (
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={onInvite}>
            Invite to Encryption
          </Button>
        )}
        {hasKeyAccess === false && (
          <Button variant="contained" startIcon={<KeyIcon />} onClick={onClaim}>
            Claim Encryption Key
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRotate}
          disabled={!isOwner}
        >
          Rotate Key
        </Button>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<WarningIcon />}
          onClick={onRevoke}
          disabled={!isOwner}
        >
          Revoke User Access
        </Button>
      </Box>

      {isOwner && claims.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Key Distribution Claims
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Claimed By</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {claims.map(claim => (
                  <TableRow key={claim.id}>
                    <TableCell>{claim.label || '(no label)'}</TableCell>
                    <TableCell>
                      <Chip
                        label={claim.status}
                        size="small"
                        sx={getStatusChipSx(claim.status, theme)}
                      />
                    </TableCell>
                    <TableCell>{new Date(claim.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {claim.status === 'pending' ? formatTimeRemaining(claim.expiresAt) : '-'}
                    </TableCell>
                    <TableCell>{claim.claimedBy || '-'}</TableCell>
                    <TableCell>
                      {claim.status === 'pending' && (
                        <Tooltip title="Revoke this claim">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => onRevokeClaim(claim.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

const AuditLogTab: React.FC<{ auditLog: AuditLogEntry[] }> = ({ auditLog }) => (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      Encryption Audit Log
    </Typography>
    <Typography color="text.secondary" component="p" sx={{ mb: 2 }}>
      Track all encryption-related activities for security monitoring.
    </Typography>

    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Event</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Message</TableCell>
            <TableCell>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {auditLog.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography color="textSecondary" py={3}>
                  No audit log entries yet
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            auditLog.map(entry => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Chip
                    label={entry.eventType}
                    size="small"
                    color={getEventTypeColor(entry.eventType)}
                  />
                </TableCell>
                <TableCell>{entry.userId}</TableCell>
                <TableCell>{entry.message}</TableCell>
                <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
);

const SettingsTab: React.FC<{ isOwner: boolean; onDisable: () => void }> = ({
  isOwner,
  onDisable,
}) => (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>
      Encryption Settings
    </Typography>

    <Alert severity="error" sx={{ mb: 3 }}>
      <AlertTitle>Danger Zone</AlertTitle>
      <Typography variant="body2">
        <strong>Disabling encryption is irreversible for existing data.</strong> No new data will be
        encrypted. Existing encrypted data will remain encrypted and will only be accessible to
        users who still hold the encryption key. If all key holders lose access, that data becomes
        permanently inaccessible.
      </Typography>
    </Alert>

    <Button
      variant="outlined"
      color="error"
      startIcon={<DeleteIcon />}
      onClick={onDisable}
      disabled={!isOwner}
    >
      Disable Encryption
    </Button>
    {isOwner ? null : (
      <Typography variant="caption" display="block" mt={1} color="error">
        Only organization owners can disable encryption
      </Typography>
    )}
  </Paper>
);

interface InviteDialogProps {
  open: boolean;
  loading: boolean;
  generatedPassphrase: string | null;
  inviteLabel: string;
  invitePassword: string;
  onClose: () => void;
  onCreate: () => void;
  onDone: () => void;
  onCopy: (value: string) => void;
  onChangeLabel: (value: string) => void;
  onChangePassword: (value: string) => void;
}

const InviteDialog: React.FC<InviteDialogProps> = ({
  open,
  loading,
  generatedPassphrase,
  inviteLabel,
  invitePassword,
  onClose,
  onCreate,
  onDone,
  onCopy,
  onChangeLabel,
  onChangePassword,
}) => {
  const hasGeneratedPassphrase = generatedPassphrase !== null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (hasGeneratedPassphrase) return;
        onClose();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {hasGeneratedPassphrase ? 'Share This Passphrase' : 'Invite Member to Encryption'}
      </DialogTitle>
      <DialogContent>
        {hasGeneratedPassphrase ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              <AlertTitle>Claim Token Created</AlertTitle>
              <Typography variant="body2">
                Share the passphrase below with the recipient via Discord DM or another secure
                channel. It expires in 24 hours and can only be used once.
              </Typography>
            </Alert>

            <Paper
              elevation={3}
              sx={{
                p: 3,
                mb: 2,
                backgroundColor: 'grey.100',
                fontFamily: 'monospace',
                fontSize: '1.3rem',
                textAlign: 'center',
                letterSpacing: 1,
                userSelect: 'all',
              }}
            >
              {generatedPassphrase}
            </Paper>

            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={() => onCopy(generatedPassphrase)}
              fullWidth
              sx={{ mb: 2 }}
            >
              Copy Passphrase
            </Button>

            <Alert severity="warning">
              <Typography variant="body2">
                <strong>Do not share this passphrase in plain text in public channels.</strong> Use
                Discord DMs, encrypted messaging, or communicate verbally.
              </Typography>
            </Alert>
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Create a one-time claim token so another org member can access encrypted data. You
                will receive a 6-word passphrase to share with them via Discord DM or another secure
                channel.
              </Typography>
            </Alert>

            <TextField
              label="Label (optional)"
              fullWidth
              value={inviteLabel}
              onChange={e => onChangeLabel(e.target.value)}
              sx={{ mb: 2, mt: 1 }}
              placeholder='e.g., "For CommanderJohn"'
              helperText="Helps you track who this invitation is for"
            />

            <TextField
              label="Your Encryption Password"
              type="password"
              fullWidth
              value={invitePassword}
              onChange={e => onChangePassword(e.target.value)}
              helperText="Your password is needed to unlock the org encryption key"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {hasGeneratedPassphrase ? (
          <Button variant="contained" onClick={onDone}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={onCreate} disabled={!invitePassword || loading}>
              {loading ? 'Creating...' : 'Create Invitation'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

interface ClaimDialogProps {
  open: boolean;
  loading: boolean;
  claimId: string;
  claimPassphrase: string;
  claimPassword: string;
  claimConfirmPassword: string;
  onClose: () => void;
  onSubmit: () => void;
  onChangeId: (value: string) => void;
  onChangePassphrase: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangeConfirmPassword: (value: string) => void;
}

const ClaimDialog: React.FC<ClaimDialogProps> = ({
  open,
  loading,
  claimId,
  claimPassphrase,
  claimPassword,
  claimConfirmPassword,
  onClose,
  onSubmit,
  onChangeId,
  onChangePassphrase,
  onChangePassword,
  onChangeConfirmPassword,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Claim Encryption Key</DialogTitle>
    <DialogContent>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Enter the 6-word passphrase you received from an organization admin, then set your own
          encryption password to protect the key on your account.
        </Typography>
      </Alert>

      <TextField
        label="Claim ID"
        fullWidth
        value={claimId}
        onChange={e => onChangeId(e.target.value)}
        sx={{ mb: 2, mt: 1 }}
        helperText="The claim token ID provided by your admin"
      />

      <TextField
        label="Claim Passphrase"
        fullWidth
        value={claimPassphrase}
        onChange={e => onChangePassphrase(e.target.value)}
        sx={{ mb: 2 }}
        placeholder="word-word-word-word-word-word"
        helperText="The 6-word passphrase shared with you by an admin"
      />

      <TextField
        label="Your New Encryption Password"
        type="password"
        fullWidth
        value={claimPassword}
        onChange={e => onChangePassword(e.target.value)}
        sx={{ mb: 2 }}
        helperText="At least 12 characters. This protects the org key on your account."
      />

      <TextField
        label="Confirm Password"
        type="password"
        fullWidth
        value={claimConfirmPassword}
        onChange={e => onChangeConfirmPassword(e.target.value)}
        error={claimConfirmPassword !== '' && claimPassword !== claimConfirmPassword}
        helperText={
          claimConfirmPassword !== '' && claimPassword !== claimConfirmPassword
            ? 'Passwords do not match'
            : ''
        }
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        onClick={onSubmit}
        disabled={
          !claimId ||
          !claimPassphrase ||
          !claimPassword ||
          claimPassword !== claimConfirmPassword ||
          claimPassword.length < 12 ||
          loading
        }
      >
        {loading ? 'Claiming...' : 'Claim Key'}
      </Button>
    </DialogActions>
  </Dialog>
);

const RotateKeyDialog: React.FC<{
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onRotate: () => void;
}> = ({ open, loading, onClose, onRotate }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Rotate Encryption Key</DialogTitle>
    <DialogContent>
      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>Performance Impact</AlertTitle>
        <Typography variant="body2">
          Rotating the encryption key will generate a new key and deactivate the current one. All
          existing encrypted data will need to be <strong>re-encrypted in the background</strong>{' '}
          with the new key.
        </Typography>
      </Alert>

      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>What happens during rotation</AlertTitle>
        <Typography variant="body2" component="div">
          <Box component="ol" sx={{ my: 0.5, pl: 2.5 }}>
            <li>A new encryption key is generated client-side</li>
            <li>The old key is deactivated (but preserved for decrypting old data)</li>
            <li>All new data will be encrypted with the new key</li>
            <li>Existing data will be re-encrypted in the background</li>
            <li>You will need to create new claim tokens for other key holders</li>
          </Box>
        </Typography>
      </Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" color="warning" onClick={onRotate} disabled={loading}>
        {loading ? 'Rotating...' : 'Rotate Key'}
      </Button>
    </DialogActions>
  </Dialog>
);

const RevokeDialog: React.FC<{
  open: boolean;
  loading: boolean;
  revokeUserId: string;
  onClose: () => void;
  onRevoke: () => void;
  onChangeUserId: (value: string) => void;
}> = ({ open, loading, revokeUserId, onClose, onRevoke, onChangeUserId }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Revoke User Key Access</DialogTitle>
    <DialogContent>
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>Data Will Become Inaccessible</AlertTitle>
        <Typography variant="body2">
          <strong>
            If you revoke this user's key access, they will no longer be able to decrypt any
            encrypted organizational data.
          </strong>{' '}
          This action takes effect immediately.
        </Typography>
      </Alert>

      <TextField
        label="User ID to Revoke"
        fullWidth
        value={revokeUserId}
        onChange={e => onChangeUserId(e.target.value)}
        sx={{ mt: 1 }}
        helperText="Enter the user ID whose encryption key access you want to revoke"
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        color="error"
        onClick={onRevoke}
        disabled={!revokeUserId || loading}
      >
        {loading ? 'Revoking...' : 'Revoke Access'}
      </Button>
    </DialogActions>
  </Dialog>
);

const DisableDialog: React.FC<{
  open: boolean;
  loading: boolean;
  organizationName: string;
  disableConfirmText: string;
  onClose: () => void;
  onDisable: () => void;
  onChangeConfirm: (value: string) => void;
}> = ({
  open,
  loading,
  organizationName,
  disableConfirmText,
  onClose,
  onDisable,
  onChangeConfirm,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Disable Encryption</DialogTitle>
    <DialogContent>
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>Encrypted Data May Become Permanently Inaccessible</AlertTitle>
        <Typography variant="body2">
          <strong>
            If you disable encryption and all key holders lose their keys, existing encrypted data
            becomes permanently inaccessible.
          </strong>{' '}
          No one - including system administrators - can recover data encrypted with a lost key.
        </Typography>
      </Alert>

      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">Before disabling, ensure that:</Typography>
        <Typography variant="body2" component="div">
          <Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>
            <li>All sensitive encrypted data has been exported or backed up in decrypted form</li>
            <li>All key holders have been notified of this change</li>
            <li>You have saved your recovery phrase in a secure location</li>
          </Box>
        </Typography>
      </Alert>

      <Typography variant="body2" sx={{ mb: 2 }}>
        Type <strong>{organizationName}</strong> to confirm:
      </Typography>
      <TextField
        fullWidth
        value={disableConfirmText}
        onChange={e => onChangeConfirm(e.target.value)}
        placeholder={organizationName}
        helperText="Type the organization name exactly as shown above"
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        variant="contained"
        color="error"
        onClick={onDisable}
        disabled={loading || disableConfirmText !== organizationName}
      >
        {loading ? 'Disabling...' : 'Disable Encryption'}
      </Button>
    </DialogActions>
  </Dialog>
);

export const EncryptionManagementDashboard: React.FC<EncryptionManagementDashboardProps> = ({
  organizationId,
  organizationName,
  currentUserId: _currentUserId,
  isOwner,
  onSetupEncryption,
  autoTriggerSetup,
}) => {
  const [status, setStatus] = useState<EncryptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const autoTriggered = React.useRef(false);

  // Key wrapper check — does the current user hold the key?
  const [hasKeyAccess, setHasKeyAccess] = useState<boolean | null>(null);

  // Claims state
  const [claims, setClaims] = useState<KeyClaimResponse[]>([]);

  // Dialog states — Invite to Encryption (create claim)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [generatedPassphrase, setGeneratedPassphrase] = useState<string | null>(null);

  // Dialog states — Claim Encryption Key (complete claim)
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimPassphrase, setClaimPassphrase] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimConfirmPassword, setClaimConfirmPassword] = useState('');
  const [claimId, setClaimId] = useState('');

  // Existing dialog states
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [rotateKeyDialogOpen, setRotateKeyDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeUserId, setRevokeUserId] = useState('');
  const [disableConfirmText, setDisableConfirmText] = useState('');
  const encryptionDisabled = status?.enabled !== true;

  // Use React Query hooks instead of direct API calls for cached data
  const { data: auditLogData } = useEncryptionAuditLog(
    status?.enabled && activeTab === 4 ? organizationId : undefined
  );
  const auditLog = auditLogData?.logs ?? [];

  const { data: reEncryptionProgressData } = useReEncryptionProgress(
    status?.enabled ? organizationId : undefined
  );
  const reEncryptionProgress = reEncryptionProgressData ?? null;

  const queryClient = useQueryClient();
  const notification = useNotification();

  const loadEncryptionStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const encryptionStatus = await encryptionApiService.getEncryptionStatus(organizationId);
      setStatus(encryptionStatus);

      // Check if current user has key access
      if (encryptionStatus.enabled) {
        try {
          const keyWrapper = await encryptionApiService.getKeyWrapper(organizationId);
          setHasKeyAccess(keyWrapper !== null);
        } catch {
          // Expected when user has no key access — non-fatal
          setHasKeyAccess(false);
        }
      }
    } catch (err) {
      logger.error('Failed to load encryption status:', err);
      notification.error('Failed to load encryption status');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const loadClaims = useCallback(async () => {
    try {
      const result = await encryptionApiService.listClaims(organizationId);
      setClaims(result.claims);
    } catch (err) {
      logger.error('Failed to load claims:', err);
    }
  }, [organizationId]);

  useEffect(() => {
    loadEncryptionStatus();
  }, [loadEncryptionStatus]);

  // Auto-trigger setup wizard on first load if encryption is not enabled
  useEffect(() => {
    if (
      autoTriggerSetup &&
      !loading &&
      status !== null &&
      !status.enabled &&
      isOwner &&
      !autoTriggered.current
    ) {
      autoTriggered.current = true;
      onSetupEncryption();
    }
  }, [autoTriggerSetup, loading, status, isOwner, onSetupEncryption]);

  // Load claims when encryption is enabled
  useEffect(() => {
    if (status?.enabled && isOwner) {
      loadClaims();
    }
  }, [status?.enabled, isOwner, loadClaims]);

  // ===========================================================================
  // Invite to Encryption (Create Claim Token)
  // ===========================================================================
  const handleCreateClaim = async () => {
    if (!invitePassword) {
      setError('Please enter your encryption password');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Get current user's key wrapper from server
      const keyWrapperResponse = await encryptionApiService.getKeyWrapper(organizationId);
      if (!keyWrapperResponse) {
        throw new Error(
          'No key wrapper found — encryption may not be initialized for this organization'
        );
      }

      // 2. Unwrap org key with user's password
      const orgKey = await unwrapKeyWithPassword(
        parseKeyWrapper(keyWrapperResponse.wrappedKey),
        invitePassword
      );

      // 3. Export org key to raw bytes
      const orgKeyRaw = await crypto.subtle.exportKey('raw', orgKey);

      // 4. Generate random passphrase
      const passphrase = generateClaimPassphrase();

      // 5. Wrap org key with passphrase
      const claimResult = await wrapKeyWithPassphrase(orgKeyRaw, passphrase);

      // 6. Send encrypted claim to server
      await encryptionApiService.createClaim(organizationId, {
        encryptedClaim: claimResult.encryptedClaim,
        claimMetadata: claimResult.claimMetadata,
        label: inviteLabel || undefined,
        expiresInHours: 24,
      });

      // 7. Show passphrase to admin
      setGeneratedPassphrase(passphrase);
      setInvitePassword('');
      await loadClaims();
    } catch (err) {
      logger.error('Failed to create claim:', err);
      const message = err instanceof Error ? err.message : 'Failed to create invitation';
      if (message.includes('Decryption failed') || message.includes('Invalid')) {
        notification.error('Incorrect encryption password. Please try again.');
      } else {
        notification.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // Claim Encryption Key (Complete Claim)
  // ===========================================================================
  const handleCompleteClaim = async () => {
    if (!claimPassphrase || !claimPassword) {
      setError('Please enter both the claim passphrase and your new encryption password');
      return;
    }
    if (claimPassword !== claimConfirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (claimPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch the encrypted claim blob from server
      const claimToken = await encryptionApiService.getClaimToken(organizationId, claimId);

      // 2. Decrypt with passphrase to recover org key
      const orgKeyRaw = await unwrapKeyWithPassphrase(
        claimToken.encryptedClaim,
        claimToken.claimMetadata,
        claimPassphrase
      );

      // 3. Wrap org key with user's own password
      const wrappedKey = await wrapKeyWithPassword(orgKeyRaw, claimPassword);

      // 4. Send new key wrapper to server
      await encryptionApiService.completeClaim(organizationId, claimId, JSON.stringify(wrappedKey));

      // 5. Success
      setClaimDialogOpen(false);
      setClaimPassphrase('');
      setClaimPassword('');
      setClaimConfirmPassword('');
      setClaimId('');
      setHasKeyAccess(true);
      notification.success(
        'Encryption key claimed successfully! You now have access to encrypted data.'
      );
      await loadEncryptionStatus();
    } catch (err) {
      logger.error('Failed to complete claim:', err);
      const message = err instanceof Error ? err.message : 'Failed to claim encryption key';
      if (message.includes('Invalid passphrase')) {
        notification.error('Invalid passphrase. Please check and try again.');
      } else {
        notification.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeClaim = async (revokeClaimId: string) => {
    try {
      await encryptionApiService.revokeClaim(organizationId, revokeClaimId);
      await loadClaims();
    } catch (err) {
      logger.error('Failed to revoke claim:', err);
      notification.error('Failed to revoke claim');
    }
  };

  const handleRevokeAccess = async () => {
    if (!revokeUserId) {
      setError('Please provide user ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await encryptionApiService.revokeKeyAccess(organizationId, revokeUserId);
      setRevokeDialogOpen(false);
      setRevokeUserId('');
      await loadEncryptionStatus();
      await queryClient.invalidateQueries({ queryKey: encryptionKeys.auditLog(organizationId) });
    } catch (err) {
      logger.error('Failed to revoke key access:', err);
      notification.error('Failed to revoke key access');
    } finally {
      setLoading(false);
    }
  };

  const handleRotateKey = async () => {
    notification.error('Key rotation requires client-side re-encryption and is not yet fully implemented.');
    setRotateKeyDialogOpen(false);
  };

  const handleDisableEncryption = async () => {
    try {
      setLoading(true);
      setError(null);
      await encryptionApiService.disableEncryption(organizationId);
      setDisableDialogOpen(false);
      setDisableConfirmText('');
      await loadEncryptionStatus();
    } catch (err) {
      logger.error('Failed to disable encryption:', err);
      notification.error('Failed to disable encryption');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading && !status) {
    return <Typography>Loading encryption settings...</Typography>;
  }

  return (
    <Box>
      <EncryptionHeader enabled={!encryptionDisabled} />
      <StatusAlerts
        error={error}
        onClearError={() => setError(null)}
      />
      {status?.enabled && hasKeyAccess === false && (
        <KeyAccessBanner onClaim={() => setClaimDialogOpen(true)} />
      )}
      {reEncryptionProgress && reEncryptionProgress.pendingItems > 0 && (
        <ReEncryptionBanner progress={reEncryptionProgress} />
      )}
      {status?.enabled && hasKeyAccess && <VaultUnlockBanner />}

      {encryptionDisabled ? (
        <EncryptionDisabledCard isOwner={isOwner} onSetup={onSetupEncryption} />
      ) : (
        <Box>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ mb: 3 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Overview" />
            <Tab label="Key Pairs" />
            <Tab label="Data Keys" />
            <Tab label="Secure Notes" />
            <Tab label="Audit Log" />
            <Tab label="Migration" />
            <Tab label="Settings" />
          </Tabs>

          {activeTab === 0 && status && (
            <OverviewTab
              status={status}
              hasKeyAccess={hasKeyAccess}
              isOwner={isOwner}
              claims={claims}
              onInvite={() => {
                setGeneratedPassphrase(null);
                setInviteLabel('');
                setInvitePassword('');
                setInviteDialogOpen(true);
              }}
              onClaim={() => setClaimDialogOpen(true)}
              onRotate={() => setRotateKeyDialogOpen(true)}
              onRevoke={() => setRevokeDialogOpen(true)}
              onRevokeClaim={handleRevokeClaim}
            />
          )}

          {activeTab === 1 && <KeyPairManager organizationId={organizationId} />}
          {activeTab === 2 && <DEKManagementPanel organizationId={organizationId} />}
          {activeTab === 3 && <SecureNotes organizationId={organizationId} />}
          {activeTab === 4 && <AuditLogTab auditLog={auditLog} />}
          {activeTab === 5 && (
            <HybridMigrationTab organizationId={organizationId} isOwner={isOwner} />
          )}
          {activeTab === 6 && (
            <SettingsTab isOwner={isOwner} onDisable={() => setDisableDialogOpen(true)} />
          )}
        </Box>
      )}

      {/* ================================================================= */}
      {/* Invite to Encryption Dialog (Create Claim Token)                  */}
      {/* ================================================================= */}
      <InviteDialog
        open={inviteDialogOpen}
        loading={loading}
        generatedPassphrase={generatedPassphrase}
        inviteLabel={inviteLabel}
        invitePassword={invitePassword}
        onClose={() => setInviteDialogOpen(false)}
        onCreate={handleCreateClaim}
        onDone={() => {
          setInviteDialogOpen(false);
          setGeneratedPassphrase(null);
        }}
        onCopy={copyToClipboard}
        onChangeLabel={setInviteLabel}
        onChangePassword={setInvitePassword}
      />

      {/* ================================================================= */}
      {/* Claim Encryption Key Dialog                                       */}
      {/* ================================================================= */}
      <ClaimDialog
        open={claimDialogOpen}
        loading={loading}
        claimId={claimId}
        claimPassphrase={claimPassphrase}
        claimPassword={claimPassword}
        claimConfirmPassword={claimConfirmPassword}
        onClose={() => {
          setClaimDialogOpen(false);
          setClaimPassphrase('');
          setClaimPassword('');
          setClaimConfirmPassword('');
          setClaimId('');
        }}
        onSubmit={handleCompleteClaim}
        onChangeId={setClaimId}
        onChangePassphrase={setClaimPassphrase}
        onChangePassword={setClaimPassword}
        onChangeConfirmPassword={setClaimConfirmPassword}
      />

      {/* Rotate Key Dialog */}
      <RotateKeyDialog
        open={rotateKeyDialogOpen}
        loading={loading}
        onClose={() => setRotateKeyDialogOpen(false)}
        onRotate={handleRotateKey}
      />

      {/* Revoke Key Access Dialog */}
      <RevokeDialog
        open={revokeDialogOpen}
        loading={loading}
        revokeUserId={revokeUserId}
        onClose={() => {
          setRevokeDialogOpen(false);
          setRevokeUserId('');
        }}
        onRevoke={handleRevokeAccess}
        onChangeUserId={setRevokeUserId}
      />

      {/* Disable Encryption Dialog */}
      <DisableDialog
        open={disableDialogOpen}
        loading={loading}
        organizationName={organizationName}
        disableConfirmText={disableConfirmText}
        onClose={() => {
          setDisableDialogOpen(false);
          setDisableConfirmText('');
        }}
        onDisable={handleDisableEncryption}
        onChangeConfirm={setDisableConfirmText}
      />
    </Box>
  );
};
