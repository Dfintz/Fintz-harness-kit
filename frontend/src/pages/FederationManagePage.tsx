import {
  Add as AddIcon,
  Campaign as AnnouncementsIcon,
  Assignment as ApplicationsIcon,
  ArrowBack as ArrowBackIcon,
  Badge as BadgeIcon,
  Balance as BalanceIcon,
  Bolt as BoltIcon,
  MenuBook as BookIcon,
  BusinessCenter as BusinessCenterIcon,
  Construction as ConstructionIcon,
  Dangerous as DangerousIcon,
  Dashboard as DashboardIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Flag as DiplomacyIcon,
  SmartToy as DiscordIcon,
  Edit as EditIcon,
  Event as EventIcon,
  ExpandMore as ExpandMoreIcon,
  FiberManualRecord as FiberManualRecordIcon,
  RocketLaunch as FleetsIcon,
  Forum as ForumIcon,
  Gavel as GavelIcon,
  Tune as GovernanceIcon,
  Groups as GroupsIcon,
  People as HRIcon,
  Handshake as HandshakeIcon,
  HeadsetMic as HeadsetMicIcon,
  Security as IntelIcon,
  Inventory as InventoryIcon,
  Link as LinkIcon,
  ListAlt as ListAltIcon,
  Map as MapIcon,
  AccountTree as OrgChartIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  HowToVote as PollIcon,
  PushPin as PushPinIcon,
  SatelliteAlt as SatelliteAltIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  WorkspacePremium as TeamIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
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
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { FederationGuildSettingsPanel } from '@/components/federation/FederationGuildSettingsPanel';
import { DataTable, type DataTableColumn } from '@/components/shared';
import { VoiceServerConfigPanel } from '@/components/voice/VoiceServerConfigPanel';
import { VoiceServerStatsPanel } from '@/components/voice/VoiceServerStatsPanel';
import {
  useAddFederationResource,
  useAddFederationTeamMember,
  useAppointAmbassador,
  useApproveFederationIntel,
  useArchiveFederationIntel,
  useCastFederationVote as useCastFedPollVote,
  useCastVote,
  useCloseFederationPoll,
  useCreateFederationAnnouncement,
  useCreateFederationPoll,
  useCreateFederationTeam,
  useCreateFederationWikiPage,
  useCreateProposal,
  useCreateTreaty,
  useDeleteFederationAnnouncement,
  useDeleteFederationIntel,
  useDeleteFederationPoll,
  useDeleteFederationTeam,
  useDeleteFederationWikiPage,
  useDisbandFederation,
  useFederation,
  useFederationAmbassadors,
  useFederationAnnouncements,
  useFederationApplications,
  useFederationContributions,
  useFederationDiscordConflicts,
  useFederationDiscordStatus,
  useFederationFleets,
  useFederationIntel,
  useFederationPersonnel,
  useFederationPersonnelSummary,
  useFederationPolls,
  useFederationProposals,
  useFederationSettings,
  useFederationStats,
  useFederationTeams,
  useFederationWikiPages,
  useInviteMember,
  usePostFederationAnnouncementToDiscord,
  usePostFederationPollToDiscord,
  useRemoveAmbassador,
  useRemoveFederationResource,
  useRemoveFederationTeamMember,
  useRemoveMember,
  useResolveFederationDiscordConflict,
  useRespondToTreaty,
  useReviewFederationApplication,
  useSetupFederationDiscord,
  useSubmitFederationIntel,
  useSucceedChairman,
  useTerminateTreaty,
  useToggleAnnouncementPin,
  useUnlinkFederationDiscord,
  useUpdateAmbassador,
  useUpdateFederation,
  useUpdateFederationSettings,
  useUpdateFederationTeam,
  useUpdateFederationWikiPage,
  useUpdateMemberRole,
  useUpdateSuccessionMode,
} from '@/hooks/queries/useFederationManagementQueries';
import { useOrganizationMembers } from '@/hooks/queries/useOrganizationQueries';
import { useDiscordGuildChannels } from '@/hooks/queries/useOrgSettingsQueries';
import { useOrgSearch, type OrgSearchResult } from '@/hooks/queries/useRelationshipQueries';
import {
  useDeleteFedVoiceConfig,
  useFedVoiceConfig,
  useFedVoiceStatus,
  useFedWhitelistSuggestions,
  useUpdateFedVoiceConfig,
} from '@/hooks/queries/useVoiceServerQueries';
import { apiClient, isApiClientError } from '@/services/apiClient';
import { type OrganizationMemberV2 } from '@/services/organizationServiceV2';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { darkFieldSx, darkSelectSx } from '@/utils/formStyles';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx } from '@/utils/statusStyles';

import {
  type FederationAmbassador,
  type FederationAmbassadorPermission,
  type FederationAmbassadorRole,
  type FederationAnnouncement,
  type FederationAnnouncementAudience,
  type FederationApplication,
  type FederationAssociationType,
  type FederationIntelClassification,
  type FederationIntelEntry,
  type FederationMember,
  type FederationPersonnel,
  type FederationPoll,
  type FederationResource,
  type FederationRole,
  type FederationTeam,
  type FederationTeamMember,
  type FederationTeamStatus,
  type FederationTeamType,
  type FederationTreaty,
  type FederationVotingMode,
  type FederationWikiPage,
  type FederationWikiVisibility,
  type ManagedFederation,
  type ProposalType,
  type ResourceType,
  type TreatyType,
  type VoteChoice,
} from '@/services/federationManagementService';

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageSx = (theme: Theme) => ({
  p: { xs: 2, md: 3 },
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
  color: 'common.white',
});

const cardSx = (theme: Theme) => ({
  background: alpha(theme.palette.background.paper, 0.6),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  borderRadius: 2,
  p: 2,
});

const cyanBtnSx = (theme: Theme) => ({
  borderColor: alpha(theme.palette.primary.main, 0.4),
  color: 'primary.main',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    background: alpha(theme.palette.primary.main, 0.08),
  },
});

const dialogPaperSx = (theme: Theme) => ({
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  color: 'common.white',
});

const getRoleColor = (role: FederationRole, theme: Theme): string => {
  switch (role) {
    case 'founder':
      return theme.palette.warning.main;
    case 'leader':
      return theme.palette.primary.main;
    case 'council':
      return theme.palette.secondary.main;
    case 'member':
      return theme.palette.success.main;
    case 'observer':
      return theme.palette.grey[600];
    default:
      return theme.palette.grey[600];
  }
};

const getTreatyColor = (type: TreatyType, theme: Theme): string => {
  switch (type) {
    case 'mutual_defense':
      return theme.palette.error.main;
    case 'trade':
      return theme.palette.success.main;
    case 'resource_sharing':
      return theme.palette.primary.main;
    case 'non_aggression':
      return theme.palette.warning.main;
    case 'custom':
      return theme.palette.secondary.main;
    default:
      return theme.palette.grey[600];
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const canManage = (role?: FederationRole) => role === 'founder' || role === 'leader';

const canVote = (role?: FederationRole) =>
  role === 'founder' || role === 'leader' || role === 'council';

/** Map a vote choice to a theme palette color key */
const getVoteColor = (vote: string, theme: Theme): string => {
  if (vote === 'approve') return theme.palette.success.main;
  if (vote === 'reject') return theme.palette.error.main;
  return theme.palette.grey[600];
};

/** Map a vote choice to a short MUI color token */
const getVoteColorToken = (vote: string): string => {
  if (vote === 'approve') return 'success.main';
  if (vote === 'reject') return 'error.main';
  return 'text.disabled';
};

/** Map a proposal status to its border color */
const getProposalBorderColor = (status: string, isOpen: boolean, theme: Theme): string => {
  if (isOpen) return theme.palette.info.main;
  if (status === 'passed') return theme.palette.success.main;
  if (status === 'rejected') return theme.palette.error.main;
  return theme.palette.grey[600];
};

// ─── Danger Zone (Disband) ────────────────────────────────────────────────────

const DangerZone: React.FC<{
  federationId: string;
  federationName: string;
  onDisbanded?: () => void;
}> = ({ federationId, federationName, onDisbanded }) => {
  const theme = useTheme();
  const notification = useNotification();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const disbandMutation = useDisbandFederation();

  const handleDisband = async () => {
    try {
      await disbandMutation.mutateAsync(federationId);
      setConfirmOpen(false);
      onDisbanded?.();
    } catch (err) {
      const msg = isApiClientError(err) ? err.message : 'Failed to disband alliance.';
      notification.error(msg);
    }
  };

  return (
    <Stack
      spacing={2}
      sx={{
        ...cardSx,
        borderColor: alpha(theme.palette.error.main, 0.4),
        border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: 'error.main' }}>
        Danger Zone
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Disbanding is permanent. All members will be removed and the alliance will be dissolved.
      </Typography>
      <Box>
        <Button variant="outlined" color="error" onClick={() => setConfirmOpen(true)}>
          Disband Alliance
        </Button>
      </Box>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmText('');
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>Disband Alliance</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will permanently dissolve <strong>{federationName}</strong> and remove all members.
            This action cannot be undone.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Type the alliance name to confirm:
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={federationName}
            sx={darkFieldSx}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConfirmOpen(false);
              setConfirmText('');
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={confirmText !== federationName || disbandMutation.isPending}
            onClick={handleDisband}
          >
            {disbandMutation.isPending ? <CircularProgress size={18} /> : 'Disband'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Settings Tab ─────────────────────────────────────────────────────────────

const SettingsTab: React.FC<{
  federation: ManagedFederation;
  myRole?: FederationRole;
  onDisbanded?: () => void;
}> = ({ federation, myRole, onDisbanded }) => {
  const theme = useTheme();
  const [name, setName] = useState(federation.name);
  const [description, setDescription] = useState(federation.description);
  const [isPublic, setIsPublic] = useState(federation.isPublic);
  const [logoUrl, setLogoUrl] = useState(federation.logoUrl ?? '');
  const [bannerUrl, setBannerUrl] = useState(federation.bannerUrl ?? '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [discordUrl, setDiscordUrl] = useState(federation.discordUrl ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(federation.websiteUrl ?? '');
  const [reviewDate, setReviewDate] = useState(federation.reviewDate?.slice(0, 10) ?? '');
  const [expiryDate, setExpiryDate] = useState(federation.expiryDate?.slice(0, 10) ?? '');
  const [autoRenew, setAutoRenew] = useState(federation.autoRenew ?? false);
  const updateMutation = useUpdateFederation();
  const canManageVoice = canManage(myRole);
  const {
    data: voiceConfig,
    isLoading: voiceConfigLoading,
    error: voiceConfigError,
  } = useFedVoiceConfig(federation.id);
  const updateVoiceConfig = useUpdateFedVoiceConfig();
  const deleteVoiceConfig = useDeleteFedVoiceConfig();
  const { data: voiceStatus } = useFedVoiceStatus(voiceConfig?.enabled ? federation.id : undefined);
  const { data: voiceSuggestions, isLoading: voiceSuggestionsLoading } = useFedWhitelistSuggestions(
    federation.id,
    canManageVoice && voiceConfig?.enabled === true
  );
  const notification = useNotification();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: federation.id,
        data: {
          name: name.trim(),
          description: description.trim(),
          isPublic,
          ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : { logoUrl: undefined }),
          ...(bannerUrl.trim() ? { bannerUrl: bannerUrl.trim() } : { bannerUrl: undefined }),
          ...(discordUrl.trim() ? { discordUrl: discordUrl.trim() } : { discordUrl: undefined }),
          ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : { websiteUrl: undefined }),
          reviewDate: reviewDate || null,
          expiryDate: expiryDate || null,
          autoRenew,
        },
      });
      notification.success('Settings saved.');
    } catch {
      const msg = updateMutation.error
        ? isApiClientError(updateMutation.error)
          ? updateMutation.error.message
          : 'Failed to save changes.'
        : 'Failed to save changes.';
      notification.error(msg);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack spacing={2} sx={cardSx}>
        <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 0.5 }}>
          General
        </Typography>
        <TextField
          label="Alliance Name"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { maxLength: 100 } }}
          sx={darkFieldSx}
        />
        <TextField
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={4}
          size="small"
          slotProps={{ htmlInput: { maxLength: 2000 } }}
          helperText={`${description.length}/2000`}
          sx={darkFieldSx}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            Visible in public directory:
          </Typography>
          <Chip
            label={isPublic ? 'Public' : 'Private'}
            size="small"
            onClick={() => setIsPublic(p => !p)}
            sx={{
              background: isPublic
                ? alpha(theme.palette.success.main, 0.15)
                : alpha(theme.palette.text.disabled, 0.15),
              color: isPublic ? 'success.main' : 'text.disabled',
              border: `1px solid ${isPublic ? alpha(theme.palette.success.main, 0.267) : alpha(theme.palette.text.disabled, 0.267)}`,
              cursor: 'pointer',
            }}
          />
        </Stack>
      </Stack>

      <Stack spacing={2} sx={cardSx}>
        <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 0.5 }}>
          Branding
        </Typography>

        {/* Logo */}
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Logo
          </Typography>
          {logoUrl && sanitizeImageUrl(logoUrl) && !logoError && (
            <Box
              component="img"
              src={sanitizeImageUrl(logoUrl)}
              alt="Logo preview"
              onError={() => setLogoError(true)}
              sx={{
                width: 80,
                height: 80,
                objectFit: 'cover',
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                mb: 1,
              }}
            />
          )}
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              component="label"
              variant="outlined"
              size="small"
              sx={{ ...cyanBtnSx(theme), textTransform: 'none', fontSize: '0.8rem' }}
            >
              {'Upload Logo'}
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    notification.error('Logo image must be under 5 MB');
                    e.target.value = '';
                    return;
                  }
                  try {
                    setUploadingLogo(true);
                    const formData = new FormData();
                    formData.append('image', file);
                    const res = await apiClient.postRaw<{ url: string }>(
                      '/api/v2/images/upload?resize=medium',
                      formData
                    );
                    if (res.url) {
                      setLogoUrl(res.url);
                      setLogoError(false);
                    }
                  } catch (err) {
                    notification.error(
                      isApiClientError(err)
                        ? err.message
                        : 'Logo upload failed. You can paste a URL instead.'
                    );
                  } finally {
                    setUploadingLogo(false);
                    e.target.value = '';
                  }
                }}
              />
            </Button>
            {uploadingLogo && <CircularProgress size={16} />}
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              or
            </Typography>
          </Stack>
          <TextField
            label="Logo URL"
            value={logoUrl}
            onChange={e => {
              setLogoUrl(e.target.value);
              setLogoError(false);
            }}
            fullWidth
            size="small"
            placeholder="https://..."
            sx={{ ...darkFieldSx, mt: 1 }}
          />
        </Box>

        {/* Banner */}
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Banner
          </Typography>
          {bannerUrl && sanitizeImageUrl(bannerUrl) && !bannerError && (
            <Box
              component="img"
              src={sanitizeImageUrl(bannerUrl)}
              alt="Banner preview"
              onError={() => setBannerError(true)}
              sx={{
                width: '100%',
                maxHeight: 120,
                objectFit: 'cover',
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                mb: 1,
              }}
            />
          )}
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              component="label"
              variant="outlined"
              size="small"
              sx={{ ...cyanBtnSx(theme), textTransform: 'none', fontSize: '0.8rem' }}
            >
              {'Upload Banner'}
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    notification.error('Banner image must be under 5 MB');
                    e.target.value = '';
                    return;
                  }
                  try {
                    setUploadingBanner(true);
                    const formData = new FormData();
                    formData.append('image', file);
                    const res = await apiClient.postRaw<{ url: string }>(
                      '/api/v2/images/upload?resize=large',
                      formData
                    );
                    if (res.url) {
                      setBannerUrl(res.url);
                      setBannerError(false);
                    }
                  } catch (err) {
                    notification.error(
                      isApiClientError(err)
                        ? err.message
                        : 'Banner upload failed. You can paste a URL instead.'
                    );
                  } finally {
                    setUploadingBanner(false);
                    e.target.value = '';
                  }
                }}
              />
            </Button>
            {uploadingBanner && <CircularProgress size={16} />}
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              or
            </Typography>
          </Stack>
          <TextField
            label="Banner URL"
            value={bannerUrl}
            onChange={e => {
              setBannerUrl(e.target.value);
              setBannerError(false);
            }}
            fullWidth
            size="small"
            placeholder="https://..."
            sx={{ ...darkFieldSx, mt: 1 }}
          />
        </Box>
      </Stack>

      <Stack spacing={2} sx={cardSx}>
        <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 0.5 }}>
          Links
        </Typography>
        <TextField
          label="Discord URL"
          value={discordUrl}
          onChange={e => setDiscordUrl(e.target.value)}
          fullWidth
          size="small"
          placeholder="https://discord.gg/..."
          sx={darkFieldSx}
        />
        <TextField
          label="Website URL"
          value={websiteUrl}
          onChange={e => setWebsiteUrl(e.target.value)}
          fullWidth
          size="small"
          placeholder="https://..."
          sx={darkFieldSx}
        />
      </Stack>

      <Stack spacing={2} sx={cardSx}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <HeadsetMicIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
            Voice Server
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Configure a third-party voice server for this federation and optionally share it with
          member organizations, partner federations, and trusted external groups.
        </Typography>

        {voiceConfig?.enabled && voiceStatus && (
          <VoiceServerStatsPanel
            status={voiceStatus}
            connectUrl={voiceConfig.connectUrl}
            serverType={voiceConfig.serverType}
          />
        )}

        {canManageVoice ? (
          <VoiceServerConfigPanel
            config={voiceConfig}
            isLoading={voiceConfigLoading}
            onSave={async data => {
              await updateVoiceConfig.mutateAsync({ fedId: federation.id, data });
            }}
            onDelete={async () => {
              await deleteVoiceConfig.mutateAsync(federation.id);
            }}
            isSaving={updateVoiceConfig.isPending}
            isDeleting={deleteVoiceConfig.isPending}
            error={voiceConfigError}
            suggestions={voiceSuggestions ?? undefined}
            suggestionsLoading={voiceSuggestionsLoading}
          />
        ) : (
          <Alert severity="info">
            Only alliance founders and leaders can manage voice server settings.
          </Alert>
        )}
      </Stack>

      {/* Agreement Details */}
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          '&:before': { display: 'none' },
          border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
          borderRadius: '8px !important',
          background: alpha(theme.palette.background.paper, 0.6),
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
            Agreement Details
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.25}>
              <TextField
                label="Next Review Date"
                type="date"
                value={reviewDate}
                onChange={e => setReviewDate(e.target.value)}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={darkFieldSx}
              />
              <TextField
                label="Expiry Date"
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={darkFieldSx}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch checked={autoRenew} onChange={(_, v) => setAutoRenew(v)} size="small" />
              }
              label="Auto-renew on expiry"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Box>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={
            updateMutation.isPending || name.trim().length < 3 || description.trim().length < 10
          }
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'common.black',
            fontWeight: 600,
          }}
        >
          {updateMutation.isPending ? (
            <CircularProgress size={18} sx={{ color: 'common.black' }} />
          ) : (
            'Save Changes'
          )}
        </Button>
      </Box>

      {/* Danger Zone — founder only */}
      {myRole === 'founder' && (
        <DangerZone
          federationId={federation.id}
          federationName={federation.name}
          onDisbanded={onDisbanded}
        />
      )}
    </Stack>
  );
};

// ─── Members Tab ─────────────────────────────────────────────────────────────

const MembersTab: React.FC<{
  federation: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federation, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [inviteOrgName, setInviteOrgName] = useState('');
  const [inviteRole, setInviteRole] = useState<FederationRole>('member');
  const [inviteAssociationType, setInviteAssociationType] =
    useState<FederationAssociationType>('full_member');
  const [isPrivateOrg, setIsPrivateOrg] = useState(false);
  const [orgSearchInput, setOrgSearchInput] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrgSearchResult | null>(null);
  const [rsiLookupLoading, setRsiLookupLoading] = useState(false);
  const { data: orgSearchResults = [], isLoading: orgSearchLoading } = useOrgSearch(orgSearchInput);
  const [roleDialogMember, setRoleDialogMember] = useState<FederationMember | null>(null);
  const [newRole, setNewRole] = useState<FederationRole>('member');
  const [error, setError] = useState<string | null>(null);

  const inviteMutation = useInviteMember();
  const removeMutation = useRemoveMember();
  const updateRoleMutation = useUpdateMemberRole();

  const handleInvite = async () => {
    try {
      await inviteMutation.mutateAsync({
        federationId: federation.id,
        targetOrgId: inviteOrgId.trim(),
        targetOrgName: inviteOrgName.trim(),
        role: inviteRole,
        associationType: inviteAssociationType,
      });
      setInviteOpen(false);
      setInviteOrgId('');
      setInviteOrgName('');
      setInviteRole('member');
      setInviteAssociationType('full_member');
      setIsPrivateOrg(false);
      setSelectedOrg(null);
      setOrgSearchInput('');
    } catch {
      // error from inviteMutation.error
    }
  };

  const handleRemove = useCallback(
    async (member: FederationMember) => {
      if (!globalThis.confirm(`Remove ${member.organizationName} from this alliance?`)) return;
      setError(null);
      try {
        await removeMutation.mutateAsync({
          federationId: federation.id,
          memberId: member.id,
        });
      } catch {
        setError('Failed to remove member.');
      }
    },
    [removeMutation, federation.id]
  );

  const handleRevokeInvite = useCallback(
    async (member: FederationMember) => {
      if (
        !globalThis.confirm(
          `Revoke pending invitation to ${member.organizationName}? They will no longer be able to accept it.`
        )
      ) {
        return;
      }
      setError(null);
      try {
        await removeMutation.mutateAsync({
          federationId: federation.id,
          memberId: member.id,
        });
      } catch {
        setError('Failed to revoke invitation.');
      }
    },
    [removeMutation, federation.id]
  );

  const handleRoleChange = async () => {
    if (!roleDialogMember) return;
    try {
      await updateRoleMutation.mutateAsync({
        federationId: federation.id,
        memberId: roleDialogMember.id,
        role: newRole,
      });
      setRoleDialogMember(null);
    } catch {
      setError('Failed to update role.');
    }
  };

  const inviteError = inviteMutation.error
    ? ((inviteMutation.error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? 'Failed to send invitation.')
    : null;

  const members = useMemo(() => federation.members ?? [], [federation.members]);
  const pendingMembers = useMemo(() => members.filter(m => m.status === 'pending'), [members]);
  const activeMembers = useMemo(() => members.filter(m => m.status !== 'pending'), [members]);
  const actionMemberId =
    (removeMutation.isPending && (removeMutation.variables as { memberId: string })?.memberId) ||
    (updateRoleMutation.isPending &&
      (updateRoleMutation.variables as { memberId: string })?.memberId) ||
    null;

  const memberColumns = useMemo((): DataTableColumn<FederationMember>[] => {
    const cols: DataTableColumn<FederationMember>[] = [
      {
        key: 'organizationName',
        header: 'Organization',
        render: m => (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {m.organizationName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {m.organizationId}
            </Typography>
          </>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: m => (
          <Chip
            label={m.role}
            size="small"
            sx={{
              background: alpha(getRoleColor(m.role, theme), 0.09),
              color: getRoleColor(m.role, theme),
              border: `1px solid ${alpha(getRoleColor(m.role, theme), 0.27)}`,
              fontSize: '0.7rem',
            }}
          />
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: m => (
          <Chip
            label={m.status}
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.7rem',
              borderColor: 'divider',
              color: 'text.secondary',
            }}
          />
        ),
      },
      {
        key: 'associationType',
        header: 'Association',
        render: m => (
          <Chip
            label={(m.associationType ?? 'full_member').replaceAll('_', ' ')}
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.7rem',
              borderColor: alpha(theme.palette.info.main, 0.3),
              color: theme.palette.info.light,
              textTransform: 'capitalize',
            }}
          />
        ),
      },
      {
        key: 'joinedAt',
        header: 'Joined',
        render: m => (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
            {new Date(m.joinedAt).toLocaleDateString()}
          </Typography>
        ),
      },
    ];

    if (manage) {
      cols.push({
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: m => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setRoleDialogMember(m);
                setNewRole(m.role);
              }}
              sx={{ ...cyanBtnSx(theme), fontSize: '0.7rem', py: 0.25 }}
              disabled={actionMemberId === m.id}
            >
              Role
            </Button>
            {m.role !== 'founder' && (
              <IconButton
                size="small"
                onClick={() => handleRemove(m)}
                disabled={actionMemberId === m.id}
                sx={{
                  color: 'error.main',
                  '&:hover': { background: alpha(theme.palette.error.main, 0.1) },
                }}
              >
                {actionMemberId === m.id ? (
                  <CircularProgress size={14} />
                ) : (
                  <DeleteIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            )}
          </Stack>
        ),
      });
    }

    return cols;
  }, [manage, theme, actionMemberId, handleRemove]);

  const pendingColumns = useMemo((): DataTableColumn<FederationMember>[] => {
    const cols: DataTableColumn<FederationMember>[] = [
      {
        key: 'organizationName',
        header: 'Organization',
        render: m => (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {m.organizationName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {m.organizationId}
            </Typography>
          </>
        ),
      },
      {
        key: 'role',
        header: 'Invited Role',
        render: m => (
          <Chip
            label={m.role}
            size="small"
            sx={{
              background: alpha(getRoleColor(m.role, theme), 0.09),
              color: getRoleColor(m.role, theme),
              border: `1px solid ${alpha(getRoleColor(m.role, theme), 0.27)}`,
              fontSize: '0.7rem',
            }}
          />
        ),
      },
      {
        key: 'associationType',
        header: 'Association',
        render: m => (
          <Chip
            label={(m.associationType ?? 'full_member').replaceAll('_', ' ')}
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.7rem',
              borderColor: alpha(theme.palette.info.main, 0.3),
              color: theme.palette.info.light,
              textTransform: 'capitalize',
            }}
          />
        ),
      },
      {
        key: 'joinedAt',
        header: 'Invited',
        render: m => (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
            {new Date(m.joinedAt).toLocaleDateString()}
          </Typography>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: () => (
          <Chip
            label="Awaiting response"
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.7rem',
              borderColor: alpha(theme.palette.warning.main, 0.4),
              color: theme.palette.warning.light,
            }}
          />
        ),
      },
    ];

    if (manage) {
      cols.push({
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: m => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => handleRevokeInvite(m)}
              disabled={actionMemberId === m.id}
              sx={{ fontSize: '0.7rem', py: 0.25 }}
              startIcon={
                actionMemberId === m.id ? (
                  <CircularProgress size={12} />
                ) : (
                  <DeleteIcon sx={{ fontSize: 14 }} />
                )
              }
            >
              Revoke
            </Button>
          </Stack>
        ),
      });
    }

    return cols;
  }, [manage, theme, actionMemberId, handleRevokeInvite]);

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {activeMembers.length} active organization{activeMembers.length === 1 ? '' : 's'}
          {pendingMembers.length > 0 &&
            ` · ${pendingMembers.length} pending invitation${pendingMembers.length === 1 ? '' : 's'}`}
        </Typography>
        {manage && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setInviteOpen(true)}
            sx={cyanBtnSx}
          >
            Invite Organization
          </Button>
        )}
      </Stack>

      {pendingMembers.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: theme.palette.warning.light, fontWeight: 600 }}
            >
              Pending Invitations
            </Typography>
            <Chip
              label={pendingMembers.length}
              size="small"
              sx={{
                background: alpha(theme.palette.warning.main, 0.12),
                color: theme.palette.warning.light,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                fontSize: '0.7rem',
                height: 18,
              }}
            />
          </Stack>
          <Box
            sx={{
              ...cardSx(theme),
              p: 0,
              overflow: 'hidden',
              borderColor: alpha(theme.palette.warning.main, 0.25),
              '& th': {
                borderColor: alpha(theme.palette.warning.main, 0.15),
                color: 'text.secondary',
                fontSize: '0.75rem',
              },
              '& td': {
                borderColor: alpha(theme.palette.warning.main, 0.1),
                color: 'common.white',
              },
            }}
          >
            <DataTable<FederationMember>
              columns={pendingColumns}
              data={pendingMembers}
              getRowKey={row => row.id}
              size="small"
              emptyMessage="No pending invitations"
              ariaLabel="Pending federation invitations"
            />
          </Box>
        </Box>
      )}

      {(pendingMembers.length > 0 || activeMembers.length > 0) && (
        <Typography
          variant="subtitle2"
          sx={{ color: theme.palette.text.secondary, fontWeight: 600, mt: 1 }}
        >
          Active Members
        </Typography>
      )}

      <Box
        sx={{
          ...cardSx(theme),
          p: 0,
          overflow: 'hidden',
          '& th': {
            borderColor: alpha(theme.palette.primary.main, 0.1),
            color: 'text.secondary',
            fontSize: '0.75rem',
          },
          '& td': {
            borderColor: alpha(theme.palette.primary.main, 0.08),
            color: 'common.white',
          },
        }}
      >
        <DataTable<FederationMember>
          columns={memberColumns}
          data={activeMembers}
          getRowKey={row => row.id}
          size="small"
          emptyMessage="No active members yet"
          ariaLabel="Active federation members"
        />
      </Box>

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onClose={() => !inviteMutation.isPending && setInviteOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Invite Organization</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {inviteError && <Alert severity="error">{inviteError}</Alert>}

            <FormControlLabel
              control={
                <Switch
                  checked={isPrivateOrg}
                  onChange={(_, checked) => {
                    setIsPrivateOrg(checked);
                    if (checked) {
                      setSelectedOrg(null);
                      setOrgSearchInput('');
                    } else {
                      setInviteOrgId('');
                      setInviteOrgName('');
                    }
                  }}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Private organization (enter ID manually)
                </Typography>
              }
            />

            {isPrivateOrg ? (
              <TextField
                label="Organization ID"
                value={inviteOrgId}
                onChange={e => {
                  setInviteOrgId(e.target.value);
                  setInviteOrgName(e.target.value);
                }}
                fullWidth
                size="small"
                placeholder="Paste the private organization ID"
                sx={darkFieldSx}
              />
            ) : (
              <Autocomplete<OrgSearchResult>
                value={selectedOrg}
                onChange={(_, newValue) => {
                  if (newValue) {
                    if (newValue.id.startsWith('rsi:')) {
                      const sid = newValue.id.replace('rsi:', '');
                      setRsiLookupLoading(true);
                      apiClient
                        .get<{
                          data?: { sid: string; name: string; memberCount?: number };
                          sid?: string;
                          name?: string;
                        }>(`/api/v2/rsi-crawler/organizations/${encodeURIComponent(sid)}`, {
                          timeout: 10000,
                        })
                        .then(response => {
                          const rsiOrg = response?.data?.data ?? response?.data;
                          if (rsiOrg && (rsiOrg as { name?: string }).name) {
                            const resolved = rsiOrg as { sid: string; name: string };
                            setSelectedOrg({
                              id: `rsi-org:${resolved.sid}`,
                              name: `${resolved.name} (RSI: ${resolved.sid})`,
                            });
                            setInviteOrgId(`rsi-org:${resolved.sid}`);
                            setInviteOrgName(resolved.name);
                          } else {
                            setSelectedOrg({
                              id: `rsi-org:${sid}`,
                              name: `${sid} (RSI organization)`,
                            });
                            setInviteOrgId(`rsi-org:${sid}`);
                            setInviteOrgName(sid);
                          }
                        })
                        .catch(() => {
                          setSelectedOrg({
                            id: `rsi-org:${sid}`,
                            name: `${sid} (RSI organization)`,
                          });
                          setInviteOrgId(`rsi-org:${sid}`);
                          setInviteOrgName(sid);
                        })
                        .finally(() => setRsiLookupLoading(false));
                    } else {
                      setSelectedOrg(newValue);
                      setInviteOrgId(newValue.id);
                      setInviteOrgName(newValue.name);
                    }
                  } else {
                    setSelectedOrg(null);
                    setInviteOrgId('');
                    setInviteOrgName('');
                  }
                }}
                inputValue={orgSearchInput}
                onInputChange={(_, value) => setOrgSearchInput(value)}
                options={(() => {
                  const opts = [...orgSearchResults];
                  if (
                    orgSearchInput.trim().length >= 2 &&
                    !orgSearchLoading &&
                    orgSearchResults.length === 0
                  ) {
                    opts.push({
                      id: `rsi:${orgSearchInput.trim().toUpperCase()}`,
                      name: `Look up "${orgSearchInput.trim().toUpperCase()}" on RSI`,
                      primaryFocus: 'rsi-lookup',
                    });
                  }
                  return opts;
                })()}
                getOptionLabel={opt => opt.name}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                loading={orgSearchLoading || rsiLookupLoading}
                noOptionsText={
                  orgSearchInput.length < 2 ? 'Type to search...' : 'No organizations found'
                }
                filterOptions={x => x}
                renderOption={(props, opt) => (
                  <Box component="li" {...props} key={opt.id}>
                    {opt.primaryFocus === 'rsi-lookup' ? (
                      <Typography sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                        {opt.name}
                      </Typography>
                    ) : (
                      <Stack>
                        <Typography sx={{ fontWeight: 500 }}>{opt.name}</Typography>
                        {opt.memberCount != null && (
                          <Typography variant="caption" color="text.secondary">
                            {opt.memberCount} members
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </Box>
                )}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Search Organizations"
                    size="small"
                    placeholder="Search by name or RSI SID..."
                    sx={darkFieldSx}
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {(orgSearchLoading || rsiLookupLoading) && (
                              <CircularProgress size={14} />
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />
            )}
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>Role</InputLabel>
              <Select
                label="Role"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as FederationRole)}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } },
                  },
                }}
              >
                {(['leader', 'council', 'member', 'observer'] as FederationRole[]).map(r => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>Association Type</InputLabel>
              <Select
                label="Association Type"
                value={inviteAssociationType}
                onChange={e =>
                  setInviteAssociationType(e.target.value as FederationAssociationType)
                }
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } },
                  },
                }}
              >
                {(
                  [
                    'full_member',
                    'associate',
                    'cooperative',
                    'affiliate',
                  ] as FederationAssociationType[]
                ).map(t => (
                  <MenuItem key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setInviteOpen(false)}
            disabled={inviteMutation.isPending}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleInvite}
            disabled={inviteMutation.isPending || !inviteOrgId.trim()}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {inviteMutation.isPending ? (
              <CircularProgress size={16} sx={{ color: 'common.black' }} />
            ) : (
              'Invite'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role change dialog */}
      <Dialog
        open={!!roleDialogMember}
        onClose={() => setRoleDialogMember(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Change Role</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.primary' }}>
              {roleDialogMember?.organizationName}
            </Typography>
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>New Role</InputLabel>
              <Select
                label="New Role"
                value={newRole}
                onChange={e => setNewRole(e.target.value as FederationRole)}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } },
                  },
                }}
              >
                {(['leader', 'council', 'member', 'observer'] as FederationRole[]).map(r => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRoleDialogMember(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRoleChange}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Ambassadors Tab ──────────────────────────────────────────────────────────

const ALL_AMBASSADOR_PERMISSIONS: FederationAmbassadorPermission[] = [
  'vote',
  'announce',
  'intel',
  'wiki',
  'resources',
  'hr',
  'settings',
  'view',
];

const getAmbassadorRoleColor = (role: FederationAmbassadorRole, theme: Theme): string => {
  switch (role) {
    case 'council':
      return theme.palette.secondary.main;
    case 'representative':
      return theme.palette.primary.main;
    case 'observer':
      return theme.palette.grey[600];
    default:
      return theme.palette.grey[600];
  }
};

const AmbassadorsTab: React.FC<{
  federationId: string;
  federation: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federationId, federation, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);

  const { data: ambassadors = [], isLoading } = useFederationAmbassadors(federationId);
  const appointMutation = useAppointAmbassador();
  const updateMutation = useUpdateAmbassador();
  const removeMutation = useRemoveAmbassador();

  const [appointOpen, setAppointOpen] = useState(false);
  const [editAmbassador, setEditAmbassador] = useState<FederationAmbassador | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Appoint form state
  const [appointUserId, setAppointUserId] = useState('');
  const [appointUserName, setAppointUserName] = useState('');
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberV2 | null>(null);
  const [appointOrgId, setAppointOrgId] = useState('');
  const [appointOrgName, setAppointOrgName] = useState('');
  const [appointRole, setAppointRole] = useState<FederationAmbassadorRole>('representative');
  const [appointPermissions, setAppointPermissions] = useState<FederationAmbassadorPermission[]>([
    'view',
  ]);
  const [appointTitle, setAppointTitle] = useState('');
  const [appointIsExternal, setAppointIsExternal] = useState(false);
  const [externalOrgSearch, setExternalOrgSearch] = useState('');
  const [selectedExternalOrg, setSelectedExternalOrg] = useState<OrgSearchResult | null>(null);

  // Edit form state
  const [editRole, setEditRole] = useState<FederationAmbassadorRole>('representative');
  const [editPermissions, setEditPermissions] = useState<FederationAmbassadorPermission[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Fetch members for the selected organization (internal mode)
  const { data: orgMembersResult, isLoading: membersLoading } = useOrganizationMembers(
    !appointIsExternal && appointOrgId ? appointOrgId : undefined,
    { limit: 200 },
    { enabled: !appointIsExternal && !!appointOrgId }
  );

  // Search external orgs
  const { data: externalOrgResults = [], isLoading: externalOrgLoading } = useOrgSearch(
    appointIsExternal ? externalOrgSearch : ''
  );

  // Filter out users who are already ambassadors for this org
  const availableMembers = useMemo(() => {
    const items = orgMembersResult?.items ?? [];
    const existingUserIds = new Set(
      ambassadors.filter(a => a.organizationId === appointOrgId).map(a => a.userId)
    );
    return items.filter(m => !existingUserIds.has(m.userId));
  }, [orgMembersResult, ambassadors, appointOrgId]);

  const resetAppointForm = () => {
    setAppointUserId('');
    setAppointUserName('');
    setSelectedMember(null);
    setAppointOrgId('');
    setAppointOrgName('');
    setAppointRole('representative');
    setAppointPermissions(['view']);
    setAppointTitle('');
    setAppointIsExternal(false);
    setExternalOrgSearch('');
    setSelectedExternalOrg(null);
    setError(null);
  };

  const handleAppoint = async () => {
    setError(null);
    try {
      await appointMutation.mutateAsync({
        federationId,
        data: {
          userId: appointUserId.trim(),
          userName: appointUserName.trim(),
          organizationId: appointOrgId.trim(),
          organizationName: appointOrgName.trim(),
          role: appointIsExternal ? 'observer' : appointRole,
          permissions: appointIsExternal ? ['view'] : appointPermissions,
          title: appointTitle.trim() || undefined,
          isExternal: appointIsExternal || undefined,
        },
      });
      setAppointOpen(false);
      resetAppointForm();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to appoint ambassador';
      setError(msg);
    }
  };

  const handleOpenEdit = (amb: FederationAmbassador) => {
    setEditAmbassador(amb);
    setEditRole(amb.role);
    setEditPermissions([...amb.permissions]);
    setEditTitle(amb.title ?? '');
    setEditIsActive(amb.isActive);
    setError(null);
  };

  const handleUpdate = async () => {
    if (!editAmbassador) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({
        federationId,
        ambassadorId: editAmbassador.id,
        data: {
          role: editRole,
          permissions: editPermissions,
          title: editTitle.trim() || null,
          isActive: editIsActive,
        },
      });
      setEditAmbassador(null);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update ambassador';
      setError(msg);
    }
  };

  const handleRemove = async (amb: FederationAmbassador) => {
    if (!globalThis.confirm(`Remove ${amb.userName} as ambassador?`)) return;
    setError(null);
    try {
      await removeMutation.mutateAsync({ federationId, ambassadorId: amb.id });
    } catch {
      setError('Failed to remove ambassador.');
    }
  };

  const togglePermission = (
    perm: FederationAmbassadorPermission,
    current: FederationAmbassadorPermission[],
    setter: (v: FederationAmbassadorPermission[]) => void
  ) => {
    if (perm === 'view') return; // view is always granted
    setter(current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm]);
  };

  // Group ambassadors by org
  const ambassadorsByOrg = useMemo(() => {
    const grouped: Record<string, FederationAmbassador[]> = {};
    for (const amb of ambassadors) {
      if (!grouped[amb.organizationName]) grouped[amb.organizationName] = [];
      grouped[amb.organizationName].push(amb);
    }
    return grouped;
  }, [ambassadors]);

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Ambassadors ({ambassadors.length})
        </Typography>
        {manage && (
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              resetAppointForm();
              setAppointOpen(true);
            }}
            sx={cyanBtnSx}
          >
            Appoint Ambassador
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {ambassadors.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 4 }}>
          <BadgeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            No ambassadors have been appointed yet.
            {manage && ' Appoint users from member organizations to represent them.'}
          </Typography>
        </Paper>
      ) : (
        Object.entries(ambassadorsByOrg).map(([orgName, orgAmbassadors]) => (
          <Paper key={orgName} sx={cardSx(theme)}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              {orgName}
            </Typography>
            <Stack spacing={1}>
              {orgAmbassadors.map(amb => (
                <Paper
                  key={amb.id}
                  sx={{
                    p: 1.5,
                    background: alpha(theme.palette.background.default, 0.4),
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    borderRadius: 1,
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    flexWrap="wrap"
                    gap={1}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {amb.userName}
                        </Typography>
                        {amb.title && (
                          <Typography variant="caption" color="text.secondary">
                            — {amb.title}
                          </Typography>
                        )}
                        {amb.isExternal && (
                          <Chip
                            label="External"
                            size="small"
                            sx={{
                              background: alpha(theme.palette.info.main, 0.12),
                              color: 'info.main',
                              border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                              fontSize: '0.7rem',
                              height: 20,
                            }}
                          />
                        )}
                        {!amb.isActive && <Chip label="Inactive" size="small" color="default" />}
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                        <Chip
                          label={amb.role}
                          size="small"
                          sx={{
                            background: alpha(getAmbassadorRoleColor(amb.role, theme), 0.12),
                            color: getAmbassadorRoleColor(amb.role, theme),
                            border: `1px solid ${alpha(getAmbassadorRoleColor(amb.role, theme), 0.3)}`,
                          }}
                        />
                        {amb.permissions
                          .filter(p => p !== 'view')
                          .map(p => (
                            <Chip
                              key={p}
                              label={p}
                              size="small"
                              sx={{
                                background: alpha(theme.palette.info.main, 0.08),
                                color: 'info.main',
                                fontSize: '0.7rem',
                              }}
                            />
                          ))}
                      </Stack>
                    </Box>
                    {manage && (
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleOpenEdit(amb)}
                          sx={{ color: 'text.secondary', minWidth: 'auto' }}
                        >
                          Edit
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => handleRemove(amb)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>
        ))
      )}

      {/* Appoint Dialog */}
      <Dialog
        open={appointOpen}
        onClose={() => setAppointOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle>Appoint Ambassador</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Internal vs External toggle */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">External Envoy</Typography>
              <Switch
                checked={appointIsExternal}
                onChange={e => {
                  setAppointIsExternal(e.target.checked);
                  // Reset org/member selection when switching modes
                  setAppointOrgId('');
                  setAppointOrgName('');
                  setSelectedMember(null);
                  setSelectedExternalOrg(null);
                  setExternalOrgSearch('');
                  setAppointUserId('');
                  setAppointUserName('');
                }}
                size="small"
              />
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {appointIsExternal
                  ? 'Appoint an envoy from an organization outside this federation'
                  : 'Appoint from a member organization'}
              </Typography>
            </Stack>

            {appointIsExternal ? (
              <>
                {/* External org search */}
                <Autocomplete
                  options={externalOrgResults}
                  value={selectedExternalOrg}
                  onInputChange={(_, value) => setExternalOrgSearch(value)}
                  onChange={(_, org) => {
                    setSelectedExternalOrg(org);
                    if (org) {
                      setAppointOrgId(org.id);
                      setAppointOrgName(org.name);
                    } else {
                      setAppointOrgId('');
                      setAppointOrgName('');
                    }
                  }}
                  getOptionLabel={option => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  loading={externalOrgLoading}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="External Organization"
                      required
                      placeholder="Search for an organization..."
                      sx={darkFieldSx}
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {externalOrgLoading ? <CircularProgress size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{option.name}</Typography>
                        {option.memberCount != null && (
                          <Typography variant="caption" color="text.disabled">
                            {option.memberCount} members
                          </Typography>
                        )}
                      </Stack>
                    </li>
                  )}
                />
                {/* Freeform user fields for external envoys */}
                <TextField
                  label="User ID"
                  fullWidth
                  required
                  size="small"
                  value={appointUserId}
                  onChange={e => setAppointUserId(e.target.value)}
                  placeholder="Discord or platform user ID"
                  sx={darkFieldSx}
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
                <TextField
                  label="User Name"
                  fullWidth
                  required
                  size="small"
                  value={appointUserName}
                  onChange={e => setAppointUserName(e.target.value)}
                  placeholder="Display name of the envoy"
                  sx={darkFieldSx}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                />
                <Alert severity="info" sx={{ bgcolor: alpha(theme.palette.info.main, 0.06) }}>
                  External envoys are assigned the Observer role with view-only permissions.
                </Alert>
              </>
            ) : (
              <>
                {/* Internal: member org dropdown */}
                <FormControl fullWidth sx={darkSelectSx}>
                  <InputLabel>Member Organization</InputLabel>
                  <Select
                    label="Member Organization"
                    value={appointOrgId}
                    onChange={e => {
                      const orgId = e.target.value;
                      setAppointOrgId(orgId);
                      const member = federation.members?.find(m => m.organizationId === orgId);
                      if (member) setAppointOrgName(member.organizationName);
                      setSelectedMember(null);
                      setAppointUserId('');
                      setAppointUserName('');
                    }}
                  >
                    {(federation.members ?? [])
                      .filter(m => m.status === 'active')
                      .map(m => (
                        <MenuItem key={m.organizationId} value={m.organizationId}>
                          {m.organizationName}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                <Autocomplete
                  options={availableMembers}
                  value={selectedMember}
                  onChange={(_, member) => {
                    setSelectedMember(member);
                    if (member) {
                      setAppointUserId(member.userId);
                      setAppointUserName(member.displayName ?? member.username ?? member.userId);
                    } else {
                      setAppointUserId('');
                      setAppointUserName('');
                    }
                  }}
                  getOptionLabel={option => option.displayName ?? option.username ?? option.userId}
                  isOptionEqualToValue={(option, value) => option.userId === value.userId}
                  disabled={!appointOrgId}
                  loading={membersLoading}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Member"
                      required
                      placeholder={
                        appointOrgId ? 'Select a member' : 'Select an organization first'
                      }
                      sx={darkFieldSx}
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {membersLoading ? <CircularProgress size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.userId}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {option.displayName ?? option.username ?? option.userId}
                        </Typography>
                        {option.username && option.displayName && (
                          <Typography variant="caption" color="text.secondary">
                            @{option.username}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.disabled">
                          {option.role}
                        </Typography>
                      </Stack>
                    </li>
                  )}
                />
                <FormControl fullWidth sx={darkSelectSx}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    label="Role"
                    value={appointRole}
                    onChange={e => setAppointRole(e.target.value as FederationAmbassadorRole)}
                  >
                    <MenuItem value="council">Council</MenuItem>
                    <MenuItem value="representative">Representative</MenuItem>
                    <MenuItem value="observer">Observer</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}
            <TextField
              label="Title (optional)"
              fullWidth
              value={appointTitle}
              onChange={e => setAppointTitle(e.target.value)}
              placeholder={
                appointIsExternal
                  ? 'e.g. Trade Envoy, Liaison Officer'
                  : 'e.g. Chief Diplomat, Trade Envoy'
              }
              sx={darkFieldSx}
            />
            {!appointIsExternal && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Permissions
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {ALL_AMBASSADOR_PERMISSIONS.map(perm => (
                    <Chip
                      key={perm}
                      label={perm}
                      size="small"
                      onClick={() =>
                        togglePermission(perm, appointPermissions, setAppointPermissions)
                      }
                      sx={{
                        cursor: perm === 'view' ? 'default' : 'pointer',
                        background: appointPermissions.includes(perm)
                          ? alpha(theme.palette.primary.main, 0.2)
                          : alpha(theme.palette.action.disabledBackground, 0.3),
                        color: appointPermissions.includes(perm)
                          ? 'primary.main'
                          : 'text.secondary',
                        border: `1px solid ${
                          appointPermissions.includes(perm)
                            ? alpha(theme.palette.primary.main, 0.4)
                            : 'transparent'
                        }`,
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppointOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleAppoint}
            disabled={
              !appointOrgId.trim() ||
              !appointUserId.trim() ||
              !appointUserName.trim() ||
              appointMutation.isPending
            }
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {appointMutation.isPending ? 'Appointing…' : 'Appoint'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editAmbassador}
        onClose={() => setEditAmbassador(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle>Edit Ambassador — {editAmbassador?.userName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth sx={darkSelectSx}>
              <InputLabel>Role</InputLabel>
              <Select
                label="Role"
                value={editRole}
                onChange={e => setEditRole(e.target.value as FederationAmbassadorRole)}
              >
                <MenuItem value="council">Council</MenuItem>
                <MenuItem value="representative">Representative</MenuItem>
                <MenuItem value="observer">Observer</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Title"
              fullWidth
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="e.g. Chief Diplomat"
              sx={darkFieldSx}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Permissions
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {ALL_AMBASSADOR_PERMISSIONS.map(perm => (
                  <Chip
                    key={perm}
                    label={perm}
                    size="small"
                    onClick={() => togglePermission(perm, editPermissions, setEditPermissions)}
                    sx={{
                      cursor: perm === 'view' ? 'default' : 'pointer',
                      background: editPermissions.includes(perm)
                        ? alpha(theme.palette.primary.main, 0.2)
                        : alpha(theme.palette.action.disabledBackground, 0.3),
                      color: editPermissions.includes(perm) ? 'primary.main' : 'text.secondary',
                      border: `1px solid ${
                        editPermissions.includes(perm)
                          ? alpha(theme.palette.primary.main, 0.4)
                          : 'transparent'
                      }`,
                    }}
                  />
                ))}
              </Stack>
            </Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">Active</Typography>
              <Switch
                checked={editIsActive}
                onChange={e => setEditIsActive(e.target.checked)}
                size="small"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAmbassador(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={updateMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Proposals Tab (Enhanced with inline ballot cards + results bars) ──────

const ProposalsTab: React.FC<{
  federationId: string;
  federation: ManagedFederation;
  myRole?: FederationRole;
  myOrgId?: string;
}> = ({ federationId, federation, myRole, myOrgId }) => {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Create form
  const [cType, setCType] = useState<ProposalType>('custom');
  const [cTitle, setCTitle] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cDays, setCDays] = useState(7);
  // Inline vote state
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [voteComment, setVoteComment] = useState('');

  const { data: proposals = [], isLoading: loading } = useFederationProposals(
    federationId,
    statusFilter as 'open' | 'passed' | 'rejected' | 'expired' | 'all'
  );

  const createProposalMutation = useCreateProposal();
  const castVoteMutation = useCastVote();

  const handleCreate = async () => {
    try {
      await createProposalMutation.mutateAsync({
        federationId,
        data: {
          type: cType,
          title: cTitle.trim(),
          description: cDesc.trim(),
          votingDurationDays: cDays,
        },
      });
      setCreateOpen(false);
      setCTitle('');
      setCDesc('');
      setCType('custom');
      setCDays(7);
    } catch {
      // error from createProposalMutation.error
    }
  };

  const handleInlineVote = async (proposalId: string, vote: VoteChoice) => {
    try {
      await castVoteMutation.mutateAsync({
        federationId,
        proposalId,
        vote,
        comment: voteComment.trim() || undefined,
      });
      setVotingProposalId(null);
      setVoteComment('');
    } catch {
      setError('Failed to cast vote.');
    }
  };

  const cError = createProposalMutation.error
    ? ((createProposalMutation.error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message ?? 'Failed to create proposal.')
    : null;

  const totalMembers = federation.members?.filter(m => m.status === 'active').length ?? 0;

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 120, ...darkSelectSx(theme) }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            MenuProps={{
              slotProps: { paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } } },
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="passed">Passed</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
          </Select>
        </FormControl>
        {canVote(myRole) && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={cyanBtnSx}
          >
            New Proposal
          </Button>
        )}
      </Stack>

      {loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: 'primary.main' }} />
        </Box>
      )}
      {!loading && proposals.length === 0 && (
        <Typography sx={{ color: 'text.disabled', textAlign: 'center', py: 4 }}>
          No proposals found
        </Typography>
      )}
      {!loading && proposals.length > 0 && (
        <Stack spacing={2}>
          {proposals.map(p => {
            const approves = p.votes.filter(v => v.vote === 'approve').length;
            const rejects = p.votes.filter(v => v.vote === 'reject').length;
            const abstains = p.votes.filter(v => v.vote === 'abstain').length;
            const totalVotes = p.votes.length;
            const approvePercent = totalVotes > 0 ? (approves / totalVotes) * 100 : 0;
            const rejectPercent = totalVotes > 0 ? (rejects / totalVotes) * 100 : 0;
            const hasVoted = p.votes.some(v => v.organizationId === myOrgId);
            const isOpen = p.status === 'open';
            const daysLeft = Math.max(
              0,
              Math.ceil((new Date(p.closesAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            );

            return (
              <Paper
                key={p.id}
                sx={{
                  ...cardSx(theme),
                  border: `1px solid ${alpha(getProposalBorderColor(p.status, isOpen, theme), 0.2)}`,
                }}
              >
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        label={p.status}
                        size="small"
                        sx={{ ...getStatusChipSx(p.status, theme), fontSize: '0.7rem' }}
                      />
                      <Chip
                        label={p.type.replaceAll('_', ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', borderColor: 'divider', color: 'text.secondary' }}
                      />
                      {isOpen && (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {daysLeft}d left
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {p.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {p.description}
                    </Typography>
                  </Box>
                </Stack>

                {/* Vote Results Bar */}
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {totalVotes} of {totalMembers} voted
                    </Typography>
                    <Stack direction="row" spacing={1.5}>
                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                        ✓ {approves}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                        ✗ {rejects}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        ○ {abstains}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(theme.palette.common.white, 0.06),
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    {approvePercent > 0 && (
                      <Box
                        sx={{
                          width: `${approvePercent}%`,
                          bgcolor: 'success.main',
                          transition: 'width 0.3s',
                        }}
                      />
                    )}
                    {rejectPercent > 0 && (
                      <Box
                        sx={{
                          width: `${rejectPercent}%`,
                          bgcolor: 'error.main',
                          transition: 'width 0.3s',
                        }}
                      />
                    )}
                  </Box>
                </Box>

                {/* Individual Votes List */}
                {totalVotes > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {p.votes.map(v => {
                      const voteTitle = v.comment
                        ? `${v.organizationName}: ${v.vote} — "${v.comment}"`
                        : `${v.organizationName}: ${v.vote}`;
                      return (
                        <Tooltip key={v.organizationId} title={voteTitle}>
                          <Chip
                            label={v.organizationName.split(' ')[0]}
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              height: 22,
                              bgcolor: alpha(getVoteColor(v.vote, theme), 0.12),
                              color: getVoteColorToken(v.vote),
                              border: `1px solid ${alpha(getVoteColor(v.vote, theme), 0.27)}`,
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Stack>
                )}

                {/* Inline Vote Actions */}
                {isOpen && canVote(myRole) && !hasVoted && (
                  <Box
                    sx={{
                      mt: 2,
                      pt: 1.5,
                      borderTop: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                    }}
                  >
                    {votingProposalId === p.id ? (
                      <Stack spacing={1.5}>
                        <TextField
                          label="Comment (optional)"
                          value={voteComment}
                          onChange={e => setVoteComment(e.target.value)}
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          slotProps={{ htmlInput: { maxLength: 1000 } }}
                          sx={darkFieldSx}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleInlineVote(p.id, 'approve')}
                            disabled={castVoteMutation.isPending}
                            sx={{
                              bgcolor: 'success.dark',
                              color: 'common.white',
                              '&:hover': { bgcolor: 'success.main' },
                              textTransform: 'none',
                              flex: 1,
                            }}
                          >
                            ✓ Approve
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleInlineVote(p.id, 'reject')}
                            disabled={castVoteMutation.isPending}
                            sx={{
                              bgcolor: 'error.dark',
                              color: 'common.white',
                              '&:hover': { bgcolor: 'error.main' },
                              textTransform: 'none',
                              flex: 1,
                            }}
                          >
                            ✗ Reject
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleInlineVote(p.id, 'abstain')}
                            disabled={castVoteMutation.isPending}
                            sx={{
                              borderColor: 'divider',
                              color: 'text.secondary',
                              textTransform: 'none',
                            }}
                          >
                            Abstain
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setVotingProposalId(null);
                              setVoteComment('');
                            }}
                            sx={{ color: 'text.disabled', textTransform: 'none' }}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setVotingProposalId(p.id)}
                        sx={{ ...cyanBtnSx(theme), textTransform: 'none' }}
                      >
                        Cast Your Vote
                      </Button>
                    )}
                  </Box>
                )}
                {isOpen && hasVoted && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'success.main', mt: 1.5, display: 'block' }}
                  >
                    ✓ Your organization has voted
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Create proposal dialog */}
      <Dialog
        open={createOpen}
        onClose={() => !createProposalMutation.isPending && setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>New Proposal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {cError && <Alert severity="error">{cError}</Alert>}
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={cType}
                onChange={e => setCType(e.target.value as ProposalType)}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } },
                  },
                }}
              >
                {(
                  [
                    'add_member',
                    'remove_member',
                    'amend_governance',
                    'add_treaty',
                    'dissolve',
                    'custom',
                  ] as ProposalType[]
                ).map(t => (
                  <MenuItem key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Title"
              value={cTitle}
              onChange={e => setCTitle(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Description"
              value={cDesc}
              onChange={e => setCDesc(e.target.value)}
              fullWidth
              multiline
              rows={4}
              size="small"
              slotProps={{ htmlInput: { maxLength: 5000 } }}
              helperText={`${cDesc.length}/5000`}
              sx={darkFieldSx}
            />
            <TextField
              label="Voting Duration (days)"
              type="number"
              value={cDays}
              onChange={e => setCDays(Math.max(1, Math.min(30, Number(e.target.value))))}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { min: 1, max: 30 } }}
              sx={darkFieldSx}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setCreateOpen(false)}
            disabled={createProposalMutation.isPending}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={
              createProposalMutation.isPending ||
              cTitle.trim().length < 3 ||
              cDesc.trim().length < 10
            }
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {createProposalMutation.isPending ? (
              <CircularProgress size={16} sx={{ color: 'common.black' }} />
            ) : (
              'Submit'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Resources Tab ────────────────────────────────────────────────────────────

const ResourcesTab: React.FC<{
  federationId: string;
  myRole?: FederationRole;
}> = ({ federationId, myRole }) => {
  const theme = useTheme();
  const [resources, setResources] = useState<FederationResource[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [rName, setRName] = useState('');
  const [rType, setRType] = useState<ResourceType>('other');
  const [rAccess, setRAccess] = useState<'all' | 'council' | 'leaders'>('all');
  const [rDesc, setRDesc] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addResourceMutation = useAddFederationResource();
  const removeResourceMutation = useRemoveFederationResource();

  const handleAdd = async () => {
    try {
      const res = await addResourceMutation.mutateAsync({
        federationId,
        data: {
          name: rName.trim(),
          type: rType,
          accessLevel: rAccess,
          description: rDesc.trim(),
        },
      });
      setResources(prev => [...prev, res]);
      setAddOpen(false);
      setRName('');
      setRDesc('');
      setRType('other');
      setRAccess('all');
    } catch {
      // error from addResourceMutation.error
    }
  };

  const handleRemove = async (id: string) => {
    if (!globalThis.confirm('Remove this shared resource?')) return;
    try {
      await removeResourceMutation.mutateAsync({ federationId, resourceId: id });
      setResources(prev => prev.filter(r => r.id !== id));
    } catch {
      setError('Failed to remove resource.');
    }
  };

  const rError = addResourceMutation.error
    ? ((addResourceMutation.error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? 'Failed to add resource.')
    : null;
  const removeLoadingId = removeResourceMutation.isPending
    ? (removeResourceMutation.variables as { resourceId: string })?.resourceId
    : null;

  const RESOURCE_ICONS: Record<ResourceType, React.ReactNode> = {
    fleet: <FleetsIcon fontSize="small" />,
    intel: <SearchIcon fontSize="small" />,
    routes: <MapIcon fontSize="small" />,
    discord: <ForumIcon fontSize="small" />,
    infrastructure: <ConstructionIcon fontSize="small" />,
    other: <InventoryIcon fontSize="small" />,
  };

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" justifyContent="flex-end">
        {canManage(myRole) && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={cyanBtnSx}
          >
            Add Resource
          </Button>
        )}
      </Stack>

      {resources.length === 0 ? (
        <Typography sx={{ color: 'text.disabled', textAlign: 'center', py: 4 }}>
          No shared resources yet
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {resources.map(r => (
            <Box
              key={r.id}
              sx={{
                ...cardSx(theme),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {RESOURCE_ICONS[r.type]}
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {r.name}
                  </Typography>
                  <Chip
                    label={r.type}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.7rem',
                      borderColor: 'divider',
                      color: 'text.secondary',
                    }}
                  />
                  <Chip
                    label={r.accessLevel}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.7rem',
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                      color: 'primary.main',
                    }}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {r.description}
                </Typography>
              </Box>
              {canManage(myRole) && (
                <IconButton
                  size="small"
                  onClick={() => handleRemove(r.id)}
                  disabled={removeLoadingId === r.id}
                  sx={{
                    color: 'error.main',
                    '&:hover': { background: alpha(theme.palette.error.main, 0.1) },
                  }}
                >
                  {removeLoadingId === r.id ? (
                    <CircularProgress size={14} />
                  ) : (
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <Dialog
        open={addOpen}
        onClose={() => !addResourceMutation.isPending && setAddOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Add Shared Resource</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {rError && <Alert severity="error">{rError}</Alert>}
            <TextField
              label="Name"
              value={rName}
              onChange={e => setRName(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={rType}
                onChange={e => setRType(e.target.value as ResourceType)}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } },
                  },
                }}
              >
                {(
                  [
                    'fleet',
                    'intel',
                    'routes',
                    'discord',
                    'infrastructure',
                    'other',
                  ] as ResourceType[]
                ).map(t => (
                  <MenuItem key={t} value={t}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {RESOURCE_ICONS[t]} <span>{t}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>Access Level</InputLabel>
              <Select
                label="Access Level"
                value={rAccess}
                onChange={e => setRAccess(e.target.value)}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } },
                  },
                }}
              >
                <MenuItem value="all">All Members</MenuItem>
                <MenuItem value="council">Council+</MenuItem>
                <MenuItem value="leaders">Leaders Only</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={rDesc}
              onChange={e => setRDesc(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText={`${rDesc.length}/2000`}
              sx={darkFieldSx}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setAddOpen(false)}
            disabled={addResourceMutation.isPending}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={
              addResourceMutation.isPending || rName.trim().length < 2 || rDesc.trim().length < 5
            }
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {addResourceMutation.isPending ? (
              <CircularProgress size={16} sx={{ color: 'common.black' }} />
            ) : (
              'Add'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Treaties Tab ─────────────────────────────────────────────────────────────

const TreatiesTab: React.FC<{
  federationId: string;
  myRole?: FederationRole;
  myOrgId?: string;
}> = ({ federationId, myRole, myOrgId }) => {
  const theme = useTheme();
  const [treaties, setTreaties] = useState<FederationTreaty[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tName, setTName] = useState('');
  const [tType, setTType] = useState<TreatyType>('custom');
  const [tTerms, setTTerms] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createTreatyMutation = useCreateTreaty();
  const terminateTreatyMutation = useTerminateTreaty();
  const respondToTreatyMutation = useRespondToTreaty();

  const handleCreate = async () => {
    const terms = tTerms
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    try {
      const res = await createTreatyMutation.mutateAsync({
        federationId,
        data: {
          name: tName.trim(),
          type: tType,
          terms,
        },
      });
      setTreaties(prev => [...prev, res]);
      setCreateOpen(false);
      setTName('');
      setTTerms('');
      setTType('custom');
    } catch {
      // error from createTreatyMutation.error
    }
  };

  const handleRespond = async (treatyId: string, action: 'sign' | 'reject') => {
    try {
      const updated = await respondToTreatyMutation.mutateAsync({
        federationId,
        treatyId,
        action,
      });
      setTreaties(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } catch {
      setError(`Failed to ${action} treaty.`);
    }
  };

  const handleTerminate = async (id: string, name: string) => {
    if (!globalThis.confirm(`Terminate treaty "${name}"?`)) return;
    try {
      await terminateTreatyMutation.mutateAsync({ federationId, treatyId: id });
      setTreaties(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to terminate treaty.');
    }
  };

  const tError = createTreatyMutation.error
    ? ((createTreatyMutation.error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message ?? 'Failed to create treaty.')
    : null;
  const removeLoadingId = terminateTreatyMutation.isPending
    ? (terminateTreatyMutation.variables as { treatyId: string })?.treatyId
    : null;
  const respondLoadingId = respondToTreatyMutation.isPending
    ? (respondToTreatyMutation.variables as { treatyId: string })?.treatyId
    : null;

  /** Get the current org's signature status for a treaty */
  const getMySignatureStatus = (t: FederationTreaty) => {
    if (!myOrgId || !t.signatures) return undefined;
    return t.signatures.find(s => s.organizationId === myOrgId);
  };

  const getStatusColor = (status: FederationTreaty['status']) => {
    switch (status) {
      case 'proposed':
        return theme.palette.info.main;
      case 'active':
        return theme.palette.success.main;
      case 'terminated':
        return theme.palette.error.main;
      case 'expired':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getSignatureColor = (sigStatus: string) => {
    switch (sigStatus) {
      case 'signed':
        return theme.palette.success.main;
      case 'rejected':
        return theme.palette.error.main;
      default:
        return theme.palette.warning.main;
    }
  };

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" justifyContent="flex-end">
        {canManage(myRole) && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={cyanBtnSx}
          >
            Propose Treaty
          </Button>
        )}
      </Stack>

      {treaties.length === 0 ? (
        <Typography sx={{ color: 'text.disabled', textAlign: 'center', py: 4 }}>
          No treaties
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {treaties.map(t => {
            const mySig = getMySignatureStatus(t);
            const signedCount = (t.signatures ?? []).filter(s => s.status === 'signed').length;
            const totalCount = (t.signatures ?? []).length;

            return (
              <Box key={t.id} sx={cardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {t.name}
                      </Typography>
                      <Chip
                        label={t.type.replace('_', ' ')}
                        size="small"
                        sx={{
                          background: alpha(getTreatyColor(t.type, theme), 0.09),
                          color: getTreatyColor(t.type, theme),
                          border: `1px solid ${alpha(getTreatyColor(t.type, theme), 0.27)}`,
                          fontSize: '0.7rem',
                        }}
                      />
                      <Chip
                        label={t.status}
                        size="small"
                        sx={{
                          background: alpha(getStatusColor(t.status), 0.09),
                          color: getStatusColor(t.status),
                          border: `1px solid ${alpha(getStatusColor(t.status), 0.27)}`,
                          fontSize: '0.7rem',
                        }}
                      />
                    </Stack>
                    {t.proposedByName && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        Proposed by: {t.proposedByName}
                      </Typography>
                    )}
                    {t.status === 'proposed' && t.signatures && (
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Signatures: {signedCount}/{totalCount}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                          {t.signatures.map(sig => {
                            const sigColor = getSignatureColor(sig.status);
                            return (
                              <Chip
                                key={sig.organizationId}
                                label={sig.organizationName}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 20,
                                  background: alpha(sigColor, 0.1),
                                  color: sigColor,
                                  border: `1px solid ${alpha(sigColor, 0.3)}`,
                                }}
                              />
                            );
                          })}
                        </Stack>
                      </Box>
                    )}
                    {t.status === 'active' && t.signatories.length > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        Signatories: {t.signatories.length} orgs
                      </Typography>
                    )}
                    {t.terms.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Terms:
                        </Typography>
                        <Stack component="ul" sx={{ m: 0, pl: 2 }}>
                          {t.terms.slice(0, 3).map((term, termIdx) => (
                            <Typography
                              key={`${t.id}-term-${String(termIdx)}`}
                              component="li"
                              variant="caption"
                              sx={{ color: 'text.secondary' }}
                            >
                              {term}
                            </Typography>
                          ))}
                          {t.terms.length > 3 && (
                            <Typography
                              component="li"
                              variant="caption"
                              sx={{ color: 'text.disabled' }}
                            >
                              +{t.terms.length - 3} more…
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                  <Stack spacing={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                    {/* Sign/Reject buttons for proposed treaties */}
                    {t.status === 'proposed' && mySig?.status === 'pending' && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleRespond(t.id, 'sign')}
                          disabled={respondLoadingId === t.id}
                          sx={{
                            borderColor: alpha(theme.palette.success.main, 0.4),
                            color: 'success.main',
                            '&:hover': {
                              borderColor: 'success.main',
                              background: alpha(theme.palette.success.main, 0.08),
                            },
                          }}
                        >
                          {respondLoadingId === t.id ? <CircularProgress size={14} /> : 'Sign'}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleRespond(t.id, 'reject')}
                          disabled={respondLoadingId === t.id}
                          sx={{
                            borderColor: alpha(theme.palette.error.main, 0.267),
                            color: 'error.main',
                            '&:hover': {
                              borderColor: 'error.main',
                              background: alpha(theme.palette.error.main, 0.08),
                            },
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {/* Show signed/rejected status badge */}
                    {t.status === 'proposed' && mySig && mySig.status !== 'pending' && (
                      <Chip
                        label={mySig.status === 'signed' ? 'Signed' : 'Rejected'}
                        size="small"
                        sx={{
                          fontSize: '0.7rem',
                          color:
                            mySig.status === 'signed'
                              ? theme.palette.success.main
                              : theme.palette.error.main,
                          background: alpha(
                            mySig.status === 'signed'
                              ? theme.palette.success.main
                              : theme.palette.error.main,
                            0.1
                          ),
                        }}
                      />
                    )}
                    {/* Terminate button for active treaties */}
                    {canManage(myRole) && t.status === 'active' && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleTerminate(t.id, t.name)}
                        disabled={removeLoadingId === t.id}
                        sx={{
                          borderColor: alpha(theme.palette.error.main, 0.267),
                          color: 'error.main',
                          '&:hover': {
                            borderColor: 'error.main',
                            background: alpha(theme.palette.error.main, 0.08),
                          },
                        }}
                      >
                        {removeLoadingId === t.id ? <CircularProgress size={14} /> : 'Terminate'}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <Dialog
        open={createOpen}
        onClose={() => !createTreatyMutation.isPending && setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Propose Treaty</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {tError && <Alert severity="error">{tError}</Alert>}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              The treaty will be created as a proposal. All federation member orgs can then choose
              to sign or reject it.
            </Typography>
            <TextField
              label="Treaty Name"
              value={tName}
              onChange={e => setTName(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={tType}
                onChange={e => setTType(e.target.value as TreatyType)}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { bgcolor: 'background.paper', color: 'common.white' } },
                  },
                }}
              >
                {(
                  [
                    'mutual_defense',
                    'trade',
                    'resource_sharing',
                    'non_aggression',
                    'custom',
                  ] as TreatyType[]
                ).map(t => (
                  <MenuItem key={t} value={t}>
                    {t.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Terms (one per line)"
              value={tTerms}
              onChange={e => setTTerms(e.target.value)}
              fullWidth
              multiline
              rows={5}
              size="small"
              placeholder="Each line is one treaty term"
              helperText="Minimum 1 term required"
              sx={darkFieldSx}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setCreateOpen(false)}
            disabled={createTreatyMutation.isPending}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={
              createTreatyMutation.isPending ||
              tName.trim().length < 3 ||
              !tTerms.split('\n').some(s => s.trim().length >= 5)
            }
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {createTreatyMutation.isPending ? (
              <CircularProgress size={16} sx={{ color: 'common.black' }} />
            ) : (
              'Propose'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────

// ─── Dashboard Tab ────────────────────────────────────────────────────────

const DashboardTab: React.FC<{
  federationId: string;
  federation: ManagedFederation;
}> = ({ federationId, federation }) => {
  const theme = useTheme();
  const { data: stats } = useFederationStats(federationId);
  const { data: contributions = [] } = useFederationContributions(federationId);
  const { data: proposals = [] } = useFederationProposals(federationId, 'open');

  const activeMembers = federation.members?.filter(m => m.status === 'active') ?? [];
  const roleBreakdown = activeMembers.reduce(
    (acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const STAT_CARDS = [
    {
      label: 'Members',
      value: stats?.activeMembers ?? activeMembers.length,
      color: theme.palette.info.main,
      icon: <GroupsIcon />,
    },
    {
      label: 'Shared Resources',
      value: stats?.sharedResourcesCount ?? 0,
      color: theme.palette.secondary.main,
      icon: <LinkIcon />,
    },
    {
      label: 'Active Treaties',
      value: stats?.activeTreaties ?? 0,
      color: theme.palette.success.main,
      icon: <DescriptionIcon />,
    },
    {
      label: 'Open Proposals',
      value: stats?.openProposals ?? proposals.length,
      color: theme.palette.warning.main,
      icon: <PollIcon />,
    },
    {
      label: 'Voting Power',
      value: stats?.totalVotingPower ?? 0,
      color: theme.palette.primary.main,
      icon: <BoltIcon />,
    },
    {
      label: 'Combined Members',
      value: stats?.combinedMemberCount ?? 0,
      color: theme.palette.grey[400],
      icon: <ListAltIcon />,
    },
  ];

  return (
    <Stack spacing={3}>
      {/* Stats Grid */}
      <Grid container spacing={2}>
        {STAT_CARDS.map(s => (
          <Grid key={s.label} size={{ xs: 6, sm: 4, md: 2 }}>
            <Paper
              sx={{
                ...cardSx(theme),
                textAlign: 'center',
                py: 2,
                border: `1px solid ${alpha(s.color, 0.15)}`,
              }}
            >
              <Box
                sx={{
                  fontSize: '1.5rem',
                  mb: 0.5,
                  color: s.color,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                {s.icon}
              </Box>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>
                {s.value}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {s.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Role Breakdown + Open Proposals */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1.5 }}>
              Role Distribution
            </Typography>
            <Stack spacing={1}>
              {Object.entries(roleBreakdown).map(([role, count]) => (
                <Stack
                  key={role}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={role}
                      size="small"
                      sx={{
                        fontSize: '0.7rem',
                        bgcolor: alpha(getRoleColor(role as FederationRole, theme), 0.09),
                        color: getRoleColor(role as FederationRole, theme),
                        border: `1px solid ${alpha(getRoleColor(role as FederationRole, theme), 0.27)}`,
                      }}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {count}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1.5 }}>
              Open Proposals ({proposals.length})
            </Typography>
            {proposals.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                No open proposals
              </Typography>
            ) : (
              <Stack spacing={1}>
                {proposals.slice(0, 5).map(p => (
                  <Stack
                    key={p.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="body2" sx={{ color: 'text.primary' }} noWrap>
                      {p.title}
                    </Typography>
                    <Chip
                      label={`${p.votes.length} votes`}
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        height: 20,
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: 'info.main',
                      }}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Top Contributors */}
      {contributions.length > 0 && (
        <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1.5 }}>
            Member Contributions
          </Typography>
          <Stack spacing={1}>
            {contributions.map((c, i) => (
              <Stack key={c.organizationId} direction="row" alignItems="center" spacing={1.5}>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.disabled', width: 20, textAlign: 'right' }}
                >
                  #{i + 1}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.organizationName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {c.contributions} contributions
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={
                      contributions[0]?.contributions
                        ? (c.contributions / contributions[0].contributions) * 100
                        : 0
                    }
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 2 },
                    }}
                  />
                </Box>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

// ─── Federation Fleets Tab ─────────────────────────────────────────────────

const FleetsTab: React.FC<{
  federationId: string;
}> = ({ federationId }) => {
  const theme = useTheme();
  const { data: fleetsData, isLoading, error } = useFederationFleets(federationId);

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={28} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (error) {
    const errMsg =
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Failed to load federation fleets. The feature may not be enabled.';
    return (
      <Alert severity="warning" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.06) }}>
        {errMsg}
      </Alert>
    );
  }

  const fleets = fleetsData?.fleets ?? [];
  const totalFleets = fleetsData?.totalFleets ?? fleets.length;
  const fleetsByOrg = fleetsData?.fleetsByOrganization ?? {};

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {totalFleets} fleet{totalFleets === 1 ? '' : 's'} across {Object.keys(fleetsByOrg).length}{' '}
          organization{Object.keys(fleetsByOrg).length === 1 ? '' : 's'}
        </Typography>
      </Stack>

      {fleets.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <FleetsIcon sx={{ fontSize: '2.5rem', mb: 1, color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            No Federation Fleets
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Enable federation fleets in Settings and member organizations will contribute their
            fleets.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {fleets.map(f => {
            const getReadinessColor = (s?: string) => {
              if (s === 'green') return theme.palette.success.main;
              if (s === 'yellow') return theme.palette.warning.main;
              return theme.palette.error.main;
            };
            const readinessColor = getReadinessColor(f.readiness?.status);

            return (
              <Paper key={f.id} sx={{ ...cardSx(theme), p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                    <Box>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {f.name}
                        </Typography>
                        {f.isShared && (
                          <Tooltip
                            title={`Shared via ${f.sharedVia?.replaceAll('_', ' ') ?? 'treaty'}`}
                          >
                            <HandshakeIcon sx={{ fontSize: '1rem', color: 'info.main' }} />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {f.organizationName}
                      </Typography>
                      {f.isShared && f.sharedVia && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'info.main', display: 'block', fontSize: '0.6rem' }}
                        >
                          {f.sharedVia.replaceAll('_', ' ')} treaty
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    <Chip
                      label={f.status}
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        height: 22,
                        bgcolor: alpha(
                          f.status === 'active'
                            ? theme.palette.success.main
                            : theme.palette.grey[600],
                          0.1
                        ),
                        color: f.status === 'active' ? 'success.main' : 'text.disabled',
                        border: `1px solid ${alpha(
                          f.status === 'active'
                            ? theme.palette.success.main
                            : theme.palette.grey[600],
                          0.27
                        )}`,
                      }}
                    />
                    <Chip
                      label={`${f.shipCount} ships`}
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        height: 22,
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: 'info.main',
                        border: `1px solid ${alpha(theme.palette.info.main, 0.27)}`,
                      }}
                    />
                    <Chip
                      label={`${f.memberCount} crew`}
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        height: 22,
                        bgcolor: alpha(theme.palette.common.white, 0.04),
                        color: 'text.secondary',
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    />
                  </Stack>
                </Stack>
                {f.description && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}
                  >
                    {f.description}
                  </Typography>
                )}
                {f.readiness && (
                  <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontWeight: 500 }}
                      >
                        Readiness
                      </Typography>
                      <Typography variant="caption" sx={{ color: readinessColor, fontWeight: 600 }}>
                        {f.readiness.healthScore}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={f.readiness.healthScore}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: alpha(readinessColor, 0.08),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: readinessColor,
                          borderRadius: 2,
                        },
                      }}
                    />
                    <Stack direction="row" spacing={2}>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled', fontSize: '0.6rem' }}
                      >
                        Ships ready: {f.readiness.readinessPercent}%
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled', fontSize: '0.6rem' }}
                      >
                        Crew fill: {f.readiness.crewFillPercent}%
                      </Typography>
                    </Stack>
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};

// ─── Diplomacy Tab ────────────────────────────────────────────────────────

const DiplomacyTab: React.FC<{
  federation: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federation, myRole }) => {
  const theme = useTheme();
  const members = useMemo(
    () => federation.members?.filter(m => m.status === 'active') ?? [],
    [federation.members]
  );

  const RELATION_TYPES = [
    {
      key: 'allied' as const,
      label: 'Allied',
      color: theme.palette.success.main,
      icon: <HandshakeIcon fontSize="small" />,
    },
    {
      key: 'neutral' as const,
      label: 'Neutral',
      color: theme.palette.grey[500],
      icon: <BalanceIcon fontSize="small" />,
    },
    {
      key: 'rival' as const,
      label: 'Rival',
      color: theme.palette.error.main,
      icon: <DangerousIcon fontSize="small" />,
    },
  ];

  type RelationKind = (typeof RELATION_TYPES)[number]['key'];
  type RelationNode = {
    member: FederationMember;
    x: number;
    y: number;
  };

  const resolveRelationType = useCallback(
    (left: FederationMember, right: FederationMember): RelationKind => {
      if (left.role === 'observer' || right.role === 'observer') {
        return 'neutral';
      }
      return 'allied';
    },
    []
  );

  const relationNodes = useMemo<RelationNode[]>(() => {
    if (members.length === 0) {
      return [];
    }

    const ringRadius = members.length <= 3 ? 30 : members.length <= 6 ? 34 : 38;
    return members.map((member, index) => {
      const angle = (Math.PI * 2 * index) / members.length - Math.PI / 2;
      return {
        member,
        x: 50 + Math.cos(angle) * ringRadius,
        y: 50 + Math.sin(angle) * ringRadius,
      };
    });
  }, [members]);

  const relationEdges = useMemo(() => {
    const edges: Array<{
      id: string;
      source: RelationNode;
      target: RelationNode;
      type: RelationKind;
    }> = [];

    for (let i = 0; i < relationNodes.length; i += 1) {
      for (let j = i + 1; j < relationNodes.length; j += 1) {
        const source = relationNodes[i];
        const target = relationNodes[j];
        edges.push({
          id: `${source.member.id}-${target.member.id}`,
          source,
          target,
          type: resolveRelationType(source.member, target.member),
        });
      }
    }

    return edges;
  }, [relationNodes, resolveRelationType]);

  const relationCounts = useMemo(
    () =>
      relationEdges.reduce(
        (acc, edge) => {
          acc[edge.type] += 1;
          return acc;
        },
        { allied: 0, neutral: 0, rival: 0 } as Record<RelationKind, number>
      ),
    [relationEdges]
  );

  const nodeWidth = members.length > 6 ? 112 : 146;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Inter-organization relations within the federation
        </Typography>
      </Stack>

      {/* Relationship graph */}
      <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 2 }}>
          Member Relations Graph
        </Typography>

        {members.length < 2 ? (
          <Alert severity="info" sx={{ bgcolor: alpha(theme.palette.info.main, 0.06) }}>
            Add at least two active organizations to display relationship links.
          </Alert>
        ) : (
          <Box
            sx={{
              position: 'relative',
              minHeight: { xs: 300, md: 360 },
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              bgcolor: alpha(theme.palette.common.white, 0.01),
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0)} 68%)`,
              }}
            />

            <Box
              component="svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {relationEdges.map(edge => {
                const relationStyle = RELATION_TYPES.find(r => r.key === edge.type);
                if (!relationStyle) return null;

                return (
                  <line
                    key={edge.id}
                    x1={edge.source.x}
                    y1={edge.source.y}
                    x2={edge.target.x}
                    y2={edge.target.y}
                    stroke={alpha(relationStyle.color, edge.type === 'allied' ? 0.5 : 0.35)}
                    strokeWidth={edge.type === 'rival' ? 1.8 : 1.35}
                    strokeDasharray={edge.type === 'neutral' ? '2.5 2' : undefined}
                  />
                );
              })}
            </Box>

            <Paper
              sx={{
                ...cardSx(theme),
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                px: 2,
                py: 1,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.82),
                zIndex: 2,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.disabled', letterSpacing: 0.6 }}>
                FEDERATION CORE
              </Typography>
              <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                {federation.name}
              </Typography>
            </Paper>

            {relationNodes.map(node => (
              <Box
                key={node.member.id}
                sx={{
                  position: 'absolute',
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: { xs: nodeWidth - 24, md: nodeWidth },
                  px: 1,
                  py: 0.9,
                  borderRadius: 1.6,
                  bgcolor: alpha(theme.palette.background.paper, 0.85),
                  border: `1px solid ${alpha(getRoleColor(node.member.role, theme), 0.35)}`,
                  boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, 0.35)}`,
                  backdropFilter: 'blur(8px)',
                  zIndex: 3,
                }}
              >
                <Tooltip title={node.member.organizationName} placement="top" arrow>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.primary',
                      fontWeight: 700,
                      lineHeight: 1.2,
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {node.member.organizationName}
                  </Typography>
                </Tooltip>
                <Chip
                  label={node.member.role}
                  size="small"
                  sx={{
                    mt: 0.75,
                    height: 18,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    bgcolor: alpha(getRoleColor(node.member.role, theme), 0.11),
                    color: getRoleColor(node.member.role, theme),
                    border: `1px solid ${alpha(getRoleColor(node.member.role, theme), 0.25)}`,
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* Legend */}
      <Paper sx={{ ...cardSx(theme), p: 2 }}>
        <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1 }}>
          Relation Types
        </Typography>
        <Stack direction="row" spacing={2}>
          {RELATION_TYPES.map(r => (
            <Stack key={r.label} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ color: r.color, display: 'flex' }}>{r.icon}</Box>
              <Typography variant="body2" sx={{ color: r.color, fontWeight: 600 }}>
                {r.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                {relationCounts[r.key]}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>

      {!canManage(myRole) && (
        <Alert severity="info" sx={{ bgcolor: alpha(theme.palette.info.main, 0.06) }}>
          Only leaders can manage diplomatic relations between member organizations.
        </Alert>
      )}
    </Stack>
  );
};

// ─── Wiki Tab ─────────────────────────────────────────────────────────────────

const WikiTab: React.FC<{
  federationId: string;
  myRole?: FederationRole;
}> = ({ federationId, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);

  const { data: pages = [], isLoading } = useFederationWikiPages(federationId);
  const createMutation = useCreateFederationWikiPage();
  const updateMutation = useUpdateFederationWikiPage();
  const deleteMutation = useDeleteFederationWikiPage();

  const [createOpen, setCreateOpen] = useState(false);
  const [editPage, setEditPage] = useState<FederationWikiPage | null>(null);
  const [viewPage, setViewPage] = useState<FederationWikiPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [cTitle, setCTitle] = useState('');
  const [cContent, setCContent] = useState('');
  const [cVisibility, setCVisibility] = useState<FederationWikiVisibility>('members');

  // Edit form
  const [eTitle, setETitle] = useState('');
  const [eContent, setEContent] = useState('');
  const [eVisibility, setEVisibility] = useState<FederationWikiVisibility>('members');

  const resetCreate = () => {
    setCTitle('');
    setCContent('');
    setCVisibility('members');
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await createMutation.mutateAsync({
        federationId,
        data: { title: cTitle.trim(), content: cContent, visibility: cVisibility },
      });
      setCreateOpen(false);
      resetCreate();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to create wiki page'
      );
    }
  };

  const handleOpenEdit = (page: FederationWikiPage) => {
    setEditPage(page);
    setETitle(page.title);
    setEContent(page.content);
    setEVisibility(page.federationVisibility ?? 'members');
    setError(null);
  };

  const handleUpdate = async () => {
    if (!editPage) return;
    setError(null);
    try {
      const updated = await updateMutation.mutateAsync({
        federationId,
        pageId: editPage.id,
        data: { title: eTitle.trim(), content: eContent, visibility: eVisibility },
      });
      // Refresh the viewed page if it was the one being edited
      if (viewPage?.id === editPage.id && updated) {
        setViewPage(updated);
      }
      setEditPage(null);
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to update wiki page'
      );
    }
  };

  const handleDelete = async (page: FederationWikiPage) => {
    if (!globalThis.confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync({ federationId, pageId: page.id });
      if (viewPage?.id === page.id) setViewPage(null);
    } catch {
      setError('Failed to delete wiki page.');
    }
  };

  const visibilityLabel = (v: string) => {
    if (v === 'public') return 'Public';
    if (v === 'council') return 'Council Only';
    return 'Members';
  };

  if (isLoading) return <CircularProgress size={24} />;

  // If viewing a page, show it
  if (viewPage) {
    return (
      <Stack spacing={2}>
        <Button
          size="small"
          onClick={() => setViewPage(null)}
          sx={{ color: 'text.secondary', alignSelf: 'flex-start' }}
        >
          ← Back to pages
        </Button>
        <Paper sx={cardSx(theme)}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {viewPage.title}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                <Chip
                  label={visibilityLabel(viewPage.federationVisibility ?? 'members')}
                  size="small"
                  sx={{ fontSize: '0.7rem' }}
                />
                <Chip label={`v${viewPage.version}`} size="small" sx={{ fontSize: '0.7rem' }} />
              </Stack>
            </Box>
            {manage && (
              <Stack direction="row" spacing={0.5}>
                <Button size="small" onClick={() => handleOpenEdit(viewPage)}>
                  Edit
                </Button>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(viewPage)}
                  sx={{ color: 'error.main' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            )}
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>
            {viewPage.content || 'No content yet.'}
          </Typography>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {pages.length} wiki page{pages.length === 1 ? '' : 's'}
        </Typography>
        {manage && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              resetCreate();
              setCreateOpen(true);
            }}
            sx={cyanBtnSx}
          >
            New Page
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pages.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <BookIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            No Wiki Pages
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Create your first federation knowledge base page.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {pages.map(page => (
            <Paper
              key={page.id}
              sx={{
                ...cardSx(theme),
                cursor: 'pointer',
                '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.3) },
              }}
              onClick={() => setViewPage(page)}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {page.title}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                    <Chip
                      label={visibilityLabel(page.federationVisibility ?? 'members')}
                      size="small"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                    {page.tags?.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 20, borderColor: 'divider' }}
                      />
                    ))}
                  </Stack>
                </Box>
                {manage && (
                  <Stack direction="row" spacing={0.5} onClick={e => e.stopPropagation()}>
                    <Button
                      size="small"
                      onClick={() => handleOpenEdit(page)}
                      sx={{ color: 'text.secondary', minWidth: 'auto' }}
                    >
                      Edit
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(page)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>New Wiki Page</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              size="small"
              value={cTitle}
              onChange={e => setCTitle(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Content (Markdown)"
              fullWidth
              multiline
              rows={12}
              size="small"
              value={cContent}
              onChange={e => setCContent(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 100000 } }}
              sx={darkFieldSx}
            />
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Visibility</InputLabel>
              <Select
                label="Visibility"
                value={cVisibility}
                onChange={e => setCVisibility(e.target.value as FederationWikiVisibility)}
              >
                <MenuItem value="members">All Members</MenuItem>
                <MenuItem value="council">Council Only</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!cTitle.trim() || createMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editPage}
        onClose={() => setEditPage(null)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Edit: {editPage?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              size="small"
              value={eTitle}
              onChange={e => setETitle(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Content (Markdown)"
              fullWidth
              multiline
              rows={12}
              size="small"
              value={eContent}
              onChange={e => setEContent(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 100000 } }}
              sx={darkFieldSx}
            />
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Visibility</InputLabel>
              <Select
                label="Visibility"
                value={eVisibility}
                onChange={e => setEVisibility(e.target.value as FederationWikiVisibility)}
              >
                <MenuItem value="members">All Members</MenuItem>
                <MenuItem value="council">Council Only</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditPage(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={updateMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Announcements Tab ───────────────────────────────────────────────────

const AnnouncementsTab: React.FC<{
  federationId: string;
  federation: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federationId, federation, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);

  const { data: announcements = [], isLoading } = useFederationAnnouncements(federationId);
  const createMutation = useCreateFederationAnnouncement();
  const deleteMutation = useDeleteFederationAnnouncement();
  const pinMutation = useToggleAnnouncementPin();
  const postMutation = usePostFederationAnnouncementToDiscord();

  const [composeOpen, setComposeOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [postTargetId, setPostTargetId] = useState<string | null>(null);
  const [postChannelId, setPostChannelId] = useState('');
  const [aTitle, setATitle] = useState('');
  const [aMessage, setAMessage] = useState('');
  const [aAudience, setAAudience] = useState<FederationAnnouncementAudience>('all-members');
  const [error, setError] = useState<string | null>(null);

  const handleBroadcast = async () => {
    setError(null);
    try {
      await createMutation.mutateAsync({
        federationId,
        data: { title: aTitle.trim(), content: aMessage.trim(), targetAudience: aAudience },
      });
      setComposeOpen(false);
      setATitle('');
      setAMessage('');
      setAAudience('all-members');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to broadcast announcement'
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!globalThis.confirm('Delete this announcement?')) return;
    try {
      await deleteMutation.mutateAsync({ federationId, announcementId: id });
    } catch {
      setError('Failed to delete announcement.');
    }
  };

  const handlePin = async (id: string) => {
    try {
      await pinMutation.mutateAsync({ federationId, announcementId: id });
    } catch {
      setError('Failed to pin/unpin announcement.');
    }
  };

  const handleOpenPostDialog = (announcementId: string) => {
    setError(null);
    setPostTargetId(announcementId);
    setPostChannelId('');
    setPostOpen(true);
  };

  const handlePostToDiscord = async () => {
    if (!postTargetId || !postChannelId.trim()) return;
    setError(null);

    try {
      await postMutation.mutateAsync({
        federationId,
        announcementId: postTargetId,
        channelId: postChannelId.trim(),
      });
      setPostOpen(false);
      setPostTargetId(null);
      setPostChannelId('');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to post announcement to Discord'
      );
    }
  };

  const audienceLabel = (a: string) => {
    if (a === 'council') return 'Council';
    if (a === 'public') return 'Public';
    return 'All Members';
  };

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {announcements.length} announcement{announcements.length === 1 ? '' : 's'}
        </Typography>
        {manage && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setError(null);
              setComposeOpen(true);
            }}
            sx={cyanBtnSx}
          >
            New Announcement
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {announcements.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <AnnouncementsIcon sx={{ fontSize: '2.5rem', mb: 1, color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            No Announcements
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            {manage
              ? 'Broadcast your first announcement to member organizations.'
              : 'No federation announcements have been posted yet.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {announcements.map((ann: FederationAnnouncement) => (
            <Paper key={ann.id} sx={cardSx(theme)}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                    {ann.pinnedAt && <PushPinIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {ann.title}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', mb: 1 }}
                  >
                    {ann.content}
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Chip
                      label={audienceLabel(ann.targetAudience)}
                      size="small"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      by {ann.createdByName ?? 'Unknown'} ·{' '}
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </Typography>
                  </Stack>
                </Box>
                {manage && (
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Post in Discord">
                      <IconButton size="small" onClick={() => handleOpenPostDialog(ann.id)}>
                        <DiscordIcon fontSize="small" sx={{ color: 'primary.main' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={ann.pinnedAt ? 'Unpin' : 'Pin'}>
                      <IconButton size="small" onClick={() => handlePin(ann.id)}>
                        <PushPinIcon
                          fontSize="small"
                          sx={{ color: ann.pinnedAt ? 'warning.main' : 'text.disabled' }}
                        />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(ann.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Compose Dialog */}
      <Dialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>New Announcement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={aTitle}
              onChange={e => setATitle(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 256 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Message"
              value={aMessage}
              onChange={e => setAMessage(e.target.value)}
              fullWidth
              multiline
              rows={5}
              size="small"
              slotProps={{ htmlInput: { maxLength: 5000 } }}
              helperText={`${aMessage.length}/5000`}
              sx={darkFieldSx}
            />
            <FormControl size="small" fullWidth sx={darkSelectSx}>
              <InputLabel>Audience</InputLabel>
              <Select
                label="Audience"
                value={aAudience}
                onChange={e => setAAudience(e.target.value as FederationAnnouncementAudience)}
              >
                <MenuItem value="all-members">All Members</MenuItem>
                <MenuItem value="council">Council Only</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Target: {aAudience === 'council' ? 'Council+' : 'All'}{' '}
                {federation.members?.filter(m => m.status === 'active').length ?? 0} member
                organizations
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setComposeOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={
              aTitle.trim().length < 3 || aMessage.trim().length < 10 || createMutation.isPending
            }
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
            onClick={handleBroadcast}
          >
            {createMutation.isPending ? 'Broadcasting…' : 'Broadcast'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Post in Discord Dialog */}
      <Dialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Post in Discord</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Discord Channel ID"
              value={postChannelId}
              onChange={e => setPostChannelId(e.target.value)}
              fullWidth
              size="small"
              sx={darkFieldSx}
              helperText="Channel in the federation's central Discord server"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPostOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePostToDiscord}
            disabled={postMutation.isPending || !postChannelId.trim()}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {postMutation.isPending ? 'Posting…' : 'Post'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Polls Tab ────────────────────────────────────────────────────────────────

const PollsTab: React.FC<{
  federationId: string;
  myRole?: FederationRole;
}> = ({ federationId, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);
  const canUserVote = canVote(myRole);

  const { data: polls = [], isLoading } = useFederationPolls(federationId);
  const createMutation = useCreateFederationPoll();
  const voteMutation = useCastFedPollVote();
  const closeMutation = useCloseFederationPoll();
  const deleteMutation = useDeleteFederationPoll();
  const postPollMutation = usePostFederationPollToDiscord();

  const [createOpen, setCreateOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [postTargetPollId, setPostTargetPollId] = useState<string | null>(null);
  const [postChannelId, setPostChannelId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [pTitle, setPTitle] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pOptionCounter, setPOptionCounter] = useState(2);
  const [pOptions, setPOptions] = useState<Array<{ key: number; value: string }>>([
    { key: 0, value: '' },
    { key: 1, value: '' },
  ]);
  const [pVotingMode, setPVotingMode] = useState<FederationVotingMode>('equal');

  const resetCreate = () => {
    setPTitle('');
    setPDescription('');
    setPOptionCounter(2);
    setPOptions([
      { key: 0, value: '' },
      { key: 1, value: '' },
    ]);
    setPVotingMode('equal');
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    const opts = pOptions.filter(o => o.value.trim()).map(o => ({ label: o.value.trim() }));
    if (opts.length < 2) {
      setError('At least 2 options are required');
      return;
    }
    try {
      await createMutation.mutateAsync({
        federationId,
        data: {
          title: pTitle.trim(),
          description: pDescription.trim() || undefined,
          options: opts,
          votingMode: pVotingMode,
        },
      });
      setCreateOpen(false);
      resetCreate();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to create poll'
      );
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      await voteMutation.mutateAsync({ federationId, pollId, optionId });
    } catch {
      setError('Failed to cast vote.');
    }
  };

  const handleClose = async (pollId: string) => {
    try {
      await closeMutation.mutateAsync({ federationId, pollId });
    } catch {
      setError('Failed to close poll.');
    }
  };

  const handleDelete = async (pollId: string) => {
    if (!globalThis.confirm('Delete this poll?')) return;
    try {
      await deleteMutation.mutateAsync({ federationId, pollId });
    } catch {
      setError('Failed to delete poll.');
    }
  };

  const handleOpenPostDialog = (pollId: string) => {
    setError(null);
    setPostTargetPollId(pollId);
    setPostChannelId('');
    setPostOpen(true);
  };

  const handlePostPollToDiscord = async () => {
    if (!postTargetPollId || !postChannelId.trim()) return;
    setError(null);

    try {
      await postPollMutation.mutateAsync({
        federationId,
        pollId: postTargetPollId,
        channelId: postChannelId.trim(),
      });
      setPostOpen(false);
      setPostTargetPollId(null);
      setPostChannelId('');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to post poll to Discord'
      );
    }
  };

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {polls.length} poll{polls.length === 1 ? '' : 's'}
        </Typography>
        {manage && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              resetCreate();
              setCreateOpen(true);
            }}
            sx={cyanBtnSx}
          >
            New Poll
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {polls.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <PollIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            No Federation Polls
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            {manage ? 'Create your first federation-wide poll.' : 'No polls have been created yet.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {polls.map((poll: FederationPoll) => {
            const isActive = poll.status === 'active';
            return (
              <Paper key={poll.id} sx={cardSx(theme)}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {poll.title}
                      </Typography>
                      <Chip
                        label={poll.status}
                        size="small"
                        sx={{ ...getStatusChipSx(poll.status, theme), fontSize: '0.7rem' }}
                      />
                      {poll.votingMode === 'weighted' && (
                        <Chip
                          label="Weighted"
                          size="small"
                          sx={{ fontSize: '0.65rem', height: 20 }}
                        />
                      )}
                    </Stack>
                    {poll.description && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        {poll.description}
                      </Typography>
                    )}
                    {/* Options with vote counts */}
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {poll.options.map(opt => (
                        <Stack key={opt.id} direction="row" spacing={1} alignItems="center">
                          {isActive && canUserVote && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleVote(poll.id, opt.id)}
                              disabled={voteMutation.isPending}
                              sx={{ minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                            >
                              Vote
                            </Button>
                          )}
                          <Typography variant="body2">{opt.label}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.disabled', mt: 1, display: 'block' }}
                    >
                      {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'} · by{' '}
                      {poll.createdByName ?? 'Unknown'}
                    </Typography>
                  </Box>
                  {manage && (
                    <Stack direction="row" spacing={0.5}>
                      {isActive && (
                        <Tooltip title="Post in Discord">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenPostDialog(poll.id)}
                            sx={{ color: 'primary.main' }}
                          >
                            <DiscordIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {isActive && (
                        <Button
                          size="small"
                          onClick={() => handleClose(poll.id)}
                          sx={{ color: 'text.secondary' }}
                        >
                          Close
                        </Button>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(poll.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Create Poll Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>New Federation Poll</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Question / Title"
              fullWidth
              size="small"
              value={pTitle}
              onChange={e => setPTitle(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={pDescription}
              onChange={e => setPDescription(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              sx={darkFieldSx}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Options
              </Typography>
              {pOptions.map((opt, idx) => (
                <Stack key={opt.key} direction="row" spacing={1} sx={{ mb: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={`Option ${idx + 1}`}
                    value={opt.value}
                    onChange={e => {
                      const next = [...pOptions];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setPOptions(next);
                    }}
                    sx={darkFieldSx}
                  />
                  {pOptions.length > 2 && (
                    <IconButton
                      size="small"
                      onClick={() => setPOptions(pOptions.filter(o => o.key !== opt.key))}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
              {pOptions.length < 10 && (
                <Button
                  size="small"
                  onClick={() => {
                    setPOptions([...pOptions, { key: pOptionCounter, value: '' }]);
                    setPOptionCounter(c => c + 1);
                  }}
                  sx={{ color: 'primary.main', mt: 0.5 }}
                >
                  + Add Option
                </Button>
              )}
            </Box>
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Voting Mode</InputLabel>
              <Select
                label="Voting Mode"
                value={pVotingMode}
                onChange={e => setPVotingMode(e.target.value as FederationVotingMode)}
              >
                <MenuItem value="equal">Equal (1 vote per ambassador)</MenuItem>
                <MenuItem value="weighted">Weighted (by org voting power)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !pTitle.trim() ||
              pOptions.filter(o => o.value.trim()).length < 2 ||
              createMutation.isPending
            }
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Poll'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Post Poll Dialog */}
      <Dialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Post Poll in Discord</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Discord Channel ID"
              value={postChannelId}
              onChange={e => setPostChannelId(e.target.value)}
              fullWidth
              size="small"
              sx={darkFieldSx}
              helperText="Channel in the federation's central Discord server"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPostOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handlePostPollToDiscord}
            disabled={postPollMutation.isPending || !postChannelId.trim()}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {postPollMutation.isPending ? 'Posting…' : 'Post'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Teams Tab ────────────────────────────────────────────────────────────────

const TeamsTab: React.FC<{
  federationId: string;
  federation?: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federationId, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);

  const { data: teams = [], isLoading } = useFederationTeams(federationId);
  const { data: personnel = [] } = useFederationPersonnel(federationId);
  const createMutation = useCreateFederationTeam();
  const updateMutation = useUpdateFederationTeam();
  const deleteMutation = useDeleteFederationTeam();
  const addMemberMutation = useAddFederationTeamMember();
  const removeMemberMutation = useRemoveFederationTeamMember();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [tName, setTName] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tType, setTType] = useState<FederationTeamType>('task_force');
  const [tMaxMembers, setTMaxMembers] = useState(20);

  // Edit form
  const [eName, setEName] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eType, setEType] = useState<FederationTeamType>('task_force');
  const [eMaxMembers, setEMaxMembers] = useState(20);
  const [eStatus, setEStatus] = useState<FederationTeamStatus>('active');

  // Add-member form
  const [memberToAdd, setMemberToAdd] = useState<FederationPersonnel | null>(null);
  const [memberRole, setMemberRole] = useState('member');

  const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? null;

  const resetCreate = () => {
    setTName('');
    setTDescription('');
    setTType('task_force');
    setTMaxMembers(20);
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await createMutation.mutateAsync({
        federationId,
        data: {
          name: tName.trim(),
          description: tDescription.trim() || undefined,
          type: tType,
          maxMembers: tMaxMembers,
        },
      });
      setCreateOpen(false);
      resetCreate();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to create team'
      );
    }
  };

  const handleOpenEdit = (team: FederationTeam) => {
    setEName(team.name);
    setEDescription(team.description ?? '');
    setEType(team.type);
    setEMaxMembers(team.maxMembers);
    setEStatus(team.status);
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedTeamId) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({
        federationId,
        teamId: selectedTeamId,
        data: {
          name: eName.trim(),
          description: eDescription.trim() || null,
          type: eType,
          maxMembers: eMaxMembers,
          status: eStatus,
        },
      });
      setEditOpen(false);
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to update team'
      );
    }
  };

  const handleDelete = async (team: FederationTeam) => {
    if (!globalThis.confirm(`Delete team "${team.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ federationId, teamId: team.id });
      if (selectedTeamId === team.id) setSelectedTeamId(null);
    } catch {
      setError('Failed to delete team.');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !memberToAdd) return;
    setError(null);
    try {
      await addMemberMutation.mutateAsync({
        federationId,
        teamId: selectedTeamId,
        member: {
          userId: memberToAdd.userId,
          userName: memberToAdd.userName,
          organizationId: memberToAdd.organizationId,
          organizationName: memberToAdd.organizationName,
          role: memberRole,
        },
      });
      setMemberToAdd(null);
      setMemberRole('member');
      setAddMemberOpen(false);
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to add member'
      );
    }
  };

  const handleRemoveMember = async (member: FederationTeamMember) => {
    if (!selectedTeamId) return;
    if (!globalThis.confirm(`Remove ${member.userName} from the team?`)) return;
    try {
      await removeMemberMutation.mutateAsync({
        federationId,
        teamId: selectedTeamId,
        memberUserId: member.userId,
      });
    } catch {
      setError('Failed to remove member.');
    }
  };

  const teamTypeLabel = (t: string) => {
    const labels: Record<string, string> = {
      task_force: 'Task Force',
      diplomatic_mission: 'Diplomatic Mission',
      joint_operation: 'Joint Operation',
      trade_convoy: 'Trade Convoy',
      custom: 'Custom',
    };
    return labels[t] ?? t;
  };

  // Filter out personnel already in the selected team
  const availablePersonnel = selectedTeam
    ? personnel.filter(p => !selectedTeam.members.some(m => m.userId === p.userId))
    : [];

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {teams.length} team{teams.length === 1 ? '' : 's'}
        </Typography>
        {manage && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              resetCreate();
              setCreateOpen(true);
            }}
            sx={cyanBtnSx}
          >
            New Team
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {teams.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <TeamIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            No Cross-Org Teams
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            {manage
              ? 'Create your first cross-organization operational team.'
              : 'No teams have been formed yet.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {teams.map((team: FederationTeam) => {
            const isSelected = selectedTeamId === team.id;
            return (
              <Paper
                key={team.id}
                sx={{
                  ...cardSx(theme),
                  cursor: 'pointer',
                  borderColor: isSelected ? alpha(theme.palette.primary.main, 0.5) : undefined,
                  '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.35),
                  },
                }}
                onClick={() => setSelectedTeamId(isSelected ? null : team.id)}
              >
                {/* Team Header Row */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {team.name}
                      </Typography>
                      <Chip
                        label={teamTypeLabel(team.type)}
                        size="small"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                      <Chip
                        label={team.status}
                        size="small"
                        sx={{
                          ...getStatusChipSx(team.status, theme),
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />
                    </Stack>
                    {team.description && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        {team.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {team.memberCount}/{team.maxMembers} members
                      </Typography>
                      {team.leaderName && (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          · Lead: {team.leaderName}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  {manage && (
                    <Stack direction="row" spacing={0.5} onClick={e => e.stopPropagation()}>
                      <Tooltip title="Edit team">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedTeamId(team.id);
                            handleOpenEdit(team);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete team">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(team)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>

                {/* Expanded Detail Panel */}
                {isSelected && (
                  <Box
                    sx={{
                      mt: 2,
                      pt: 2,
                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Action Buttons */}
                    {manage && (
                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<PersonAddIcon />}
                          onClick={() => {
                            setMemberToAdd(null);
                            setMemberRole('member');
                            setAddMemberOpen(true);
                          }}
                          disabled={team.memberCount >= team.maxMembers}
                          sx={cyanBtnSx}
                        >
                          Add Member
                        </Button>
                      </Stack>
                    )}

                    {/* Members List */}
                    {team.members.length === 0 ? (
                      <Typography variant="body2" sx={{ color: 'text.disabled', py: 1 }}>
                        No members assigned yet.
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}
                        >
                          Members ({team.members.length})
                        </Typography>
                        {team.members.map(m => (
                          <Stack
                            key={m.userId}
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{
                              px: 1.5,
                              py: 0.75,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.background.default, 0.4),
                            }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">{m.userName}</Typography>
                              <Chip
                                label={m.organizationName}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.6rem', height: 18, borderColor: 'divider' }}
                              />
                              <Chip
                                label={m.role}
                                size="small"
                                sx={{
                                  fontSize: '0.6rem',
                                  height: 18,
                                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                                  color: 'primary.main',
                                }}
                              />
                            </Stack>
                            {manage && (
                              <Tooltip title="Remove from team">
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveMember(m)}
                                  sx={{ color: 'error.main' }}
                                >
                                  <PersonRemoveIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Create Team Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>New Cross-Org Team</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Team Name"
              fullWidth
              size="small"
              value={tName}
              onChange={e => setTName(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 100 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              rows={3}
              size="small"
              value={tDescription}
              onChange={e => setTDescription(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              sx={darkFieldSx}
            />
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={tType}
                onChange={e => setTType(e.target.value as FederationTeamType)}
              >
                <MenuItem value="task_force">Task Force</MenuItem>
                <MenuItem value="diplomatic_mission">Diplomatic Mission</MenuItem>
                <MenuItem value="joint_operation">Joint Operation</MenuItem>
                <MenuItem value="trade_convoy">Trade Convoy</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Max Members"
              type="number"
              fullWidth
              size="small"
              value={tMaxMembers}
              onChange={e => setTMaxMembers(Math.max(2, Math.min(100, Number(e.target.value))))}
              slotProps={{ htmlInput: { min: 2, max: 100 } }}
              sx={darkFieldSx}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!tName.trim() || createMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Edit Team</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Team Name"
              fullWidth
              size="small"
              value={eName}
              onChange={e => setEName(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 100 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              rows={3}
              size="small"
              value={eDescription}
              onChange={e => setEDescription(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              sx={darkFieldSx}
            />
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={eType}
                onChange={e => setEType(e.target.value as FederationTeamType)}
              >
                <MenuItem value="task_force">Task Force</MenuItem>
                <MenuItem value="diplomatic_mission">Diplomatic Mission</MenuItem>
                <MenuItem value="joint_operation">Joint Operation</MenuItem>
                <MenuItem value="trade_convoy">Trade Convoy</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Max Members"
              type="number"
              fullWidth
              size="small"
              value={eMaxMembers}
              onChange={e => setEMaxMembers(Math.max(2, Math.min(100, Number(e.target.value))))}
              slotProps={{ htmlInput: { min: 2, max: 100 } }}
              sx={darkFieldSx}
            />
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={eStatus}
                onChange={e => setEStatus(e.target.value as FederationTeamStatus)}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="disbanded">Disbanded</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={!eName.trim() || updateMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>
          Add Member to {selectedTeam?.name ?? 'Team'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={availablePersonnel}
              value={memberToAdd}
              onChange={(_e, v) => setMemberToAdd(v)}
              getOptionLabel={p => `${p.userName} (${p.organizationName})`}
              renderInput={params => (
                <TextField {...params} label="Select Person" size="small" sx={darkFieldSx} />
              )}
              renderOption={(props, p) => (
                <li {...props} key={p.userId}>
                  <Stack>
                    <Typography variant="body2">{p.userName}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {p.organizationName}
                      {p.title ? ` · ${p.title}` : ''}
                    </Typography>
                  </Stack>
                </li>
              )}
              isOptionEqualToValue={(opt, val) => opt.userId === val.userId}
              noOptionsText="No available personnel"
            />
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                <MenuItem value="leader">Leader</MenuItem>
                <MenuItem value="officer">Officer</MenuItem>
                <MenuItem value="member">Member</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddMemberOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMember}
            disabled={!memberToAdd || addMemberMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {addMemberMutation.isPending ? 'Adding…' : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Org Chart Tab ────────────────────────────────────────────────────────

const OrgChartTab: React.FC<{
  federation: ManagedFederation;
}> = ({ federation }) => {
  const theme = useTheme();
  const members = federation.members?.filter(m => m.status === 'active') ?? [];

  const ROLE_TIERS: Record<string, { order: number; label: string; description: string }> = {
    founder: { order: 0, label: 'Founder', description: 'Alliance creator with veto power' },
    leader: {
      order: 1,
      label: 'Leadership',
      description: 'Strategic command and decision authority',
    },
    council: { order: 2, label: 'Council', description: 'Voting members with advisory roles' },
    member: { order: 3, label: 'Members', description: 'Full participating organizations' },
    observer: { order: 4, label: 'Observers', description: 'Non-voting participants' },
  };

  const tiers = Object.entries(ROLE_TIERS)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([role, info]) => ({
      ...info,
      role,
      members: members.filter(m => m.role === role),
    }))
    .filter(t => t.members.length > 0);

  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Federation hierarchy and organizational structure
      </Typography>

      {/* Vertical hierarchy tree */}
      <Stack spacing={0} alignItems="center">
        {tiers.map((tier, i) => (
          <React.Fragment key={tier.role}>
            {/* Connecting line */}
            {i > 0 && (
              <Box
                sx={{
                  width: 2,
                  height: 24,
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                }}
              />
            )}

            {/* Tier Card */}
            <Paper
              sx={{
                ...cardSx(theme),
                width: '100%',
                maxWidth: Math.max(300, 600 - i * 50),
                py: 2,
                px: 2.5,
                border: `1px solid ${alpha(getRoleColor(tier.role as FederationRole, theme), 0.2)}`,
                position: 'relative',
                '&::before':
                  i === 0
                    ? {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        bgcolor: getRoleColor(tier.role as FederationRole, theme),
                        borderRadius: '8px 8px 0 0',
                      }
                    : undefined,
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={tier.label}
                    size="small"
                    sx={{
                      bgcolor: alpha(getRoleColor(tier.role as FederationRole, theme), 0.12),
                      color: getRoleColor(tier.role as FederationRole, theme),
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      border: `1px solid ${alpha(getRoleColor(tier.role as FederationRole, theme), 0.3)}`,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {tier.description}
                  </Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {tier.members.map(m => (
                  <Chip
                    key={m.id}
                    label={m.organizationName}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.common.white, 0.04),
                      color: 'text.primary',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  />
                ))}
              </Stack>
            </Paper>
          </React.Fragment>
        ))}
      </Stack>
    </Stack>
  );
};

// ─── Intel Sharing Tab ──────────────────────────────────────────────────

const CLEARANCE_COLORS: Record<string, (t: Theme) => string> = {
  open: t => t.palette.success.main,
  restricted: t => t.palette.warning.main,
  secret: t => t.palette.error.main,
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
  archived: 'Archived',
};

const IntelTab: React.FC<{
  federationId: string;
  federation: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federationId, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);

  const { data: entries = [], isLoading } = useFederationIntel(federationId);
  const submitMutation = useSubmitFederationIntel();
  const approveMutation = useApproveFederationIntel();
  const archiveMutation = useArchiveFederationIntel();
  const deleteMutation = useDeleteFederationIntel();

  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [iTitle, setITitle] = useState('');
  const [iContent, setIContent] = useState('');
  const [iClassification, setIClassification] = useState<FederationIntelClassification>('open');

  const resetCreate = () => {
    setITitle('');
    setIContent('');
    setIClassification('open');
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      await submitMutation.mutateAsync({
        federationId,
        data: { title: iTitle.trim(), content: iContent.trim(), classification: iClassification },
      });
      setCreateOpen(false);
      resetCreate();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to submit intel'
      );
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ federationId, intelId: id });
    } catch {
      setError('Failed to approve intel.');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveMutation.mutateAsync({ federationId, intelId: id });
    } catch {
      setError('Failed to archive intel.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!globalThis.confirm('Delete this intel entry?')) return;
    try {
      await deleteMutation.mutateAsync({ federationId, intelId: id });
    } catch {
      setError('Failed to delete intel.');
    }
  };

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {entries.length} intel entr{entries.length === 1 ? 'y' : 'ies'}
        </Typography>
        {manage && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              resetCreate();
              setCreateOpen(true);
            }}
            sx={cyanBtnSx}
          >
            Submit Intel
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Classification legend */}
      <Paper sx={{ ...cardSx(theme), p: 1.5 }}>
        <Stack direction="row" spacing={3}>
          {(['open', 'restricted', 'secret'] as const).map(cl => (
            <Stack key={cl} direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: CLEARANCE_COLORS[cl](theme),
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: CLEARANCE_COLORS[cl](theme), textTransform: 'capitalize' }}
              >
                {cl}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>

      {entries.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <IntelIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            No Intel Entries
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            {manage ? 'Submit the first shared intel report.' : 'No intel has been shared yet.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {entries.map((entry: FederationIntelEntry) => {
            const clColor =
              CLEARANCE_COLORS[entry.classification]?.(theme) ?? theme.palette.grey[600];
            return (
              <Paper key={entry.id} sx={{ ...cardSx(theme), borderLeft: `3px solid ${clColor}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {entry.title}
                      </Typography>
                      <Chip
                        label={entry.classification}
                        size="small"
                        sx={{
                          bgcolor: alpha(clColor, 0.12),
                          color: clColor,
                          border: `1px solid ${alpha(clColor, 0.3)}`,
                          fontSize: '0.65rem',
                          height: 20,
                          textTransform: 'capitalize',
                        }}
                      />
                      <Chip
                        label={STATUS_LABELS[entry.status] ?? entry.status}
                        size="small"
                        sx={{
                          ...getStatusChipSx(
                            entry.status === 'published' ? 'active' : entry.status,
                            theme
                          ),
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', mb: 0.5 }}
                    >
                      {entry.content.length > 300
                        ? `${entry.content.substring(0, 300)}...`
                        : entry.content}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      by {entry.submittedByName ?? 'Unknown'} ·{' '}
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  {manage && (
                    <Stack direction="row" spacing={0.5}>
                      {(entry.status === 'pending_review' || entry.status === 'draft') && (
                        <Button
                          size="small"
                          onClick={() => handleApprove(entry.id)}
                          sx={{ color: 'success.main' }}
                        >
                          Approve
                        </Button>
                      )}
                      {entry.status === 'published' && (
                        <Button
                          size="small"
                          onClick={() => handleArchive(entry.id)}
                          sx={{ color: 'text.secondary' }}
                        >
                          Archive
                        </Button>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(entry.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Submit Intel Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Submit Intel Report</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              size="small"
              value={iTitle}
              onChange={e => setITitle(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Intel Content"
              fullWidth
              multiline
              rows={6}
              size="small"
              value={iContent}
              onChange={e => setIContent(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 10000 } }}
              helperText={`${iContent.length}/10000`}
              sx={darkFieldSx}
            />
            <FormControl fullWidth size="small" sx={darkSelectSx}>
              <InputLabel>Classification</InputLabel>
              <Select
                label="Classification"
                value={iClassification}
                onChange={e => setIClassification(e.target.value as FederationIntelClassification)}
              >
                <MenuItem value="open">
                  <FiberManualRecordIcon sx={{ fontSize: 12, color: 'success.main', mr: 0.5 }} />{' '}
                  Open — All members
                </MenuItem>
                <MenuItem value="restricted">
                  <FiberManualRecordIcon sx={{ fontSize: 12, color: 'warning.main', mr: 0.5 }} />{' '}
                  Restricted — Council only
                </MenuItem>
                <MenuItem value="secret">
                  <FiberManualRecordIcon sx={{ fontSize: 12, color: 'error.main', mr: 0.5 }} />{' '}
                  Secret — Treaty partners
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              iTitle.trim().length < 3 || iContent.trim().length < 10 || submitMutation.isPending
            }
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit for Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Discord Integration Tab ───────────────────────────────────────────

const DiscordTab: React.FC<{
  federationId: string;
  federation: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federationId, federation, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);
  // Backend allows founder, leader, AND council to update settings
  const canEditSettings = myRole === 'founder' || myRole === 'leader' || myRole === 'council';

  const { data: discordStatus } = useFederationDiscordStatus(federationId);
  const { data: conflicts = [] } = useFederationDiscordConflicts(federationId);
  const { data: settings } = useFederationSettings(federationId);
  const { data: guildChannels = [] } = useDiscordGuildChannels(
    discordStatus?.centralGuildId ?? undefined
  );
  const textChannels = useMemo(() => guildChannels.filter(ch => ch.type === 0), [guildChannels]);
  const setupMutation = useSetupFederationDiscord();
  const unlinkMutation = useUnlinkFederationDiscord();
  const resolveMutation = useResolveFederationDiscordConflict();
  const updateSettingsMutation = useUpdateFederationSettings();

  const [setupOpen, setSetupOpen] = useState(false);
  const [guildId, setGuildId] = useState('');
  const [guildName, setGuildName] = useState('');
  const [syncChannelId, setSyncChannelId] = useState(settings?.syncNotificationChannelId ?? '');
  const [error, setError] = useState<string | null>(null);

  // Keep syncChannelId in sync when settings load/change
  React.useEffect(() => {
    setSyncChannelId(settings?.syncNotificationChannelId ?? '');
  }, [settings?.syncNotificationChannelId]);

  const handleSetup = async () => {
    setError(null);
    try {
      await setupMutation.mutateAsync({
        federationId,
        guildId: guildId.trim(),
        guildName: guildName.trim(),
      });
      setSetupOpen(false);
      setGuildId('');
      setGuildName('');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to setup Discord'
      );
    }
  };

  const handleUnlink = async () => {
    if (
      !globalThis.confirm('Unlink the central Discord server? All role mappings will be removed.')
    )
      return;
    try {
      await unlinkMutation.mutateAsync({ federationId });
    } catch {
      setError('Failed to unlink Discord.');
    }
  };

  const handleResolveConflict = async (discordUserId: string, chosenOrgId: string) => {
    try {
      await resolveMutation.mutateAsync({ federationId, discordUserId, chosenOrgId });
    } catch {
      setError('Failed to resolve conflict.');
    }
  };

  const botCommands = [
    { command: '/federation info', description: 'View federation details and features overview' },
    { command: '/federation members', description: 'List member organizations and role hierarchy' },
    {
      command: '/federation announcements',
      description: 'View federation announcement system info',
    },
    { command: '/federation intel', description: 'Access the shared intel vault (ephemeral)' },
    { command: '/federation polls', description: 'View active polls and voting modes' },
    { command: '/federation teams', description: 'List cross-org teams and team types' },
  ];

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Discord bot integration for federation management
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Central Guild Connection */}
      <Paper sx={cardSx(theme)}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Central Discord Server
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {discordStatus?.enabled
                ? `Connected: ${discordStatus.centralGuildName ?? discordStatus.centralGuildId}`
                : 'No central server configured'}
            </Typography>
            {discordStatus?.enabled && (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {discordStatus.orgRoleCount} org roles · {discordStatus.hierarchyRoleCount}{' '}
                hierarchy roles · {discordStatus.conflictCount} conflicts
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={discordStatus?.enabled ? 'Connected' : 'Not Connected'}
              size="small"
              sx={{
                bgcolor: alpha(
                  discordStatus?.enabled ? theme.palette.success.main : theme.palette.grey[600],
                  0.12
                ),
                color: discordStatus?.enabled ? 'success.main' : 'text.disabled',
                border: `1px solid ${alpha(discordStatus?.enabled ? theme.palette.success.main : theme.palette.grey[600], 0.3)}`,
              }}
            />
            {manage && !discordStatus?.enabled && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setSetupOpen(true)}
                sx={cyanBtnSx}
              >
                Setup
              </Button>
            )}
            {manage && discordStatus?.enabled && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleUnlink}
                sx={{ borderColor: 'error.main', color: 'error.main' }}
              >
                Unlink
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Conflict Queue */}
      {conflicts.length > 0 && (
        <Paper sx={{ ...cardSx(theme), borderLeft: `3px solid ${theme.palette.warning.main}` }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'warning.main' }}>
            Membership Conflicts ({conflicts.length})
          </Typography>
          <Stack spacing={1}>
            {conflicts.map(c => (
              <Paper
                key={c.discordUserId}
                sx={{
                  p: 1,
                  bgcolor: alpha(theme.palette.background.default, 0.4),
                  borderRadius: 1,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={1}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {c.discordUsername}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      In: {c.conflictingOrgs.map(o => o.orgName).join(', ')}
                    </Typography>
                  </Box>
                  {manage && (
                    <Stack direction="row" spacing={0.5}>
                      {c.conflictingOrgs.map(o => (
                        <Button
                          key={o.orgId}
                          size="small"
                          variant="outlined"
                          onClick={() => handleResolveConflict(c.discordUserId, o.orgId)}
                          disabled={resolveMutation.isPending}
                          sx={{ fontSize: '0.7rem', px: 1 }}
                        >
                          {o.orgName}
                        </Button>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Connection Status */}
      <Paper sx={cardSx(theme)}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Discord Server
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {federation.discordUrl
                ? 'Connected — Bot commands available'
                : 'No Discord server linked'}
            </Typography>
          </Box>
          <Chip
            label={federation.discordUrl ? 'Connected' : 'Not Connected'}
            size="small"
            sx={{
              bgcolor: alpha(
                federation.discordUrl ? theme.palette.success.main : theme.palette.grey[600],
                0.12
              ),
              color: federation.discordUrl ? 'success.main' : 'text.disabled',
              border: `1px solid ${alpha(
                federation.discordUrl ? theme.palette.success.main : theme.palette.grey[600],
                0.3
              )}`,
            }}
          />
        </Stack>
        {federation.discordUrl && (
          <Button
            size="small"
            href={federation.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main', mt: 1 }}
          >
            Open Discord Server ↗
          </Button>
        )}
      </Paper>

      {/* Discord Settings */}
      {discordStatus?.enabled && (
        <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1.5 }}>
            Discord Settings
          </Typography>
          <Stack spacing={1.5}>
            {[
              {
                key: 'autoCreateOrgRoles',
                label: 'Auto-Create Org Roles',
                description: 'Automatically create a Discord role for each member organization',
                value: settings?.autoCreateOrgRoles ?? false,
              },
              {
                key: 'removeRolesOnOrgLeave',
                label: 'Remove Roles on Org Leave',
                description: 'Strip Discord roles when an organization leaves the federation',
                value: settings?.removeRolesOnOrgLeave ?? false,
              },
              {
                key: 'removeRolesOnUserLeave',
                label: 'Remove Roles on User Leave',
                description: 'Strip Discord roles when a user leaves their organization',
                value: settings?.removeRolesOnUserLeave ?? false,
              },
              {
                key: 'kickNonMembers',
                label: 'Kick Non-Members',
                description:
                  'Kick users who are not members of any federation org instead of assigning the no-access role',
                value: settings?.kickNonMembers ?? false,
              },
            ].map(toggle => (
              <Stack
                key={toggle.key}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.common.white, 0.02),
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {toggle.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {toggle.description}
                  </Typography>
                </Stack>
                <Switch
                  checked={toggle.value}
                  onChange={async e => {
                    try {
                      await updateSettingsMutation.mutateAsync({
                        federationId,
                        data: { [toggle.key]: e.target.checked },
                      });
                    } catch {
                      setError(`Failed to update ${toggle.label.toLowerCase()}.`);
                    }
                  }}
                  disabled={!canEditSettings || updateSettingsMutation.isPending}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: 'primary.main',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      bgcolor: alpha(theme.palette.primary.main, 0.4),
                    },
                  }}
                />
              </Stack>
            ))}

            {/* Conflict Resolution Mode */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.common.white, 0.02),
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Conflict Resolution
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  How to handle users who belong to multiple member organizations
                </Typography>
              </Stack>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={settings?.conflictResolutionMode ?? 'manual'}
                  onChange={async e => {
                    try {
                      await updateSettingsMutation.mutateAsync({
                        federationId,
                        data: {
                          conflictResolutionMode: e.target.value,
                        },
                      });
                    } catch {
                      setError('Failed to update conflict resolution mode.');
                    }
                  }}
                  disabled={!canEditSettings || updateSettingsMutation.isPending}
                  sx={darkSelectSx}
                >
                  <MenuItem value="manual">Manual Review</MenuItem>
                  <MenuItem value="primary_org">Primary Org</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* Sync Notification Channel */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.common.white, 0.02),
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Sync Notification Channel
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Discord channel for role sync notifications
                </Typography>
              </Stack>
              {textChannels.length > 0 ? (
                <Autocomplete
                  size="small"
                  sx={{ width: 240 }}
                  options={textChannels}
                  value={
                    textChannels.find(
                      ch => ch.id === (settings?.syncNotificationChannelId ?? '')
                    ) ?? null
                  }
                  getOptionLabel={ch => `#${ch.name}`}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  disabled={!canEditSettings || updateSettingsMutation.isPending}
                  onChange={async (_, newValue) => {
                    const newId = newValue?.id ?? null;
                    if (newId !== (settings?.syncNotificationChannelId ?? null)) {
                      try {
                        await updateSettingsMutation.mutateAsync({
                          federationId,
                          data: { syncNotificationChannelId: newId },
                        });
                      } catch {
                        setError('Failed to update sync notification channel.');
                      }
                    }
                  }}
                  renderInput={params => (
                    <TextField {...params} placeholder="Select a channel" sx={darkFieldSx} />
                  )}
                />
              ) : (
                <TextField
                  size="small"
                  placeholder="Channel ID"
                  value={syncChannelId}
                  onChange={e => setSyncChannelId(e.target.value)}
                  onBlur={async () => {
                    const trimmed = syncChannelId.trim() || null;
                    if (trimmed !== (settings?.syncNotificationChannelId ?? null)) {
                      try {
                        await updateSettingsMutation.mutateAsync({
                          federationId,
                          data: { syncNotificationChannelId: trimmed },
                        });
                      } catch {
                        setError('Failed to update sync notification channel.');
                      }
                    }
                  }}
                  disabled={!canEditSettings || updateSettingsMutation.isPending}
                  slotProps={{ htmlInput: { maxLength: 30 } }}
                  sx={{ ...darkFieldSx, width: 180 }}
                />
              )}
            </Stack>
          </Stack>

          {/* Auto-Created Role IDs */}
          {(settings?.ambassadorRoleId || settings?.memberRoleId || settings?.noAccessRoleId) && (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}
              >
                Auto-created Discord roles
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {settings?.ambassadorRoleId && (
                  <Chip
                    label={`Ambassador: ${settings.ambassadorRoleId}`}
                    size="small"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      bgcolor: alpha(theme.palette.warning.main, 0.08),
                      color: 'warning.main',
                    }}
                  />
                )}
                {settings?.memberRoleId && (
                  <Chip
                    label={`Member: ${settings.memberRoleId}`}
                    size="small"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      bgcolor: alpha(theme.palette.success.main, 0.08),
                      color: 'success.main',
                    }}
                  />
                )}
                {settings?.noAccessRoleId && (
                  <Chip
                    label={`No Access: ${settings.noAccessRoleId}`}
                    size="small"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      bgcolor: alpha(theme.palette.grey[600], 0.08),
                      color: 'text.disabled',
                    }}
                  />
                )}
              </Stack>
            </Box>
          )}

          {!manage && (
            <Alert severity="info" sx={{ mt: 1.5, bgcolor: alpha(theme.palette.info.main, 0.06) }}>
              Only founders and leaders can modify Discord settings.
            </Alert>
          )}
        </Paper>
      )}

      {/* Guild Feature Settings */}
      {discordStatus?.enabled && discordStatus?.centralGuildId && (
        <FederationGuildSettingsPanel
          federationId={federationId}
          guildId={discordStatus.centralGuildId}
          canEdit={canEditSettings}
        />
      )}

      {/* Bot Commands */}
      <Paper sx={cardSx(theme)}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Bot Commands
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Available <code>/federation</code> slash commands for all member servers:
        </Typography>
        <Stack spacing={0.75}>
          {botCommands.map(cmd => (
            <Stack key={cmd.command} direction="row" spacing={1} alignItems="baseline">
              <Chip
                label={cmd.command}
                size="small"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  height: 22,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {cmd.description}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>

      {/* Features */}
      <Paper sx={cardSx(theme)}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Federation Discord Features
        </Typography>
        <Grid container spacing={1}>
          {[
            { label: 'Cross-server announcements', icon: <AnnouncementsIcon fontSize="small" /> },
            { label: 'Intel vault access', icon: <SatelliteAltIcon fontSize="small" /> },
            { label: 'Poll notifications', icon: <PollIcon fontSize="small" /> },
            { label: 'Team coordination', icon: <BusinessCenterIcon fontSize="small" /> },
            { label: 'Event notifications', icon: <EventIcon fontSize="small" /> },
            { label: 'Treaty updates', icon: <HandshakeIcon fontSize="small" /> },
          ].map(feat => (
            <Grid key={feat.label} size={{ xs: 6, sm: 4 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ color: 'text.secondary', display: 'flex' }}>{feat.icon}</Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {feat.label}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Setup Dialog */}
      <Dialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ color: 'primary.main' }}>Setup Central Discord Server</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Discord Server ID"
              fullWidth
              size="small"
              value={guildId}
              onChange={e => setGuildId(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 30 } }}
              sx={darkFieldSx}
            />
            <TextField
              label="Server Name"
              fullWidth
              size="small"
              value={guildName}
              onChange={e => setGuildName(e.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={darkFieldSx}
            />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              The bot must have ManageRoles permission in this server. Org tag roles and federation
              hierarchy roles will be created automatically.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSetupOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSetup}
            disabled={!guildId.trim() || !guildName.trim() || setupMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {setupMutation.isPending ? 'Connecting…' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ─── Chairman Card (extracted for complexity) ──────────────────────────

const ChairmanCard: React.FC<{
  chairman?: {
    organizationName: string;
    userName: string;
    termEnd: string | null;
  };
  successionMode: string;
  manage: boolean;
  onTriggerSuccession: () => void;
  succeedPending: boolean;
}> = ({ chairman, successionMode, manage, onTriggerSuccession, succeedPending }) => {
  const theme = useTheme();

  const isTermExpired = chairman?.termEnd ? new Date(chairman.termEnd) <= new Date() : false;
  const termEndLabel = chairman?.termEnd
    ? new Date(chairman.termEnd).toLocaleDateString()
    : 'No end date';

  return (
    <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
      <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1.5 }}>
        Chairman
      </Typography>
      {chairman ? (
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={2}
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h6" sx={{ color: 'primary.main' }}>
                {chairman.organizationName.charAt(0).toUpperCase()}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {chairman.userName}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {chairman.organizationName}
              </Typography>
            </Box>
            <Stack alignItems="flex-end">
              <Chip
                label={isTermExpired ? 'Term Expired' : 'Active'}
                size="small"
                color={isTermExpired ? 'warning' : 'success'}
                sx={{ fontWeight: 600 }}
              />
              <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5 }}>
                {successionMode === 'fixed' ? 'Permanent' : `Term ends: ${termEndLabel}`}
              </Typography>
            </Stack>
          </Stack>

          {manage && successionMode !== 'fixed' && (
            <Button
              variant="outlined"
              size="small"
              onClick={onTriggerSuccession}
              disabled={succeedPending}
              sx={{ alignSelf: 'flex-start' }}
            >
              {successionMode === 'rotation' ? 'Rotate Chairman' : 'Start Election'}
            </Button>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          No chairman has been appointed yet.
        </Typography>
      )}
    </Paper>
  );
};

// ─── Governance Form Fields (shared between edit & propose) ─────────────

const GovernanceFormFields: React.FC<{
  votingSystem: string;
  onVotingSystemChange: (v: string) => void;
  threshold: number;
  onThresholdChange: (v: number) => void;
  councilSize: number;
  onCouncilSizeChange: (v: number) => void;
  leaderTermDays: number;
  onLeaderTermDaysChange: (v: number) => void;
}> = ({
  votingSystem,
  onVotingSystemChange,
  threshold,
  onThresholdChange,
  councilSize,
  onCouncilSizeChange,
  leaderTermDays,
  onLeaderTermDaysChange,
}) => {
  const theme = useTheme();
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth size="small">
          <InputLabel sx={{ color: 'text.secondary' }}>Voting System</InputLabel>
          <Select
            value={votingSystem}
            label="Voting System"
            onChange={e => onVotingSystemChange(e.target.value)}
            sx={darkSelectSx(theme)}
          >
            <MenuItem value="majority">Simple Majority (&gt;50%)</MenuItem>
            <MenuItem value="supermajority">Supermajority (&gt;66%)</MenuItem>
            <MenuItem value="unanimous">Unanimous (100%)</MenuItem>
            <MenuItem value="weighted">Weighted (by voting power)</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          size="small"
          label="Quorum Threshold (%)"
          type="number"
          value={threshold}
          onChange={e => onThresholdChange(Math.max(1, Math.min(100, Number(e.target.value))))}
          slotProps={{ htmlInput: { min: 1, max: 100 } }}
          sx={darkFieldSx(theme)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          size="small"
          label="Council Size"
          type="number"
          value={councilSize}
          onChange={e => onCouncilSizeChange(Math.max(1, Math.min(50, Number(e.target.value))))}
          slotProps={{ htmlInput: { min: 1, max: 50 } }}
          sx={darkFieldSx(theme)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          size="small"
          label="Leader Term (days)"
          type="number"
          value={leaderTermDays}
          onChange={e =>
            onLeaderTermDaysChange(Math.max(1, Math.min(3650, Number(e.target.value))))
          }
          slotProps={{ htmlInput: { min: 1, max: 3650 } }}
          sx={darkFieldSx(theme)}
        />
      </Grid>
    </Grid>
  );
};

// ─── Governance Settings Tab ────────────────────────────────────────────

const SUCCESSION_MODE_LABELS: Record<string, { label: string; description: string }> = {
  fixed: {
    label: 'Permanent',
    description: 'The chairman holds office indefinitely.',
  },
  rotation: {
    label: 'Rotation',
    description: 'The chairmanship rotates through member organizations each term.',
  },
  election: {
    label: 'Election',
    description: 'Member organizations vote for the next chairman each term.',
  },
};

const GovernanceTab: React.FC<{
  federationId: string;
  federation: ManagedFederation;
  myRole?: FederationRole;
}> = ({ federationId, federation, myRole }) => {
  const theme = useTheme();
  const { data: settings } = useFederationSettings(federationId);
  const updateSettingsMutation = useUpdateFederationSettings();
  const successionMutation = useUpdateSuccessionMode();
  const succeedMutation = useSucceedChairman();
  const updateFederationMutation = useUpdateFederation();
  const createProposalMutation = useCreateProposal();

  const governance = federation.governance;
  const chairman = governance?.chairman;
  const successionMode = governance?.successionMode ?? 'fixed';
  const manage = canManage(myRole);

  // When multiple active members exist, governance changes require a proposal vote
  const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
  const requiresProposal = activeMembers.length > 1;

  // Editable governance rule state
  const [editingGovernance, setEditingGovernance] = useState(false);
  const [govVotingSystem, setGovVotingSystem] = useState<string>(
    governance?.votingSystem ?? 'majority'
  );
  const [govThreshold, setGovThreshold] = useState(governance?.requiredApprovalThreshold ?? 51);
  const [govCouncilSize, setGovCouncilSize] = useState(governance?.councilSize ?? 5);
  const [govLeaderTermDays, setGovLeaderTermDays] = useState(governance?.leaderTermDays ?? 90);

  // Propose amendment dialog state
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposeDescription, setProposeDescription] = useState('');
  const [proposeDuration, setProposeDuration] = useState(7);

  const VOTING_SYSTEM_LABELS: Record<string, string> = {
    majority: 'Simple Majority (>50%)',
    supermajority: 'Supermajority (>66%)',
    unanimous: 'Unanimous (100%)',
    weighted: 'Weighted (by voting power)',
  };

  const handleToggle = async (key: string, value: boolean) => {
    await updateSettingsMutation.mutateAsync({
      federationId,
      data: { [key]: value },
    });
  };

  const handleSuccessionChange = async (mode: 'fixed' | 'rotation' | 'election') => {
    await successionMutation.mutateAsync({
      federationId,
      data: { successionMode: mode },
    });
  };

  const handleTriggerSuccession = async () => {
    await succeedMutation.mutateAsync(federationId);
  };

  const handleGovernanceSave = async () => {
    if (requiresProposal) {
      // Open proposal dialog instead of saving directly
      setEditingGovernance(false);
      setProposeOpen(true);
      return;
    }
    await updateFederationMutation.mutateAsync({
      id: federationId,
      data: {
        governance: {
          votingSystem: govVotingSystem as 'majority' | 'supermajority' | 'unanimous' | 'weighted',
          requiredApprovalThreshold: govThreshold,
          councilSize: govCouncilSize,
          leaderTermDays: govLeaderTermDays,
        },
      },
    });
    setEditingGovernance(false);
  };

  const handleGovernanceCancel = () => {
    setGovVotingSystem(governance?.votingSystem ?? 'majority');
    setGovThreshold(governance?.requiredApprovalThreshold ?? 51);
    setGovCouncilSize(governance?.councilSize ?? 5);
    setGovLeaderTermDays(governance?.leaderTermDays ?? 90);
    setEditingGovernance(false);
  };

  const handleProposeAmendment = async () => {
    if (!proposeTitle.trim()) return;
    await createProposalMutation.mutateAsync({
      federationId,
      data: {
        type: 'amend_governance',
        title: proposeTitle,
        description: proposeDescription,
        votingDurationDays: proposeDuration,
        metadata: {
          governance: {
            votingSystem: govVotingSystem,
            requiredApprovalThreshold: govThreshold,
            councilSize: govCouncilSize,
            leaderTermDays: govLeaderTermDays,
          },
        },
      },
    });
    setProposeOpen(false);
    setProposeTitle('');
    setProposeDescription('');
  };

  return (
    <Stack spacing={2.5}>
      {/* Chairman Section */}
      <ChairmanCard
        chairman={chairman}
        successionMode={successionMode}
        manage={manage}
        onTriggerSuccession={handleTriggerSuccession}
        succeedPending={succeedMutation.isPending}
      />

      {/* Succession Mode */}
      <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1.5 }}>
          Succession Law
        </Typography>
        <Stack spacing={1}>
          {(['fixed', 'rotation', 'election'] as const).map(mode => {
            const info = SUCCESSION_MODE_LABELS[mode];
            const isActive = successionMode === mode;
            return (
              <Stack
                key={mode}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                onClick={() =>
                  manage && !successionMutation.isPending && handleSuccessionChange(mode)
                }
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  cursor: manage ? 'pointer' : 'default',
                  bgcolor: isActive
                    ? alpha(theme.palette.primary.main, 0.08)
                    : alpha(theme.palette.common.white, 0.02),
                  border: `1px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
                  transition: 'all 0.2s',
                  '&:hover': manage ? { borderColor: theme.palette.primary.main } : {},
                }}
              >
                <Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {info.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {info.description}
                  </Typography>
                </Stack>
                {isActive && (
                  <Chip label="Active" size="small" color="primary" sx={{ fontWeight: 600 }} />
                )}
              </Stack>
            );
          })}
        </Stack>
        {successionMode !== 'fixed' && (
          <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>
            Term length: {governance?.leaderTermDays ?? 90} days
          </Typography>
        )}
      </Paper>

      {/* Governance Rules (editable for leaders, propose amendment for others) */}
      <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
            Governance Rules
          </Typography>
          {manage && !editingGovernance && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setEditingGovernance(true)}
              sx={cyanBtnSx(theme)}
            >
              {requiresProposal ? 'Propose Amendment' : 'Edit'}
            </Button>
          )}
          {!manage && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setProposeOpen(true)}
              sx={cyanBtnSx(theme)}
            >
              Propose Amendment
            </Button>
          )}
        </Stack>

        {editingGovernance && manage ? (
          <Stack spacing={2}>
            <GovernanceFormFields
              votingSystem={govVotingSystem}
              onVotingSystemChange={setGovVotingSystem}
              threshold={govThreshold}
              onThresholdChange={setGovThreshold}
              councilSize={govCouncilSize}
              onCouncilSizeChange={setGovCouncilSize}
              leaderTermDays={govLeaderTermDays}
              onLeaderTermDaysChange={setGovLeaderTermDays}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                onClick={handleGovernanceCancel}
                sx={{ color: 'text.secondary' }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleGovernanceSave}
                disabled={!requiresProposal && updateFederationMutation.isPending}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  color: 'common.black',
                }}
              >
                {requiresProposal && 'Continue to Proposal'}
                {!requiresProposal && (updateFederationMutation.isPending ? 'Saving…' : 'Save')}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Voting System
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {VOTING_SYSTEM_LABELS[governance?.votingSystem ?? 'majority'] ?? 'Majority'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Quorum Threshold
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {governance?.requiredApprovalThreshold ?? 51}%
                  </Typography>
                </Stack>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Council Size
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {governance?.councilSize ?? '—'}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Leader Term
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {governance?.leaderTermDays ? `${governance.leaderTermDays} days` : '—'}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Propose Amendment Dialog (for non-leaders to request governance changes via voting) */}
      <Dialog
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx(theme) } }}
      >
        <DialogTitle>Propose Governance Amendment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Submit a proposal to change governance rules. All member organizations will vote on
              the amendment.
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Proposal Title"
              value={proposeTitle}
              onChange={e => setProposeTitle(e.target.value)}
              sx={darkFieldSx(theme)}
            />
            <TextField
              fullWidth
              size="small"
              label="Description"
              multiline
              minRows={3}
              value={proposeDescription}
              onChange={e => setProposeDescription(e.target.value)}
              sx={darkFieldSx(theme)}
            />
            <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.3) }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              Proposed Values
            </Typography>
            <GovernanceFormFields
              votingSystem={govVotingSystem}
              onVotingSystemChange={setGovVotingSystem}
              threshold={govThreshold}
              onThresholdChange={setGovThreshold}
              councilSize={govCouncilSize}
              onCouncilSizeChange={setGovCouncilSize}
              leaderTermDays={govLeaderTermDays}
              onLeaderTermDaysChange={setGovLeaderTermDays}
            />
            <TextField
              fullWidth
              size="small"
              label="Voting Duration (days)"
              type="number"
              value={proposeDuration}
              onChange={e => {
                const v = Math.max(1, Math.min(30, Number(e.target.value)));
                setProposeDuration(v);
              }}
              slotProps={{ htmlInput: { min: 1, max: 30 } }}
              sx={darkFieldSx(theme)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProposeOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleProposeAmendment}
            disabled={!proposeTitle.trim() || createProposalMutation.isPending}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'common.black',
            }}
          >
            {createProposalMutation.isPending ? 'Submitting…' : 'Submit Proposal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feature Toggles (editable for leaders) */}
      <Paper sx={{ ...cardSx(theme), p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1.5 }}>
          Feature Toggles
        </Typography>
        <Stack spacing={1.5}>
          {[
            {
              key: 'enableTitlesBadges',
              label: 'Titles & Badges',
              description: 'Allow custom member titles and badges',
              value: settings?.enableTitlesBadges ?? false,
            },
            {
              key: 'enableFederationFleets',
              label: 'Federation Fleets',
              description: 'Enable cross-org fleet aggregation',
              value: settings?.enableFederationFleets ?? false,
            },
            {
              key: 'enableFederationDynamicTeams',
              label: 'Dynamic Teams',
              description: 'Enable cross-org team formation',
              value: settings?.enableFederationDynamicTeams ?? false,
            },
          ].map(toggle => (
            <Stack
              key={toggle.key}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.common.white, 0.02),
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {toggle.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {toggle.description}
                </Typography>
              </Stack>
              <Switch
                checked={toggle.value}
                onChange={e => handleToggle(toggle.key, e.target.checked)}
                disabled={!manage || updateSettingsMutation.isPending}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: 'primary.main',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    bgcolor: alpha(theme.palette.primary.main, 0.4),
                  },
                }}
              />
            </Stack>
          ))}
        </Stack>
      </Paper>

      {!manage && (
        <Alert severity="info" sx={{ bgcolor: alpha(theme.palette.info.main, 0.06) }}>
          Only founders and leaders can modify governance settings.
        </Alert>
      )}
    </Stack>
  );
};

// ─── HR / Personnel Tab ──────────────────────────────────────────────────

const HRTab: React.FC<{
  federationId: string;
}> = ({ federationId }) => {
  const theme = useTheme();
  const { data: personnel = [], isLoading } = useFederationPersonnel(federationId);
  const { data: summary } = useFederationPersonnelSummary(federationId);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPersonnel = useMemo(() => {
    if (!searchTerm.trim()) return personnel;
    const term = searchTerm.toLowerCase();
    return personnel.filter(
      (p: FederationPersonnel) =>
        p.userName.toLowerCase().includes(term) ||
        p.organizationName.toLowerCase().includes(term) ||
        p.orgRole.toLowerCase().includes(term)
    );
  }, [personnel, searchTerm]);

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      {/* Summary */}
      {summary && (
        <Stack direction="row" spacing={2}>
          <Paper sx={{ ...cardSx(theme), flex: 1, textAlign: 'center', py: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {summary.totalPersonnel}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Total Personnel
            </Typography>
          </Paper>
          <Paper sx={{ ...cardSx(theme), flex: 1, textAlign: 'center', py: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              {summary.totalAmbassadors}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Ambassadors
            </Typography>
          </Paper>
          <Paper sx={{ ...cardSx(theme), flex: 1, textAlign: 'center', py: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
              {Object.keys(summary.byOrganization).length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Organizations
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Search */}
      <TextField
        placeholder="Search personnel by name, org, or role…"
        size="small"
        fullWidth
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        sx={darkFieldSx}
      />

      {/* Personnel list */}
      {filteredPersonnel.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <HRIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            {searchTerm ? 'No Matching Personnel' : 'No Personnel Data'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            {searchTerm
              ? 'Try a different search term.'
              : 'Personnel data from member organizations will appear here.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={0.75}>
          {filteredPersonnel.map((p: FederationPersonnel) => (
            <Paper
              key={`${p.userId}-${p.organizationId}`}
              sx={{
                ...cardSx(theme),
                p: 1.5,
                borderLeft: p.isAmbassador ? `3px solid ${theme.palette.warning.main}` : undefined,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {p.userName}
                    </Typography>
                    {p.isAmbassador && (
                      <Chip
                        label={p.ambassadorTitle ?? `Ambassador (${p.ambassadorRole})`}
                        size="small"
                        sx={{
                          fontSize: '0.6rem',
                          height: 18,
                          bgcolor: alpha(theme.palette.warning.main, 0.12),
                          color: 'warning.main',
                          border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                        }}
                      />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {p.organizationName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      · {p.orgRole}
                    </Typography>
                    {p.title && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        · {p.title}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                {p.joinedAt && (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {new Date(p.joinedAt).toLocaleDateString()}
                  </Typography>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

// ─── Applications Tab ─────────────────────────────────────────────────────────

const ApplicationsTab: React.FC<{
  federationId: string;
  myRole?: FederationRole;
}> = ({ federationId, myRole }) => {
  const theme = useTheme();
  const manage = canManage(myRole);

  const { data: applications = [], isLoading } = useFederationApplications(federationId);
  const reviewMutation = useReviewFederationApplication();
  const [error, setError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const pendingApps = applications.filter((a: FederationApplication) => a.status === 'pending');
  const reviewedApps = applications.filter((a: FederationApplication) => a.status !== 'pending');

  const handleReview = async (appId: string, decision: 'approved' | 'rejected') => {
    setError(null);
    try {
      await reviewMutation.mutateAsync({
        federationId,
        appId,
        decision,
        note: reviewNote.trim() || undefined,
      });
      setReviewNote('');
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          `Failed to ${decision === 'approved' ? 'approve' : 'reject'} application`
      );
    }
  };

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {pendingApps.length} pending application{pendingApps.length === 1 ? '' : 's'}
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pendingApps.length === 0 && reviewedApps.length === 0 ? (
        <Paper sx={{ ...cardSx(theme), textAlign: 'center', py: 6 }}>
          <ApplicationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 0.5 }}>
            No Applications
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Organizations can apply to join from the public federation directory.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {pendingApps.map((app: FederationApplication) => (
            <Paper
              key={app.id}
              sx={{ ...cardSx(theme), borderLeft: `3px solid ${theme.palette.warning.main}` }}
            >
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {app.applicantOrgName}
                      </Typography>
                      <Chip
                        label="Pending"
                        size="small"
                        sx={{
                          ...getStatusChipSx('pending', theme),
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />
                      {app.source && (
                        <Chip
                          label={app.source}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.6rem', height: 18 }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Applied {new Date(app.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Stack>
                {app.message && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {app.message}
                  </Typography>
                )}
                {manage && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      placeholder="Review note (optional)"
                      size="small"
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      sx={{ ...darkFieldSx, flex: 1 }}
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleReview(app.id, 'approved')}
                      disabled={reviewMutation.isPending}
                      sx={{ bgcolor: 'success.dark', '&:hover': { bgcolor: 'success.main' } }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleReview(app.id, 'rejected')}
                      disabled={reviewMutation.isPending}
                      sx={{ borderColor: 'error.main', color: 'error.main' }}
                    >
                      Reject
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
          {reviewedApps.length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ color: 'text.disabled' }}>
                Previous ({reviewedApps.length})
              </Typography>
              {reviewedApps.slice(0, 20).map((app: FederationApplication) => (
                <Paper key={app.id} sx={{ ...cardSx(theme), opacity: 0.7 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {app.applicantOrgName}
                      </Typography>
                      <Chip
                        label={app.status}
                        size="small"
                        sx={{
                          ...getStatusChipSx(
                            app.status === 'approved' ? 'active' : app.status,
                            theme
                          ),
                          fontSize: '0.6rem',
                          height: 18,
                        }}
                      />
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : ''}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
};

// ─── Sidebar Nav Item Types ───────────────────────────────────────────────────

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 18 }} /> },
      {
        key: 'settings',
        label: 'Settings',
        icon: <SettingsIcon sx={{ fontSize: 18 }} />,
        adminOnly: true,
      },
    ],
  },
  {
    label: 'Organization',
    items: [
      { key: 'members', label: 'Members', icon: <GroupsIcon sx={{ fontSize: 18 }} /> },
      { key: 'ambassadors', label: 'Ambassadors', icon: <BadgeIcon sx={{ fontSize: 18 }} /> },
      { key: 'teams', label: 'Teams', icon: <TeamIcon sx={{ fontSize: 18 }} /> },
      { key: 'orgChart', label: 'Org Chart', icon: <OrgChartIcon sx={{ fontSize: 18 }} /> },
      { key: 'hr', label: 'HR', icon: <HRIcon sx={{ fontSize: 18 }} /> },
      {
        key: 'applications',
        label: 'Applications',
        icon: <ApplicationsIcon sx={{ fontSize: 18 }} />,
        adminOnly: true,
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      { key: 'proposals', label: 'Proposals', icon: <GavelIcon sx={{ fontSize: 18 }} /> },
      { key: 'governance', label: 'Governance', icon: <GovernanceIcon sx={{ fontSize: 18 }} /> },
      { key: 'polls', label: 'Polls', icon: <PollIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'resources', label: 'Resources', icon: <InventoryIcon sx={{ fontSize: 18 }} /> },
      { key: 'treaties', label: 'Treaties', icon: <HandshakeIcon sx={{ fontSize: 18 }} /> },
      { key: 'fleets', label: 'Fleets', icon: <FleetsIcon sx={{ fontSize: 18 }} /> },
      { key: 'diplomacy', label: 'Diplomacy', icon: <DiplomacyIcon sx={{ fontSize: 18 }} /> },
      { key: 'intel', label: 'Intel', icon: <IntelIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        key: 'announcements',
        label: 'Announcements',
        icon: <AnnouncementsIcon sx={{ fontSize: 18 }} />,
      },
      { key: 'wiki', label: 'Wiki', icon: <BookIcon sx={{ fontSize: 18 }} /> },
      { key: 'discord', label: 'Discord', icon: <DiscordIcon sx={{ fontSize: 18 }} /> },
    ],
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────

export const FederationManagePage: React.FC = () => {
  const { federationSlug } = useParams<{ federationSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const theme = useTheme();

  // Resolve slug → federation ID via public API then load managed data
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!federationSlug) return;
    let cancelled = false;
    (async () => {
      try {
        // Use authenticated endpoint to resolve slug — works for both public and private federations
        const { federationManagementService } =
          await import('@/services/federationManagementService');
        const result = await federationManagementService.resolveSlug(federationSlug);
        if (!cancelled && result?.id) {
          setResolvedId(result.id);
        } else if (!cancelled) {
          setSlugError('Alliance not found.');
        }
      } catch {
        if (!cancelled) setSlugError('Failed to resolve alliance.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [federationSlug]);

  const {
    data: federation,
    isLoading: loading,
    error: queryError,
  } = useFederation(resolvedId ?? undefined);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const error = useMemo(() => {
    if (slugError) return slugError;
    if (!queryError) return null;
    const status = isApiClientError(queryError)
      ? queryError.statusCode
      : (queryError as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      return 'Your session has expired. Please log in again to manage this alliance.';
    }
    if (status === 400 || status === 403 || status === 404) {
      return 'You do not have access to manage this alliance, or it does not exist.';
    }
    const apiMessage = isApiClientError(queryError) ? queryError.message : null;
    return apiMessage
      ? `Failed to load alliance data: ${apiMessage}`
      : 'Failed to load alliance data. Please try again later.';
  }, [queryError, slugError]);

  // Determine the current user's org role in this federation
  const myOrgId = user?.activeOrgId ?? user?.organizationId;
  const myMember = federation?.members?.find(m => m.organizationId === myOrgId);
  const myRole = myMember?.role;
  const isMember = !!myMember;
  const isAdmin = canManage(myRole);

  // Filter nav sections based on role
  const filteredSections = useMemo(
    () =>
      NAV_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item => !item.adminOnly || isAdmin),
      })).filter(section => section.items.length > 0),
    [isAdmin]
  );

  if (loading || (!resolvedId && !slugError)) {
    return (
      <Box
        sx={{ ...pageSx(theme), display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (error || !federation) {
    return (
      <Box sx={pageSx}>
        <Stack spacing={2} sx={{ maxWidth: 600, mx: 'auto', pt: 4 }}>
          <Alert severity="error">{error ?? 'Alliance not found.'}</Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={cyanBtnSx}
            variant="outlined"
          >
            Go Back
          </Button>
        </Stack>
      </Box>
    );
  }

  if (!isMember) {
    return (
      <Box sx={pageSx}>
        <Stack spacing={2} sx={{ maxWidth: 600, mx: 'auto', pt: 4 }}>
          <Alert severity="info">
            Your organization is not a member of this alliance. You need to be invited to manage it.
          </Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            onClick={() => navigate(`/directory/federations/${federationSlug}`)}
            sx={cyanBtnSx}
          >
            View Alliance
          </Button>
        </Stack>
      </Box>
    );
  }

  // Sidebar navigation component
  const sidebarContent = (
    <Stack spacing={0.5} sx={{ py: 1 }}>
      {filteredSections.map(section => (
        <Box key={section.label}>
          <Typography
            variant="overline"
            sx={{
              px: 2,
              pt: 1.5,
              pb: 0.5,
              display: 'block',
              color: alpha(theme.palette.text.secondary, 0.6),
              fontSize: '0.65rem',
              letterSpacing: 1.5,
            }}
          >
            {section.label}
          </Typography>
          {section.items.map(item => (
            <Button
              key={item.key}
              fullWidth
              startIcon={item.icon}
              onClick={() => {
                setActiveSection(item.key);
                setMobileNavOpen(false);
              }}
              sx={{
                justifyContent: 'flex-start',
                px: 2,
                py: 0.75,
                borderRadius: 1,
                fontSize: '0.82rem',
                fontWeight: activeSection === item.key ? 600 : 400,
                color: activeSection === item.key ? 'primary.main' : 'text.secondary',
                bgcolor:
                  activeSection === item.key
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  color: 'primary.main',
                },
                textTransform: 'none',
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      ))}
    </Stack>
  );

  // Render active tab content
  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardTab federationId={federation.id} federation={federation} />;
      case 'settings':
        return (
          <SettingsTab
            federation={federation}
            myRole={myRole}
            onDisbanded={() => navigate('/federation')}
          />
        );
      case 'members':
        return <MembersTab federation={federation} myRole={myRole} />;
      case 'ambassadors':
        return (
          <AmbassadorsTab federationId={federation.id} federation={federation} myRole={myRole} />
        );
      case 'proposals':
        return (
          <ProposalsTab
            federationId={federation.id}
            federation={federation}
            myRole={myRole}
            myOrgId={myOrgId}
          />
        );
      case 'resources':
        return <ResourcesTab federationId={federation.id} myRole={myRole} />;
      case 'treaties':
        return <TreatiesTab federationId={federation.id} myRole={myRole} myOrgId={myOrgId} />;
      case 'fleets':
        return <FleetsTab federationId={federation.id} />;
      case 'diplomacy':
        return <DiplomacyTab federation={federation} myRole={myRole} />;
      case 'announcements':
        return (
          <AnnouncementsTab federationId={federation.id} federation={federation} myRole={myRole} />
        );
      case 'wiki':
        return <WikiTab federationId={federation.id} myRole={myRole} />;
      case 'polls':
        return <PollsTab federationId={federation.id} myRole={myRole} />;
      case 'teams':
        return <TeamsTab federationId={federation.id} federation={federation} myRole={myRole} />;
      case 'orgChart':
        return <OrgChartTab federation={federation} />;
      case 'intel':
        return <IntelTab federationId={federation.id} federation={federation} myRole={myRole} />;
      case 'discord':
        return <DiscordTab federationId={federation.id} federation={federation} myRole={myRole} />;
      case 'governance':
        return (
          <GovernanceTab federationId={federation.id} federation={federation} myRole={myRole} />
        );
      case 'hr':
        return <HRTab federationId={federation.id} />;
      case 'applications':
        return <ApplicationsTab federationId={federation.id} myRole={myRole} />;
      default:
        return <DashboardTab federationId={federation.id} federation={federation} />;
    }
  };

  return (
    <Box sx={pageSx}>
      {/* Header */}
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ mb: 2, maxWidth: 1200, mx: 'auto' }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          variant="text"
          size="small"
          onClick={() => navigate(`/directory/federations/${federationSlug}`)}
          sx={{ color: 'text.secondary', '&:hover': { color: 'common.white' } }}
        >
          Back
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'common.white' }}>
            {federation.name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" alignItems="center">
            <Chip
              label={federation.status}
              size="small"
              sx={{
                background:
                  federation.status === 'active'
                    ? alpha(theme.palette.success.main, 0.15)
                    : alpha(theme.palette.text.disabled, 0.15),
                color: federation.status === 'active' ? 'success.main' : 'text.disabled',
                border: `1px solid ${federation.status === 'active' ? alpha(theme.palette.success.main, 0.267) : alpha(theme.palette.text.disabled, 0.267)}`,
              }}
            />
            {myRole && (
              <Chip
                label={`Your role: ${myRole}`}
                size="small"
                sx={{
                  background: alpha(getRoleColor(myRole, theme), 0.09),
                  color: getRoleColor(myRole, theme),
                  border: `1px solid ${alpha(getRoleColor(myRole, theme), 0.27)}`,
                }}
              />
            )}
          </Stack>
        </Box>
        {/* Mobile nav toggle */}
        <Button
          variant="outlined"
          size="small"
          onClick={() => setMobileNavOpen(o => !o)}
          sx={{
            display: { xs: 'flex', md: 'none' },
            borderColor: alpha(theme.palette.primary.main, 0.3),
            color: 'primary.main',
            minWidth: 36,
          }}
        >
          {activeSection}
        </Button>
      </Stack>

      <Divider
        sx={{
          borderColor: alpha(theme.palette.primary.main, 0.1),
          mb: 2,
          maxWidth: 1200,
          mx: 'auto',
        }}
      />

      {/* Layout: Sidebar + Content */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          maxWidth: 1200,
          mx: 'auto',
        }}
      >
        {/* Sidebar — desktop */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            width: 200,
            flexShrink: 0,
            position: 'sticky',
            top: 80,
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              borderRadius: 2,
            },
          }}
        >
          {sidebarContent}
        </Box>

        {/* Sidebar — mobile drawer */}
        {mobileNavOpen && (
          <Box
            sx={{
              display: { xs: 'block', md: 'none' },
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1200,
              bgcolor: alpha(theme.palette.background.default, 0.95),
              overflowY: 'auto',
              p: 2,
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'common.white' }}>
                Navigation
              </Typography>
              <Button
                size="small"
                onClick={() => setMobileNavOpen(false)}
                sx={{ color: 'text.secondary' }}
              >
                Close
              </Button>
            </Stack>
            {sidebarContent}
          </Box>
        )}

        {/* Content area */}
        <Box sx={{ flex: 1, minWidth: 0 }}>{renderContent()}</Box>
      </Box>
    </Box>
  );
};

export const FederationManagePageWithErrorBoundary: React.FC = () => <FederationManagePage />;
