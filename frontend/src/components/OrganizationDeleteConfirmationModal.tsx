import { apiClient } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import WarningAmber from '@mui/icons-material/WarningAmber';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { TwoFactorInput } from './TwoFactorInput';

import { useAuthStore } from '@/store/authStore';
import { executeWith2FA, is2FAError } from '@/utils/twoFactorHelper';

/**
 * Deletion PreBox Interface
 */
interface DeletionPreBox {
  organizationId: string;
  organizationName: string;
  descendantCount: number;
  memberCount: number;
  shipCount: number;
  estimatedDataSize: string;
  willDeleteDescendants: boolean;
}

/**
 * Props for OrganizationDeleteConfirmationModal
 */
interface OrganizationDeleteConfirmationModalProps {
  organizationId: string;
  organizationName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  deleteDescendants?: boolean;
}

/**
 * OrganizationDeleteConfirmationModal Component
 *
 * A critical confirmation dialog for organization deletion that:
 * - Displays deletion impact preBox (members, ships, descendants)
 * - Requires typing organization name to confirm (type-to-confirm pattern)
 * - Shows clear visual warnings about irreversibility
 * - Provides easy cancellation
 * - Uses red theme for critical action
 */
export const OrganizationDeleteConfirmationModal: React.FC<
  OrganizationDeleteConfirmationModalProps
> = ({
  organizationId,
  organizationName,
  isOpen,
  onClose,
  onConfirm,
  deleteDescendants = false,
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [preBox, setPreBox] = useState<DeletionPreBox | null>(null);
  const [loadingPreBox, setLoadingPreBox] = useState(false);
  const [preBoxError, setPreBoxError] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // Get user's 2FA status from store
  const user = useAuthStore(state => state.user);
  const has2FAEnabled = user?.twoFactorEnabled || false;

  // Check if confirmation text matches 'DELETE-' + organization name format
  const expectedConfirmation = `DELETE-${organizationName}`;
  const isConfirmationValid = confirmationText === expectedConfirmation;

  // Check if 2FA is valid (either not required or code is provided)
  const is2FAValid = !has2FAEnabled || twoFactorCode.length === 6;

  /**
   * Fetch deletion preBox when modal opens
   */
  useEffect(() => {
    if (isOpen && organizationId) {
      fetchDeletionPreBox();
    } else {
      // Reset state when modal closes
      setConfirmationText('');
      setPreBox(null);
      setPreBoxError(null);
    }
  }, [isOpen, organizationId, deleteDescendants]);

  /**
   * Fetch deletion preBox from API
   */
  const fetchDeletionPreBox = async () => {
    setLoadingPreBox(true);
    setPreBoxError(null);

    try {
      const response = await apiClient.get<{ success: boolean; data: DeletionPreBox }>(
        `/api/organizations/${organizationId}/deletion-preview`,
        { params: { deleteDescendants } }
      );

      const result = response.data;
      if (result.success && result.data) {
        setPreBox(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: unknown) {
      logger.error(
        'Error fetching deletion preBox:',
        error instanceof Error ? error : new Error(String(error))
      );
      const axiosErr = error as { response?: { data?: { error?: string } }; message?: string };
      setPreBoxError(
        axiosErr.response?.data?.error || axiosErr.message || 'Failed to load deletion preBox'
      );
    } finally {
      setLoadingPreBox(false);
    }
  };

  /**
   * Handle deletion confirmation
   */
  const handleConfirm = async () => {
    if (!isConfirmationValid || !is2FAValid) {
      return;
    }

    setIsDeleting(true);
    setTwoFactorError(null);

    try {
      // Execute with 2FA code if user has 2FA enabled
      await executeWith2FA(has2FAEnabled ? twoFactorCode : null, async () => await onConfirm());

      // Clear 2FA code after successful operation
      setTwoFactorCode('');

      // Parent component handles modal close after successful deletion
    } catch (error: unknown) {
      // Check if error is related to 2FA
      if (is2FAError(error)) {
        const twoFAErr = error as { response?: { data?: { error?: string } } };
        setTwoFactorError(twoFAErr.response?.data?.error || 'Invalid 2FA code. Please try again.');
      }
      // Error handling is done by parent component
      logger.error('Deletion failed:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!isDeleting) {
      setConfirmationText('');
      setTwoFactorCode('');
      setTwoFactorError(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="org-delete-title"
      role="alertdialog"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="org-delete-title">Delete Organization</DialogTitle>
      <DialogContent>
        <Stack direction="column" spacing={2}>
          {/* Warning Header */}
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <WarningAmber aria-label="Warning" fontSize="large" />
              <Typography>
                <strong>Warning: This action cannot be undone!</strong>
              </Typography>
            </Stack>
          </Box>

          {/* Loading PreBox */}
          {loadingPreBox && (
            <Stack direction="column" alignItems="center" spacing={2} sx={{ my: 2 }}>
              <CircularProgress aria-label="Loading deletion preBox..." size={40} />
              <Typography>Loading deletion impact...</Typography>
            </Stack>
          )}

          {/* PreBox Error */}
          {preBoxError && (
            <Box
              sx={{ p: 2, borderRadius: 2, bgcolor: 'error.light', color: 'error.contrastText' }}
            >
              <Typography>Error: {preBoxError}</Typography>
            </Box>
          )}

          {/* Deletion Impact PreBox */}
          {preBox && !loadingPreBox && (
            <Box sx={{ borderRadius: 1, p: 2 }}>
              <Typography variant="subtitle1">Deletion Impact</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack direction="column" spacing={1}>
                <Typography>
                  <strong>Organization:</strong> {preBox.organizationName}
                </Typography>
                <Typography>
                  <strong>Members:</strong> {preBox.memberCount.toLocaleString()} will lose access
                </Typography>
                <Typography>
                  <strong>Ships:</strong> {preBox.shipCount.toLocaleString()} will be removed
                </Typography>
                {preBox.willDeleteDescendants && preBox.descendantCount > 0 && (
                  <Typography sx={{ color: 'var(--spectrum-global-color-red-600)' }}>
                    <strong>Sub-organizations:</strong> {preBox.descendantCount} will also be
                    deleted
                  </Typography>
                )}
                <Typography>
                  <strong>Estimated data:</strong> {preBox.estimatedDataSize}
                </Typography>
              </Stack>
            </Box>
          )}

          {/* Deletion Workflow Explanation */}
          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Typography variant="subtitle1">Deletion Process</Typography>
            <Divider sx={{ my: 1 }} />
            <Stack direction="column" spacing={1}>
              <Typography>
                <strong>Step 1:</strong> Submit deletion request
              </Typography>
              <Typography>
                <strong>Step 2:</strong> Confirm via email (required)
              </Typography>
              <Typography>
                <strong>Step 3:</strong> Admin approval reBox
              </Typography>
              <Typography>
                <strong>Step 4:</strong> 30-day grace period begins
              </Typography>
              <Typography>
                <strong>Step 5:</strong> Permanent deletion after grace period
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography>
              <strong>Important:</strong> You will receive a confirmation email that must be
              verified before the request is submitted for admin approval.
            </Typography>
          </Box>

          <Box sx={{ mt: 1 }}>
            <Typography>
              After admin approval, you will have a <strong>30-day grace period</strong> to cancel
              the deletion if you change your mind.
            </Typography>
          </Box>

          {/* Type-to-Confirm */}
          <Box sx={{ mt: 2 }}>
            <TextField
              label={`Type "DELETE-${organizationName}" to confirm`}
              value={confirmationText}
              onChange={e => setConfirmationText(e.target.value)}
              disabled={isDeleting || loadingPreBox}
              autoFocus
              fullWidth
              error={Boolean(confirmationText && !isConfirmationValid)}
              helperText={
                confirmationText && !isConfirmationValid
                  ? `Confirmation text does not match. Must be exactly: DELETE-${organizationName}`
                  : 'Type the exact text shown above to confirm deletion'
              }
            />
          </Box>

          {/* Two-Factor Authentication */}
          <TwoFactorInput
            required={has2FAEnabled}
            value={twoFactorCode}
            onChange={setTwoFactorCode}
            disabled={isDeleting || loadingPreBox}
            errorMessage={twoFactorError || undefined}
          />

          {/* What Will Be Deleted */}
          <Box sx={{ borderRadius: 1, p: 2, mt: 2 }}>
            <Typography variant="subtitle1">What Will Be Deleted</Typography>
            <Divider sx={{ my: 1 }} />
            <Stack direction="column" spacing={1}>
              <Typography>• Organization profile and all settings</Typography>
              <Typography>• All members and their roles</Typography>
              <Typography>• All ships and fleet data</Typography>
              <Typography>• All activities and logs</Typography>
              <Typography>• All relationships with other organizations</Typography>
              {preBox?.willDeleteDescendants && preBox.descendantCount > 0 && (
                <Typography sx={{ color: 'var(--spectrum-global-color-red-600)' }}>
                  • All {preBox.descendantCount} sub-organization(s)
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Timeline */}
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.100', mt: 2 }}>
            <Typography>
              <strong>Timeline:</strong> After email confirmation and admin approval, you will have
              30 days to cancel. Data will be permanently deleted after the grace period expires.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={!isConfirmationValid || !is2FAValid || isDeleting || loadingPreBox}
        >
          {isDeleting ? 'Deleting...' : 'Delete Organization'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
