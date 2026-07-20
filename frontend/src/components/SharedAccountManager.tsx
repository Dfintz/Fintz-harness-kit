/**
 * Shared Account Manager
 *
 * Manages shared organization accounts (e.g., shared Star Citizen logins).
 * Provides CRUD operations, password reveal, and clipboard copy.
 *
 * Rewritten in Sprint 0.5 Phase C — migrated from raw axios + localStorage
 * to sharedAccountService + cookie-auth + MUI components.
 */

import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import Add from '@mui/icons-material/Add';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Delete from '@mui/icons-material/Delete';
import Visibility from '@mui/icons-material/Visibility';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useCreateSharedAccount,
  useDeleteSharedAccount,
  useSharedAccountsByOrganization,
} from '@/hooks/queries/useSharedAccountQueries';
import type { CreateSharedAccountDTO, SharedAccount } from '@/services/sharedAccountService';
import { sharedAccountService } from '@/services/sharedAccountService';
import { ConfirmDialog, useConfirmDialog } from './ui/ConfirmDialog';

// ============================================================================
// Types
// ============================================================================

interface Organization {
  id: string;
  name: string;
}

interface SharedAccountManagerProps {
  userId: string;
  userOrganizations: Organization[];
}

// ============================================================================
// Component
// ============================================================================

export const SharedAccountManager: React.FC<SharedAccountManagerProps> = ({
  userId: _userId,
  userOrganizations,
}) => {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const notification = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    accountName: '',
    accountUsername: '',
    password: '',
    description: '',
  });

  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  // Auto-select first org
  useEffect(() => {
    if (userOrganizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(userOrganizations[0].id);
    }
  }, [userOrganizations, selectedOrgId]);

  // Query: accounts by organization
  const {
    data: accounts = [],
    isLoading,
    error: fetchError,
  } = useSharedAccountsByOrganization(selectedOrgId || undefined);

  // Mutations
  const createMutation = useCreateSharedAccount();
  const deleteMutation = useDeleteSharedAccount();

  const selectedOrganization = useMemo(
    () => userOrganizations.find(org => org.id === selectedOrgId),
    [userOrganizations, selectedOrgId]
  );

  const showMessage = useCallback(
    (message: string, severity: 'success' | 'error' = 'success') => {
      if (severity === 'error') {
        notification.error(message);
      } else {
        notification.success(message);
      }
    },
    [notification]
  );

  // ==================== Handlers ====================

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.accountName || !formData.accountUsername || !formData.password) {
      showMessage('Account name, username, and password are required', 'error');
      return;
    }

    try {
      const dto: CreateSharedAccountDTO = {
        accountName: formData.accountName,
        accountUsername: formData.accountUsername,
        password: formData.password,
        organizationId: selectedOrgId,
        description: formData.description || undefined,
      };
      await createMutation.mutateAsync(dto);
      showMessage('Shared account created successfully!');
      setShowCreateDialog(false);
      setFormData({ accountName: '', accountUsername: '', password: '', description: '' });
    } catch (err) {
      logger.error(
        'Failed to create shared account',
        err instanceof Error ? err : new Error(String(err))
      );
      showMessage('Failed to create shared account', 'error');
    }
  };

  const handleRevealPassword = async (accountId: string) => {
    setPasswordLoading(true);
    try {
      const password = await sharedAccountService.getAccountPassword(accountId);
      setRevealedPassword(password);
      setPasswordDialogOpen(true);
    } catch (err) {
      logger.error(
        'Failed to retrieve password',
        err instanceof Error ? err : new Error(String(err))
      );
      showMessage('Failed to retrieve password', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const accountId = pendingDeleteId;
    closeDeleteConfirm();
    if (!accountId) return;

    try {
      await deleteMutation.mutateAsync(accountId);
      showMessage('Shared account deleted successfully!');
    } catch (err) {
      logger.error(
        'Failed to delete shared account',
        err instanceof Error ? err : new Error(String(err))
      );
      showMessage('Failed to delete shared account', 'error');
    }
  };

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      showMessage('Copied to clipboard!');
    },
    [showMessage]
  );

  // ==================== Render ====================

  const getDisplayName = (account: SharedAccount) =>
    account.accountName || account.name || 'Unnamed Account';

  const getDisplayUsername = (account: SharedAccount) => account.accountUsername || '—';

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
          Shared SC Accounts
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="org-select-label">Organization</InputLabel>
            <Select
              labelId="org-select-label"
              value={selectedOrgId}
              label="Organization"
              onChange={e => setSelectedOrgId(e.target.value)}
            >
              {userOrganizations.map(org => (
                <MenuItem key={org.id} value={org.id}>
                  {org.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowCreateDialog(true)}
            sx={{ textTransform: 'none' }}
          >
            Add Account
          </Button>
        </Stack>
      </Stack>

      {/* Error */}
      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {fetchError.message || 'Failed to fetch shared accounts'}
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!isLoading && accounts.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            bgcolor: 'var(--bg-secondary)',
            borderRadius: 2,
          }}
        >
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No shared accounts found for {selectedOrganization?.name}
          </Typography>
          <Button
            variant="contained"
            onClick={() => setShowCreateDialog(true)}
            sx={{ textTransform: 'none' }}
          >
            Create First Account
          </Button>
        </Box>
      )}

      {/* Account cards */}
      {!isLoading && accounts.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          }}
        >
          {accounts.map(account => (
            <Card key={account.id} variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ color: 'var(--accent-primary)', mb: 1 }}>
                  {getDisplayName(account)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Username:</strong> {getDisplayUsername(account)}
                </Typography>
                {account.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {account.description}
                  </Typography>
                )}
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Tooltip title="Copy Username">
                  <Button
                    size="small"
                    startIcon={<ContentCopy />}
                    onClick={() => copyToClipboard(getDisplayUsername(account))}
                    sx={{ textTransform: 'none' }}
                  >
                    Copy
                  </Button>
                </Tooltip>
                <Tooltip title="View Password">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleRevealPassword(account.id)}
                    disabled={passwordLoading}
                  >
                    <Visibility />
                  </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Delete Account">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => openDeleteConfirm(account.id)}
                  >
                    <Delete />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      {/* Create Account Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleCreateAccount}>
          <DialogTitle>Create Shared Account</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Account Name"
                required
                fullWidth
                value={formData.accountName}
                onChange={e => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
              />
              <TextField
                label="Username"
                required
                fullWidth
                value={formData.accountUsername}
                onChange={e => setFormData(prev => ({ ...prev, accountUsername: e.target.value }))}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                helperText="Password will be securely stored in Azure Key Vault"
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShowCreateDialog(false);
                setFormData({
                  accountName: '',
                  accountUsername: '',
                  password: '',
                  description: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Password Reveal Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => {
          setPasswordDialogOpen(false);
          setRevealedPassword('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Account Password</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              p: 2,
              bgcolor: 'var(--bg-secondary)',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              wordBreak: 'break-all',
            }}
          >
            {revealedPassword}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => copyToClipboard(revealedPassword)} startIcon={<ContentCopy />}>
            Copy
          </Button>
          <Button
            onClick={() => {
              setPasswordDialogOpen(false);
              setRevealedPassword('');
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Shared Account"
        message="Are you sure you want to delete this shared account? This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
};
