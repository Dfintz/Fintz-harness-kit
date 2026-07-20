import { userKeys } from '@/hooks/queries/queryKeys';
import { logger } from '@/utils/logger';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DangerousIcon from '@mui/icons-material/Dangerous';
import EditIcon from '@mui/icons-material/Edit';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LinkIcon from '@mui/icons-material/Link';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LockIcon from '@mui/icons-material/Lock';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SearchIcon from '@mui/icons-material/Search';
import SosIcon from '@mui/icons-material/Sos';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TimelineIcon from '@mui/icons-material/Timeline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { UserBadgesDock } from '@/components/badges/UserBadgesDock';
import { SCStatsDashboardWidget } from '@/components/dashboard/SCStatsDashboardWidget';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { PasskeyManagement } from '@/components/PasskeyManagement';
import { SCStatsImportDialog } from '@/components/profile/SCStatsImportDialog';
import { TwoFactorManagement } from '@/components/TwoFactorManagement';
import { useHunterProfile } from '@/hooks/queries/useHunterQueries';
import {
  useMyProfile,
  useUserShips as useProfileUserShips,
  useUserActivityTimeline,
  useUserProfile as useUserProfileQuery,
} from '@/hooks/queries/useUserQueries';
import { useUserTrustScore } from '@/hooks/queries/useUserTrustScoreQueries';

import { apiClient, isApiClientError } from '@/services/apiClient';
import { HunterRank } from '@/services/bountyService';
import type { UserProfile } from '@/services/userProfileService';
import { rsiVerificationService } from '@/services/rsiVerificationService';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { sanitizeImageUrl } from '@/utils/sanitize';

// Extended profile type with RSI fields
type ExtendedUserProfile = UserProfile & {
  rsiHandle?: string;
  rsiVerified?: boolean;
};

/**
 * UserProfilePage - Display user profile information
 *
 * Shows user details, ships, and activity respecting privacy settings.
 * Can Box own profile or other users' public profiles.
 */
/** Build tabs list based on profile visibility settings */
function buildProfileTabs(
  isOwnProfile: boolean,
  profile: ExtendedUserProfile | undefined,
  shipCount: number
) {
  const tabs = [{ key: 'profile', label: 'Profile', icon: <PersonIcon fontSize="small" /> }];
  if (!profile) return tabs;
  if (isOwnProfile || profile.showShips) {
    tabs.push({
      key: 'ships',
      label: `Ships (${shipCount})`,
      icon: <RocketLaunchIcon fontSize="small" />,
    });
  }
  if (isOwnProfile || profile.showActivity) {
    tabs.push({ key: 'activity', label: 'Activity', icon: <TimelineIcon fontSize="small" /> });
  }
  if (isOwnProfile) {
    tabs.push(
      { key: 'security', label: 'Security', icon: <LockIcon fontSize="small" /> },
      { key: 'bounty', label: 'Bounty Hunter', icon: <GpsFixedIcon fontSize="small" /> }
    );
  }
  return tabs;
}

/** Derive profile data from own/other profile queries */
function deriveProfileState(
  isOwnProfile: boolean,
  myProfileData: unknown,
  otherProfileData: unknown,
  myProfileLoading: boolean,
  otherProfileLoading: boolean,
  myProfileError: Error | null,
  otherProfileError: Error | null
) {
  const profile = (isOwnProfile ? myProfileData : otherProfileData) as
    | ExtendedUserProfile
    | undefined;
  const loading = isOwnProfile ? myProfileLoading : otherProfileLoading;
  const profileError = isOwnProfile ? myProfileError : otherProfileError;
  const error = (() => {
    if (!profileError) return null;
    return profileError instanceof Error ? profileError.message : 'Failed to load user profile';
  })();
  return { profile, loading, error };
}

/** Extract orgs array from API response which may be a direct array or { data: [...] } envelope */
function extractOrgsArray(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object') {
    const inner = (raw as Record<string, unknown>)?.data;
    if (Array.isArray(inner)) return inner as Array<Record<string, unknown>>;
  }
  return [];
}

/** Wrap an unknown error value into an Error instance for logging */
function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/** Extract a user-friendly error message from an RSI API error */
function extractRsiErrorMessage(err: unknown, fallback: string): string {
  if (!isApiClientError(err)) return fallback;
  if (err.statusCode === 503) {
    return 'The RSI API is temporarily unavailable. Please try again in a few minutes.';
  }
  return err.message || fallback;
}

/** Build non-empty profile update payload from the edit form */
function buildProfilePayload(editForm: {
  displayName: string;
  bio: string;
  rsiHandle: string;
}): Record<string, string> {
  const payload: Record<string, string> = {};
  if (editForm.displayName.trim()) payload.displayName = editForm.displayName.trim();
  if (editForm.bio.trim()) payload.bio = editForm.bio.trim();
  if (editForm.rsiHandle.trim()) payload.rsiHandle = editForm.rsiHandle.trim();
  return payload;
}

/** Process avatar file selection — validates type and creates preview URL */
function processAvatarFile(
  files: FileList | null,
  setAvatarFile: (f: File | null) => void,
  setEditForm: React.Dispatch<
    React.SetStateAction<{ displayName: string; bio: string; rsiHandle: string; avatar: string }>
  >,
  setAvatarError?: (msg: string) => void
): void {
  const file = files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setAvatarError?.('Please select an image file');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setAvatarError?.('Avatar image must be under 5 MB');
    return;
  }
  setAvatarError?.('');
  setAvatarFile(file);
  const previewUrl = URL.createObjectURL(file);
  setEditForm(prev => ({ ...prev, avatar: previewUrl }));
}

/** Upload avatar and patch profile fields in a single save operation */
async function saveProfileChanges(
  avatarFile: File | null,
  editForm: { displayName: string; bio: string; rsiHandle: string }
): Promise<void> {
  if (avatarFile) {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    await apiClient.patch('/api/v2/users/me/avatar', formData);
  }

  const payload = buildProfilePayload(editForm);
  if (Object.keys(payload).length > 0) {
    await apiClient.patch('/api/v2/users/me', payload);
  }
}

/** Initiate RSI verification — requests a verification link from the API */
async function initiateRsiVerification(
  rsiHandle: string
): Promise<{ verificationCode: string; verificationUrl?: string }> {
  const response = await rsiVerificationService.initiateUserVerification(rsiHandle.trim());
  if (!response.verificationCode) {
    throw new Error('Failed to generate verification link from server response');
  }

  return {
    verificationCode: response.verificationCode,
    verificationUrl: response.verificationUrl,
  };
}

/** Remove existing RSI verification and refresh auth state */
async function removeRsiVerification(fetchProfile: () => void): Promise<void> {
  await rsiVerificationService.removeUserVerification();
  fetchProfile();
  const { tryAuthWithCookies } = useAuthStore.getState();
  await tryAuthWithCookies();
}

/** Open the user's RSI citizen profile page in a new tab */
function openRsiProfilePage(rsiHandle: string): void {
  const sanitizedHandle = rsiHandle.trim();
  if (!sanitizedHandle) return;
  const encodedHandle = encodeURIComponent(sanitizedHandle);
  const url = `https://robertsspaceindustries.com/citizens/${encodedHandle}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Execute primary org switch with error handling */
async function executeSwitchOrg(
  orgId: string,
  setIsSwitching: (v: boolean) => void,
  notification: { success: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
  setIsSwitching(true);
  try {
    await switchPrimaryOrg(orgId);
    notification.success('Primary organization switched. Reloading...');
    globalThis.setTimeout(() => globalThis.location.reload(), 1000);
  } catch (err) {
    logger.error('Failed to switch org', toError(err));
    notification.error('Failed to switch organization.');
  } finally {
    setIsSwitching(false);
  }
}

/** Reset avatar and refresh profile, ignoring failures */
async function tryResetAvatar(
  source: 'discord' | 'rsi',
  fetchProfile: () => Promise<void> | void
): Promise<void> {
  try {
    await resetAvatar(source);
    await fetchProfile();
  } catch {
    // Non-critical — avatar reset failure doesn't warrant blocking UI
  }
}

/** Execute profile save with error handling */
async function executeSaveProfile(
  avatarFile: File | null,
  editForm: { displayName: string; bio: string; rsiHandle: string },
  fetchProfile: () => void,
  setIsEditDialogOpen: (v: boolean) => void,
  setIsSaving: (v: boolean) => void,
  notification: { error: (msg: string) => void }
): Promise<void> {
  setIsSaving(true);
  try {
    await saveProfileChanges(avatarFile, editForm);
    fetchProfile();
    setIsEditDialogOpen(false);
  } catch (err: unknown) {
    logger.error('Error saving profile:', err);
    const status =
      err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0;
    if (status === 413) {
      notification.error('Avatar image is too large. Please choose a file under 5 MB.');
    } else {
      notification.error('Failed to save profile changes');
    }
  } finally {
    setIsSaving(false);
  }
}

/** Execute RSI link generation with validation and error handling */
async function executeGenerateCode(
  rsiHandle: string,
  setters: {
    setIsGeneratingCode: (v: boolean) => void;
    setVerificationCode: (code: string) => void;
    setVerificationUrl: (url: string) => void;
    setShowVerificationInstructions: (v: boolean) => void;
  },
  notification: { error: (msg: string) => void }
): Promise<void> {
  if (!rsiHandle.trim()) {
    notification.error('Please enter your RSI handle first');
    return;
  }
  setters.setIsGeneratingCode(true);
  try {
    const data = await initiateRsiVerification(rsiHandle);
    setters.setVerificationCode(data.verificationCode);
    setters.setVerificationUrl(data.verificationUrl ?? data.verificationCode);
    setters.setShowVerificationInstructions(true);
  } catch (err: unknown) {
    logger.error('Error generating verification link:', toError(err));
    notification.error(extractRsiErrorMessage(err, 'Failed to generate verification link'));
  } finally {
    setters.setIsGeneratingCode(false);
  }
}

/** Execute RSI handle verification with error handling */
async function executeVerifyRSI(
  verificationCode: string,
  fetchProfile: () => void,
  setters: {
    setIsVerifying: (v: boolean) => void;
    setShowVerificationInstructions: (v: boolean) => void;
  },
  notification: { error: (msg: string) => void; success: (msg: string) => void }
): Promise<void> {
  if (!verificationCode) {
    notification.error('Please generate a verification link first');
    return;
  }
  setters.setIsVerifying(true);
  try {
    await executeRsiVerification(
      fetchProfile,
      notification,
      setters.setShowVerificationInstructions
    );
  } catch (err: unknown) {
    logger.error('Error verifying RSI handle:', toError(err));
    notification.error(
      extractRsiErrorMessage(
        err,
        'Failed to verify RSI handle. Make sure the link is in your RSI bio.'
      )
    );
  } finally {
    setters.setIsVerifying(false);
  }
}

/** Execute RSI re-verification (remove existing and start fresh) */
async function executeReVerify(
  rsiHandle: string | undefined,
  fetchProfile: () => void,
  setters: {
    setIsReVerifying: (v: boolean) => void;
    setRsiHandle: (h: string) => void;
    setVerificationCode: (c: string) => void;
    setVerificationUrl: (u: string) => void;
    setShowVerificationInstructions: (v: boolean) => void;
  },
  notification: { error: (msg: string) => void; success: (msg: string) => void }
): Promise<void> {
  setters.setIsReVerifying(true);
  try {
    await removeRsiVerification(fetchProfile);
    setters.setRsiHandle(rsiHandle ?? '');
    setters.setVerificationCode('');
    setters.setVerificationUrl('');
    setters.setShowVerificationInstructions(false);
    notification.success('Verification removed. You can now re-verify your RSI handle.');
  } catch (err: unknown) {
    logger.error('Error removing verification:', toError(err));
    notification.error('Failed to remove verification. Please try again.');
  } finally {
    setters.setIsReVerifying(false);
  }
}

/** Switch the user's active organization and reload */
async function switchPrimaryOrg(orgId: string): Promise<void> {
  await apiClient.put('/api/v2/users/me/active-organization', { organizationId: orgId });
  const { tryAuthWithCookies } = useAuthStore.getState();
  await tryAuthWithCookies();
}

/** Reset avatar to Discord or RSI source */
async function resetAvatar(source: 'discord' | 'rsi'): Promise<void> {
  await apiClient.post('/api/v2/users/me/avatar/reset', { source });
}

/** Complete RSI verification — returns whether the verification succeeded */
async function completeRsiVerification(): Promise<boolean> {
  const data = await rsiVerificationService.completeUserVerification();
  if (data.verified) {
    const { tryAuthWithCookies } = useAuthStore.getState();
    await tryAuthWithCookies();
  }
  return data.verified;
}

/** Run the full RSI verification flow and update state accordingly */
async function executeRsiVerification(
  fetchProfile: () => void,
  notification: { error: (msg: string) => void; success: (msg: string) => void },
  setShowVerificationInstructions: (v: boolean) => void
): Promise<void> {
  const verified = await completeRsiVerification();
  fetchProfile();
  if (!verified) {
    notification.error(
      'Verification link not found in your RSI bio. Please make sure you added it correctly and saved your profile.'
    );
    return;
  }
  setShowVerificationInstructions(false);
  notification.success(
    'RSI handle verified successfully! You can now remove the link from your bio.'
  );
}

/** Resolve whether the profile being viewed is the current user's own profile */
function resolveProfileContext(
  slug: string | undefined,
  currentUser: { id: string; username?: string } | null
): { isOwnProfile: boolean; profileUserId: string } {
  const isOwnProfile = !slug || slug === currentUser?.id || slug === currentUser?.username;
  const profileUserId = isOwnProfile ? currentUser?.id || '' : slug || '';
  return { isOwnProfile, profileUserId };
}

const UserProfilePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  const { isOwnProfile, profileUserId } = resolveProfileContext(slug, currentUser);

  // React Query hooks for profile data
  const {
    data: myProfileData,
    isLoading: myProfileLoading,
    error: myProfileError,
  } = useMyProfile({ enabled: isOwnProfile && !!profileUserId });

  const {
    data: otherProfileData,
    isLoading: otherProfileLoading,
    error: otherProfileError,
  } = useUserProfileQuery(isOwnProfile ? undefined : profileUserId);

  const { profile, loading, error } = deriveProfileState(
    isOwnProfile,
    myProfileData,
    otherProfileData,
    myProfileLoading,
    otherProfileLoading,
    myProfileError,
    otherProfileError
  );

  // Resolved UUID from the profile response (needed for endpoints that only accept UUIDs)
  const resolvedUserId = profile?.id ?? (isOwnProfile ? currentUser?.id : undefined);

  // Trust score query — only fetch when own profile or user allows it
  const showTrustScore = isOwnProfile || !!profile?.showRsiInfo;
  const { data: trustScore } = useUserTrustScore(showTrustScore ? resolvedUserId : undefined);

  // Ships query (only if allowed)
  const { data: shipsData } = useProfileUserShips(profileUserId || undefined, {
    enabled: !!profileUserId && (isOwnProfile || !!profile?.showShips),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ships: any[] = (shipsData as any[]) ?? [];

  // Activity query (only if allowed)
  const { data: activitiesData } = useUserActivityTimeline(profileUserId || undefined, 30, {
    enabled: !!profileUserId && (isOwnProfile || !!profile?.showActivity),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activities: any[] = (activitiesData as any[]) ?? [];

  // Hunter profile query — only fetched when viewing your own profile (org context required)
  const {
    data: hunterProfile,
    isLoading: hunterProfileLoading,
    error: hunterProfileError,
  } = useHunterProfile(isOwnProfile ? undefined : resolvedUserId);

  const fetchProfile = () => {
    return queryClient.invalidateQueries({
      // Use a length-2 prefix so all per-user variants of `current` are invalidated,
      // since userKeys.current(userId) now embeds the signed-in user's id.
      queryKey: isOwnProfile ? [...userKeys.all, 'current'] : userKeys.detail(profileUserId),
    });
  };

  // ── Active organization switching ──
  const { data: orgsResponse } = useQuery({
    queryKey: ['users', 'me', 'organizations'],
    queryFn: async () => {
      const res = await apiClient.get<Record<string, unknown>>('/api/v2/users/me/organizations');
      return res.data;
    },
    enabled: isOwnProfile,
  });

  const userOrgs = extractOrgsArray(orgsResponse);

  const hasMultipleOrgs = userOrgs.length > 1;
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);

  const notification = useNotification();

  const handleSwitchPrimaryOrg = async (orgId: string) => {
    if (orgId === currentUser?.activeOrgId) return;
    await executeSwitchOrg(orgId, setIsSwitchingOrg, notification);
  };

  // Edit profile state
  const [selectedTab, setSelectedTab] = useState<React.Key>('profile');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    rsiHandle: '',
    avatar: '',
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState('');

  // RSI Verification state
  const [rsiHandle, setRsiHandle] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [showVerificationInstructions, setShowVerificationInstructions] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isReVerifying, setIsReVerifying] = useState(false);

  // SCStats state
  const [scstatsImportOpen, setScstatsImportOpen] = useState(false);

  const tabs = useMemo(
    () => buildProfileTabs(isOwnProfile, profile, ships.length),
    [isOwnProfile, profile, ships.length]
  );

  // Handle back navigation
  const handleBack = () => {
    navigate(-1);
  };

  // Handle opening edit dialog
  const handleEditProfile = () => {
    setEditForm({
      displayName: profile?.displayName ?? profile?.username ?? '',
      bio: profile?.bio ?? '',
      rsiHandle: profile?.rsiHandle ?? '',
      avatar: profile?.avatar ?? '',
    });
    setAvatarFile(null);
    setAvatarError('');
    setIsEditDialogOpen(true);
  };

  // Handle saving profile changes
  const handleSaveProfile = async () => {
    await executeSaveProfile(
      avatarFile,
      editForm,
      fetchProfile,
      setIsEditDialogOpen,
      setIsSaving,
      notification
    );
  };

  // Generate RSI verification link
  const handleGenerateCode = async () => {
    await executeGenerateCode(
      rsiHandle,
      {
        setIsGeneratingCode,
        setVerificationCode,
        setVerificationUrl,
        setShowVerificationInstructions,
      },
      notification
    );
  };

  // Handle RSI verification
  const handleVerifyRSI = async () => {
    await executeVerifyRSI(
      verificationCode,
      fetchProfile,
      {
        setIsVerifying,
        setShowVerificationInstructions,
      },
      notification
    );
  };

  // Handle RSI re-verification
  const handleReVerify = async () => {
    await executeReVerify(
      profile?.rsiHandle,
      fetchProfile,
      {
        setIsReVerifying,
        setRsiHandle,
        setVerificationCode,
        setVerificationUrl,
        setShowVerificationInstructions,
      },
      notification
    );
  };

  // Handle avatar file selection
  const handleAvatarChange = (files: FileList | null) => {
    processAvatarFile(files, setAvatarFile, setEditForm, setAvatarError);
  };

  const handleResetAvatar = async (source: 'discord' | 'rsi') => {
    await tryResetAvatar(source, fetchProfile);
  };

  if (loading) {
    return (
      <Box p={4}>
        <Stack alignItems="center" justifyContent="center" minHeight={320} spacing={2}>
          <CircularProgress aria-label="Loading profile..." size={40} />
          <Typography>Loading user profile...</Typography>
        </Stack>
      </Box>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <Box p={4}>
        <Stack spacing={2}>
          <Button variant="outlined" onClick={handleBack} startIcon={<ArrowBackIcon />}>
            Back
          </Button>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2} alignItems="center">
              <Typography>{error || 'Failed to load user profile'}</Typography>
              <Button variant="outlined" onClick={fetchProfile}>
                Retry
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    );
  }

  /** Verification chip shown in header — extracted to simplify ternary nesting */
  const verificationStatusChip = profile.rsiVerified ? (
    <Chip color="success" label="Verified" icon={<CheckCircleIcon />} />
  ) : (
    <Chip label="Not Verified" />
  );

  /** Re-verify button label with loading state */
  const reVerifyButtonContent = isReVerifying ? (
    <>
      <CircularProgress size={16} sx={{ mr: 1 }} />
      Removing...
    </>
  ) : (
    'Re-verify RSI Handle'
  );

  /** RSI Verification section — extracted to reduce renderProfileTab complexity */
  const renderRsiVerificationSection = () => (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">RSI Verification</Typography>
          {verificationStatusChip}
        </Stack>

        {profile.rsiVerified ? (
          <Stack spacing={1}>
            <Typography>
              Your RSI handle <strong>{profile.rsiHandle}</strong> has been verified.
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Thank you for verifying your Star Citizen account!
            </Typography>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              onClick={() => void handleReVerify()}
              disabled={isReVerifying}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            >
              {reVerifyButtonContent}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography>
              Verify your RSI handle to prove you're a real Star Citizen player and unlock
              additional features.
            </Typography>

            <TextField
              label="RSI Handle"
              value={rsiHandle}
              onChange={e => {
                setRsiHandle(e.target.value);
              }}
              placeholder="Enter your RSI handle"
              helperText="Your Roberts Space Industries handle"
              fullWidth
            />

            <Button
              variant="contained"
              onClick={handleGenerateCode}
              disabled={!rsiHandle.trim() || isGeneratingCode}
              sx={{ alignSelf: 'flex-start' }}
            >
              {isGeneratingCode ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Generating...
                </>
              ) : (
                'Generate Verification Link'
              )}
            </Button>

            {verificationCode && showVerificationInstructions && (
              <Paper sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1">
                    <ListAltIcon sx={{ fontSize: 18, verticalAlign: 'middle', mr: 0.5 }} />
                    RSI Verification Instructions
                  </Typography>

                  <Stack spacing={1}>
                    <Typography fontWeight={700}>Step 1: Copy Your Verification Link</Typography>
                    <Typography color="text.secondary">
                      Copy the link below. You'll paste it into your RSI bio — no code to type by
                      hand.
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          flex: 1,
                          bgcolor: 'background.default',
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          fontFamily: 'monospace',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          textAlign: 'center',
                          wordBreak: 'break-all',
                          userSelect: 'all',
                        }}
                      >
                        {verificationUrl || verificationCode}
                      </Box>
                      <Tooltip title={codeCopied ? 'Copied!' : 'Copy to clipboard'}>
                        <IconButton
                          color={codeCopied ? 'success' : 'default'}
                          onClick={() => {
                            navigator.clipboard.writeText(verificationUrl || verificationCode);
                            setCodeCopied(true);
                            setTimeout(() => setCodeCopied(false), 2000);
                          }}
                          aria-label="Copy verification link"
                        >
                          {codeCopied ? <CheckIcon /> : <ContentCopyIcon />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack spacing={1}>
                    <Typography fontWeight={700}>Step 2: Open Your RSI Profile</Typography>
                    <Typography color="text.secondary">
                      Click the button below to open your RSI profile page in a new tab.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => openRsiProfilePage(rsiHandle)}
                      startIcon={<OpenInNewIcon />}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Open My RSI Profile
                    </Button>
                  </Stack>

                  <Divider />

                  <Stack spacing={1}>
                    <Typography fontWeight={700}>Step 3: Add the Link to Your Bio</Typography>
                    <Typography color="text.secondary">On your RSI profile page:</Typography>
                    <Stack spacing={0.5} sx={{ pl: 2 }}>
                      <Typography>
                        • Look for the "Edit" or pencil icon near your Short Bio
                      </Typography>
                      <Typography>• Click it to enter edit mode</Typography>
                      <Typography>• Paste the verification link anywhere in your bio</Typography>
                      <Typography>• Save your profile changes</Typography>
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack spacing={1}>
                    <Typography fontWeight={700}>Step 4: We Detect It Automatically</Typography>
                    <Typography color="text.secondary">
                      Once you've saved your RSI profile, we'll detect the link automatically within
                      a couple of minutes — no need to come back. In a hurry? Click below to check
                      right now.
                    </Typography>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleVerifyRSI}
                      disabled={isVerifying}
                      startIcon={isVerifying ? undefined : <CheckIcon />}
                      sx={{ alignSelf: 'flex-start', mt: 1 }}
                    >
                      {isVerifying ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          Verifying...
                        </>
                      ) : (
                        'Verify Now'
                      )}
                    </Button>
                  </Stack>

                  <Divider />

                  <Typography color="text.secondary" fontStyle="italic">
                    <LightbulbIcon
                      sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5, color: 'warning.main' }}
                    />
                    Pro Tip: You can remove the verification link from your RSI profile after the
                    verification is complete.
                  </Typography>
                </Stack>
              </Paper>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );

  const renderProfileTab = () => (
    <Stack spacing={3} mt={2}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">About</Typography>
          {profile.bio ? (
            <Typography>{profile.bio}</Typography>
          ) : (
            <Typography color="text.secondary" fontStyle="italic">
              No bio available
            </Typography>
          )}
          {profile.createdAt && (
            <Typography variant="body2" color="text.secondary">
              Member since: {new Date(profile.createdAt).toLocaleDateString()}
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* Titles & Badges Dock */}
      {resolvedUserId && <UserBadgesDock userId={resolvedUserId} isOwnProfile={isOwnProfile} />}

      {/* Organizations & Ranks — shown when allowed by privacy settings */}
      {(isOwnProfile || profile.showOrganizations !== false) &&
        profile.organizations &&
        profile.organizations.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BusinessIcon color="primary" />
                <Typography variant="h6">Organizations</Typography>
              </Stack>
              <Stack spacing={1}>
                {profile.organizations.map(org => (
                  <Stack
                    key={org.orgId}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {org.orgLogo ? (
                      <Avatar
                        src={sanitizeImageUrl(org.orgLogo) || undefined}
                        alt={org.orgName}
                        sx={{ width: 32, height: 32 }}
                      >
                        {org.orgName.charAt(0)}
                      </Avatar>
                    ) : (
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                        {org.orgName.charAt(0)}
                      </Avatar>
                    )}
                    <Typography sx={{ flex: 1, fontWeight: 500 }}>{org.orgName}</Typography>
                    <Chip
                      label={org.roleName}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}

      {/* RSI Verified badge — shown to visitors when allowed */}
      {!isOwnProfile && profile.showVerifiedBadge !== false && profile.rsiVerified && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CheckCircleIcon color="success" />
            <Box>
              <Typography variant="h6">RSI Verified</Typography>
              {profile.rsiHandle && (
                <Typography color="text.secondary">
                  RSI Handle: <strong>{profile.rsiHandle}</strong>
                </Typography>
              )}
            </Box>
            <Chip color="success" label="Verified" icon={<CheckCircleIcon />} sx={{ ml: 'auto' }} />
          </Stack>
        </Paper>
      )}

      {isOwnProfile && renderRsiVerificationSection()}

      {/* Active Organization Switcher — only for own profile with multiple orgs */}
      {isOwnProfile && hasMultipleOrgs && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <BusinessIcon color="primary" />
              <Typography variant="h6">Active Organization</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Switch your primary organization. All org-scoped pages (fleet, ops, activities) will
              reflect the selected organization.
            </Typography>
            <Divider />
            <FormControl fullWidth>
              <InputLabel>Organization</InputLabel>
              <Select
                value={currentUser?.activeOrgId ?? ''}
                label="Organization"
                onChange={e => handleSwitchPrimaryOrg(e.target.value)}
                disabled={isSwitchingOrg}
                startAdornment={<SwapHorizIcon sx={{ mr: 1, color: 'text.secondary' }} />}
              >
                {userOrgs.map(org => (
                  <MenuItem key={String(org.id)} value={String(org.id)}>
                    {String(org.name ?? org.id)}
                    {String(org.role ?? '') === 'owner' || String(org.role ?? '') === 'founder'
                      ? ' (Owner)'
                      : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {isSwitchingOrg && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Switching organization...
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {/* SCStats Gameplay Metrics — shown to visitors only if showScStats is enabled */}
      {(isOwnProfile || profile.showScStats) && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">SCStats Gameplay Metrics</Typography>
              {isOwnProfile && (
                <Button variant="outlined" size="small" onClick={() => setScstatsImportOpen(true)}>
                  Import / Update Data
                </Button>
              )}
            </Stack>
            <SCStatsDashboardWidget userId={profileUserId} />
          </Stack>
        </Paper>
      )}

      {/* Reputation & Standing — shown to visitors only if showRsiInfo is enabled */}
      {(isOwnProfile || showTrustScore) && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Reputation & Standing</Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              divider={<Divider orientation="vertical" flexItem />}
            >
              <Stack alignItems="center" spacing={0.5}>
                <Stack direction="row" spacing={0.25}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const rating = trustScore?.userReputation.averageRating ?? 0;
                    return (
                      <React.Fragment key={star}>
                        {star <= Math.round(rating) ? (
                          <StarIcon sx={{ color: 'warning.main', fontSize: 24 }} />
                        ) : (
                          <StarBorderIcon sx={{ color: 'warning.main', fontSize: 24 }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {(trustScore?.userReputation.averageRating ?? 0).toFixed(1)} / 5.0 Rating
                </Typography>
              </Stack>
              <Stack alignItems="center" spacing={0.5}>
                <Typography variant="h5" fontWeight={700} color="primary">
                  {trustScore?.combinedScore ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Trust Score
                </Typography>
              </Stack>
              <Stack alignItems="center" spacing={0.5}>
                <Chip
                  label={trustScore?.userReputation.tier ?? 'Unranked'}
                  color="info"
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Standing
                </Typography>
              </Stack>
              <Stack alignItems="center" spacing={0.5}>
                <Typography variant="h5" fontWeight={700} sx={{ color: 'success.main' }}>
                  {trustScore?.reliability ?? '–'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Reliability
                </Typography>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Trust score combines LFG sessions, trading reputation, activity completion, and peer
              ratings.
            </Typography>
          </Stack>
        </Paper>
      )}
    </Stack>
  );

  const renderShipsTab = () => (
    <Box mt={2}>
      {ships.length > 0 ? (
        <Grid container spacing={2}>
          {ships.map(ship => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={ship.id}>
              <Paper sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">{ship.shipName}</Typography>
                  </Stack>
                  {ship.manufacturer && <Typography>{ship.manufacturer}</Typography>}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Stack alignItems="center" spacing={2}>
            <RocketLaunchIcon fontSize="large" />
            <Typography>No ships to display</Typography>
          </Stack>
        </Paper>
      )}
    </Box>
  );

  const renderActivityTab = () => (
    <Box mt={2}>
      {activities && activities.length > 0 ? (
        <Stack spacing={2}>
          {activities.map(activity => (
            <Paper key={activity.id} sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography fontWeight={700}>{activity.action}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(activity.timestamp).toLocaleString()}
                  </Typography>
                </Stack>
                {activity.description && (
                  <Typography color="text.secondary">{activity.description}</Typography>
                )}
                <Chip label={activity.entityType} />
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Stack alignItems="center" spacing={2}>
            <TimelineIcon fontSize="large" />
            <Typography>No recent activity</Typography>
          </Stack>
        </Paper>
      )}
    </Box>
  );

  const renderSecurityTab = () => (
    <Box mt={2}>
      <Stack spacing={4}>
        <TwoFactorManagement />
        <Divider />
        <PasskeyManagement />
      </Stack>
    </Box>
  );

  /**
   * Bounty Hunter tab — summary of hunter profile stats.
   * Sources data from `/api/v2/bounties/hunter/profile` via `useHunterProfile`.
   * Requires the user to have an active organization context.
   */
  const renderBountyHunterTab = () => {
    if (hunterProfileLoading) {
      return (
        <Box mt={2} display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      );
    }

    if (hunterProfileError) {
      return (
        <Box mt={2}>
          <Alert severity="error">
            Failed to load Bounty Hunter profile. An active organization is required.
          </Alert>
        </Box>
      );
    }

    if (!hunterProfile) {
      return (
        <Box mt={2}>
          <Alert severity="info">No Bounty Hunter profile available yet.</Alert>
        </Box>
      );
    }

    const rankLabel = hunterProfile.rank.charAt(0).toUpperCase() + hunterProfile.rank.slice(1);
    const isElite =
      hunterProfile.rank === HunterRank.ELITE || hunterProfile.rank === HunterRank.LEGENDARY;
    const rankIcon = (
      <StarIcon
        sx={{
          fontSize: 18,
          color: isElite ? 'warning.main' : 'text.secondary',
          verticalAlign: 'middle',
        }}
      />
    );

    const specializations = [
      {
        type: 'Kill',
        icon: <DangerousIcon sx={{ fontSize: 14, color: 'error.main' }} />,
        count: hunterProfile.killBountiesCompleted,
        color: 'error.main',
      },
      {
        type: 'Capture',
        icon: <LinkIcon sx={{ fontSize: 14, color: 'warning.main' }} />,
        count: hunterProfile.captureBountiesCompleted,
        color: 'warning.main',
      },
      {
        type: 'Intel',
        icon: <SearchIcon sx={{ fontSize: 14, color: 'info.main' }} />,
        count: hunterProfile.intelBountiesCompleted,
        color: 'info.main',
      },
      {
        type: 'Transport',
        icon: <Inventory2Icon sx={{ fontSize: 14, color: 'success.main' }} />,
        count: hunterProfile.transportBountiesCompleted,
        color: 'success.main',
      },
      {
        type: 'Rescue',
        icon: <SosIcon sx={{ fontSize: 14, color: 'info.light' }} />,
        count: hunterProfile.rescueBountiesCompleted,
        color: 'info.light',
      },
      {
        type: 'Custom',
        icon: <StarIcon sx={{ fontSize: 14, color: 'secondary.main' }} />,
        count: hunterProfile.customBountiesCompleted,
        color: 'secondary.main',
      },
    ];

    const totalCompleted = hunterProfile.totalBountiesCompleted || 1;

    return (
      <Box mt={2}>
        <Stack spacing={3}>
          {/* Rank & Key Stats */}
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">{rankIcon} Hunter Profile</Typography>
                <Chip label={rankLabel.toUpperCase()} color="info" sx={{ fontWeight: 700 }} />
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack alignItems="center" spacing={0.5}>
                    <GpsFixedIcon color="primary" />
                    <Typography variant="h5" fontWeight={700}>
                      {hunterProfile.totalBountiesCompleted}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack alignItems="center" spacing={0.5}>
                    <TrendingUpIcon sx={{ color: 'success.main' }} />
                    <Typography variant="h5" fontWeight={700} sx={{ color: 'success.main' }}>
                      {Math.round(hunterProfile.successRate)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Success Rate
                    </Typography>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack alignItems="center" spacing={0.5}>
                    <StarIcon sx={{ color: 'warning.main' }} />
                    <Typography variant="h5" fontWeight={700} color="primary">
                      {hunterProfile.reputationScore.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Reputation
                    </Typography>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack alignItems="center" spacing={0.5}>
                    <Typography variant="h5" fontWeight={700} sx={{ color: 'warning.main' }}>
                      {hunterProfile.totalRewardsEarned.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      aUEC Earned
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          {/* Specializations */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Specializations
            </Typography>
            <Stack spacing={1.5}>
              {specializations.map(spec => (
                <Stack key={spec.type} spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">
                      {spec.icon} {spec.type}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {spec.count}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(spec.count / totalCompleted) * 100}
                    aria-label={`${spec.type} progress`}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      '& .MuiLinearProgress-bar': { backgroundColor: spec.color },
                    }}
                  />
                </Stack>
              ))}
            </Stack>
          </Paper>

          {/* Streak & Performance */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Performance
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight={700}>
                    {hunterProfile.currentStreak}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Streak
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight={700}>
                    {hunterProfile.longestStreak}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Longest Streak
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight={700}>
                    {Math.round(hunterProfile.averageCompletionTimeMinutes)}m
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Completion
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Stack alignItems="center">
                  <Typography variant="h6" fontWeight={700}>
                    {hunterProfile.totalBountiesClaimed}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Claimed
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Link to full bounty profile page */}
          <Button
            variant="outlined"
            onClick={() => navigate('/bounty/profile')}
            sx={{ alignSelf: 'flex-start' }}
          >
            View Full Bounty Profile
          </Button>
        </Stack>
      </Box>
    );
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'profile':
        return renderProfileTab();
      case 'ships':
        return renderShipsTab();
      case 'activity':
        return renderActivityTab();
      case 'security':
        return renderSecurityTab();
      case 'bounty':
        return renderBountyHunterTab();
      default:
        return null;
    }
  };

  return (
    <Box p={4}>
      <Stack spacing={4}>
        <Button
          variant="outlined"
          onClick={handleBack}
          startIcon={<ArrowBackIcon />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back
        </Button>

        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="flex-start">
            <Avatar
              src={
                profile.avatar && sanitizeImageUrl(profile.avatar)
                  ? sanitizeImageUrl(profile.avatar)
                  : undefined
              }
              alt={`${profile.username} avatar`}
              sx={{ width: 120, height: 120, bgcolor: 'grey.200', fontSize: 48 }}
            >
              {!profile.avatar && <PersonIcon fontSize="inherit" />}
            </Avatar>

            <Stack spacing={1.5} flex={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h5">{profile.displayName || profile.username}</Typography>
                {profile.isPrivateProfile && <Chip icon={<LockIcon />} label="Private" />}
                {profile.rsiVerified && (
                  <Chip color="success" icon={<CheckCircleIcon />} label="RSI Verified" />
                )}
                {/* SCStats badge — data source not yet implemented */}
                {isOwnProfile && (
                  <>
                    <Button
                      variant="contained"
                      startIcon={<EditIcon />}
                      onClick={handleEditProfile}
                      sx={{ ml: { xs: 0, sm: 1 } }}
                    >
                      Edit Profile
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => navigate('/privacy')}
                      sx={{ ml: { xs: 0, sm: 1 } }}
                    >
                      Edit Privacy Settings
                    </Button>
                  </>
                )}
              </Stack>

              {profile.displayName && profile.username !== profile.displayName && (
                <Typography color="text.secondary">@{profile.username}</Typography>
              )}

              {profile.rsiHandle && (
                <Typography color="text.secondary">RSI Handle: {profile.rsiHandle}</Typography>
              )}

              {profile.bio && <Typography>{profile.bio}</Typography>}

              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                {profile.role && <Chip label={profile.role} />}
                {profile.lastActiveAt && (
                  <Typography variant="body2" color="text.secondary">
                    Last active: {new Date(profile.lastActiveAt).toLocaleDateString()}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Stack>
        </Paper>

        <Box>
          <Tabs
            value={selectedTab}
            onChange={(_, value) => setSelectedTab(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map(tab => (
              <Tab
                key={tab.key}
                value={tab.key}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>
          {renderTabContent()}
        </Box>

        {!isOwnProfile && profile.isPrivateProfile && (
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <LockIcon />
              <Typography>
                This user has set their profile to private. Some information may not be visible.
              </Typography>
            </Stack>
          </Paper>
        )}
      </Stack>

      {isOwnProfile && (
        <Dialog
          open={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogContent>
            <Stack spacing={3} mt={1}>
              <Stack spacing={1} alignItems="center">
                <Avatar
                  src={
                    editForm.avatar && sanitizeImageUrl(editForm.avatar)
                      ? sanitizeImageUrl(editForm.avatar)
                      : undefined
                  }
                  alt="Avatar preview"
                  sx={{ width: 120, height: 120, bgcolor: 'grey.200', fontSize: 48 }}
                >
                  {!editForm.avatar && <PersonIcon fontSize="inherit" />}
                </Avatar>
                <Button component="label" variant="outlined">
                  {'Upload Avatar'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={e => handleAvatarChange(e.target.files)}
                  />
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button variant="text" size="small" onClick={() => handleResetAvatar('discord')}>
                    Reset to Discord
                  </Button>
                  <Button variant="text" size="small" onClick={() => handleResetAvatar('rsi')}>
                    Reset to RSI
                  </Button>
                </Stack>
                {avatarError && (
                  <Alert severity="error" sx={{ width: '100%' }}>
                    {avatarError}
                  </Alert>
                )}
                <Typography variant="body2" color="text.secondary">
                  Upload an avatar image (max 5 MB), or reset to your Discord or RSI profile picture
                </Typography>
              </Stack>

              <TextField
                label="Display Name"
                value={editForm.displayName}
                onChange={e => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                fullWidth
              />

              <TextField
                label="Bio"
                value={editForm.bio}
                onChange={e => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                fullWidth
                multiline
                minRows={3}
                slotProps={{ htmlInput: { maxLength: 500 } }}
                helperText="Tell others about yourself"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="text" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* SCStats Import Dialog */}
      {isOwnProfile && (
        <SCStatsImportDialog
          userId={profileUserId}
          open={scstatsImportOpen}
          onClose={() => setScstatsImportOpen(false)}
          onSuccess={fetchProfile}
        />
      )}
    </Box>
  );
};

export const UserProfilePageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="User Profile"
    fallbackMessage="Unable to load user profile. Please try again later."
    showHomeButton={true}
  >
    <UserProfilePage />
  </FeatureErrorBoundary>
);
