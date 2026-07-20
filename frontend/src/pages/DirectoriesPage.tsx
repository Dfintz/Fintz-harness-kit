import { CommunityMembersPanel } from '@/components/directories/CommunityMembersPanel';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import {
  ButtonGroup,
  Content,
  TypographyArea,
  TypographyField,
} from '@/components/ui/SpectrumCompat';
import { organizationKeys, publicDirectoryKeys } from '@/hooks/queries/queryKeys';
import { useLeaveOrganization } from '@/hooks/queries/useOrganizationQueries';
import { ApiClientError } from '@/services/apiClient';
import { organizationServiceV2 as organizationService } from '@/services/organizationServiceV2';
import { publicFederationService } from '@/services/publicDirectoryService';
import { rsiVerificationService } from '@/services/rsiVerificationService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { retryLazy } from '@/utils/retryLazy';
import { isOwnerOrFounderRole } from '@/utils/roleUtils';
import {
  Add,
  CheckCircle as CheckmarkCircle,
  ErrorOutline,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { Suspense, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

const PublicStatsPage = retryLazy(() =>
  import('@/pages/PublicStatsPage').then(m => ({ default: m.PublicStatsPage }))
);
const OpportunitiesView = retryLazy(() =>
  import('@/pages/UnifiedPublicDirectoriesPage').then(m => ({ default: m.OpportunitiesPanel }))
);
const OrganizationsDirectoryPanel = retryLazy(() =>
  import('@/pages/UnifiedPublicDirectoriesPage').then(m => ({ default: m.OrganizationsPanel }))
);
const AlliancesDirectoryPanel = retryLazy(() =>
  import('@/pages/UnifiedPublicDirectoriesPage').then(m => ({ default: m.AlliancesPanel }))
);

/** Extract a user-facing error message from an API error, avoiding nested ternaries. */
function extractApiErrorMessage(err: unknown, defaultMessage: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as Record<string, unknown>).response as
      | Record<string, unknown>
      | undefined;
    const data = response?.data as
      | { message?: string; error?: string; errors?: Array<{ field?: string; message?: string }> }
      | undefined;
    // If backend returned validation errors array, join their messages
    if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return (
        data.errors
          .map(e => e.message)
          .filter(Boolean)
          .join('. ') || defaultMessage
      );
    }
    return data?.message || data?.error || defaultMessage;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return defaultMessage;
}

const DirectoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  // Determine which view to show based on URL param
  type ViewMode = 'organizations' | 'alliances' | 'opportunities' | 'stats' | 'members';
  const viewMode: ViewMode = (searchParams.get('tab') as ViewMode) || 'organizations';

  const viewTitles: Record<ViewMode, string> = {
    organizations: 'Organizations',
    alliances: 'Alliances',
    opportunities: 'Jobs & Opportunities',
    stats: 'Platform Stats',
    members: 'Community Members',
  };
  const viewDescriptions: Record<ViewMode, string> = {
    organizations: 'Browse public organizations and manage your own.',
    alliances: 'Explore publicly listed alliances.',
    opportunities: 'Discover jobs, services, and activities across organizations.',
    stats: 'View live platform-wide statistics.',
    members: 'Browse community members with public profiles.',
  };

  const userId = user?.id;
  const activeOrgId = user?.activeOrgId;

  // Organizations query — user's own orgs (full data for the org tab)
  const {
    data: organizationsRaw,
    isLoading: orgLoading,
    error: orgQueryError,
    refetch: refetchOrganizations,
  } = useQuery({
    queryKey: [...organizationKeys.all, 'my'],
    queryFn: () => organizationService.getMyOrganizations(),
    enabled: !!userId && viewMode === 'organizations',
  });

  const organizations = Array.isArray(organizationsRaw) ? organizationsRaw : [];
  const orgError = (() => {
    if (!orgQueryError) return null;
    if (
      orgQueryError instanceof ApiClientError &&
      (orgQueryError.statusCode === 401 || orgQueryError.statusCode === 403)
    )
      return null;
    return 'Failed to load your organizations. Please try again.';
  })();

  // Alliances query removed — now uses AlliancesDirectoryPanel

  // Create org modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createOrgForm, setCreateOrgForm] = useState({
    name: '',
    tag: '',
    description: '',
    rsiOrgSid: '',
  });
  // Removed unused state: creatingOrg, setCreatingOrg
  const [verifyingRsiOrg, setVerifyingRsiOrg] = useState(false);
  const [rsiOrgVerified, setRsiOrgVerified] = useState(false);
  const [rsiOrgError, setRsiOrgError] = useState<string | null>(null);
  const [rsiVerificationCode, setRsiVerificationCode] = useState<string>('');
  const [rsiVerificationUrl, setRsiVerificationUrl] = useState<string>('');
  const [showVerificationInstructions, setShowVerificationInstructions] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<'code' | 'rank'>('rank');

  // Create alliance dialog state
  const [isCreateAllianceOpen, setIsCreateAllianceOpen] = useState(false);
  const [createAllianceForm, setCreateAllianceForm] = useState({
    name: '',
    description: '',
    isPublic: false,
  });
  const [creatingAlliance, setCreatingAlliance] = useState(false);
  const [createAllianceError, setCreateAllianceError] = useState<string | null>(null);

  const isRsiVerified = useMemo(() => {
    return !!user?.rsiVerified;
  }, [user]);
  const isOrgLeader = useMemo(() => {
    if (!user) return false;
    return (
      user.role === 'admin' ||
      user.orgRole === 'owner' ||
      user.orgRole === 'admin' ||
      user.orgRole === 'founder' ||
      user.permissions?.includes('org.manage')
    );
  }, [user]);

  const fetchOrganizations = () => refetchOrganizations();

  // Leave organization
  const leaveOrganization = useLeaveOrganization();
  const {
    openDialog: openLeaveDialog,
    closeDialog: closeLeaveDialog,
    pendingData: leaveOrgId,
    dialogProps: leaveDialogProps,
  } = useConfirmDialog<string>();

  const handleLeaveOrganization = async () => {
    if (!leaveOrgId) return;
    try {
      await leaveOrganization.mutateAsync(leaveOrgId);
      closeLeaveDialog();
      refetchOrganizations();
    } catch (err) {
      logger.error(
        'Failed to leave organization',
        err instanceof Error ? err : new Error(String(err))
      );
      closeLeaveDialog();
    }
  };

  const handleCreateAlliance = async () => {
    if (!createAllianceForm.name.trim()) {
      setCreateAllianceError('Alliance name is required');
      return;
    }
    if (createAllianceForm.description.trim().length < 10) {
      setCreateAllianceError('Description must be at least 10 characters');
      return;
    }
    setCreatingAlliance(true);
    setCreateAllianceError(null);
    try {
      await publicFederationService.createFederation({
        name: createAllianceForm.name.trim(),
        description: createAllianceForm.description.trim(),
        isPublic: createAllianceForm.isPublic,
      });
      setIsCreateAllianceOpen(false);
      setCreateAllianceForm({ name: '', description: '', isPublic: false });
      queryClient.invalidateQueries({ queryKey: publicDirectoryKeys.federations() });
      // Navigate to the federation hub — it auto-redirects to manage if only one alliance
      navigate('/federation');
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Failed to create alliance');
      setCreateAllianceError(message);
    } finally {
      setCreatingAlliance(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
    setRsiOrgVerified(false);
    setRsiOrgError(null);
    setRsiVerificationCode('');
    setRsiVerificationUrl('');
    setShowVerificationInstructions(false);
    setPendingOrgId(null);
    setCreateOrgForm({ name: '', tag: '', description: '', rsiOrgSid: '' });
    setVerificationMethod('rank');
  };

  const handleGenerateVerificationCode = async () => {
    if (!createOrgForm.rsiOrgSid.trim()) {
      setRsiOrgError('Please enter an RSI organization SID');
      return;
    }

    if (!createOrgForm.name.trim()) {
      setRsiOrgError('Please enter an organization name');
      return;
    }

    setIsGeneratingCode(true);
    setRsiOrgError(null);
    try {
      // First, create the organization
      const newOrg = await organizationService.createOrganization({
        name: createOrgForm.name.trim(),
        description: createOrgForm.description.trim() || undefined,
      });

      setPendingOrgId(newOrg.id);

      // Then initiate verification
      const payload = await rsiVerificationService.initiateOrganizationVerification(
        newOrg.id,
        createOrgForm.rsiOrgSid.trim()
      );
      setRsiVerificationCode(payload.verificationCode ?? '');
      setRsiVerificationUrl(payload.verificationUrl ?? payload.verificationCode ?? '');
      setShowVerificationInstructions(true);
      setRsiOrgError(null);
    } catch (err: unknown) {
      logger.error(
        'Failed to generate verification link',
        err,
        new Error('Failed to generate verification link')
      );
      const errorMessage = extractApiErrorMessage(
        err,
        'Failed to generate verification link. Please check the SID and try again.'
      );
      setRsiOrgError(errorMessage);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleVerifyRsiOrg = async () => {
    if (!pendingOrgId) {
      setRsiOrgError('No pending organization verification found');
      return;
    }

    if (!rsiVerificationCode) {
      setRsiOrgError('Please generate a verification link first');
      return;
    }

    setVerifyingRsiOrg(true);
    setRsiOrgError(null);
    try {
      const data = await rsiVerificationService.completeOrganizationVerification(pendingOrgId);
      if (data.verified) {
        setRsiOrgVerified(true);
        setShowVerificationInstructions(false);
        setRsiOrgError(null);
        // Close modal and refresh list
        setTimeout(() => {
          setIsCreateModalOpen(false);
          refetchOrganizations();
        }, 1500);
      } else {
        setRsiOrgError(
          'Verification link not found on your RSI organization page. Please make sure you added it correctly and saved.'
        );
      }
    } catch (err: unknown) {
      logger.error(
        'Failed to verify RSI organization',
        err,
        new Error('Failed to verify RSI organization')
      );
      const errorMessage = extractApiErrorMessage(
        err,
        'Failed to verify RSI organization. Make sure the link is on your RSI organization page.'
      );
      setRsiOrgError(errorMessage);
      setRsiOrgVerified(false);
    } finally {
      setVerifyingRsiOrg(false);
    }
  };

  const handleVerifyRsiOrgByRank = async () => {
    if (!createOrgForm.rsiOrgSid.trim()) {
      setRsiOrgError('Please enter an RSI organization SID');
      return;
    }
    if (!createOrgForm.name.trim()) {
      setRsiOrgError('Please enter an organization name');
      return;
    }

    setVerifyingRsiOrg(true);
    setRsiOrgError(null);
    try {
      // Create the organization first if not yet created
      let orgId = pendingOrgId;
      if (!orgId) {
        const newOrg = await organizationService.createOrganization({
          name: createOrgForm.name.trim(),
          description: createOrgForm.description.trim() || undefined,
        });
        orgId = newOrg.id;
        setPendingOrgId(orgId);
      }

      const data = await rsiVerificationService.verifyOrganizationByRank(
        orgId,
        createOrgForm.rsiOrgSid.trim()
      );
      if (data.verified) {
        setRsiOrgVerified(true);
        setRsiOrgError(null);
        setTimeout(() => {
          setIsCreateModalOpen(false);
          refetchOrganizations();
        }, 1500);
      } else {
        setRsiOrgError(
          'Rank-based verification failed. Your RSI rank may not be high enough. Try the verification link method instead.'
        );
      }
    } catch (err: unknown) {
      logger.error(
        'Failed to verify RSI organization by rank',
        err,
        new Error('Failed to verify RSI organization by rank')
      );
      const errorMessage = extractApiErrorMessage(
        err,
        'Rank-based verification failed. Make sure you have a 5-star rank, Founder, or Officer role on the RSI organization.'
      );
      setRsiOrgError(errorMessage);
      setRsiOrgVerified(false);
    } finally {
      setVerifyingRsiOrg(false);
    }
  };

  // Removed unused function: handleCreateOrganization
  // Organization creation now happens in handleGenerateVerificationCode

  const renderOrganizations = () => {
    if (orgLoading) {
      return <LoadingSpinner message="Loading organizations..." />;
    }

    if (orgError) {
      return <ErrorMessage message={orgError} onDismiss={() => refetchOrganizations()} />;
    }

    return (
      <Stack direction="column" gap={3}>
        {/* User's own organizations */}
        {organizations.length > 0 && (
          <>
            <Typography variant="h6">My Organizations</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {organizations.map(org => (
                <Box
                  key={org.id}
                  sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                >
                  <Stack direction="column" gap={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="column" gap={0.5}>
                        <Typography>
                          <strong>{org.name}</strong>
                        </Typography>
                        {org.userRole && (
                          <Typography variant="caption" color="text.secondary">
                            {org.userRole.charAt(0).toUpperCase() + org.userRole.slice(1)}
                          </Typography>
                        )}
                        {org.id === activeOrgId && (
                          <Typography sx={{ color: 'var(--accent-blue)' }}>Active</Typography>
                        )}
                      </Stack>
                      <Stack direction="row" gap={1}>
                        {!isOwnerOrFounderRole(org.userRole) && (
                          <Button variant="outline" onClick={() => openLeaveDialog(org.id)}>
                            Leave
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => navigate(`/organizations`)}>
                          Manage
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* Public organizations directory */}
        <Typography variant="h6">Public Organizations</Typography>
        <Suspense fallback={<CircularProgress />}>
          <OrganizationsDirectoryPanel />
        </Suspense>
      </Stack>
    );
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="column" gap={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
          <Stack direction="column" gap={1}>
            <Typography variant="h1">{viewTitles[viewMode]}</Typography>
            <Typography>{viewDescriptions[viewMode]}</Typography>
          </Stack>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
            {viewMode === 'organizations' && (
              <>
                <Button variant="primary" onClick={handleOpenCreateModal}>
                  <Add />
                  <Typography>Add New</Typography>
                </Button>
                <IconButton onClick={fetchOrganizations} aria-label="Refresh">
                  <RefreshIcon />
                </IconButton>
              </>
            )}
            {viewMode === 'alliances' && isOrgLeader && (
              <Button variant="primary" onClick={() => setIsCreateAllianceOpen(true)}>
                <Add />
                <Typography>Create Alliance</Typography>
              </Button>
            )}
          </Stack>
        </Stack>

        {viewMode === 'organizations' && (
          <Stack direction="column" gap={2}>
            <Divider />
            {renderOrganizations()}
          </Stack>
        )}

        {viewMode === 'alliances' && (
          <Stack direction="column" gap={2}>
            <Divider />
            <Suspense fallback={<CircularProgress />}>
              <AlliancesDirectoryPanel />
            </Suspense>
          </Stack>
        )}

        {viewMode === 'opportunities' && (
          <Suspense fallback={<CircularProgress />}>
            <OpportunitiesView />
          </Suspense>
        )}

        {viewMode === 'stats' && (
          <Suspense fallback={<CircularProgress />}>
            <PublicStatsPage />
          </Suspense>
        )}

        {viewMode === 'members' && (
          <Suspense fallback={<CircularProgress />}>
            <CommunityMembersPanel />
          </Suspense>
        )}
      </Stack>

      {/* Create Organization Modal */}
      {isCreateModalOpen && (
        <Dialog open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
          <Typography>Create New Organization</Typography>
          <Divider />
          <Content>
            <Stack direction="column" gap={2}>
              {!isRsiVerified && (
                <Box sx={{ p: 1.5, backgroundColor: 'error.main', borderRadius: 1 }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <ErrorOutline sx={{ color: 'error.main' }} />
                    <Typography>
                      You must verify your RSI account before creating an organization.
                    </Typography>
                  </Stack>
                </Box>
              )}

              {rsiOrgError && (
                <Box sx={{ p: 1.5, backgroundColor: 'error.main', borderRadius: 1 }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <ErrorOutline sx={{ color: 'error.main' }} />
                    <Typography>{rsiOrgError}</Typography>
                  </Stack>
                </Box>
              )}

              <TypographyField
                label="Organization Name"
                isRequired
                value={createOrgForm.name}
                onChange={value => setCreateOrgForm(prev => ({ ...prev, name: value }))}
                maxLength={100}
                description="The display name of your organization"
              />

              <TypographyField
                label="Organization Tag"
                value={createOrgForm.tag}
                onChange={value => setCreateOrgForm(prev => ({ ...prev, tag: value }))}
                maxLength={10}
                description="Short tag or abbreviation (optional)"
              />

              <TypographyArea
                label="Description"
                value={createOrgForm.description}
                onChange={value => setCreateOrgForm(prev => ({ ...prev, description: value }))}
                maxLength={500}
                height="size-1000"
                description="Brief description of your organization (optional)"
              />

              <Divider />

              <Typography variant="h4">RSI Organization Verification</Typography>
              <Typography>
                To create an organization, you must verify ownership of your RSI organization.
              </Typography>

              <TypographyField
                label="RSI Organization SID"
                isRequired
                value={createOrgForm.rsiOrgSid}
                onChange={value => setCreateOrgForm(prev => ({ ...prev, rsiOrgSid: value }))}
                maxLength={20}
                description="Your organization's Spectrum ID (e.g., CITIZEN)"
                isDisabled={showVerificationInstructions}
              />

              {!showVerificationInstructions && !rsiOrgVerified && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Verification Method
                  </Typography>
                  <Stack direction="row" gap={1}>
                    <Button
                      variant={verificationMethod === 'rank' ? 'primary' : 'outline'}
                      onClick={() => setVerificationMethod('rank')}
                    >
                      Verify by Rank
                    </Button>
                    <Button
                      variant={verificationMethod === 'code' ? 'primary' : 'outline'}
                      onClick={() => setVerificationMethod('code')}
                    >
                      Verify by Link
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {verificationMethod === 'rank'
                      ? 'Instant verification if you are a Founder, Officer, or have a 5-star rank on the RSI organization.'
                      : 'Generate a verification link and add it to your RSI organization page to verify ownership.'}
                  </Typography>
                </Box>
              )}

              {/* Rank-based verification */}
              {verificationMethod === 'rank' &&
                !showVerificationInstructions &&
                !rsiOrgVerified && (
                  <Button
                    variant="primary"
                    onClick={handleVerifyRsiOrgByRank}
                    disabled={
                      !createOrgForm.name.trim() ||
                      !createOrgForm.rsiOrgSid.trim() ||
                      verifyingRsiOrg
                    }
                  >
                    {verifyingRsiOrg ? 'Verifying...' : 'Verify by Rank'}
                  </Button>
                )}

              {/* Code-based verification: generate step */}
              {verificationMethod === 'code' &&
                !showVerificationInstructions &&
                !rsiOrgVerified && (
                  <Button
                    variant="primary"
                    onClick={handleGenerateVerificationCode}
                    disabled={
                      !createOrgForm.name.trim() ||
                      !createOrgForm.rsiOrgSid.trim() ||
                      isGeneratingCode
                    }
                  >
                    {isGeneratingCode ? 'Generating...' : 'Generate Verification Link'}
                  </Button>
                )}

              {showVerificationInstructions && rsiVerificationCode && (
                <Box sx={{ p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                  <Stack direction="column" gap={2}>
                    <Typography variant="h5">Verification Link</Typography>
                    <Box
                      sx={{
                        p: 1.5,
                        backgroundColor: 'grey.200',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.95em',
                        textAlign: 'center',
                        wordBreak: 'break-all',
                      }}
                    >
                      <Typography>{rsiVerificationUrl || rsiVerificationCode}</Typography>
                    </Box>
                    <Divider />
                    <Typography variant="h6">Instructions:</Typography>
                    <Box sx={{ paddingLeft: '1em' }}>
                      <ol>
                        <li>
                          Log in to your RSI account at <strong>robertsspaceindustries.com</strong>
                        </li>
                        <li>Navigate to your organization page</li>
                        <li>Edit your organization settings</li>
                        <li>
                          Paste the verification link above into your{' '}
                          <strong>Introduction, History, Manifesto, or Charter</strong>
                        </li>
                        <li>Save your organization changes</li>
                        <li>
                          We&apos;ll detect it automatically within a couple of minutes — or click
                          &quot;Verify Now&quot; to check immediately
                        </li>
                      </ol>
                    </Box>
                    <Stack direction="row" gap={1.5}>
                      <Button
                        variant="primary"
                        onClick={handleVerifyRsiOrg}
                        disabled={verifyingRsiOrg}
                      >
                        {verifyingRsiOrg ? 'Verifying...' : 'Verify Now'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )}

              {rsiOrgVerified && (
                <Box sx={{ p: 1.5, backgroundColor: 'success.main', borderRadius: 1 }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <CheckmarkCircle sx={{ color: 'success.main' }} />
                    <Typography>
                      RSI Organization verified successfully! Your organization has been created.
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Stack>
          </Content>
          <ButtonGroup>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                if (rsiOrgVerified) {
                  fetchOrganizations();
                }
              }}
            >
              {rsiOrgVerified ? 'Close' : 'Cancel'}
            </Button>
          </ButtonGroup>
        </Dialog>
      )}

      {/* Create Alliance Dialog */}
      <Dialog
        open={isCreateAllianceOpen}
        onClose={() => {
          setIsCreateAllianceOpen(false);
          setCreateAllianceError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Alliance</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Alliance Name"
            fullWidth
            variant="outlined"
            value={createAllianceForm.name}
            onChange={e => setCreateAllianceForm(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mt: 1 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={createAllianceForm.description}
            onChange={e =>
              setCreateAllianceForm(prev => ({ ...prev, description: e.target.value }))
            }
            helperText="At least 10 characters"
          />
          <FormControlLabel
            control={
              <Switch
                checked={createAllianceForm.isPublic}
                onChange={e =>
                  setCreateAllianceForm(prev => ({ ...prev, isPublic: e.target.checked }))
                }
              />
            }
            label="List in public directory"
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: -0.5 }}>
            {createAllianceForm.isPublic
              ? 'Anyone can find and view this alliance in the public directory.'
              : 'Only members can see this alliance. You can make it public later in Settings.'}
          </Typography>
          {createAllianceError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {createAllianceError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="secondary"
            onClick={() => {
              setIsCreateAllianceOpen(false);
              setCreateAllianceError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateAlliance}
            disabled={creatingAlliance || !createAllianceForm.name.trim()}
          >
            {creatingAlliance ? <CircularProgress size={16} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Leave organization confirm dialog */}
      <ConfirmDialog
        {...leaveDialogProps}
        title="Leave Organization"
        message="Are you sure you want to leave this organization? You will lose access to all organization resources."
        onConfirm={handleLeaveOrganization}
        confirmLabel="Leave"
        confirmColor="error"
      />
    </Box>
  );
};

export const DirectoriesPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Directories"
    fallbackMessage="Unable to load directories. Please try again later."
    showHomeButton={true}
  >
    <DirectoriesPage />
  </FeatureErrorBoundary>
);
