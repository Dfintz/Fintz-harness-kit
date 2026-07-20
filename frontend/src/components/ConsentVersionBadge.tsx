/**
 * Consent Version Badge Component
 *
 * Displays the current consent version status and shows a renewal prompt
 * when the user needs to re-consent to updated terms.
 */

import {
  Warning as Alert,
  CheckCircle as Checkmark,
  Close,
  Description as FileTemplate,
  Info,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Alert as MuiAlert,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';

import { useConsentVersion } from '@/hooks/queries/useConsentQueries';
import { consentService, ConsentType } from '@/services/consentService';

interface ConsentVersionBadgeProps {
  /** Whether to show detailed version information */
  showDetails?: boolean;
  /** Consent type to check (defaults to ESSENTIAL) */
  consentType?: ConsentType;
  /** Callback when consent is renewed */
  onConsentRenewed?: () => void;
}

export const ConsentVersionBadge: React.FC<ConsentVersionBadgeProps> = ({
  showDetails = false,
  consentType = ConsentType.ESSENTIAL,
  onConsentRenewed,
}) => {
  const theme = useTheme();
  const {
    data: versionStatus,
    isLoading: loading,
    error: queryError,
    refetch: refetchVersion,
  } = useConsentVersion(consentType);
  const [showAlert, setShowAlert] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRenewConsent = async () => {
    try {
      setRenewing(true);
      setError(null);

      await consentService.recordConsent(
        consentType,
        true,
        undefined,
        versionStatus?.currentVersion
      );
      await refetchVersion();

      setShowAlert(false);
      setShowDialog(false);
      onConsentRenewed?.();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to renew consent';
      setError(errorMessage);
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={20} aria-label="Checking version" />
        <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
          Checking policy version...
        </Typography>
      </Stack>
    );
  }

  if (queryError || error) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'error.main',
            display: 'inline-block',
          }}
        />
        Version check failed
      </Box>
    );
  }

  if (!versionStatus) {
    return null;
  }

  const getStatusVariant = (): 'positive' | 'notice' | 'negative' => {
    if (!versionStatus.hasConsent) return 'negative';
    if (versionStatus.requiresRenewal) return 'notice';
    return 'positive';
  };

  const statusColorMap: Record<string, string> = {
    positive: 'success.main',
    notice: 'warning.main',
    negative: 'error.main',
  };

  const getStatusLabel = () => {
    if (!versionStatus.hasConsent) return 'No Consent';
    if (versionStatus.requiresRenewal) return 'Update Required';
    return 'Up to Date';
  };

  return (
    <>
      {/* Version Badge */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip
          title={versionStatus.requiresRenewal ? 'Click to review policy updates' : ''}
          arrow
        >
          <IconButton
            onClick={versionStatus.requiresRenewal ? () => setShowDialog(true) : undefined}
            sx={{ cursor: versionStatus.requiresRenewal ? 'pointer' : 'default', borderRadius: 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: statusColorMap[getStatusVariant()],
                  display: 'inline-block',
                }}
              />
              {getStatusLabel()}
            </Box>
          </IconButton>
        </Tooltip>

        {showDetails && (
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
            v{versionStatus.currentVersion}
          </Typography>
        )}
      </Stack>

      {/* Renewal Alert */}
      {showAlert && versionStatus.requiresRenewal && (
        <Box
          sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.warning.main, marginTop: '16px' }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="start">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Alert sx={{ color: theme.palette.warning.main }} />
                <Typography sx={{ fontWeight: 'bold' }}>Policy Update Required</Typography>
              </Stack>
              <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                Our terms have been updated to version {versionStatus.currentVersion}. Please review
                and accept the updated terms to continue using all features.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setShowDialog(true)}>
                Review
              </Button>
              <Tooltip title="Dismiss alert" arrow>
                <IconButton onClick={() => setShowAlert(false)}>
                  <Close />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Renewal Dialog */}
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <FileTemplate sx={{ color: theme.palette.primary.main }} />
            Policy Update
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ mb: 2 }}>
              We have updated our privacy policy and terms of service. Please review the key changes
              below and confirm your consent to continue.
            </Typography>

            <Box
              sx={{
                borderRadius: 1,
                p: 2,
                borderColor: theme.palette.primary.main,
                marginBottom: '16px',
              }}
            >
              <Stack direction="row" justifyContent="space-between">
                <Typography>
                  <strong>Your version:</strong> {versionStatus.consentedVersion || 'None'}
                </Typography>
                <Typography>
                  <strong>Current version:</strong> {versionStatus.currentVersion}
                </Typography>
              </Stack>
            </Box>
          </Box>

          <Typography sx={{ fontWeight: 'bold', marginBottom: '8px' }}>Key Updates:</Typography>
          <Stack direction="column" spacing={1} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Info sx={{ color: theme.palette.primary.main }} fontSize="small" />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>Data Processing</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Clarified how we process your fleet and trading data
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Info sx={{ color: theme.palette.primary.main }} fontSize="small" />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>Third-Party Services</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Updated Discord integration privacy details
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Info sx={{ color: theme.palette.primary.main }} fontSize="small" />
              <Box>
                <Typography sx={{ fontWeight: 'bold' }}>Data Retention</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Enhanced data retention and deletion policies
                </Typography>
              </Box>
            </Stack>
          </Stack>

          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
            By clicking "Accept & Continue", you agree to our updated terms and confirm that you
            have read and understood the changes.
          </Typography>

          {error && (
            <MuiAlert severity="error" sx={{ marginTop: 2 }}>
              {error}
            </MuiAlert>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowDialog(false)} disabled={renewing}>
            Review Later
          </Button>
          <Button
            variant="contained"
            onClick={handleRenewConsent}
            disabled={renewing}
            startIcon={renewing ? <CircularProgress size={20} /> : <Checkmark />}
          >
            Accept & Continue
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
