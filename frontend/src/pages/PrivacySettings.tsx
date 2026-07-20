/**
 * Privacy Settings Page
 *
 * User-facing page for managing GDPR consent preferences and data rights.
 * Provides options to:
 * - Box and manage consent preferences
 * - Download personal data (data portability)
 * - Request account deletion (right to be forgotten)
 */

import { ConsentVersionBadge } from '@/components/ConsentVersionBadge';
import { ConsentWithdrawalDialog, WithdrawalType } from '@/components/ConsentWithdrawalDialog';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { consentKeys } from '@/hooks/queries/queryKeys';
import { useRecordConsent, useUserConsents } from '@/hooks/queries/useConsentQueries';
import { usePrivacySettings, useUpdatePrivacySettings } from '@/hooks/queries/useUserQueries';
import { consentService, ConsentType, type Consent } from '@/services/consentService';
import { scstatsService } from '@/services/scstatsService';
import type { PrivacySettings as PrivacySettingsType } from '@/services/userProfileService';
import { selectIsAuthenticated, useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import {
    Warning as AlertIcon,
    BarChart as BarChartIcon,
    Delete,
    Download,
    Info,
    Lock as LockClosed,
    Person as PersonIcon,
    Refresh,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    FormControl,
    IconButton,
    MenuItem,
    Select,
    Stack,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';

interface ConsentDescription {
  type: ConsentType;
  title: string;
  description: string;
  required: boolean;
}

const CONSENT_DESCRIPTIONS: ConsentDescription[] = [
  {
    type: ConsentType.ESSENTIAL,
    title: 'Essential Services',
    description:
      'Required for core functionality including authentication, fleet management, and data storage. Cannot be disabled.',
    required: true,
  },
  {
    type: ConsentType.DATA_PROCESSING,
    title: 'Enhanced Data Processing',
    description:
      'Enables advanced features such as fleet analytics, ship value tracking, and personalized recommendations based on your hangar data.',
    required: false,
  },
  {
    type: ConsentType.ANALYTICS,
    title: 'Usage Analytics',
    description:
      'Collects anonymized usage data via Application Insights to help us identify performance issues and improve the application.',
    required: false,
  },
  {
    type: ConsentType.MARKETING,
    title: 'Feature Announcements',
    description:
      'Receive notifications about new features, ship database updates, and community events. No third-party marketing.',
    required: false,
  },
  {
    type: ConsentType.THIRD_PARTY,
    title: 'Third-Party Integrations',
    description:
      'Share data with connected services such as Discord (bot commands, role sync) and RSI account linking for enhanced features.',
    required: false,
  },
];

const PrivacySettings: React.FC = () => {
  const theme = useTheme();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const currentUser = useAuthStore(state => state.user);
  const queryClient = useQueryClient();
  const notification = useNotification();

  // React Query for consents
  const {
    data: consents = [],
    isLoading: loading,
    error: queryError,
    refetch: refetchConsents,
  } = useUserConsents();
  const recordConsentMutation = useRecordConsent();

  // React Query for public profile privacy settings
  const { data: privacySettings, isLoading: privacyLoading } = usePrivacySettings({
    enabled: isAuthenticated,
  });
  const updatePrivacyMutation = useUpdatePrivacySettings();

  const handlePrivacyToggle = async (key: keyof PrivacySettingsType, value: boolean | string) => {
    try {
      await updatePrivacyMutation.mutateAsync({ [key]: value });
      notification.success('Privacy setting updated');
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to update privacy setting');
    }
  };

  const [saving, setSaving] = useState<ConsentType | null>(null);
  const [error, setError] = useState<string | null>(
    queryError ? 'Failed to load consent preferences' : null
  );
  const [downloadingData, setDownloadingData] = useState(false);
  const [deletingSCStats, setDeletingSCStats] = useState(false);
  const [hasSCStatsData, setHasSCStatsData] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<WithdrawalType>('consent');
  const [selectedConsentType, setSelectedConsentType] = useState<ConsentType | undefined>();

  // Sync query error into local error state
  useEffect(() => {
    if (queryError) {
      setError(
        queryError instanceof Error ? queryError.message : 'Failed to load consent preferences'
      );
    }
  }, [queryError]);

  // Auto-record ESSENTIAL consent if not present in database
  // Essential is required and always on, but the DB record is needed for version tracking
  useEffect(() => {
    if (!isAuthenticated || loading || !consents) return;
    const hasEssential = consents.some(c => c.type === ConsentType.ESSENTIAL && c.granted);
    if (!hasEssential) {
      recordConsentMutation.mutate({ consentType: ConsentType.ESSENTIAL, granted: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when consents load
  }, [isAuthenticated, loading, consents]);

  // Silent refresh: invalidate query cache
  const refreshConsents = useCallback(async () => {
    if (!isAuthenticated) return;
    queryClient.invalidateQueries({ queryKey: consentKeys.all });
  }, [isAuthenticated, queryClient]);

  const fetchConsents = useCallback(async () => {
    refetchConsents();
  }, [refetchConsents]);

  // Check for SCStats data on mount
  useEffect(() => {
    if (currentUser?.id && isAuthenticated) {
      scstatsService
        .getData(currentUser.id)
        .then(scstats => setHasSCStatsData(scstats.hasData))
        .catch(() => {
          /* Non-critical */
        });
    }
  }, [currentUser?.id, isAuthenticated]);

  const handleDeleteSCStats = async () => {
    if (!currentUser?.id) {
      return;
    }
    try {
      setDeletingSCStats(true);
      setError(null);
      await scstatsService.deleteData(currentUser.id);
      setHasSCStatsData(false);
      notification.success('SCStats data deleted successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete SCStats data');
    } finally {
      setDeletingSCStats(false);
    }
  };

  const handleConsentToggle = async (consentType: ConsentType, currentValue: boolean) => {
    if (consentType === ConsentType.ESSENTIAL) return;

    // If turning off, show withdrawal dialog
    if (currentValue) {
      setSelectedConsentType(consentType);
      setDialogType('consent');
      setDialogOpen(true);
      return;
    }

    // If turning on, use mutation
    try {
      setSaving(consentType);
      setError(null);

      await recordConsentMutation.mutateAsync({ consentType, granted: true });
      notification.success('Consent preference updated successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update consent');
    } finally {
      setSaving(null);
    }
  };

  const handleDownloadData = async () => {
    try {
      setDownloadingData(true);
      setError(null);
      await consentService.downloadUserData();
      notification.success('Data export downloaded successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to download data');
    } finally {
      setDownloadingData(false);
    }
  };

  const handleDeleteAccount = () => {
    setDialogType('account');
    setSelectedConsentType(undefined);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedConsentType(undefined);
  };

  const handleDialogConfirm = () => {
    // Immediately update consent cache so the toggle flips without waiting for refetch
    if (selectedConsentType) {
      const key = consentKeys.lists();
      const cached = queryClient.getQueryData<Consent[]>(key);
      if (cached) {
        queryClient.setQueryData<Consent[]>(
          key,
          cached.map(c =>
            c.type === selectedConsentType
              ? { ...c, granted: false, updatedAt: new Date().toISOString() }
              : c
          )
        );
      }
    }
    // Also refetch from server to ensure consistency
    refreshConsents();
  };

  const getConsentValue = (type: ConsentType): boolean => {
    // Essential is always required and cannot be disabled
    if (type === ConsentType.ESSENTIAL) return true;
    const consent = consents.find(c => c.type === type);
    return consent?.granted ?? false;
  };

  const getConsentLastUpdated = (type: ConsentType): string | null => {
    const consent = consents.find(c => c.type === type);
    return consent?.updatedAt ?? null;
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.warning.main }}>
          <Typography>Please log in to manage your privacy settings.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: '800px', mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" gap={2} alignItems="center" sx={{ mb: 3 }}>
        <LockClosed fontSize="large" style={{ color: theme.palette.info.main }} />
        <Box flex={1}>
          <Typography variant="h2">Privacy Settings</Typography>
          <Typography sx={{ color: theme.palette.text.secondary }}>
            Manage your consent preferences and data rights
          </Typography>
        </Box>
        <Tooltip title="Refresh" arrow>
          <IconButton onClick={fetchConsents} disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Consent Version Status */}
      <Box sx={{ mb: 3 }}>
        <ConsentVersionBadge showDetails onConsentRenewed={fetchConsents} />
      </Box>

      {/* Messages */}
      {error && (
        <Box
          sx={{
            borderRadius: 1,
            p: 2,
            borderColor: theme.palette.error.main,
            marginBottom: '16px',
          }}
        >
          <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" gap={1} alignItems="center">
              <AlertIcon style={{ color: theme.palette.error.main }} />
              <Typography>{error}</Typography>
            </Stack>
            <Button variant="outlined" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </Stack>
        </Box>
      )}
      {/* GDPR Information */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 3, borderColor: theme.palette.info.main }}>
        <Stack direction="row" gap={1} alignItems="start">
          <Info style={{ color: theme.palette.info.main }} />
          <Typography>
            Under GDPR, you have the right to control how your personal data is processed. You can
            withdraw consent at any time. Withdrawing consent does not affect the lawfulness of
            processing based on consent before its withdrawal.
          </Typography>
        </Stack>
      </Box>

      {/* Consent Preferences */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>
          Consent Preferences
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {loading ? (
          <Stack justifyContent="center" alignItems="center" sx={{ height: 200 }}>
            <CircularProgress aria-label="Loading" size={40} />
          </Stack>
        ) : (
          <Stack direction="column" gap={2}>
            {CONSENT_DESCRIPTIONS.map((consent, index) => (
              <Box key={consent.type}>
                {index > 0 && <Divider sx={{ my: 2 }} />}
                <Stack direction="row" justifyContent="space-between" alignItems="start">
                  <Box flex={1}>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Typography sx={{ fontWeight: 'bold' }}>{consent.title}</Typography>
                      {consent.required && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            component="span"
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: 'info.main',
                              display: 'inline-block',
                            }}
                          />
                          Required
                        </Box>
                      )}
                    </Stack>
                    <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                      {consent.description}
                    </Typography>
                    {getConsentLastUpdated(consent.type) && (
                      <Typography sx={{ color: theme.palette.text.disabled, fontSize: '0.75rem' }}>
                        Last updated:{' '}
                        {new Date(getConsentLastUpdated(consent.type)!).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" gap={1} alignItems="center">
                    {saving === consent.type && <CircularProgress aria-label="Saving" size={20} />}
                    <Switch
                      checked={getConsentValue(consent.type)}
                      onChange={() =>
                        handleConsentToggle(consent.type, getConsentValue(consent.type))
                      }
                      disabled={consent.required || saving === consent.type}
                    />
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Public Profile Visibility */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
        <Stack direction="row" gap={2} alignItems="center" sx={{ mb: 2 }}>
          <PersonIcon style={{ color: theme.palette.primary.main }} />
          <Box flex={1}>
            <Typography variant="h3">Public Profile Visibility</Typography>
            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
              Control what others can see when they visit your profile
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        {privacyLoading ? (
          <Stack justifyContent="center" alignItems="center" sx={{ height: 100 }}>
            <CircularProgress size={32} />
          </Stack>
        ) : (
          <Stack direction="column" gap={1}>
            {/* Profile Visibility Level */}
            <Box sx={{ py: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box flex={1}>
                  <Typography sx={{ fontWeight: 'bold' }}>Profile Visibility</Typography>
                  <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                    Who can view your profile page
                  </Typography>
                </Box>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <Select
                    value={privacySettings?.profileVisibility ?? 'public'}
                    onChange={e => handlePrivacyToggle('profileVisibility', e.target.value)}
                    disabled={updatePrivacyMutation.isPending}
                  >
                    <MenuItem value="public">Everyone</MenuItem>
                    <MenuItem value="organization">Organization Only</MenuItem>
                    <MenuItem value="private">Private</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Divider />

            {/* About / Bio */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>About / Bio</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Show your bio text on your public profile
                </Typography>
              </Box>
              <Switch
                checked={privacySettings?.showBio ?? true}
                onChange={(_e, checked) => handlePrivacyToggle('showBio', checked)}
                disabled={updatePrivacyMutation.isPending}
              />
            </Stack>

            <Divider />

            {/* RSI Handle & Trust Score */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>RSI Handle & Trust Score</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Show your RSI handle and community trust score
                </Typography>
              </Box>
              <Switch
                checked={privacySettings?.showRsiInfo ?? true}
                onChange={(_e, checked) => handlePrivacyToggle('showRsiInfo', checked)}
                disabled={updatePrivacyMutation.isPending}
              />
            </Stack>

            <Divider />

            {/* Verified Badge */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>Verified Badge</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Display your RSI account verification badge
                </Typography>
              </Box>
              <Switch
                checked={privacySettings?.showVerifiedBadge ?? true}
                onChange={(_e, checked) => handlePrivacyToggle('showVerifiedBadge', checked)}
                disabled={updatePrivacyMutation.isPending}
              />
            </Stack>

            <Divider />

            {/* Organizations & Ranks */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>Organizations & Ranks</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Show your organization memberships and rank in each
                </Typography>
              </Box>
              <Switch
                checked={privacySettings?.showOrganizations ?? true}
                onChange={(_e, checked) => handlePrivacyToggle('showOrganizations', checked)}
                disabled={updatePrivacyMutation.isPending}
              />
            </Stack>

            <Divider />

            {/* Public Ships */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>Ships</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Show ships you have marked as public on your profile
                </Typography>
              </Box>
              <Switch
                checked={privacySettings?.showPublicShips ?? true}
                onChange={(_e, checked) => handlePrivacyToggle('showPublicShips', checked)}
                disabled={updatePrivacyMutation.isPending}
              />
            </Stack>

            <Divider />

            {/* SCStats */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>SCStats Gameplay Metrics</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Show your imported gameplay statistics on your profile
                </Typography>
              </Box>
              <Switch
                checked={privacySettings?.showScStats ?? false}
                onChange={(_e, checked) => handlePrivacyToggle('showScStats', checked)}
                disabled={updatePrivacyMutation.isPending}
              />
            </Stack>

            <Divider />

            {/* Activity History */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>Activity History</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Show your recent activity on your profile
                </Typography>
              </Box>
              <Switch
                checked={privacySettings?.showActivity ?? true}
                onChange={(_e, checked) => handlePrivacyToggle('showActivity', checked)}
                disabled={updatePrivacyMutation.isPending}
              />
            </Stack>
          </Stack>
        )}

        <Box sx={{ borderRadius: 1, p: 1.5, mt: 2, bgcolor: 'action.hover' }}>
          <Stack direction="row" gap={1} alignItems="center">
            <VisibilityIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
            <Typography variant="caption" color="text.secondary">
              These settings control what other users see on your public profile. Your own view
              always shows all data.
            </Typography>
          </Stack>
        </Box>
      </Box>

      {/* Data Rights */}
      <Box sx={{ borderRadius: 1, p: 2, mb: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>
          Your Data Rights
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ borderRadius: 1, p: 2, mb: 2 }}>
          <Stack direction="row" gap={2} alignItems="center">
            <Download fontSize="large" style={{ color: theme.palette.info.main }} />
            <Box flex={1}>
              <Typography sx={{ fontWeight: 'bold' }}>Download Your Data</Typography>
              <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                Export all your personal data in a portable JSON format.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={handleDownloadData} disabled={downloadingData}>
              {downloadingData ? (
                <CircularProgress aria-label="Downloading" size={20} />
              ) : (
                <>
                  <Download />
                  <Typography>Download</Typography>
                </>
              )}
            </Button>
          </Stack>
        </Box>

        {hasSCStatsData && (
          <Box sx={{ borderRadius: 1, p: 2, mb: 2, borderColor: theme.palette.warning.main }}>
            <Stack direction="row" gap={2} alignItems="center">
              <BarChartIcon fontSize="large" style={{ color: theme.palette.warning.main }} />
              <Box flex={1}>
                <Typography sx={{ fontWeight: 'bold' }}>Delete SCStats Data</Typography>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  Remove all imported SCStats gameplay metrics from your profile. Your verification
                  badge will also be removed.
                </Typography>
              </Box>
              <Button variant="outlined" onClick={handleDeleteSCStats} disabled={deletingSCStats}>
                {deletingSCStats ? (
                  <CircularProgress aria-label="Deleting SCStats" size={20} />
                ) : (
                  <>
                    <Delete />
                    <Typography>Delete</Typography>
                  </>
                )}
              </Button>
            </Stack>
          </Box>
        )}

        <Box sx={{ borderRadius: 1, p: 2, borderColor: theme.palette.error.main }}>
          <Stack direction="row" gap={2} alignItems="center">
            <Delete fontSize="large" style={{ color: theme.palette.error.main }} />
            <Box flex={1}>
              <Typography sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
                Delete Your Account
              </Typography>
              <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                Permanently delete your account and all associated data. This action cannot be
                undone.
              </Typography>
            </Box>
            <Button variant="contained" color="error" onClick={handleDeleteAccount}>
              <Delete />
              <Typography>Delete Account</Typography>
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Information */}
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="row" gap={1} alignItems="start">
          <Info style={{ color: theme.palette.info.main }} />
          <Box>
            <Typography variant="h4">About Your Privacy</Typography>
            <Typography sx={{ color: theme.palette.text.secondary, marginBottom: '8px' }}>
              We take your privacy seriously. Your data is encrypted at rest and in transit. We
              never sell your personal information to third parties.
            </Typography>
            <Typography sx={{ color: theme.palette.text.secondary }}>
              For more information, please reBox our Privacy Policy or contact our Data Protection
              Officer at privacy@fringecore.space.
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Withdrawal Dialog */}
      <ConsentWithdrawalDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        withdrawalType={dialogType}
        consentType={selectedConsentType}
        onConfirm={handleDialogConfirm}
      />
    </Box>
  );
};

export const PrivacySettingsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Privacy Settings"
    fallbackMessage="Unable to load privacy settings. Please try again later."
    showHomeButton={true}
  >
    <PrivacySettings />
  </FeatureErrorBoundary>
);
