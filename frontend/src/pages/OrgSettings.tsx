/**
 * Organization Settings Page
 *
 * Central hub for organization management with tabbed layout.
 * Tabs: General | Recruitment | Integrations | Encryption | Voice Server
 *
 * Restructured in Sprint 0.5 Phase B — Wire Unwired Features
 */
import { EncryptionKeyProvider } from '@/components/encryption/EncryptionKeyProvider';
import { EncryptionManagementDashboard } from '@/components/EncryptionManagementDashboard';
import { EncryptionSetupWizard } from '@/components/EncryptionSetupWizard';
import { OrganizationDeleteConfirmationModal } from '@/components/OrganizationDeleteConfirmationModal';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { apiClient, isApiClientError } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import LockIcon from '@mui/icons-material/Lock';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import SyncIcon from '@mui/icons-material/Sync';
import VerifiedIcon from '@mui/icons-material/Verified';
import WebhookIcon from '@mui/icons-material/Webhook';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildBotInviteUrl } from '@/components/landing/DiscordBotPreview';
import { ApplicationFormBuilder } from '@/components/organization/ApplicationFormBuilder';
import { RoleMappingPanel } from '@/components/organization/RoleMappingPanel';
import { WebhookList } from '@/components/organization/WebhookList';
import { RsiSyncDashboard } from '@/components/RsiSyncDashboard';
import { RsiSyncReviewQueue } from '@/components/RsiSyncReviewQueue';
import { VoiceServerConfigPanel } from '@/components/voice/VoiceServerConfigPanel';
import { VoiceServerStatsPanel } from '@/components/voice/VoiceServerStatsPanel';
import {
  useOrganization,
  useRenameOrganization,
  useSyncNameFromRsi,
} from '@/hooks/queries/useOrganizationQueries';
import {
  useConnectDiscordGuild,
  useDisconnectDiscordGuild,
  useDiscordGuilds,
  useOrgSettings,
  usePublicProfile,
  useUpdateOrgSettings,
  useUpdatePublicProfile,
} from '@/hooks/queries/useOrgSettingsQueries';
import {
  publicDirectoryService,
  type OrgPrimaryFocus,
  type ProfileUpdateInput,
} from '@/services/publicDirectoryService';
import { rsiVerificationService } from '@/services/rsiVerificationService';
import { DISCORD_BLUE, DISCORD_BLUE_HOVER } from '@/utils/brandColors';

import {
  useDeleteOrgVoiceConfig,
  useOrgVoiceConfig,
  useOrgVoiceStatus,
  useOrgWhitelistSuggestions,
  useUpdateOrgVoiceConfig,
} from '@/hooks/queries/useVoiceServerQueries';
import { useNotification } from '@/store/uiStore';
import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';

// ============================================================================
// Tab Panel Helper
// ============================================================================

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    id={`org-settings-tabpanel-${index}`}
    aria-labelledby={`org-settings-tab-${index}`}
    sx={{ pt: 2 }}
  >
    {value === index && children}
  </Box>
);

function a11yProps(index: number) {
  return {
    id: `org-settings-tab-${index}`,
    'aria-controls': `org-settings-tabpanel-${index}`,
  };
}

// ============================================================================
// URL validation helper (B8)
// ============================================================================

const URL_PATTERN = /^https?:\/\/.+/i;

function isValidUrl(value: string): boolean {
  if (!value) return true; // empty is valid (optional fields)
  return URL_PATTERN.test(value);
}

const PRIMARY_FOCUS_OPTIONS: { value: OrgPrimaryFocus; label: string }[] = [
  { value: 'combat', label: 'Combat' },
  { value: 'mining', label: 'Mining' },
  { value: 'trading', label: 'Trading' },
  { value: 'exploration', label: 'Exploration' },
  { value: 'bounty_hunting', label: 'Bounty Hunting' },
  { value: 'medical', label: 'Medical' },
  { value: 'transport', label: 'Transport' },
  { value: 'salvage', label: 'Salvage' },
  { value: 'security', label: 'Security' },
  { value: 'social', label: 'Social' },
  { value: 'piracy', label: 'Piracy' },
  { value: 'racing', label: 'Racing' },
  { value: 'mixed', label: 'Mixed / Multi-Role' },
];

// ============================================================================
// Component
// ============================================================================

export const OrgSettings: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const notification = useNotification();
  const [activeTab, setActiveTab] = useState(0);
  const [showEncryptionWizard, setShowEncryptionWizard] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Discord manual connect form state (client-only)
  const [manualGuildId, setManualGuildId] = useState('');
  const [manualGuildName, setManualGuildName] = useState('');
  const [showManualConnect, setShowManualConnect] = useState(false);

  // Public profile form state (local draft)
  const [profileForm, setProfileForm] = useState<ProfileUpdateInput>({});
  const [profileFormDirty, setProfileFormDirty] = useState(false);
  const [rsiSyncLoading, setRsiSyncLoading] = useState(false);
  const [rsiSyncSid, setRsiSyncSid] = useState('');
  const [showRsiSync, setShowRsiSync] = useState(false);
  const [rsiSyncError, setRsiSyncError] = useState<string | null>(null);

  // Org RSI verification state
  const [orgRsiVerified, setOrgRsiVerified] = useState<boolean | null>(null);
  const [orgRsiSid, setOrgRsiSid] = useState('');
  const [orgVerifyCode, setOrgVerifyCode] = useState('');
  const [orgVerifyLoading, setOrgVerifyLoading] = useState(false);
  const [orgVerifyCodeCopied, setOrgVerifyCodeCopied] = useState(false);
  const [orgVerificationMethod, setOrgVerificationMethod] = useState<'code' | 'rank'>('rank');

  // Org rename state
  const [renameValue, setRenameValue] = useState('');
  const [renameDirty, setRenameDirty] = useState(false);
  const [renameSuccess, setRenameSuccess] = useState(false);
  const renameSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orgId = user?.activeOrgId;
  const isLeader =
    user?.orgRole === 'owner' ||
    user?.orgRole === 'admin' ||
    user?.orgRole === 'officer' ||
    user?.orgRole === 'founder';
  const canManageVoice =
    user?.orgRole === 'owner' || user?.orgRole === 'admin' || user?.orgRole === 'founder';
  const isOwner = user?.orgRole === 'owner' || user?.orgRole === 'founder';

  // ========== React Query hooks ==========
  const {
    data: orgSettings = {},
    isLoading: settingsLoading,
    error: settingsQueryError,
  } = useOrgSettings(orgId);
  const updateSettings = useUpdateOrgSettings(orgId);

  const { data: orgDetail } = useOrganization(orgId);
  const renameOrg = useRenameOrganization();
  const syncNameFromRsi = useSyncNameFromRsi();

  const {
    data: discordGuilds = [],
    isLoading: discordLoading,
    error: discordQueryError,
  } = useDiscordGuilds(orgId);
  const connectGuild = useConnectDiscordGuild(orgId);
  const disconnectGuild = useDisconnectDiscordGuild(orgId);

  const isPublic = orgSettings.visibility === 'public';

  const { data: publicProfile, isLoading: profileLoading } = usePublicProfile(
    orgId,
    isPublic && isLeader
  );
  const updateProfile = useUpdatePublicProfile(orgId);

  // Sync profile form from fetched data (F5: moved from render-time to useEffect)
  useEffect(() => {
    if (publicProfile && !profileFormDirty) {
      setProfileForm({
        tagline: publicProfile.tagline ?? '',
        primaryFocus: publicProfile.primaryFocus ?? 'mixed',
        secondaryFocus: publicProfile.secondaryFocus ?? [],
        isRecruiting: publicProfile.isRecruiting ?? false,
        rsiUrl: publicProfile.rsiUrl ?? '',
        discordInvite: publicProfile.discordInvite ?? '',
        twitterUrl: publicProfile.twitterUrl ?? '',
        youtubeUrl: publicProfile.youtubeUrl ?? '',
        twitchUrl: publicProfile.twitchUrl ?? '',
        websiteUrl: publicProfile.websiteUrl ?? '',
        timezone: publicProfile.timezone ?? '',
      });
    }
  }, [publicProfile, profileFormDirty]);

  // Sync rename value from org detail
  useEffect(() => {
    if (orgDetail?.name && !renameDirty) {
      setRenameValue(orgDetail.name);
    }
  }, [orgDetail?.name, renameDirty]);

  // Cleanup rename success timer on unmount
  useEffect(() => {
    return () => {
      if (renameSuccessTimer.current) clearTimeout(renameSuccessTimer.current);
    };
  }, []);

  // Fetch org RSI verification status and SID
  useEffect(() => {
    if (!orgId) return;

    // Get org verification status
    apiClient
      .getRaw<{ rsiVerified?: boolean; rsiSid?: string }>(`/api/v2/organizations/${orgId}`)
      .then(org => {
        setOrgRsiVerified(org.rsiVerified === true);
        if (org.rsiSid) setOrgRsiSid(org.rsiSid);
      })
      .catch(() => {
        setOrgRsiVerified(false);
      });

    // Also try to pre-fill SID from the sync schedule if not set on org
    apiClient
      .getRaw<{ rsiOrgSid?: string }>(`/api/v2/rsi/sync/schedule/${orgId}`)
      .then(schedule => {
        if (schedule.rsiOrgSid) {
          setOrgRsiSid(prev => prev || schedule.rsiOrgSid || '');
        }
      })
      .catch(() => {
        // Schedule may not exist — that's fine
      });
  }, [orgId]);

  // Aggregate error state
  let settingsError: string | null = null;
  if (updateSettings.error) settingsError = 'Failed to update setting';
  else if (settingsQueryError) settingsError = 'Failed to load settings';

  let discordError: string | null = null;
  if (connectGuild.error)
    discordError = 'Failed to connect Discord server. Make sure the bot is in the server.';
  else if (disconnectGuild.error) discordError = 'Failed to disconnect Discord server';
  else if (discordQueryError) discordError = 'Failed to load Discord guilds';
  const profileError = updateProfile.error ? 'Failed to save public profile' : null;

  // ========== Handlers ==========
  const handleConnectGuild = useCallback(async () => {
    if (!manualGuildId.trim()) return;
    try {
      await connectGuild.mutateAsync({
        guildId: manualGuildId.trim(),
        guildName: manualGuildName.trim() || `Guild ${manualGuildId.trim()}`,
      });
      setManualGuildId('');
      setManualGuildName('');
      setShowManualConnect(false);
    } catch {
      // Error surfaced via connectGuild.error in the UI
    }
  }, [manualGuildId, manualGuildName, connectGuild]);

  const handleSaveProfile = useCallback(async () => {
    try {
      await updateProfile.mutateAsync(profileForm);
      setProfileFormDirty(false);
      notification.success('Profile saved successfully');
    } catch {
      // Error surfaced via updateProfile.error in the UI
    }
  }, [profileForm, updateProfile]);

  const handleRename = useCallback(async () => {
    if (!orgId || !renameValue.trim()) return;
    try {
      await renameOrg.mutateAsync({ organizationId: orgId, name: renameValue.trim() });
      setRenameDirty(false);
      setRenameSuccess(true);
      if (renameSuccessTimer.current) clearTimeout(renameSuccessTimer.current);
      renameSuccessTimer.current = setTimeout(() => setRenameSuccess(false), 3000);
    } catch {
      // Error surfaced via renameOrg.error in the UI
    }
  }, [orgId, renameValue, renameOrg]);

  const handleSyncNameFromRsi = useCallback(async () => {
    if (!orgId) return;
    try {
      await syncNameFromRsi.mutateAsync(orgId);
      setRenameDirty(false);
      setRenameSuccess(true);
      if (renameSuccessTimer.current) clearTimeout(renameSuccessTimer.current);
      renameSuccessTimer.current = setTimeout(() => setRenameSuccess(false), 3000);
    } catch {
      // Error surfaced via syncNameFromRsi.error in the UI
    }
  }, [orgId, syncNameFromRsi]);

  const updateProfileField = useCallback(
    (field: keyof ProfileUpdateInput, value: string | boolean) => {
      setProfileForm(prev => ({ ...prev, [field]: value }));
      setProfileFormDirty(true);
    },
    []
  );

  const handleResetProfile = useCallback(() => {
    if (publicProfile) {
      setProfileForm({
        tagline: publicProfile.tagline ?? '',
        primaryFocus: publicProfile.primaryFocus ?? 'mixed',
        secondaryFocus: publicProfile.secondaryFocus ?? [],
        isRecruiting: publicProfile.isRecruiting ?? false,
        rsiUrl: publicProfile.rsiUrl ?? '',
        discordInvite: publicProfile.discordInvite ?? '',
        twitterUrl: publicProfile.twitterUrl ?? '',
        youtubeUrl: publicProfile.youtubeUrl ?? '',
        twitchUrl: publicProfile.twitchUrl ?? '',
        websiteUrl: publicProfile.websiteUrl ?? '',
        timezone: publicProfile.timezone ?? '',
      });
    }
    setProfileFormDirty(false);
  }, [publicProfile]);

  /** Toggle a focus area chip in the profile form */
  const handleFocusToggle = useCallback(
    (focusValue: OrgPrimaryFocus, isSelected: boolean) => {
      if (isSelected) {
        // Removing a selected focus
        if (profileForm.primaryFocus === focusValue) {
          const remaining = (profileForm.secondaryFocus ?? []).filter(
            v => v !== focusValue
          ) as OrgPrimaryFocus[];
          setProfileForm(prev => ({
            ...prev,
            primaryFocus: (remaining[0] ?? 'mixed') as OrgPrimaryFocus,
            secondaryFocus: remaining.slice(1),
          }));
        } else {
          setProfileForm(prev => ({
            ...prev,
            secondaryFocus: (prev.secondaryFocus ?? []).filter(v => v !== focusValue),
          }));
        }
      } else if (!profileForm.primaryFocus || profileForm.primaryFocus === 'mixed') {
        setProfileForm(prev => ({ ...prev, primaryFocus: focusValue }));
      } else {
        setProfileForm(prev => ({
          ...prev,
          secondaryFocus: [...(prev.secondaryFocus ?? []), focusValue],
        }));
      }
      setProfileFormDirty(true);
    },
    [profileForm.primaryFocus, profileForm.secondaryFocus]
  );

  const handleSyncFromRsi = useCallback(async () => {
    if (!orgId || !rsiSyncSid.trim()) return;
    setRsiSyncLoading(true);
    setRsiSyncError(null);
    try {
      await publicDirectoryService.syncFromRsi(orgId, rsiSyncSid.trim());
      setShowRsiSync(false);
      setRsiSyncSid('');
      // Refetch profile to pick up synced data
      setProfileFormDirty(false);
    } catch (err: unknown) {
      setRsiSyncError(err instanceof Error ? err.message : 'Failed to sync from RSI');
    } finally {
      setRsiSyncLoading(false);
    }
  }, [orgId, rsiSyncSid]);

  // Org RSI verification handlers
  const handleOrgGenerateCode = async () => {
    if (!orgId || !orgRsiSid.trim()) return;
    setOrgVerifyLoading(true);
    try {
      const data = await rsiVerificationService.initiateOrganizationVerification(
        orgId,
        orgRsiSid.trim()
      );
      setOrgVerifyCode(data.verificationUrl ?? data.verificationCode ?? '');
    } catch (err: unknown) {
      const message = isApiClientError(err)
        ? err.message
        : 'Failed to generate verification link. Please try again.';
      notification.error(message);
    } finally {
      setOrgVerifyLoading(false);
    }
  };

  const handleOrgVerifyByRank = async () => {
    if (!orgId || !orgRsiSid.trim()) return;
    setOrgVerifyLoading(true);
    try {
      const data = await rsiVerificationService.verifyOrganizationByRank(orgId, orgRsiSid.trim());
      if (data.verified) {
        setOrgRsiVerified(true);
        setOrgVerifyCode('');
        notification.success('Organization RSI verification successful!');
      } else {
        notification.error(
          'Rank-based verification failed. Your RSI rank may not be high enough. Try the verification link method instead.'
        );
      }
    } catch (err: unknown) {
      const message = isApiClientError(err)
        ? err.message
        : 'Rank-based verification failed. Make sure you have a 5-star rank, Founder, or Officer role on the RSI organization.';
      notification.error(message);
    } finally {
      setOrgVerifyLoading(false);
    }
  };

  const handleOrgVerify = async () => {
    if (!orgId) return;
    setOrgVerifyLoading(true);
    try {
      const data = await rsiVerificationService.completeOrganizationVerification(orgId);
      if (data.verified) {
        setOrgRsiVerified(true);
        setOrgVerifyCode('');
        notification.success('Organization RSI verification successful!');
      } else {
        notification.error(
          'Verification link not found on your RSI organization page. Make sure you added it to the Introduction, History, Manifesto, or Charter and saved.'
        );
      }
    } catch (err: unknown) {
      const message = isApiClientError(err)
        ? err.message
        : 'Failed to verify. Make sure the link is on your RSI org page (Introduction, History, Manifesto, or Charter).';
      notification.error(message);
    } finally {
      setOrgVerifyLoading(false);
    }
  };

  const handleOrgReVerify = () => {
    setOrgRsiVerified(false);
    setOrgVerifyCode('');
    setOrgVerificationMethod('rank');
  };

  // URL validation for social links (B8)
  const urlErrors = {
    rsiUrl: !isValidUrl(profileForm.rsiUrl ?? ''),
    discordInvite: !!(
      profileForm.discordInvite &&
      !(
        /^https?:\/\//i.test(profileForm.discordInvite) ||
        /^discord\.gg\//i.test(profileForm.discordInvite)
      )
    ),
    twitterUrl: !isValidUrl(profileForm.twitterUrl ?? ''),
    youtubeUrl: !isValidUrl(profileForm.youtubeUrl ?? ''),
    twitchUrl: !isValidUrl(profileForm.twitchUrl ?? ''),
    websiteUrl: !isValidUrl(profileForm.websiteUrl ?? ''),
  };
  const hasUrlErrors = Object.values(urlErrors).some(Boolean);

  const teamsEnabled = orgSettings.enableTeams !== false; // default: enabled
  const titlesBadgesEnabled = orgSettings.enableTitlesBadges === true; // default: disabled

  if (!orgId) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="info">
          You need to be a member of an organization to access organization settings.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0, color: 'text.primary' }}>
          Organization Settings
        </Typography>
        <HelpTooltip
          content="Configure your organization's profile, manage member applications, send invitations, and control recruitment visibility."
          icon
          iconSize="sm"
          position="right"
        />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, mt: 1 }}>
        Manage your organization — {user.activeOrgName || orgId}
      </Typography>

      {settingsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {settingsError}
        </Alert>
      )}

      {/* Tabbed Layout */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_e, newValue: number) => setActiveTab(newValue)}
          aria-label="Organization settings tabs"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', minHeight: 48, fontWeight: 500 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
          }}
        >
          <Tab icon={<SettingsIcon />} iconPosition="start" label="General" {...a11yProps(0)} />
          <Tab
            icon={<AssignmentIcon />}
            iconPosition="start"
            label="Recruitment"
            {...a11yProps(1)}
          />
          <Tab icon={<WebhookIcon />} iconPosition="start" label="Integrations" {...a11yProps(2)} />
          <Tab icon={<LockIcon />} iconPosition="start" label="Encryption" {...a11yProps(3)} />
          <Tab
            icon={<HeadsetMicIcon />}
            iconPosition="start"
            label="Voice Server"
            {...a11yProps(4)}
          />
        </Tabs>
      </Box>

      {/* ==================== Tab 0: General ==================== */}
      <TabPanel value={activeTab} index={0}>
        {/* Organization Identity — rename org or pull name from RSI */}
        {isLeader && (
          <Card
            sx={{
              mt: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <DriveFileRenameOutlineIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Organization Identity
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                The organization tag is your permanent identifier and cannot be changed. You can
                rename the display name or pull the current name from your RSI organization page.
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'divider' }} />

              {renameOrg.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {isApiClientError(renameOrg.error)
                    ? renameOrg.error.message
                    : 'Failed to rename organization'}
                </Alert>
              )}
              {syncNameFromRsi.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {isApiClientError(syncNameFromRsi.error)
                    ? syncNameFromRsi.error.message
                    : 'Failed to sync name from RSI'}
                </Alert>
              )}
              {renameSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Organization name updated successfully
                </Alert>
              )}

              <Stack spacing={2}>
                <TextField
                  label="Organization Tag (ID)"
                  value={orgId}
                  size="small"
                  fullWidth
                  disabled
                  helperText="This is your permanent organization identifier and cannot be changed"
                  slotProps={{
                    input: { readOnly: true },
                  }}
                />

                {orgRsiSid && (
                  <TextField
                    label="RSI Organization Tag"
                    value={orgRsiSid}
                    size="small"
                    fullWidth
                    disabled
                    helperText={
                      <span>
                        Linked RSI spectrum ID —{' '}
                        <Link
                          href={`https://robertsspaceindustries.com/en/orgs/${encodeURIComponent(orgRsiSid)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="inherit"
                        >
                          View on RSI
                        </Link>
                      </span>
                    }
                    slotProps={{
                      input: { readOnly: true },
                    }}
                  />
                )}

                <TextField
                  label="Organization Name"
                  value={renameValue}
                  onChange={e => {
                    setRenameValue(e.target.value);
                    setRenameDirty(true);
                    setRenameSuccess(false);
                  }}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  helperText={`${renameValue.length}/100 — Display name shown across the platform`}
                />

                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                  {orgRsiSid && (
                    <Button
                      variant="outlined"
                      startIcon={
                        syncNameFromRsi.isPending ? <CircularProgress size={16} /> : <SyncIcon />
                      }
                      onClick={handleSyncNameFromRsi}
                      disabled={syncNameFromRsi.isPending || renameOrg.isPending}
                      sx={{ textTransform: 'none' }}
                    >
                      {syncNameFromRsi.isPending ? 'Syncing...' : 'Pull Name from RSI'}
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    onClick={handleRename}
                    disabled={renameOrg.isPending || !renameDirty || renameValue.trim().length < 3}
                    sx={{ textTransform: 'none' }}
                  >
                    {renameOrg.isPending ? <CircularProgress size={20} /> : 'Save Name'}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Feature Toggles — only visible to leaders */}
        {isLeader && (
          <Card
            sx={{
              mt: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Feature Toggles
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Enable or disable optional features for your organization.
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'divider' }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={teamsEnabled}
                    onChange={(_e, checked) => updateSettings.mutate({ enableTeams: checked })}
                    disabled={settingsLoading || updateSettings.isPending}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: 'primary.main',
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Teams & Squads
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Allow members to create and manage squads, divisions, and operational units
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />

              <Divider sx={{ my: 2, borderColor: 'divider' }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={titlesBadgesEnabled}
                    onChange={(_e, checked) =>
                      updateSettings.mutate({ enableTitlesBadges: checked })
                    }
                    disabled={settingsLoading || updateSettings.isPending}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: 'primary.main',
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Titles & Badges
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Create and award custom titles and badges to recognize member contributions
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />

              <Divider sx={{ my: 2, borderColor: 'divider' }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={isPublic}
                    onChange={(_e, checked) => {
                      updateSettings.mutate({
                        visibility: checked ? 'public' : 'private',
                      });
                    }}
                    disabled={settingsLoading || updateSettings.isPending}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: 'success.main' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: 'success.main',
                      },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Public Directory Listing
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      List your organization in the public directory so others can find and join you
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />
            </CardContent>
          </Card>
        )}

        {/* Danger Zone — only visible to owners/founders */}
        {isOwner && (
          <Card
            sx={{
              mt: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'error.main',
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}>
                Danger Zone
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Irreversible actions. Proceed with caution.
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'error.main', opacity: 0.3 }} />

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Delete Organization
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Permanently delete this organization and all associated data
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete Organization
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        <OrganizationDeleteConfirmationModal
          organizationId={orgId}
          organizationName={user?.activeOrgName || orgId}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            try {
              await apiClient.delete(`/api/v2/organizations/${orgId}`);
              navigate('/directories');
            } catch {
              notification.error('Failed to delete organization. Please try again.');
            }
          }}
        />
      </TabPanel>

      {/* ==================== Tab 1: Recruitment ==================== */}
      <TabPanel value={activeTab} index={1}>
        {/* Application Form Builder — configure custom application questions */}
        {isLeader && (
          <Card
            sx={{
              mt: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <ApplicationFormBuilder
                questions={(orgSettings.applicationQuestions as ApplicationQuestion[]) ?? []}
                onChange={(questions: ApplicationQuestion[]) =>
                  updateSettings.mutate({ applicationQuestions: questions })
                }
                disabled={settingsLoading || updateSettings.isPending}
              />
            </CardContent>
          </Card>
        )}

        {/* Public Profile Editor — shown when org is public and user is leader */}
        {isPublic && isLeader && (
          <Card
            sx={{
              mt: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Public Profile
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Configure how your organization appears in the public directory.
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'divider' }} />

              {profileLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  {profileError && <Alert severity="error">{profileError}</Alert>}

                  <TextField
                    label="Tagline / Motto"
                    placeholder="A short description of your org (max 200 chars)"
                    value={profileForm.tagline ?? ''}
                    onChange={e => updateProfileField('tagline', e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    helperText={`${(profileForm.tagline ?? '').length}/200`}
                  />

                  <TextField
                    label="Logo URL"
                    placeholder="https://... or use Import from RSI"
                    value={profileForm.logoUrl ?? ''}
                    onChange={e => updateProfileField('logoUrl', e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Organization logo image URL (displayed on profile)"
                  />

                  <TextField
                    label="Banner URL"
                    placeholder="https://... or use Import from RSI"
                    value={profileForm.bannerUrl ?? ''}
                    onChange={e => updateProfileField('bannerUrl', e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Banner image displayed at top of your org page"
                  />

                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.5, display: 'block' }}
                    >
                      Focus Areas (select up to 3)
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {PRIMARY_FOCUS_OPTIONS.map(opt => {
                        const allSelected = [
                          profileForm.primaryFocus,
                          ...(profileForm.secondaryFocus ?? []),
                        ].filter(Boolean);
                        const isSelected = allSelected.includes(opt.value);
                        const atMax = allSelected.length >= 3 && !isSelected;

                        return (
                          <Chip
                            key={opt.value}
                            label={opt.label}
                            size="small"
                            variant={isSelected ? 'filled' : 'outlined'}
                            color={isSelected ? 'primary' : 'default'}
                            disabled={atMax}
                            onClick={() => handleFocusToggle(opt.value, isSelected)}
                            sx={{ cursor: atMax ? 'not-allowed' : 'pointer' }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>

                  <TextField
                    label="Timezone"
                    placeholder="e.g. UTC, EST, CET"
                    value={profileForm.timezone ?? ''}
                    onChange={e => updateProfileField('timezone', e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 50 } }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={profileForm.isRecruiting ?? false}
                        onChange={(_e, checked) => updateProfileField('isRecruiting', checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: 'success.main' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: 'success.main',
                          },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Actively Recruiting
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Show a recruiting badge on your directory listing
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', ml: 0 }}
                  />

                  <Divider sx={{ borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Public Profile Sections
                    </Typography>
                  </Divider>

                  <Stack spacing={0.5}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                      SCStats Visibility
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1 }}>
                      Choose which analytics sections appear on your public profile
                    </Typography>
                    {[
                      {
                        key: 'showVerification',
                        label: 'Verification Rate',
                        desc: 'Member verification progress bar',
                      },
                      {
                        key: 'showSkills',
                        label: 'Skill Distribution',
                        desc: 'Combat, piloting, and other skill bars',
                      },
                      {
                        key: 'showTimezone',
                        label: 'Timezone',
                        desc: 'Organization timezone display',
                      },
                      {
                        key: 'showAnalytics',
                        label: 'Analytics Summary',
                        desc: 'Members, avg hours, avg K/D stats',
                      },
                    ].map(({ key, label, desc }) => (
                      <FormControlLabel
                        key={key}
                        control={
                          <Switch
                            size="small"
                            checked={
                              (profileForm as Record<string, unknown>).scstatsVisibility
                                ? (
                                    (profileForm as Record<string, unknown>)
                                      .scstatsVisibility as Record<string, boolean>
                                  )?.[key] !== false
                                : true
                            }
                            onChange={(_e, checked) => {
                              setProfileForm(prev => ({
                                ...prev,
                                scstatsVisibility: {
                                  ...((prev as Record<string, unknown>).scstatsVisibility as Record<
                                    string,
                                    boolean
                                  >),
                                  [key]: checked,
                                },
                              }));
                              setProfileFormDirty(true);
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{label}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {desc}
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', ml: 0 }}
                      />
                    ))}
                  </Stack>

                  <Divider sx={{ borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Social Links
                    </Typography>
                  </Divider>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 2,
                    }}
                  >
                    <TextField
                      label="RSI Spectrum URL"
                      placeholder="https://robertsspaceindustries.com/orgs/..."
                      value={profileForm.rsiUrl ?? ''}
                      onChange={e => updateProfileField('rsiUrl', e.target.value)}
                      error={urlErrors.rsiUrl}
                      helperText={
                        urlErrors.rsiUrl ? 'Must start with http:// or https://' : undefined
                      }
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Discord Invite"
                      placeholder="https://discord.gg/..."
                      value={profileForm.discordInvite ?? ''}
                      onChange={e => updateProfileField('discordInvite', e.target.value)}
                      error={urlErrors.discordInvite}
                      helperText={
                        urlErrors.discordInvite ? 'Must be a valid Discord invite URL' : undefined
                      }
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Website"
                      placeholder="https://..."
                      value={profileForm.websiteUrl ?? ''}
                      onChange={e => updateProfileField('websiteUrl', e.target.value)}
                      error={urlErrors.websiteUrl}
                      helperText={
                        urlErrors.websiteUrl ? 'Must start with http:// or https://' : undefined
                      }
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Twitter / X"
                      placeholder="https://twitter.com/..."
                      value={profileForm.twitterUrl ?? ''}
                      onChange={e => updateProfileField('twitterUrl', e.target.value)}
                      error={urlErrors.twitterUrl}
                      helperText={
                        urlErrors.twitterUrl ? 'Must start with http:// or https://' : undefined
                      }
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="YouTube"
                      placeholder="https://youtube.com/..."
                      value={profileForm.youtubeUrl ?? ''}
                      onChange={e => updateProfileField('youtubeUrl', e.target.value)}
                      error={urlErrors.youtubeUrl}
                      helperText={
                        urlErrors.youtubeUrl ? 'Must start with http:// or https://' : undefined
                      }
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Twitch"
                      placeholder="https://twitch.tv/..."
                      value={profileForm.twitchUrl ?? ''}
                      onChange={e => updateProfileField('twitchUrl', e.target.value)}
                      error={urlErrors.twitchUrl}
                      helperText={
                        urlErrors.twitchUrl ? 'Must start with http:// or https://' : undefined
                      }
                      size="small"
                      fullWidth
                    />
                  </Box>

                  <Divider sx={{ my: 1 }} />

                  {/* Import from RSI */}
                  {showRsiSync ? (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <TextField
                        label="RSI Org SID"
                        placeholder="e.g. FRINGENAUTS"
                        value={rsiSyncSid}
                        onChange={e => setRsiSyncSid(e.target.value.toUpperCase())}
                        size="small"
                        sx={{ flex: 1 }}
                        helperText={
                          rsiSyncError ||
                          'Enter your RSI organization SID to import logo, banner, and profile data'
                        }
                        error={!!rsiSyncError}
                        slotProps={{ htmlInput: { maxLength: 30 } }}
                      />
                      <Button
                        variant="contained"
                        onClick={handleSyncFromRsi}
                        disabled={rsiSyncLoading || !rsiSyncSid.trim()}
                        startIcon={rsiSyncLoading ? <CircularProgress size={16} /> : <SyncIcon />}
                        sx={{ textTransform: 'none', mt: 0.25 }}
                      >
                        {rsiSyncLoading ? 'Importing...' : 'Import'}
                      </Button>
                      <Button
                        variant="text"
                        onClick={() => {
                          setShowRsiSync(false);
                          setRsiSyncSid('');
                          setRsiSyncError(null);
                        }}
                        sx={{ textTransform: 'none', mt: 0.25 }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={<SyncIcon />}
                      onClick={() => setShowRsiSync(true)}
                      sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                    >
                      Import from RSI
                    </Button>
                  )}

                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button
                      variant="outlined"
                      onClick={handleResetProfile}
                      disabled={updateProfile.isPending}
                      sx={{ textTransform: 'none' }}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSaveProfile}
                      disabled={updateProfile.isPending || hasUrlErrors}
                      sx={{ textTransform: 'none' }}
                    >
                      {updateProfile.isPending ? <CircularProgress size={20} /> : 'Save Profile'}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* ==================== Tab 2: Integrations ==================== */}
      <TabPanel value={activeTab} index={2}>
        <Stack spacing={3}>
          {/* RSI Organization Verification Card */}
          {isLeader && (
            <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <VerifiedIcon
                      sx={{ color: orgRsiVerified ? 'success.main' : 'text.secondary' }}
                    />
                    <Typography variant="h6">RSI Organization Verification</Typography>
                  </Stack>
                  {orgRsiVerified && (
                    <Chip
                      color="success"
                      label="Verified"
                      icon={<CheckCircleIcon />}
                      size="small"
                    />
                  )}
                </Stack>

                {orgRsiVerified ? (
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Your organization&apos;s RSI identity has been verified.
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      color="warning"
                      onClick={handleOrgReVerify}
                      sx={{ alignSelf: 'flex-start', mt: 1 }}
                    >
                      Re-verify Organization
                    </Button>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                      Verify ownership of your RSI organization.
                    </Typography>

                    <TextField
                      label="RSI Organization SID"
                      value={orgRsiSid}
                      onChange={e => setOrgRsiSid(e.target.value.toUpperCase())}
                      placeholder="e.g. FRINAUTS"
                      helperText="The Spectrum ID of your RSI organization"
                      size="small"
                      fullWidth
                    />

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Verification Method
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant={orgVerificationMethod === 'rank' ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => setOrgVerificationMethod('rank')}
                        >
                          Verify by Rank
                        </Button>
                        <Button
                          variant={orgVerificationMethod === 'code' ? 'contained' : 'outlined'}
                          size="small"
                          onClick={() => setOrgVerificationMethod('code')}
                        >
                          Verify by Link
                        </Button>
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: 'block' }}
                      >
                        {orgVerificationMethod === 'rank'
                          ? 'Instant verification if you are a Founder, Officer, or have a 5-star rank on the RSI organization.'
                          : 'Generate a verification link and add it to your RSI organization page to verify ownership.'}
                      </Typography>
                    </Box>

                    {orgVerificationMethod === 'rank' && !orgVerifyCode && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => void handleOrgVerifyByRank()}
                        disabled={!orgRsiSid.trim() || orgVerifyLoading}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {orgVerifyLoading ? (
                          <>
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                            Verifying...
                          </>
                        ) : (
                          'Verify by Rank'
                        )}
                      </Button>
                    )}

                    {orgVerificationMethod === 'code' && orgVerifyCode ? (
                      <Stack spacing={1.5}>
                        <Typography variant="body2" fontWeight={600}>
                          Add this verification link to your RSI org page (Introduction, History,
                          Manifesto, or Charter):
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              flex: 1,
                              bgcolor: 'background.default',
                              p: 1.5,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              textAlign: 'center',
                              userSelect: 'all',
                            }}
                          >
                            {orgVerifyCode}
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={
                              orgVerifyCodeCopied ? <CheckCircleIcon /> : <ContentCopyIcon />
                            }
                            color={orgVerifyCodeCopied ? 'success' : 'primary'}
                            onClick={() => {
                              void navigator.clipboard.writeText(orgVerifyCode);
                              setOrgVerifyCodeCopied(true);
                              setTimeout(() => setOrgVerifyCodeCopied(false), 2000);
                            }}
                          >
                            {orgVerifyCodeCopied ? 'Copied!' : 'Copy'}
                          </Button>
                        </Stack>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => {
                            const encoded = encodeURIComponent(orgRsiSid.trim());
                            window.open(
                              `https://robertsspaceindustries.com/orgs/${encoded}`,
                              '_blank',
                              'noopener,noreferrer'
                            );
                          }}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          Open RSI Org Page
                        </Button>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => void handleOrgVerify()}
                          disabled={orgVerifyLoading}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {orgVerifyLoading ? (
                            <>
                              <CircularProgress size={16} sx={{ mr: 1 }} />
                              Verifying...
                            </>
                          ) : (
                            'Verify Now'
                          )}
                        </Button>
                      </Stack>
                    ) : null}

                    {orgVerificationMethod === 'code' && !orgVerifyCode && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => void handleOrgGenerateCode()}
                        disabled={!orgRsiSid.trim() || orgVerifyLoading}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {orgVerifyLoading ? (
                          <>
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                            Generating...
                          </>
                        ) : (
                          'Generate Verification Link'
                        )}
                      </Button>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <SyncIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6">RSI Sync</Typography>
              </Stack>
              <RsiSyncReviewQueue organizationId={orgId} />
              <Box sx={{ mt: 3 }}>
                <RsiSyncDashboard organizationId={orgId} />
              </Box>
            </CardContent>
          </Card>

          {/* Role Mapping Card */}
          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <RoleMappingPanel organizationId={orgId} guildId={discordGuilds[0]?.guildId} />
            </CardContent>
          </Card>

          {/* Discord Server Connection Card */}
          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      bgcolor: DISCORD_BLUE,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'common.white',
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    D
                  </Box>
                  <Typography variant="h6">Discord Server</Typography>
                </Stack>
                {(() => {
                  if (discordLoading) return <CircularProgress size={20} />;
                  if (discordGuilds.length > 0)
                    return <Chip label="Connected" color="success" size="small" />;
                  return <Chip label="Not Connected" variant="outlined" size="small" />;
                })()}
              </Stack>

              {discordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {discordError}
                </Alert>
              )}

              {discordGuilds.length > 0 ? (
                <Stack spacing={2}>
                  {discordGuilds.map(guild => (
                    <Stack
                      key={guild.guildId}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {guild.guildName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ID: {guild.guildId}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate('/discord')}
                        >
                          Manage
                        </Button>
                        {isLeader && (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<LinkOffIcon />}
                            onClick={() => disconnectGuild.mutate(guild.guildId)}
                          >
                            Disconnect
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Connect your Discord server to enable voice channels, tunnels, ticketing, and
                    recruitment integration.
                  </Typography>

                  {/* Step 1: Invite Bot (auto-connects via redirect) */}
                  {(() => {
                    const url = buildBotInviteUrl(orgId, user.id);
                    if (!url) return null;
                    return (
                      <Button
                        variant="contained"
                        startIcon={<OpenInNewIcon />}
                        component="a"
                        href={url}
                        sx={{
                          bgcolor: DISCORD_BLUE,
                          '&:hover': { bgcolor: DISCORD_BLUE_HOVER },
                          textTransform: 'none',
                        }}
                      >
                        Add Bot to Your Server
                      </Button>
                    );
                  })()}

                  <Divider>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      or link manually
                    </Typography>
                  </Divider>

                  {/* Step 2: Enter Guild ID */}
                  {showManualConnect ? (
                    <Stack spacing={1.5}>
                      <TextField
                        label="Discord Server ID (Guild ID)"
                        placeholder="e.g. 123456789012345678"
                        value={manualGuildId}
                        onChange={e => {
                          // Only allow digits
                          const val = e.target.value.replaceAll(/\D/g, '');
                          setManualGuildId(val);
                        }}
                        size="small"
                        fullWidth
                        helperText="Right-click your server name in Discord → Copy Server ID (enable Developer Mode in Discord settings)"
                        slotProps={{ htmlInput: { maxLength: 20, inputMode: 'numeric' } }}
                      />
                      <TextField
                        label="Server Name (optional)"
                        placeholder="My Organization Server"
                        value={manualGuildName}
                        onChange={e => setManualGuildName(e.target.value)}
                        size="small"
                        fullWidth
                        slotProps={{ htmlInput: { maxLength: 100 } }}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="contained"
                          onClick={handleConnectGuild}
                          disabled={!manualGuildId.trim() || connectGuild.isPending}
                          sx={{ textTransform: 'none' }}
                        >
                          {connectGuild.isPending ? (
                            <CircularProgress size={20} />
                          ) : (
                            'Connect Server'
                          )}
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setShowManualConnect(false);
                            setManualGuildId('');
                            setManualGuildName('');
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Button
                      variant="outlined"
                      onClick={() => setShowManualConnect(true)}
                      sx={{ textTransform: 'none' }}
                    >
                      Link Server by Guild ID
                    </Button>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>

          <WebhookList organizationId={orgId} userId={user.id} />
        </Stack>
      </TabPanel>

      {/* ==================== Tab 3: Encryption ==================== */}
      <TabPanel value={activeTab} index={3}>
        <EncryptionKeyProvider organizationId={orgId}>
          {showEncryptionWizard ? (
            <EncryptionSetupWizard
              organizationId={orgId}
              organizationName={user.activeOrgName ?? orgId}
              userId={user.id}
              onComplete={() => setShowEncryptionWizard(false)}
              onCancel={() => setShowEncryptionWizard(false)}
            />
          ) : (
            <EncryptionManagementDashboard
              organizationId={orgId}
              organizationName={user.activeOrgName ?? orgId}
              currentUserId={user.id}
              isOwner={isOwner}
              onSetupEncryption={() => setShowEncryptionWizard(true)}
              autoTriggerSetup
            />
          )}
        </EncryptionKeyProvider>
      </TabPanel>

      {/* ==================== Tab 4: Voice Server ==================== */}
      <TabPanel value={activeTab} index={4}>
        <OrgVoiceServerTab orgId={orgId} canManageVoice={canManageVoice} />
      </TabPanel>
    </Box>
  );
};

// ============================================================================
// Voice Server Tab (extracted to avoid hooks in conditional)
// ============================================================================

interface OrgVoiceServerTabProps {
  orgId: string | undefined;
  canManageVoice: boolean;
}

const OrgVoiceServerTab: React.FC<OrgVoiceServerTabProps> = ({ orgId, canManageVoice }) => {
  const { data: config, isLoading, error } = useOrgVoiceConfig(orgId);
  const updateConfig = useUpdateOrgVoiceConfig();
  const deleteConfig = useDeleteOrgVoiceConfig();

  // Organization voice server status (when enabled)
  const { data: orgStatus } = useOrgVoiceStatus(config?.enabled ? orgId : undefined);

  // Whitelist suggestions from federations & positive relationships
  const { data: suggestions, isLoading: suggestionsLoading } = useOrgWhitelistSuggestions(
    orgId,
    canManageVoice && config?.enabled === true
  );

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      {/* Voice Server Status (when configured and online) */}
      {config?.enabled && orgStatus && (
        <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <HeadsetMicIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {config.displayName ?? 'Voice Server'} — Status
              </Typography>
              {config.sharing?.enabled && config.sharing.whitelist.length > 0 && (
                <Chip
                  label={`Shared with ${config.sharing.whitelist.length} ${config.sharing.whitelist.length === 1 ? 'entity' : 'entities'}`}
                  color="info"
                  size="small"
                  variant="outlined"
                  sx={{ ml: 'auto' }}
                />
              )}
            </Stack>
            <VoiceServerStatsPanel status={orgStatus} connectUrl={config.connectUrl} />
          </CardContent>
        </Card>
      )}

      {/* Configuration Panel */}
      {canManageVoice ? (
        <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <SettingsIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Voice Server Configuration
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Configure your organization&apos;s voice server. You can optionally share access with
              federations and trusted organizations via the whitelist.
            </Typography>
            <VoiceServerConfigPanel
              config={config}
              isLoading={isLoading}
              onSave={async data => {
                if (!orgId) return;
                await updateConfig.mutateAsync({ orgId, data });
              }}
              onDelete={async () => {
                if (!orgId) return;
                await deleteConfig.mutateAsync(orgId);
              }}
              isSaving={updateConfig.isPending}
              isDeleting={deleteConfig.isPending}
              error={error}
              suggestions={suggestions ?? undefined}
              suggestionsLoading={suggestionsLoading}
            />
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          Only organization founders, owners, and admins can manage voice server settings.
        </Alert>
      )}
    </Stack>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const OrgSettingsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Organization Settings">
    <OrgSettings />
  </FeatureErrorBoundary>
);
