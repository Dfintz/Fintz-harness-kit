/**
 * Consent Withdrawal Dialog Component
 *
 * Provides a confirmation flow for users to withdraw consent or delete their account.
 * Implements GDPR requirements for clear consent withdrawal with proper confirmation.
 */

import { consentService, ConsentType } from '@/services/consentService';
import CheckmarkIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import AlertIcon from '@mui/icons-material/Warning';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

export type WithdrawalType = 'consent' | 'account';

interface ConsentWithdrawalDialogProps {
  open: boolean;
  onClose: () => void;
  withdrawalType: WithdrawalType;
  consentType?: ConsentType;
  onConfirm?: () => void;
}

const steps = ['Information', 'Confirmation', 'Complete'];

/**
 * ConsentWithdrawalDialog - Confirmation dialog for consent withdrawal
 */
export const ConsentWithdrawalDialog: React.FC<ConsentWithdrawalDialogProps> = ({
  open,
  onClose,
  withdrawalType,
  consentType,
  onConfirm,
}) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [downloadedData, setDownloadedData] = useState(false);
  const [immediateDelete, setImmediateDelete] = useState(false);

  const isAccountDeletion = withdrawalType === 'account';
  const confirmationWord = isAccountDeletion ? 'DELETE' : 'WITHDRAW';
  const isConfirmValid = confirmText === confirmationWord && understood;

  const handleClose = useCallback(() => {
    setActiveStep(0);
    setConfirmText('');
    setError(null);
    setUnderstood(false);
    setDownloadedData(false);
    setImmediateDelete(false);
    onClose();
  }, [onClose]);

  const handleDownloadData = async () => {
    try {
      setLoading(true);
      await consentService.downloadUserData();
      setDownloadedData(true);
    } catch (err) {
      setError('Failed to download data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  const handleConfirm = async () => {
    if (!isConfirmValid) return;

    setLoading(true);
    setError(null);

    try {
      if (isAccountDeletion) {
        await consentService.requestAccountDeletion(immediateDelete);
      } else if (consentType) {
        await consentService.withdrawConsent(consentType);
      } else {
        await consentService.withdrawAllConsents();
      }

      setActiveStep(2); // Move to completion step
      onConfirm?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
      {steps.map((label, index) => (
        <Stack key={label} direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor:
                index <= activeStep ? theme.palette.primary.main : theme.palette.action.disabled,
              display: 'Stack',
              alignItems: 'center',
              justifyContent: 'center',
              color:
                index <= activeStep ? theme.palette.common.black : theme.palette.text.secondary,
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}
          >
            {index < activeStep ? '✓' : index + 1}
          </Box>
          <Typography
            sx={{
              color:
                index <= activeStep ? theme.palette.common.white : theme.palette.text.secondary,
              fontSize: '0.875rem',
            }}
          >
            {label}
          </Typography>
          {index < steps.length - 1 && (
            <Box
              sx={{
                width: '40px',
                height: '2px',
                backgroundColor:
                  index < activeStep ? theme.palette.primary.main : theme.palette.action.disabled,
              }}
            />
          )}
        </Stack>
      ))}
    </Stack>
  );

  const renderInfoStep = () => (
    <Box>
      {isAccountDeletion ? (
        <>
          <Box
            sx={{
              borderRadius: 1,
              p: 2,
              borderColor: theme.palette.warning.main,
              marginBottom: '16px',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <AlertIcon sx={{ color: theme.palette.warning.main }} />
              <Typography>
                <strong>Warning:</strong> Account deletion is permanent and cannot be undone.
              </Typography>
            </Stack>
          </Box>

          <Typography sx={{ mb: 2 }}>
            Before proceeding, please understand what will happen:
          </Typography>

          <Stack direction="column" spacing={1} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <DeleteIcon sx={{ color: theme.palette.error.main }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>
                  All your personal data will be deleted
                </Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Including profile, ships, activities, and preferences
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <DeleteIcon sx={{ color: theme.palette.error.main }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>
                  Organization memberships will be removed
                </Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  You will no longer have access to any organizations
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <DeleteIcon sx={{ color: theme.palette.error.main }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>All consents will be revoked</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Your consent history will be preserved for legal compliance
                </Typography>
              </Box>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography sx={{ color: theme.palette.text.secondary, marginBottom: '8px' }}>
            We recommend downloading your data before deletion:
          </Typography>

          <Button
            variant="outlined"
            onClick={handleDownloadData}
            disabled={loading}
            startIcon={
              loading ? (
                <CircularProgress size={20} />
              ) : downloadedData ? (
                <CheckmarkIcon />
              ) : (
                <DownloadIcon />
              )
            }
          >
            {downloadedData ? 'Downloaded ✓' : 'Download My Data'}
          </Button>
        </>
      ) : (
        <>
          <Box
            sx={{
              borderRadius: 1,
              p: 2,
              borderColor: theme.palette.primary.main,
              marginBottom: '16px',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <InfoIcon sx={{ color: theme.palette.primary.main }} />
              <Typography>
                You have the right to withdraw consent at any time under GDPR.
              </Typography>
            </Stack>
          </Box>

          <Typography sx={{ mb: 2 }}>
            {consentType
              ? `You are withdrawing consent for: ${consentType.replace('_', ' ').toUpperCase()}`
              : 'You are withdrawing all optional consents.'}
          </Typography>

          <Stack direction="column" spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <InfoIcon sx={{ color: theme.palette.primary.main }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>What this means</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  We will stop processing your data for the purposes you're withdrawing consent for.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <InfoIcon sx={{ color: theme.palette.primary.main }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>Essential services remain</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Core functionality required for the service will continue to work.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <InfoIcon sx={{ color: theme.palette.primary.main }} />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>You can re-consent later</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  You can always grant consent again in your privacy settings.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </>
      )}
    </Box>
  );

  const renderConfirmStep = () => (
    <Box>
      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          borderColor: theme.palette.warning.main,
          marginBottom: '16px',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AlertIcon sx={{ color: theme.palette.warning.main }} />
          <Typography>
            Please confirm your action by typing <strong>{confirmationWord}</strong> below.
          </Typography>
        </Stack>
      </Box>

      <FormControlLabel
        control={<Checkbox checked={understood} onChange={e => setUnderstood(e.target.checked)} />}
        label={
          isAccountDeletion
            ? 'I understand that this action is permanent and cannot be undone'
            : 'I understand that withdrawing consent will affect the specified features'
        }
        sx={{ mb: 2 }}
      />

      {isAccountDeletion && (
        <FormControlLabel
          control={
            <Checkbox
              checked={immediateDelete}
              onChange={e => setImmediateDelete(e.target.checked)}
            />
          }
          label="Delete immediately (otherwise 30-day grace period applies)"
          sx={{ mb: 2 }}
        />
      )}

      <TextField
        label={`Type "${confirmationWord}" to confirm`}
        value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
        error={confirmText.length > 0 && confirmText !== confirmationWord}
        helperText={
          confirmText.length > 0 && confirmText !== confirmationWord
            ? `Please type exactly "${confirmationWord}"`
            : undefined
        }
        fullWidth
        sx={{ mb: 2 }}
      />

      {error && (
        <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.error.main }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AlertIcon sx={{ color: theme.palette.error.main }} />
            <Typography>{error}</Typography>
          </Stack>
        </Box>
      )}
    </Box>
  );

  const renderCompleteStep = () => (
    <Box sx={{ textAlign: 'center' }}>
      <CheckmarkIcon
        sx={{ fontSize: 64, color: theme.palette.success.main, marginBottom: '16px' }}
      />

      <Typography variant="h6" sx={{ mb: 2 }}>
        {isAccountDeletion
          ? immediateDelete
            ? 'Account Deleted Successfully'
            : 'Account Deletion Scheduled'
          : 'Consent Withdrawn Successfully'}
      </Typography>

      <Typography sx={{ color: theme.palette.text.secondary }}>
        {isAccountDeletion
          ? immediateDelete
            ? 'Your account and all associated data have been permanently deleted.'
            : 'Your account will be deleted within 30 days. You can cancel this during the grace period.'
          : 'Your consent preferences have been updated. Changes take effect immediately.'}
      </Typography>
    </Box>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderInfoStep();
      case 1:
        return renderConfirmStep();
      case 2:
        return renderCompleteStep();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <AlertIcon sx={{ color: theme.palette.warning.main }} />
          {isAccountDeletion ? 'Delete Account' : 'Withdraw Consent'}
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent>
        {renderStepIndicator()}
        {renderStepContent()}
      </DialogContent>
      <DialogActions>
        {activeStep === 2 ? (
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="outlined" onClick={handleClose}>
              Cancel
            </Button>

            {activeStep > 0 && (
              <Button variant="outlined" onClick={handleBack}>
                Back
              </Button>
            )}

            {activeStep === 0 && (
              <Button variant="contained" onClick={handleNext}>
                Continue
              </Button>
            )}

            {activeStep === 1 && (
              <Button
                variant="contained"
                color="error"
                onClick={handleConfirm}
                disabled={!isConfirmValid || loading}
                startIcon={loading ? <CircularProgress size={20} /> : <DeleteIcon />}
              >
                Confirm
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
