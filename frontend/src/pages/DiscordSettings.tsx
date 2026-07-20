import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { buildBotInviteUrl } from '@/components/landing/DiscordBotPreview';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAlliances } from '@/hooks/queries/useAllianceQueries';
import { useMyFederations } from '@/hooks/queries/useFederationManagementQueries';
import {
  useConnectDiscordGuild,
  useDiscordGuildChannels,
  useDiscordGuildRoles,
  useDiscordGuilds,
  useGuildSettings,
  useInvalidateGuildSettings,
  useMyGuildMembership,
  type GuildMembershipStatus,
} from '@/hooks/queries/useOrgSettingsQueries';
import { useOrgRelationships } from '@/hooks/queries/useRelationshipQueries';
import {
  discordService,
  DiscordSettings,
  LfgSettingsPayload,
  RsiStatusConfiguration,
  RsiStatusRole,
  TeamVoiceSettings,
  Tunnel,
  UserDiscordPreferences,
  VoiceChannelConfig,
} from '@/services/discordService';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { DISCORD_BLUE } from '@/utils/brandColors';
import { getNotificationChannelDestinations } from '@/utils/discordNotificationDestinations';
import { buildCrossOrgLfgOptions, type CrossOrgOption } from '@/utils/relatedOrganizationOptions';
import { sanitizeImageUrl } from '@/utils/sanitize';
import {
  Add,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Assignment as AssignmentIcon,
  Summarize as AuditLogIcon,
  BarChart,
  CardGiftcard,
  Chat as ChatIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Folder as FolderIcon,
  Groups as GroupsIcon,
  Headset as HeadsetIcon,
  Info as InfoIcon,
  LightbulbOutlined as LightbulbOutlinedIcon,
  Link as LinkIcon,
  LocalOffer as LocalOfferIcon,
  Mail,
  Notifications as NotificationsIcon,
  OpenInNew as OpenInNewIcon,
  People,
  Person as PersonIcon,
  RecordVoiceOver,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
  Sync as SyncIcon,
  VolumeUp as VolumeUpIcon,
  WavingHand as WelcomeIcon,
  Work,
} from '@mui/icons-material';
import {
  Alert,
  AppBar,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Switch as MuiSwitch,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Channel type filter options. */
type ChannelTypeFilter = 'text' | 'voice' | 'category' | 'status' | 'all';

interface QuickResponseItem {
  id: string;
  name: string;
  content: string;
  categoryId?: string;
}

interface QuickResponseCategoryItem {
  id: string;
  name: string;
}

interface DiscordChannelOption {
  id: string;
  name: string;
  type: number;
}

interface DiscordRoleOption {
  id: string;
  name: string;
}

interface TicketSettingsState {
  enabled: boolean;
  defaultCategoryId: string;
  transcriptChannelId: string;
  supportRoleId: string;
  escalationRoleId: string;
  formChannelId: string;
  autoCloseHours: number;
  maxOpenTicketsPerUser: number;
  mentionSupportRoleOnCreate: boolean;
  notifyOnClose: boolean;
  allowMemberClose: boolean;
}

interface TicketAccessControlState {
  blockedRoleIds: string;
  requiredRoleIds: string;
  roleMatchMode: 'any' | 'all';
}

interface RecruitmentSettingsState {
  enabled: boolean;
  applicationChannelId: string;
  approvedRoleId: string;
  pendingRoleId: string;
  requireDiscordVerification: boolean;
  autoAssignRole: boolean;
  welcomeMessage: string;
  inviteFormEnabled: boolean;
  inviteFormBindingCode: string;
  discordInviteUrl: string;
  autoResolveOnRoleChange: boolean;
}

interface RecruitAdvancedRolesState {
  restrictedRoleIds: string;
  requiredRoleIds: string;
  requiredRoleMatchMode: 'any' | 'all';
  acceptedRemovalRoleIds: string;
  deniedRemovalRoleIds: string;
  removeRolesOnSubmit: string;
  acceptedChannelId: string;
  deniedChannelId: string;
  pendingChannelId: string;
}

interface RoleSyncSettingsState {
  enabled: boolean;
  syncRolesFromApi: boolean;
  autoRoleManagement: boolean;
  removeRolesOnLeave: boolean;
  syncIntervalMinutes: number;
  syncOnBotJoin: boolean;
  requireManualApproval: boolean;
  approvalRoleId: string;
  syncErrorNotificationChannelId: string;
  verifiedRoleId: string;
  roleMappings: string;
}

/** Resolve a channel list by type filter. */
function filterChannelsByType(
  channels: { id: string; name: string; type: number }[],
  channelType: ChannelTypeFilter
): { id: string; name: string; type: number }[] {
  switch (channelType) {
    case 'text':
      // Include both text (0) and announcement/news (5) channels
      return channels.filter(c => c.type === 0 || c.type === 5);
    case 'voice':
      return channels.filter(c => c.type === 2);
    case 'category':
      return channels.filter(c => c.type === 4);
    case 'status':
      // Status channels can be either text/announcement or voice channels.
      return channels.filter(c => c.type === 0 || c.type === 5 || c.type === 2);
    default:
      return channels;
  }
}

/** Return a display prefix for a Discord channel based on its type. */
function channelPrefix(type: number): string {
  if (type === 2) return '🔊 ';
  if (type === 5) return '📢 ';
  if (type === 4) return '📁 ';
  return '# ';
}

const COMMON_SERVER_TIMEZONES = [
  'UTC',
  'GMT',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Warsaw',
  'Europe/Istanbul',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

/** Shared state for multi-select pickers (roles and channels). */
function useMultiPicker(values: string[], onChange: (v: string[]) => void) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState('');
  const add = (id: string) => {
    if (id && !values.includes(id)) onChange([...values, id]);
    setPendingId('');
    setOpen(false);
  };
  const remove = (id: string) => onChange(values.filter(v => v !== id));
  return { open, setOpen, pendingId, setPendingId, add, remove };
}

/**
 * Reusable channel picker — shows a dropdown of real Discord channels.
 * Falls back to text field if no channels are loaded.
 */
const ChannelPicker: React.FC<{
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly channels: { id: string; name: string; type: number }[];
  readonly helperText?: string;
  readonly channelType?: ChannelTypeFilter;
}> = ({ label, value, onChange, channels, helperText, channelType = 'all' }) => {
  const filtered = filterChannelsByType(channels, channelType);

  if (filtered.length === 0) {
    return (
      <TextField
        label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        size="small"
        fullWidth
        helperText={helperText ?? 'Enter Discord channel ID'}
      />
    );
  }

  const selectedChannel = filtered.find(ch => ch.id === value) ?? null;

  return (
    <Autocomplete
      options={filtered}
      value={selectedChannel}
      onChange={(_, newValue) => onChange(newValue?.id ?? '')}
      getOptionLabel={ch => `${channelPrefix(ch.type)}${ch.name}`}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      size="small"
      fullWidth
      renderInput={params => <TextField {...params} label={label} helperText={helperText} />}
    />
  );
};

/**
 * Reusable role picker — shows a dropdown of real Discord roles.
 * Falls back to text field if no roles are loaded.
 */
const RolePicker: React.FC<{
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly roles: { id: string; name: string }[];
  readonly helperText?: string;
}> = ({ label, value, onChange, roles, helperText }) => {
  if (roles.length === 0) {
    return (
      <TextField
        label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        size="small"
        fullWidth
        helperText={helperText ?? 'Enter Discord role ID'}
      />
    );
  }

  return (
    <TextField
      label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      size="small"
      fullWidth
      select
      helperText={helperText}
      slotProps={{
        select: {
          inputProps: {
            title: label,
            'aria-label': label,
          },
        },
      }}
    >
      <MenuItem value="">
        <em>None</em>
      </MenuItem>
      {roles.map(r => (
        <MenuItem key={r.id} value={r.id}>
          @{r.name}
        </MenuItem>
      ))}
    </TextField>
  );
};

/**
 * Multi-role picker — lets the user pick several Discord roles via a dropdown,
 * displaying chosen roles as chips. Falls back to a plain text field when no
 * role data has been loaded.
 *
 * `values` is an array of role IDs; `onChange` receives the updated array.
 */
const MultiRolePicker: React.FC<{
  readonly label: string;
  readonly values: string[];
  readonly onChange: (values: string[]) => void;
  readonly roles: { id: string; name: string }[];
  readonly helperText?: string;
}> = ({ label, values, onChange, roles, helperText }) => {
  const { open, setOpen, pendingId, add, remove } = useMultiPicker(values, onChange);

  if (roles.length === 0) {
    return (
      <TextField
        label={label}
        value={values.join(', ')}
        onChange={e =>
          onChange(
            e.target.value
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          )
        }
        size="small"
        fullWidth
        helperText={helperText ?? 'Enter comma-separated Discord role IDs'}
      />
    );
  }

  const available = roles.filter(r => !values.includes(r.id));

  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        {values.map(id => {
          const role = roles.find(r => r.id === id);
          return (
            <Chip
              key={id}
              label={role ? `@${role.name}` : id}
              onDelete={() => remove(id)}
              size="small"
              color="primary"
              variant="outlined"
            />
          );
        })}
        {available.length > 0 && (
          <Box>
            {open ? (
              <TextField
                select
                size="small"
                sx={{ minWidth: 180 }}
                value={pendingId}
                onChange={e => add(e.target.value)}
                onBlur={() => setOpen(false)}
                autoFocus
                label="Add role"
                slotProps={{
                  select: {
                    inputProps: {
                      title: 'Add role',
                      'aria-label': 'Add role',
                    },
                  },
                }}
              >
                {available.map(r => (
                  <MenuItem key={r.id} value={r.id}>
                    @{r.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Chip
                label="+ Add role"
                size="small"
                variant="outlined"
                onClick={() => setOpen(true)}
                sx={{ cursor: 'pointer', borderStyle: 'dashed' }}
              />
            )}
          </Box>
        )}
      </Stack>
      {helperText && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Reusable multi-channel picker — lets the user pick several Discord channels
 * via a dropdown, displaying chosen channels as chips.  Falls back to a plain
 * text field when no channel data has been loaded.
 */
const MultiChannelPicker: React.FC<{
  readonly label: string;
  readonly values: string[];
  readonly onChange: (values: string[]) => void;
  readonly channels: { id: string; name: string; type: number }[];
  readonly helperText?: string;
  readonly channelType?: ChannelTypeFilter;
}> = ({ label, values, onChange, channels, helperText, channelType = 'all' }) => {
  const { open, setOpen, pendingId, add, remove } = useMultiPicker(values, onChange);

  const filtered = filterChannelsByType(channels, channelType);

  if (filtered.length === 0) {
    return (
      <TextField
        label={label}
        value={values.join(', ')}
        onChange={e =>
          onChange(
            e.target.value
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          )
        }
        size="small"
        fullWidth
        helperText={helperText ?? 'Enter comma-separated Discord channel IDs'}
      />
    );
  }

  const available = filtered.filter(c => !values.includes(c.id));

  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        {values.map(id => {
          const ch = filtered.find(c => c.id === id);
          return (
            <Chip
              key={id}
              label={ch ? `${channelPrefix(ch.type).trim()}${ch.name}` : id}
              onDelete={() => remove(id)}
              size="small"
              color="primary"
              variant="outlined"
            />
          );
        })}
        {available.length > 0 && (
          <Box>
            {open ? (
              <TextField
                select
                size="small"
                sx={{ minWidth: 180 }}
                value={pendingId}
                onChange={e => add(e.target.value)}
                onBlur={() => setOpen(false)}
                autoFocus
                label="Add channel"
                slotProps={{
                  select: {
                    inputProps: {
                      title: 'Add channel',
                      'aria-label': 'Add channel',
                    },
                  },
                }}
              >
                {available.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {channelPrefix(c.type)}
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Chip
                label="+ Add channel"
                size="small"
                variant="outlined"
                onClick={() => setOpen(true)}
                sx={{ cursor: 'pointer', borderStyle: 'dashed' }}
              />
            )}
          </Box>
        )}
      </Stack>
      {helperText && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

/**
 * LFG settings tab content — extracted to keep DiscordSettingsPage complexity low.
 */
interface LfgSettingsPanelProps {
  readonly settings: LfgSettingsPayload;
  readonly onChange: (updated: LfgSettingsPayload) => void;
  readonly onSave: () => void;
  readonly saving: boolean;
  readonly textChannels: { id: string; name: string; type: number }[];
  readonly voiceChannels: { id: string; name: string; type: number }[];
  readonly roles: { id: string; name: string }[];
  readonly organizationId: string;
}

const LfgSettingsPanel: React.FC<Readonly<LfgSettingsPanelProps>> = ({
  settings,
  onChange,
  onSave,
  saving,
  textChannels,
  voiceChannels,
  roles,
  organizationId,
}) => {
  const theme = useTheme();

  // ── Fetch allied orgs from relationships, diplomacy treaties, + federation members ──
  const { data: relationshipsData } = useOrgRelationships(organizationId || undefined);
  const { data: federations } = useMyFederations();
  const { data: alliances } = useAlliances();

  // Local state for RSI tag text input fields
  const [allowTagInput, setAllowTagInput] = React.useState('');
  const [blockTagInput, setBlockTagInput] = React.useState('');

  // Build the list of selectable allied organizations, diplomacy treaty orgs, and federations
  const alliedOrgs = React.useMemo<CrossOrgOption[]>(() => {
    return buildCrossOrgLfgOptions({
      organizationId,
      relationships: relationshipsData?.data ?? [],
      alliances: alliances ?? [],
      federations: federations ?? [],
    });
  }, [relationshipsData, federations, alliances, organizationId]);

  // Build a separate list for the block autocomplete (same orgs available)
  const blockableOrgs = alliedOrgs;
  return (
    <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h6">LFG Channel Configuration</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure how Looking-For-Group posts are announced in your Discord server.
          </Typography>
          <Divider />

          <ChannelPicker
            label="LFG Channel"
            value={settings.lfgChannelId ?? ''}
            onChange={v => onChange({ ...settings, lfgChannelId: v })}
            channels={textChannels}
            channelType="text"
            helperText="The channel where LFG posts will be cross-posted. Also configurable via /lfg → LFG Settings in Discord."
          />

          <Stack direction="row" spacing={4} flexWrap="wrap">
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={settings.autoPostEnabled ?? true}
                  onChange={(_, checked) => onChange({ ...settings, autoPostEnabled: checked })}
                />
              }
              label="Auto-post new LFG activities to Discord"
            />
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={settings.smartPingEnabled ?? true}
                  onChange={(_, checked) => onChange({ ...settings, smartPingEnabled: checked })}
                />
              }
              label="Enable Smart Ping (reduces notification spam)"
            />
          </Stack>

          <TextField
            label="Auto-LFG Voice Channel Scope"
            select
            size="small"
            sx={{ maxWidth: 360 }}
            value={settings.autoLfgVoiceChannelScope ?? 'all'}
            onChange={e =>
              onChange({
                ...settings,
                autoLfgVoiceChannelScope: e.target.value as 'all' | 'selected',
              })
            }
            helperText="Choose whether Auto-LFG can trigger from all voice channels or only selected ones."
            slotProps={{
              select: {
                inputProps: {
                  title: 'Auto-LFG Voice Channel Scope',
                  'aria-label': 'Auto-LFG Voice Channel Scope',
                },
              },
            }}
          >
            <MenuItem value="all">All voice channels</MenuItem>
            <MenuItem value="selected">Only selected voice channels</MenuItem>
          </TextField>

          {(settings.autoLfgVoiceChannelScope ?? 'all') === 'selected' && (
            <MultiChannelPicker
              label="Auto-LFG Allowed Voice Channels"
              values={settings.autoLfgAllowedVoiceChannelIds ?? []}
              onChange={values =>
                onChange({
                  ...settings,
                  autoLfgAllowedVoiceChannelIds: values,
                })
              }
              channels={voiceChannels}
              channelType="voice"
              helperText="Auto-LFG will only trigger when users are in one of these voice channels. Leave empty to block Auto-LFG for all channels while in selected-only mode."
            />
          )}

          <TextField
            label="Ping Cooldown (minutes)"
            type="number"
            value={settings.pingCooldownMinutes ?? 30}
            onChange={e => onChange({ ...settings, pingCooldownMinutes: Number(e.target.value) })}
            size="small"
            sx={{ maxWidth: 200 }}
            helperText="Minimum time between LFG pings per user"
          />

          <Divider />

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Cross-Organization LFG
          </Typography>
          <FormControlLabel
            control={
              <MuiSwitch
                checked={settings.crossOrgEnabled ?? false}
                onChange={(_, checked) => onChange({ ...settings, crossOrgEnabled: checked })}
              />
            }
            label="Show LFG posts from allied organizations"
          />

          {settings.crossOrgEnabled && (
            <Stack direction="column" spacing={2}>
              <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>
                Organizations are sourced from your active diplomacy treaties, federation
                memberships, and allied relationships. You can also manually whitelist or block
                organizations by their RSI tag below.
              </Alert>

              {alliedOrgs.length === 0 && (
                <Alert severity="warning" variant="outlined">
                  No allied organizations found. Set up diplomacy treaties, federation memberships,
                  or organization relationships first — or use the Manual RSI Tag Whitelist below to
                  allow specific organizations by their RSI tag.
                </Alert>
              )}

              <Autocomplete
                multiple
                options={alliedOrgs}
                groupBy={opt => opt.group}
                getOptionLabel={opt => {
                  if (opt.group === 'Federations') return `${opt.name} (Federation)`;
                  if (opt.group === 'Diplomacy Treaties') return `${opt.name} (Treaty)`;
                  return opt.name;
                }}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                value={alliedOrgs.filter(o => (settings.crossOrgAllowList ?? []).includes(o.id))}
                onChange={(_, selected) =>
                  onChange({
                    ...settings,
                    crossOrgAllowList: selected.map(o => o.id),
                  })
                }
                size="small"
                fullWidth
                slotProps={{
                  chip: { size: 'small', variant: 'outlined', color: 'primary' },
                }}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Whitelisted Organizations"
                    placeholder={
                      (settings.crossOrgAllowList ?? []).length === 0
                        ? 'All allied organizations allowed'
                        : 'Add organization...'
                    }
                    helperText="Select specific organizations or federations to allow LFG sharing. Leave empty to allow all allied orgs."
                  />
                )}
                noOptionsText="No allied, treaty, or federation organizations found"
              />

              <Autocomplete
                multiple
                options={blockableOrgs}
                groupBy={opt => opt.group}
                getOptionLabel={opt => {
                  if (opt.group === 'Federations') return `${opt.name} (Federation)`;
                  if (opt.group === 'Diplomacy Treaties') return `${opt.name} (Treaty)`;
                  return opt.name;
                }}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                value={blockableOrgs.filter(o => (settings.crossOrgBlockList ?? []).includes(o.id))}
                onChange={(_, selected) =>
                  onChange({
                    ...settings,
                    crossOrgBlockList: selected.map(o => o.id),
                  })
                }
                size="small"
                fullWidth
                slotProps={{
                  chip: { size: 'small', variant: 'outlined', color: 'error' },
                }}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Blocked Organizations"
                    placeholder="Block specific organizations from LFG sharing..."
                    helperText="These organizations will be excluded even if they appear in your allow list or have an active treaty."
                  />
                )}
                noOptionsText="No organizations available to block"
              />

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Manual RSI Tag Whitelist
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manually allow organizations by their RSI spectrum tag, even if they are not in your
                diplomacy, federation, or relationship lists.
              </Typography>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TextField
                  label="RSI Tag"
                  placeholder="e.g., FRINAUTS"
                  size="small"
                  value={allowTagInput}
                  onChange={e => setAllowTagInput(e.target.value.toUpperCase())}
                  sx={{ maxWidth: 200 }}
                  helperText="Enter an RSI organization tag"
                  slotProps={{
                    input: {
                      sx: { textTransform: 'uppercase' },
                    },
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && allowTagInput.trim()) {
                      e.preventDefault();
                      const tag = allowTagInput.trim().toUpperCase();
                      const current = settings.crossOrgManualAllowTags ?? [];
                      if (!current.includes(tag)) {
                        onChange({
                          ...settings,
                          crossOrgManualAllowTags: [...current, tag],
                        });
                      }
                      setAllowTagInput('');
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: '4px' }}
                  disabled={!allowTagInput.trim()}
                  onClick={() => {
                    const tag = allowTagInput.trim().toUpperCase();
                    const current = settings.crossOrgManualAllowTags ?? [];
                    if (tag && !current.includes(tag)) {
                      onChange({
                        ...settings,
                        crossOrgManualAllowTags: [...current, tag],
                      });
                    }
                    setAllowTagInput('');
                  }}
                >
                  Add
                </Button>
              </Stack>
              {(settings.crossOrgManualAllowTags ?? []).length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(settings.crossOrgManualAllowTags ?? []).map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      color="success"
                      variant="outlined"
                      onDelete={() =>
                        onChange({
                          ...settings,
                          crossOrgManualAllowTags: (settings.crossOrgManualAllowTags ?? []).filter(
                            t => t !== tag
                          ),
                        })
                      }
                    />
                  ))}
                </Box>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
                Manual RSI Tag Block List
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Block organizations by their RSI spectrum tag. Blocked tags take precedence over all
                allow rules.
              </Typography>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TextField
                  label="RSI Tag"
                  placeholder="e.g., BADORG"
                  size="small"
                  value={blockTagInput}
                  onChange={e => setBlockTagInput(e.target.value.toUpperCase())}
                  sx={{ maxWidth: 200 }}
                  helperText="Enter an RSI organization tag to block"
                  slotProps={{
                    input: {
                      sx: { textTransform: 'uppercase' },
                    },
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && blockTagInput.trim()) {
                      e.preventDefault();
                      const tag = blockTagInput.trim().toUpperCase();
                      const current = settings.crossOrgManualBlockTags ?? [];
                      if (!current.includes(tag)) {
                        onChange({
                          ...settings,
                          crossOrgManualBlockTags: [...current, tag],
                        });
                      }
                      setBlockTagInput('');
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  sx={{ mt: '4px' }}
                  disabled={!blockTagInput.trim()}
                  onClick={() => {
                    const tag = blockTagInput.trim().toUpperCase();
                    const current = settings.crossOrgManualBlockTags ?? [];
                    if (tag && !current.includes(tag)) {
                      onChange({
                        ...settings,
                        crossOrgManualBlockTags: [...current, tag],
                      });
                    }
                    setBlockTagInput('');
                  }}
                >
                  Block
                </Button>
              </Stack>
              {(settings.crossOrgManualBlockTags ?? []).length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(settings.crossOrgManualBlockTags ?? []).map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      color="error"
                      variant="outlined"
                      onDelete={() =>
                        onChange({
                          ...settings,
                          crossOrgManualBlockTags: (settings.crossOrgManualBlockTags ?? []).filter(
                            t => t !== tag
                          ),
                        })
                      }
                    />
                  ))}
                </Box>
              )}

              {(() => {
                const allowTags = settings.crossOrgManualAllowTags ?? [];
                const blockTags = settings.crossOrgManualBlockTags ?? [];
                const overlap = allowTags.filter(t => blockTags.includes(t));
                const allowIds = new Set(settings.crossOrgAllowList ?? []);
                const blockIds = new Set(settings.crossOrgBlockList ?? []);
                const orgOverlap = [...allowIds].filter(id => blockIds.has(id));
                if (overlap.length === 0 && orgOverlap.length === 0) return null;
                return (
                  <Alert severity="warning" variant="outlined">
                    {overlap.length > 0 && (
                      <>
                        {'RSI tags in both allow and block lists: '}
                        <strong>{overlap.join(', ')}</strong>
                        {'. Blocked tags take precedence.'}
                      </>
                    )}
                    {orgOverlap.length > 0 && (
                      <>
                        {overlap.length > 0 && <br />}
                        Organizations in both allow and block lists will be blocked.
                      </>
                    )}
                  </Alert>
                );
              })()}
            </Stack>
          )}

          <Divider />

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Region &amp; Language
          </Typography>
          <TextField
            label="Region"
            placeholder="e.g., NA, EU, OCE, APAC"
            size="small"
            sx={{ maxWidth: 200 }}
            value={settings.region ?? ''}
            onChange={e => onChange({ ...settings, region: e.target.value })}
            helperText="Server region for LFG matching"
          />
          <TextField
            label="Language"
            placeholder="e.g., en, de, fr, es"
            size="small"
            sx={{ maxWidth: 200 }}
            value={settings.language ?? ''}
            onChange={e => onChange({ ...settings, language: e.target.value })}
            helperText="Primary language for LFG posts"
          />

          <Divider />

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Role Filter Mapping
          </Typography>
          <TextField
            label="Role \u2192 Filter Mappings"
            placeholder="RoleID=Category, 123456789=Tank, 987654321=Healer"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={settings.roleFilterMappings ?? ''}
            onChange={e => onChange({ ...settings, roleFilterMappings: e.target.value })}
            helperText="Map Discord roles to LFG search filters. Format: RoleID=Category, comma-separated"
          />
        </Stack>
      </Box>

      {/* Game Settings Section */}
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h6">Game Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure which games can be used for LFG and where non-default game posts are routed.
          </Typography>
          <Divider />

          <TextField
            label="Default Game"
            placeholder="Star Citizen"
            size="small"
            sx={{ maxWidth: 300 }}
            value={settings.defaultGame ?? ''}
            onChange={e => onChange({ ...settings, defaultGame: e.target.value })}
            helperText="The default game for LFG posts. Leave empty for Star Citizen."
          />

          <TextField
            label="Allowed Games"
            placeholder="Star Citizen"
            size="small"
            fullWidth
            value={settings.gameFilters ?? ''}
            onChange={e => onChange({ ...settings, gameFilters: e.target.value })}
            helperText="Comma-separated list of allowed games for LFG. Leave empty to allow only Star Citizen."
          />

          <ChannelPicker
            label="Other Games Channel"
            value={settings.otherGamesChannelId ?? ''}
            onChange={v => onChange({ ...settings, otherGamesChannelId: v })}
            channels={textChannels}
            channelType="text"
            helperText="LFG posts for non-default games will be posted here instead of the main LFG channel."
          />
        </Stack>
      </Box>

      {/* Public LFG Section */}
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h6">Public LFG</Typography>
          <Typography variant="body2" color="text.secondary">
            Share LFG posts across servers. When enabled, public LFG posts from other servers will
            be delivered to opted-in members via DM or posted to a channel.
          </Typography>
          <Divider />

          <FormControlLabel
            control={
              <MuiSwitch
                checked={settings.publicLfgEnabled ?? false}
                onChange={(_, checked) => onChange({ ...settings, publicLfgEnabled: checked })}
              />
            }
            label="Enable Public LFG (receive cross-server LFG posts)"
          />

          <TextField
            label="Public LFG Delivery"
            select
            size="small"
            sx={{ maxWidth: 300 }}
            value={settings.publicLfgDelivery ?? 'dm'}
            onChange={e =>
              onChange({ ...settings, publicLfgDelivery: e.target.value as 'dm' | 'channel' })
            }
            helperText="How incoming public LFG posts are delivered to this server."
            slotProps={{
              select: {
                inputProps: {
                  title: 'Public LFG Delivery',
                  'aria-label': 'Public LFG Delivery',
                },
              },
            }}
          >
            <MenuItem value="dm">DM (direct message to opted-in members)</MenuItem>
            <MenuItem value="channel">Channel (post to a text channel)</MenuItem>
          </TextField>

          {settings.publicLfgDelivery === 'channel' && (
            <ChannelPicker
              label="Public LFG Channel"
              value={settings.publicLfgChannelId ?? ''}
              onChange={v => onChange({ ...settings, publicLfgChannelId: v })}
              channels={textChannels}
              channelType="text"
              helperText="Channel where incoming public LFG posts will be posted."
            />
          )}

          {(settings.publicLfgDelivery ?? 'dm') === 'dm' && (
            <RolePicker
              label="Public LFG Opt-in Role"
              value={settings.publicLfgOptInRoleId ?? ''}
              onChange={v => onChange({ ...settings, publicLfgOptInRoleId: v })}
              roles={roles}
              helperText="Only members with this role will receive public LFG DMs. Leave empty for all members."
            />
          )}

          <RolePicker
            label="LFG Mention Role"
            value={settings.lfgMentionRoleId ?? ''}
            onChange={v => onChange({ ...settings, lfgMentionRoleId: v })}
            roles={roles}
            helperText="Role to @mention in the LFG channel when a new LFG post is created. Leave empty to skip pinging."
          />
        </Stack>
      </Box>

      <Stack direction="row" justifyContent="end">
        <Button variant="contained" onClick={onSave} disabled={saving}>
          {saving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Save LFG Settings
        </Button>
      </Stack>

      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          background: alpha(theme.palette.info.main, 0.1),
          border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
        }}
      >
        <Stack direction="column" spacing={1}>
          <Typography variant="h4" sx={{ color: 'info.main' }}>
            <LightbulbOutlinedIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />{' '}
            Discord Bot Commands
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            Type <strong>/lfg</strong> in Discord to open the LFG panel. All actions are
            button-driven:
            <br />
            <strong>Browse Groups</strong> - See active LFG posts in this server
            <br />
            <strong>Create Group</strong> - Create a new LFG post
            <br />
            <strong>Find Match</strong> - Find LFG posts matching your preferences
            <br />
            <strong>Auto-LFG</strong> - Automatic group matching
            <br />
            <strong>Smart Ping</strong> - Get notified when groups matching your interests appear
            <br />
            <strong>My Reputation</strong> - View your LFG reputation score
            <br />
            <strong>LFG Settings</strong> - Configure channels, filters, and public LFG (admin)
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
};

const MembershipStatusChip: React.FC<{
  readonly membership: GuildMembershipStatus | undefined;
  readonly onOpenPreferences: () => void;
}> = ({ membership, onOpenPreferences }) => {
  if (!membership) {
    return null;
  }

  if (!membership.isInGuild) {
    return (
      <Chip
        label="Not in server"
        color="warning"
        size="small"
        variant="outlined"
        sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
      />
    );
  }

  return (
    <Chip
      label={`You: ${membership.displayName || 'Member'}`}
      color="success"
      size="small"
      variant="outlined"
      onClick={onOpenPreferences}
      sx={{
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
        cursor: 'pointer',
        '&:hover': { opacity: 0.85 },
      }}
    />
  );
};

interface TicketingQuickResponsesSectionProps {
  readonly categories: QuickResponseCategoryItem[];
  readonly responses: QuickResponseItem[];
  readonly newCategoryName: string;
  readonly onNewCategoryNameChange: (value: string) => void;
  readonly onCreateCategory: () => void;
  readonly onDeleteCategory: (categoryId: string) => void;
  readonly newResponseName: string;
  readonly onNewResponseNameChange: (value: string) => void;
  readonly newResponseContent: string;
  readonly onNewResponseContentChange: (value: string) => void;
  readonly onCreateResponse: () => void;
  readonly onDeleteResponse: (responseId: string) => void;
}

const TicketingQuickResponsesSection: React.FC<Readonly<TicketingQuickResponsesSectionProps>> = ({
  categories,
  responses,
  newCategoryName,
  onNewCategoryNameChange,
  onCreateCategory,
  onDeleteCategory,
  newResponseName,
  onNewResponseNameChange,
  newResponseContent,
  onNewResponseContentChange,
  onCreateResponse,
  onDeleteResponse,
}) => (
  <Box sx={{ borderRadius: 1, p: 2 }}>
    <Stack direction="column" spacing={2}>
      <Typography variant="h6">Quick Responses</Typography>
      <Typography variant="body2" color="text.secondary">
        Create canned replies for common ticket questions. Staff can use these to respond faster.
      </Typography>
      <Divider />

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Categories
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {categories.map(category => (
          <Chip
            key={category.id}
            label={category.name}
            onDelete={() => onDeleteCategory(category.id)}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          placeholder="New category name"
          value={newCategoryName}
          onChange={e => onNewCategoryNameChange(e.target.value)}
        />
        <Button
          size="small"
          variant="outlined"
          disabled={!newCategoryName.trim()}
          onClick={onCreateCategory}
        >
          Add
        </Button>
      </Stack>

      <Divider />

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Responses
      </Typography>
      {responses.map(response => (
        <Box
          key={response.id}
          sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack>
              <Typography sx={{ fontWeight: 600 }}>{response.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
                {response.content.substring(0, 100)}
                {response.content.length > 100 ? '...' : ''}
              </Typography>
            </Stack>
            <IconButton size="small" onClick={() => onDeleteResponse(response.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      ))}

      <Stack direction="column" spacing={1}>
        <TextField
          size="small"
          label="Response Name"
          value={newResponseName}
          onChange={e => onNewResponseNameChange(e.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Response Content"
          value={newResponseContent}
          onChange={e => onNewResponseContentChange(e.target.value)}
          fullWidth
          multiline
          minRows={2}
        />
        <Button
          size="small"
          variant="contained"
          disabled={!newResponseName.trim() || !newResponseContent.trim()}
          startIcon={<Add />}
          onClick={onCreateResponse}
          sx={{ alignSelf: 'flex-start' }}
        >
          Add Quick Response
        </Button>
      </Stack>
    </Stack>
  </Box>
);

interface TicketingTabContentProps {
  readonly ticketSettings: TicketSettingsState;
  readonly setTicketSettings: React.Dispatch<React.SetStateAction<TicketSettingsState>>;
  readonly categoryChannels: DiscordChannelOption[];
  readonly textChannels: DiscordChannelOption[];
  readonly guildRoles: DiscordRoleOption[];
  readonly ticketAccessControl: TicketAccessControlState;
  readonly setTicketAccessControl: React.Dispatch<React.SetStateAction<TicketAccessControlState>>;
  readonly ticketRateSupportEnabled: boolean;
  readonly setTicketRateSupportEnabled: (value: boolean) => void;
  readonly ticketChannelNameTemplate: string;
  readonly setTicketChannelNameTemplate: (value: string) => void;
  readonly onSaveTicketSettings: () => Promise<void>;
  readonly ticketingSaving: boolean;
  readonly quickResponseCategories: QuickResponseCategoryItem[];
  readonly quickResponses: QuickResponseItem[];
  readonly newQrCatName: string;
  readonly setNewQrCatName: (value: string) => void;
  readonly onCreateQuickResponseCategory: () => Promise<void>;
  readonly onDeleteQuickResponseCategory: (categoryId: string) => Promise<void>;
  readonly newQrName: string;
  readonly setNewQrName: (value: string) => void;
  readonly newQrContent: string;
  readonly setNewQrContent: (value: string) => void;
  readonly onCreateQuickResponse: () => Promise<void>;
  readonly onDeleteQuickResponse: (responseId: string) => Promise<void>;
}

const TicketingTabContent: React.FC<Readonly<TicketingTabContentProps>> = ({
  ticketSettings,
  setTicketSettings,
  categoryChannels,
  textChannels,
  guildRoles,
  ticketAccessControl,
  setTicketAccessControl,
  ticketRateSupportEnabled,
  setTicketRateSupportEnabled,
  ticketChannelNameTemplate,
  setTicketChannelNameTemplate,
  onSaveTicketSettings,
  ticketingSaving,
  quickResponseCategories,
  quickResponses,
  newQrCatName,
  setNewQrCatName,
  onCreateQuickResponseCategory,
  onDeleteQuickResponseCategory,
  newQrName,
  setNewQrName,
  newQrContent,
  setNewQrContent,
  onCreateQuickResponse,
  onDeleteQuickResponse,
}) => {
  const theme = useTheme();

  return (
    <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: alpha(theme.palette.primary.main, 0.2),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            <ConfirmationNumberIcon sx={{ fontSize: 24 }} />
          </Box>
          <Stack direction="column" flex={1}>
            <Typography sx={{ fontWeight: 600, color: 'common.white' }}>
              Discord Ticketing System
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              Create and manage support tickets through Discord (like tickettool.xyz)
            </Typography>
          </Stack>
          <FormControlLabel
            control={
              <MuiSwitch
                checked={ticketSettings.enabled}
                onChange={(_, checked) =>
                  setTicketSettings(prev => ({ ...prev, enabled: checked }))
                }
              />
            }
            label="Enabled"
          />
        </Stack>
      </Box>

      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h3" sx={{ color: 'primary.main' }}>
            Ticket Channel Configuration
          </Typography>
          <Typography sx={{ color: 'text.secondary', marginBottom: '16px' }}>
            Configure which Discord channels handle different ticket categories
          </Typography>

          <Stack direction="column" spacing={2}>
            <ChannelPicker
              label="Ticket Category"
              value={ticketSettings.defaultCategoryId}
              onChange={value => setTicketSettings(prev => ({ ...prev, defaultCategoryId: value }))}
              channels={categoryChannels}
              channelType="category"
              helperText="Discord category where ticket channels are created"
            />
            <ChannelPicker
              label="Transcript Channel"
              value={ticketSettings.transcriptChannelId}
              onChange={value =>
                setTicketSettings(prev => ({ ...prev, transcriptChannelId: value }))
              }
              channels={textChannels}
              channelType="text"
              helperText="Channel where ticket transcripts are saved"
            />
            <ChannelPicker
              label="Ticket Form Channel"
              value={ticketSettings.formChannelId}
              onChange={value => setTicketSettings(prev => ({ ...prev, formChannelId: value }))}
              channels={textChannels}
              channelType="text"
              helperText="Channel for the ticket creation panel"
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h4" sx={{ color: 'primary.main' }}>
            Role Configuration
          </Typography>

          <Stack direction="column" spacing={2}>
            <RolePicker
              label="Support Role"
              value={ticketSettings.supportRoleId}
              onChange={value => setTicketSettings(prev => ({ ...prev, supportRoleId: value }))}
              roles={guildRoles}
              helperText="Role pinged when a ticket is created"
            />
            <RolePicker
              label="Escalation Role"
              value={ticketSettings.escalationRoleId}
              onChange={value => setTicketSettings(prev => ({ ...prev, escalationRoleId: value }))}
              roles={guildRoles}
              helperText="Role pinged when a ticket is escalated"
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h4" sx={{ color: 'primary.main' }}>
            Behavior
          </Typography>

          <Stack direction="row" spacing={3} flexWrap="wrap">
            <TextField
              label="Auto-close after (hours)"
              type="number"
              value={ticketSettings.autoCloseHours}
              onChange={e =>
                setTicketSettings(prev => ({
                  ...prev,
                  autoCloseHours: Number(e.target.value),
                }))
              }
              size="small"
              sx={{ maxWidth: 200 }}
              slotProps={{ htmlInput: { min: 1, max: 168 } }}
              helperText="Hours of inactivity before auto-close"
            />
            <TextField
              label="Max open tickets per user"
              type="number"
              value={ticketSettings.maxOpenTicketsPerUser}
              onChange={e =>
                setTicketSettings(prev => ({
                  ...prev,
                  maxOpenTicketsPerUser: Number(e.target.value),
                }))
              }
              size="small"
              sx={{ maxWidth: 200 }}
              slotProps={{ htmlInput: { min: 1, max: 20 } }}
            />
          </Stack>

          <Stack direction="row" spacing={4} flexWrap="wrap">
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={ticketSettings.mentionSupportRoleOnCreate}
                  onChange={(_, checked) =>
                    setTicketSettings(prev => ({ ...prev, mentionSupportRoleOnCreate: checked }))
                  }
                />
              }
              label="Ping support role when ticket is created"
            />
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={ticketSettings.notifyOnClose}
                  onChange={(_, checked) =>
                    setTicketSettings(prev => ({ ...prev, notifyOnClose: checked }))
                  }
                />
              }
              label="Notify when ticket is closed"
            />
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={ticketSettings.allowMemberClose}
                  onChange={(_, checked) =>
                    setTicketSettings(prev => ({ ...prev, allowMemberClose: checked }))
                  }
                />
              }
              label="Allow members to close their own tickets"
            />
          </Stack>

          <Divider />

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Access Control
          </Typography>
          <MultiRolePicker
            label="Blocked Roles"
            values={ticketAccessControl.blockedRoleIds
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)}
            onChange={values =>
              setTicketAccessControl(prev => ({ ...prev, blockedRoleIds: values.join(', ') }))
            }
            roles={guildRoles}
            helperText="Users with these roles cannot create tickets"
          />
          <MultiRolePicker
            label="Required Roles"
            values={ticketAccessControl.requiredRoleIds
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)}
            onChange={values =>
              setTicketAccessControl(prev => ({ ...prev, requiredRoleIds: values.join(', ') }))
            }
            roles={guildRoles}
            helperText="Only members with these roles can open tickets"
          />
          <FormControlLabel
            control={
              <MuiSwitch
                checked={ticketAccessControl.roleMatchMode === 'all'}
                onChange={e =>
                  setTicketAccessControl(prev => ({
                    ...prev,
                    roleMatchMode: e.target.checked ? 'all' : 'any',
                  }))
                }
              />
            }
            label="Require ALL listed roles (vs any one)"
          />

          <Divider />

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Ticket Experience
          </Typography>
          <FormControlLabel
            control={
              <MuiSwitch
                checked={ticketRateSupportEnabled}
                onChange={e => setTicketRateSupportEnabled(e.target.checked)}
              />
            }
            label="Enable satisfaction rating on ticket close (1-5 stars)"
          />
          <TextField
            size="small"
            fullWidth
            label="Channel Name Template"
            value={ticketChannelNameTemplate}
            onChange={e => setTicketChannelNameTemplate(e.target.value)}
            helperText="Variables: {count}, {user}, {category}. Default: ticket-{count}"
          />

          <Stack direction="row" justifyContent="end" sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={() => {
                void onSaveTicketSettings();
              }}
              disabled={ticketingSaving}
            >
              {ticketingSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Save Ticketing Settings
            </Button>
          </Stack>
        </Stack>
      </Box>

      <TicketingQuickResponsesSection
        categories={quickResponseCategories}
        responses={quickResponses}
        newCategoryName={newQrCatName}
        onNewCategoryNameChange={value => setNewQrCatName(value)}
        onCreateCategory={() => {
          void onCreateQuickResponseCategory();
        }}
        onDeleteCategory={categoryId => {
          void onDeleteQuickResponseCategory(categoryId);
        }}
        newResponseName={newQrName}
        onNewResponseNameChange={value => setNewQrName(value)}
        newResponseContent={newQrContent}
        onNewResponseContentChange={value => setNewQrContent(value)}
        onCreateResponse={() => {
          void onCreateQuickResponse();
        }}
        onDeleteResponse={responseId => {
          void onDeleteQuickResponse(responseId);
        }}
      />

      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          background: alpha(theme.palette.warning.main, 0.1),
          border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
        }}
      >
        <Stack direction="column" spacing={1}>
          <Typography variant="h4" sx={{ color: 'warning.main' }}>
            <LightbulbOutlinedIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />{' '}
            Discord Bot Commands
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            <strong>/ticket create [category]</strong> - Create a new ticket
            <br />
            <strong>/ticket list</strong> - Box your open tickets
            <br />
            <strong>/ticket Box [number]</strong> - Box ticket details
            <br />
            <strong>/ticket reply [number] [message]</strong> - Reply to a ticket
            <br />
            <strong>/ticket close [number]</strong> - Close a ticket
            <br />
            <strong>/ticket panel</strong> - Create a ticket panel (Admin only)
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
};

interface RecruitmentTabContentProps {
  readonly recruitmentSettings: RecruitmentSettingsState;
  readonly setRecruitmentSettings: React.Dispatch<React.SetStateAction<RecruitmentSettingsState>>;
  readonly textChannels: DiscordChannelOption[];
  readonly guildRoles: DiscordRoleOption[];
  readonly recruitDeniedMessage: string;
  readonly setRecruitDeniedMessage: React.Dispatch<React.SetStateAction<string>>;
  readonly recruitConfirmationMessage: string;
  readonly setRecruitConfirmationMessage: React.Dispatch<React.SetStateAction<string>>;
  readonly recruitCompletionMessage: string;
  readonly setRecruitCompletionMessage: React.Dispatch<React.SetStateAction<string>>;
  readonly recruitAdvRoles: RecruitAdvancedRolesState;
  readonly setRecruitAdvRoles: React.Dispatch<React.SetStateAction<RecruitAdvancedRolesState>>;
  readonly recruitTimeLimitMinutes: number;
  readonly setRecruitTimeLimitMinutes: React.Dispatch<React.SetStateAction<number>>;
  readonly recruitActionOnLeave: string;
  readonly setRecruitActionOnLeave: React.Dispatch<React.SetStateAction<string>>;
  readonly onSaveRecruitmentSettings: () => Promise<void>;
  readonly recruitmentSaving: boolean;
}

const RecruitmentTabContent: React.FC<Readonly<RecruitmentTabContentProps>> = ({
  recruitmentSettings,
  setRecruitmentSettings,
  textChannels,
  guildRoles,
  recruitDeniedMessage,
  setRecruitDeniedMessage,
  recruitConfirmationMessage,
  setRecruitConfirmationMessage,
  recruitCompletionMessage,
  setRecruitCompletionMessage,
  recruitAdvRoles,
  setRecruitAdvRoles,
  recruitTimeLimitMinutes,
  setRecruitTimeLimitMinutes,
  recruitActionOnLeave,
  setRecruitActionOnLeave,
  onSaveRecruitmentSettings,
  recruitmentSaving,
}) => {
  const theme = useTheme();

  return (
    <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: alpha(theme.palette.success.main, 0.2),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            <AssignmentIcon sx={{ fontSize: 24 }} />
          </Box>
          <Stack direction="column" flex={1}>
            <Typography sx={{ fontWeight: 600, color: 'common.white' }}>
              Discord Recruitment Integration
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              Accept applications through Discord with invite form binding (like appy.bot)
            </Typography>
          </Stack>
          <FormControlLabel
            control={
              <MuiSwitch
                checked={recruitmentSettings.enabled}
                onChange={(_, checked) =>
                  setRecruitmentSettings(prev => ({ ...prev, enabled: checked }))
                }
              />
            }
            label="Enabled"
          />
        </Stack>
      </Box>

      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h3" sx={{ color: 'primary.main' }}>
            Application Settings
          </Typography>
          <Typography sx={{ color: 'text.secondary', marginBottom: '16px' }}>
            Configure how recruitment applications are handled through Discord
          </Typography>

          <Stack direction="column" spacing={2}>
            <ChannelPicker
              label="Application Channel"
              value={recruitmentSettings.applicationChannelId}
              onChange={v => setRecruitmentSettings(prev => ({ ...prev, applicationChannelId: v }))}
              channels={textChannels}
              channelType="text"
              helperText="Channel where applications are posted"
            />
            <RolePicker
              label="Approved Role"
              value={recruitmentSettings.approvedRoleId}
              onChange={v => setRecruitmentSettings(prev => ({ ...prev, approvedRoleId: v }))}
              roles={guildRoles}
              helperText="Role given to approved applicants"
            />
            <RolePicker
              label="Pending Role"
              value={recruitmentSettings.pendingRoleId}
              onChange={v => setRecruitmentSettings(prev => ({ ...prev, pendingRoleId: v }))}
              roles={guildRoles}
              helperText="Role for pending applicants"
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={4} flexWrap="wrap">
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={recruitmentSettings.requireDiscordVerification}
                  onChange={(_, checked) =>
                    setRecruitmentSettings(prev => ({
                      ...prev,
                      requireDiscordVerification: checked,
                    }))
                  }
                />
              }
              label="Require Discord account verification"
            />
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={recruitmentSettings.autoAssignRole}
                  onChange={(_, checked) =>
                    setRecruitmentSettings(prev => ({
                      ...prev,
                      autoAssignRole: checked,
                    }))
                  }
                />
              }
              label="Auto-assign role on approval"
            />
          </Stack>

          <TextField
            label="Welcome Message"
            value={recruitmentSettings.welcomeMessage}
            onChange={e =>
              setRecruitmentSettings(prev => ({
                ...prev,
                welcomeMessage: e.target.value,
              }))
            }
            multiline
            rows={2}
            fullWidth
            size="small"
            helperText="Sent to applicants when approved. Variables: {user}, {application}, {reviewer}"
          />

          <TextField
            label="Denied Message"
            value={recruitDeniedMessage}
            onChange={e => setRecruitDeniedMessage(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            helperText="Sent to applicants when denied. Variables: {user}, {application}, {reviewer}"
          />

          <TextField
            label="Confirmation Message"
            value={recruitConfirmationMessage}
            onChange={e => setRecruitConfirmationMessage(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            helperText="Shown when a user starts an application"
          />

          <TextField
            label="Completion Message"
            value={recruitCompletionMessage}
            onChange={e => setRecruitCompletionMessage(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
            helperText="Shown when a user submits their application"
          />

          <TextField
            label="Discord Invite URL"
            value={recruitmentSettings.discordInviteUrl}
            onChange={e =>
              setRecruitmentSettings(prev => ({
                ...prev,
                discordInviteUrl: e.target.value,
              }))
            }
            size="small"
            fullWidth
            placeholder="https://discord.gg/..."
            helperText="Invite link shown to applicants when Discord recruitment is enabled"
          />

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" spacing={4} flexWrap="wrap">
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={recruitmentSettings.autoResolveOnRoleChange}
                  onChange={(_, checked) =>
                    setRecruitmentSettings(prev => ({
                      ...prev,
                      autoResolveOnRoleChange: checked,
                    }))
                  }
                />
              }
              label="Auto-resolve applications on Discord role change"
            />
          </Stack>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: -1 }}>
            When a member receives the Approved Role in Discord, their pending application is
            automatically accepted. Removal triggers rejection.
          </Typography>

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Access Control
          </Typography>
          <MultiRolePicker
            label="Restricted Roles"
            values={recruitAdvRoles.restrictedRoleIds
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)}
            onChange={vals =>
              setRecruitAdvRoles(prev => ({ ...prev, restrictedRoleIds: vals.join(', ') }))
            }
            roles={guildRoles}
            helperText="Members with any of these roles are blocked from applying"
          />
          <MultiRolePicker
            label="Required Roles"
            values={recruitAdvRoles.requiredRoleIds
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)}
            onChange={vals =>
              setRecruitAdvRoles(prev => ({ ...prev, requiredRoleIds: vals.join(', ') }))
            }
            roles={guildRoles}
            helperText={`Match mode: ${recruitAdvRoles.requiredRoleMatchMode}`}
          />
          <FormControlLabel
            control={
              <MuiSwitch
                checked={recruitAdvRoles.requiredRoleMatchMode === 'all'}
                onChange={e =>
                  setRecruitAdvRoles(prev => ({
                    ...prev,
                    requiredRoleMatchMode: e.target.checked ? 'all' : 'any',
                  }))
                }
              />
            }
            label="Require ALL listed roles (vs any one)"
          />

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
            Role Changes on Decision
          </Typography>
          <MultiRolePicker
            label="Roles to Remove on Accept"
            values={recruitAdvRoles.acceptedRemovalRoleIds
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)}
            onChange={vals =>
              setRecruitAdvRoles(prev => ({
                ...prev,
                acceptedRemovalRoleIds: vals.join(', '),
              }))
            }
            roles={guildRoles}
          />
          <MultiRolePicker
            label="Roles to Remove on Deny"
            values={recruitAdvRoles.deniedRemovalRoleIds
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)}
            onChange={vals =>
              setRecruitAdvRoles(prev => ({
                ...prev,
                deniedRemovalRoleIds: vals.join(', '),
              }))
            }
            roles={guildRoles}
          />
          <MultiRolePicker
            label="Roles to Remove on Submit"
            values={recruitAdvRoles.removeRolesOnSubmit
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)}
            onChange={vals =>
              setRecruitAdvRoles(prev => ({
                ...prev,
                removeRolesOnSubmit: vals.join(', '),
              }))
            }
            roles={guildRoles}
          />

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
            Per-Status Channels
          </Typography>
          <ChannelPicker
            label="Pending Applications Channel"
            value={recruitAdvRoles.pendingChannelId}
            onChange={v => setRecruitAdvRoles(prev => ({ ...prev, pendingChannelId: v }))}
            channels={textChannels}
            channelType="text"
            helperText="Channel for pending submissions"
          />
          <ChannelPicker
            label="Accepted Applications Channel"
            value={recruitAdvRoles.acceptedChannelId}
            onChange={v => setRecruitAdvRoles(prev => ({ ...prev, acceptedChannelId: v }))}
            channels={textChannels}
            channelType="text"
            helperText="Channel for accepted submissions"
          />
          <ChannelPicker
            label="Denied Applications Channel"
            value={recruitAdvRoles.deniedChannelId}
            onChange={v => setRecruitAdvRoles(prev => ({ ...prev, deniedChannelId: v }))}
            channels={textChannels}
            channelType="text"
            helperText="Channel for denied submissions"
          />

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
            Application Behavior
          </Typography>
          <TextField
            size="small"
            type="number"
            sx={{ maxWidth: 250 }}
            label="Application Time Limit (minutes)"
            value={recruitTimeLimitMinutes}
            onChange={e => setRecruitTimeLimitMinutes(Math.max(0, Number(e.target.value)))}
            helperText="0 = no time limit. Auto-cancel incomplete applications after this."
            slotProps={{ htmlInput: { min: 0, max: 10080 } }}
          />
          <TextField
            size="small"
            fullWidth
            label="Action on Applicant Leave"
            title="Action on Applicant Leave"
            select
            value={recruitActionOnLeave}
            onChange={e => setRecruitActionOnLeave(e.target.value)}
            helperText="What happens to their application if the applicant leaves the server"
            slotProps={{
              select: {
                title: 'Action on Applicant Leave',
                inputProps: {
                  title: 'Action on Applicant Leave',
                  'aria-label': 'Action on Applicant Leave',
                },
              },
            }}
          >
            <MenuItem value="nothing">Do nothing</MenuItem>
            <MenuItem value="withdraw">Withdraw application</MenuItem>
            <MenuItem value="notify">Notify staff</MenuItem>
            <MenuItem value="archive">Archive application</MenuItem>
          </TextField>

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                <LinkIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
                Invite Form Binding
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Require an application form before granting Discord server access
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <MuiSwitch
                  checked={recruitmentSettings.inviteFormEnabled}
                  onChange={e =>
                    setRecruitmentSettings(prev => ({
                      ...prev,
                      inviteFormEnabled: e.target.checked,
                    }))
                  }
                />
              }
              label="Enable"
            />
          </Stack>

          {recruitmentSettings.inviteFormEnabled && (
            <Stack spacing={1}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                Use <strong>/recruitment invite-form</strong> to generate bound invite links.
              </Typography>

              {recruitmentSettings.inviteFormBindingCode && (
                <Box
                  sx={{
                    borderRadius: 1,
                    p: 2,
                    background: alpha(theme.palette.success.main, 0.1),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                  }}
                >
                  <Stack direction="column" spacing={0.5}>
                    <Typography sx={{ fontWeight: 600, color: 'success.main' }}>
                      Active Invite Form
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      Binding Code: {recruitmentSettings.inviteFormBindingCode}
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </Box>

      <Stack direction="row" justifyContent="end">
        <Button
          variant="contained"
          onClick={() => {
            void onSaveRecruitmentSettings();
          }}
          disabled={recruitmentSaving}
        >
          {recruitmentSaving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Save Recruitment Settings
        </Button>
      </Stack>

      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          background: alpha(theme.palette.warning.main, 0.1),
          border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
        }}
      >
        <Stack direction="column" spacing={1}>
          <Typography variant="h4" sx={{ color: 'warning.main' }}>
            <LightbulbOutlinedIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />{' '}
            Discord Bot Commands
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            <strong>/recruitment list</strong> - View open positions
            <br />
            <strong>/recruitment view [id]</strong> - View recruitment details
            <br />
            <strong>/recruitment apply [id]</strong> - Submit an application
            <br />
            <strong>/recruitment my-applications</strong> - View your applications
            <br />
            <strong>/recruitment post [id]</strong> - Post recruitment announcement
            <br />
            <strong>/recruitment panel</strong> - Create application panel
            <br />
            <strong>/recruitment invite-form [id]</strong> - Create bound invite link
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
};

interface TeamVoiceTabContentProps {
  readonly teamVoiceSettings: TeamVoiceSettings;
  readonly setTeamVoiceSettings: React.Dispatch<React.SetStateAction<TeamVoiceSettings>>;
  readonly categoryChannels: DiscordChannelOption[];
  readonly guildRoles: DiscordRoleOption[];
  readonly teamVoiceSaving: boolean;
  readonly onSaveTeamVoiceSettings: () => Promise<void>;
}

const TeamVoiceTabContent: React.FC<Readonly<TeamVoiceTabContentProps>> = ({
  teamVoiceSettings,
  setTeamVoiceSettings,
  categoryChannels,
  guildRoles,
  teamVoiceSaving,
  onSaveTeamVoiceSettings,
}) => {
  const theme = useTheme();

  return (
    <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h6">Team Voice Channels</Typography>
          <Typography variant="body2" color="text.secondary">
            Automatically create a private Discord category with text and voice channels for each
            team. Team members get exclusive access via a managed Discord role.
          </Typography>
          <Divider />

          <FormControlLabel
            control={
              <MuiSwitch
                checked={teamVoiceSettings.enabled}
                onChange={e =>
                  setTeamVoiceSettings(prev => ({ ...prev, enabled: e.target.checked }))
                }
              />
            }
            label="Enable Team Voice Channels"
          />

          {teamVoiceSettings.enabled && (
            <Stack direction="column" spacing={2} sx={{ pl: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Channel Lifecycle
              </Typography>

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={teamVoiceSettings.autoCreateOnTeamCreate ?? true}
                    onChange={e =>
                      setTeamVoiceSettings(prev => ({
                        ...prev,
                        autoCreateOnTeamCreate: e.target.checked,
                      }))
                    }
                  />
                }
                label="Auto-create channels when a team is created"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={teamVoiceSettings.autoDeleteOnTeamDelete ?? true}
                    onChange={e =>
                      setTeamVoiceSettings(prev => ({
                        ...prev,
                        autoDeleteOnTeamDelete: e.target.checked,
                      }))
                    }
                  />
                }
                label="Auto-delete channels when a team is deleted"
              />

              <ChannelPicker
                label="Parent Category"
                value={teamVoiceSettings.parentCategoryId ?? ''}
                onChange={v =>
                  setTeamVoiceSettings(prev => ({
                    ...prev,
                    parentCategoryId: v || undefined,
                  }))
                }
                channels={categoryChannels}
                channelType="category"
                helperText="Optional - leave blank to create at the top level"
              />

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Access &amp; Visibility
              </Typography>

              <RolePicker
                label="Base Access Role"
                value={teamVoiceSettings.baseAccessRoleId ?? ''}
                onChange={v =>
                  setTeamVoiceSettings(prev => ({
                    ...prev,
                    baseAccessRoleId: v || undefined,
                  }))
                }
                roles={guildRoles}
                helperText="Members with this role can see who's in voice but cannot join"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={teamVoiceSettings.allowBaseVisibility ?? false}
                    onChange={e =>
                      setTeamVoiceSettings(prev => ({
                        ...prev,
                        allowBaseVisibility: e.target.checked,
                      }))
                    }
                  />
                }
                label="Allow base role to see who's in voice"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={teamVoiceSettings.allowListenIn ?? false}
                    onChange={e =>
                      setTeamVoiceSettings(prev => ({
                        ...prev,
                        allowListenIn: e.target.checked,
                      }))
                    }
                  />
                }
                label="Allow non-team members to listen in (can't talk)"
              />

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Voice Behavior
              </Typography>

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={teamVoiceSettings.enforcePushToTalk ?? false}
                    onChange={e =>
                      setTeamVoiceSettings(prev => ({
                        ...prev,
                        enforcePushToTalk: e.target.checked,
                      }))
                    }
                  />
                }
                label="Enforce push-to-talk for team members"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={teamVoiceSettings.enablePrioritySpeaker ?? false}
                    onChange={e =>
                      setTeamVoiceSettings(prev => ({
                        ...prev,
                        enablePrioritySpeaker: e.target.checked,
                      }))
                    }
                  />
                }
                label="Enable priority speaker for team leaders &amp; officers"
              />
            </Stack>
          )}
        </Stack>
      </Box>

      <Stack direction="row" justifyContent="end">
        <Button
          variant="contained"
          disabled={teamVoiceSaving}
          onClick={() => {
            void onSaveTeamVoiceSettings();
          }}
        >
          {teamVoiceSaving ? <CircularProgress size={20} /> : 'Save Team Voice Settings'}
        </Button>
      </Stack>

      <Box
        sx={{
          borderRadius: 1,
          p: 2,
          background: alpha(theme.palette.info.main, 0.1),
          border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
        }}
      >
        <Stack direction="column" spacing={1}>
          <Typography
            variant="h4"
            sx={{ color: 'info.main', display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <InfoIcon fontSize="small" /> How Team Voice Works
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            When enabled, each team automatically gets:
            <br />
            <FolderIcon sx={{ fontSize: '0.875rem', verticalAlign: 'middle', mr: 0.5 }} />
            <strong>Category</strong> - Private category named after the team
            <br />
            <ChatIcon sx={{ fontSize: '0.875rem', verticalAlign: 'middle', mr: 0.5 }} />
            <strong>Text Channel</strong> - Team-only text chat
            <br />
            <VolumeUpIcon sx={{ fontSize: '0.875rem', verticalAlign: 'middle', mr: 0.5 }} />
            <strong>Voice Channel</strong> - Team-only voice with configurable access
            <br />
            <LocalOfferIcon sx={{ fontSize: '0.875rem', verticalAlign: 'middle', mr: 0.5 }} />
            <strong>Discord Role</strong> - Auto-assigned to team members for access control
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
};

interface RoleSyncTabContentProps {
  readonly roleSyncSettings: RoleSyncSettingsState;
  readonly setRoleSyncSettings: React.Dispatch<React.SetStateAction<RoleSyncSettingsState>>;
  readonly guildRoles: DiscordRoleOption[];
  readonly textChannels: DiscordChannelOption[];
  readonly assistantRoleIds: string[];
  readonly setAssistantRoleIds: React.Dispatch<React.SetStateAction<string[]>>;
  readonly roleSyncSaving: boolean;
  readonly onSaveRoleSyncSettings: () => Promise<void>;
}

const RoleSyncTabContent: React.FC<Readonly<RoleSyncTabContentProps>> = ({
  roleSyncSettings,
  setRoleSyncSettings,
  guildRoles,
  textChannels,
  assistantRoleIds,
  setAssistantRoleIds,
  roleSyncSaving,
  onSaveRoleSyncSettings,
}) => {
  return (
    <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
      <Box sx={{ borderRadius: 1, p: 2 }}>
        <Stack direction="column" spacing={2}>
          <Typography variant="h6">Role Synchronization</Typography>
          <Typography variant="body2" color="text.secondary">
            Synchronize Discord roles with your organization's RSI ranks. Use the{' '}
            <strong>/verify</strong> bot command for interactive setup, or configure here.
          </Typography>
          <Divider />

          <FormControlLabel
            control={
              <MuiSwitch
                checked={roleSyncSettings.enabled}
                onChange={e =>
                  setRoleSyncSettings(prev => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
              />
            }
            label="Enable Role Sync"
          />

          {roleSyncSettings.enabled && (
            <Stack direction="column" spacing={2} sx={{ pl: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Sync Behavior
              </Typography>

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={roleSyncSettings.syncRolesFromApi}
                    onChange={e =>
                      setRoleSyncSettings(prev => ({
                        ...prev,
                        syncRolesFromApi: e.target.checked,
                      }))
                    }
                  />
                }
                label="Sync roles from RSI API"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={roleSyncSettings.autoRoleManagement}
                    onChange={e =>
                      setRoleSyncSettings(prev => ({
                        ...prev,
                        autoRoleManagement: e.target.checked,
                      }))
                    }
                  />
                }
                label="Auto-assign and revoke roles on sync"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={roleSyncSettings.removeRolesOnLeave}
                    onChange={e =>
                      setRoleSyncSettings(prev => ({
                        ...prev,
                        removeRolesOnLeave: e.target.checked,
                      }))
                    }
                  />
                }
                label="Remove synced roles when member leaves the org"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={roleSyncSettings.syncOnBotJoin}
                    onChange={e =>
                      setRoleSyncSettings(prev => ({
                        ...prev,
                        syncOnBotJoin: e.target.checked,
                      }))
                    }
                  />
                }
                label="Run sync when bot joins the server"
              />

              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={roleSyncSettings.requireManualApproval}
                    onChange={e =>
                      setRoleSyncSettings(prev => ({
                        ...prev,
                        requireManualApproval: e.target.checked,
                      }))
                    }
                  />
                }
                label="Require manual approval before assigning roles"
              />

              <TextField
                label="Sync Interval (minutes)"
                type="number"
                size="small"
                sx={{ maxWidth: 200 }}
                value={roleSyncSettings.syncIntervalMinutes}
                onChange={e =>
                  setRoleSyncSettings(prev => ({
                    ...prev,
                    syncIntervalMinutes: Math.max(
                      15,
                      Math.min(1440, Number(e.target.value) || 360)
                    ),
                  }))
                }
                helperText="How often to auto-sync (15-1440 min)"
                slotProps={{ htmlInput: { min: 15, max: 1440 } }}
              />

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Roles
              </Typography>

              <RolePicker
                label="Verified Role"
                value={roleSyncSettings.verifiedRoleId}
                onChange={v => setRoleSyncSettings(prev => ({ ...prev, verifiedRoleId: v }))}
                roles={guildRoles}
                helperText="Auto-assigned when a member completes RSI verification"
              />

              {roleSyncSettings.requireManualApproval && (
                <RolePicker
                  label="Approval Role"
                  value={roleSyncSettings.approvalRoleId}
                  onChange={v => setRoleSyncSettings(prev => ({ ...prev, approvalRoleId: v }))}
                  roles={guildRoles}
                  helperText="Discord role that can approve role assignments"
                />
              )}

              <ChannelPicker
                label="Sync Error Notification Channel"
                value={roleSyncSettings.syncErrorNotificationChannelId}
                onChange={v =>
                  setRoleSyncSettings(prev => ({
                    ...prev,
                    syncErrorNotificationChannelId: v,
                  }))
                }
                channels={textChannels}
                channelType="text"
                helperText="Channel to post sync error alerts"
              />

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Role Mappings
              </Typography>

              <TextField
                label="Role Mappings"
                placeholder="OrgRank=DiscordRoleId, Officer=123456789, Member=987654321"
                size="small"
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                value={roleSyncSettings.roleMappings}
                onChange={e =>
                  setRoleSyncSettings(prev => ({
                    ...prev,
                    roleMappings: e.target.value,
                  }))
                }
                helperText="Map org ranks to Discord role IDs. Format: RankName=RoleID, separated by commas"
              />
            </Stack>
          )}

          <Divider />

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Permission Roles
          </Typography>
          <MultiRolePicker
            label="Assistant Role IDs"
            values={assistantRoleIds}
            onChange={setAssistantRoleIds}
            roles={guildRoles}
            helperText="Assistants can create events and activities but cannot edit others' or change server settings"
          />

          <Divider />

          <Button
            variant="contained"
            onClick={() => {
              void onSaveRoleSyncSettings();
            }}
            disabled={roleSyncSaving}
            startIcon={roleSyncSaving ? <CircularProgress size={16} /> : <SyncIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            {roleSyncSaving ? 'Saving...' : 'Save Role Sync Settings'}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
};

interface TabPanelProps {
  readonly selectedTab: string;
  readonly tab: string;
  readonly children: React.ReactNode;
}

const TabPanel: React.FC<Readonly<TabPanelProps>> = ({ selectedTab, tab, children }) => {
  if (selectedTab !== tab) {
    return null;
  }

  return <>{children}</>;
};

const DiscordSettingsPage: React.FC = () => {
  // NOSONAR: legacy orchestrator, incremental decomposition in progress.
  // NOSONAR: legacy orchestrator, incremental decomposition in progress.
  const notification = useNotification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<DiscordSettings | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('voice');

  // Track whether initial hydration from server data has been completed.
  // After initial hydration, subsequent guildSettingsData changes (e.g. from
  // invalidation after a save) should NOT overwrite unsaved form state on
  // other tabs. Each tab's save handler already calls invalidateGuildSettings
  // which re-fetches — but that should only apply to the tab that was just saved.
  const initialHydrationDone = useRef(false);
  // Track the previous guildId to detect when we switch guilds (need re-hydration).
  const lastHydratedGuildId = useRef<string | undefined>(undefined);

  // Form states for voice config
  const [voiceConfig, setVoiceConfig] = useState<VoiceChannelConfig | null>(null);

  // Ticketing integration settings (matches backend TicketSettings model)
  const [ticketSettings, setTicketSettings] = useState<TicketSettingsState>({
    enabled: false,
    defaultCategoryId: '',
    transcriptChannelId: '',
    supportRoleId: '',
    escalationRoleId: '',
    formChannelId: '',
    autoCloseHours: 72,
    maxOpenTicketsPerUser: 2,
    mentionSupportRoleOnCreate: true,
    notifyOnClose: true,
    allowMemberClose: true,
  });

  // Recruitment integration settings
  const [recruitmentSettings, setRecruitmentSettings] = useState<RecruitmentSettingsState>({
    enabled: true,
    applicationChannelId: '',
    approvedRoleId: '',
    pendingRoleId: '',
    requireDiscordVerification: true,
    autoAssignRole: true,
    welcomeMessage: 'Welcome to the organization! Your application has been approved.',
    inviteFormEnabled: false,
    inviteFormBindingCode: '',
    discordInviteUrl: '',
    autoResolveOnRoleChange: true,
  });
  const [recruitmentSaving, setRecruitmentSaving] = useState(false);

  // Form states for new tunnel
  const [newTunnelName, setNewTunnelName] = useState('');
  const [newTunnelChannelId, setNewTunnelChannelId] = useState('');
  const [newTunnelPublic, setNewTunnelPublic] = useState(true);
  const [newTunnelPassword, setNewTunnelPassword] = useState('');
  const [newTunnelContentFilter, setNewTunnelContentFilter] = useState(true);

  // Edit tunnel dialog state
  const [editingTunnel, setEditingTunnel] = useState<Tunnel | null>(null);
  const [editTunnelName, setEditTunnelName] = useState('');
  const [editTunnelContentFilter, setEditTunnelContentFilter] = useState(true);
  const [editTunnelAllowBotMessages, setEditTunnelAllowBotMessages] = useState(true);
  const [editTunnelMaxServers, setEditTunnelMaxServers] = useState(0);

  // Team voice settings state
  const [teamVoiceSettings, setTeamVoiceSettings] = useState<TeamVoiceSettings>({
    enabled: false,
    allowBaseVisibility: false,
    allowListenIn: false,
    enforcePushToTalk: false,
    enablePrioritySpeaker: false,
    autoCreateOnTeamCreate: true,
    autoDeleteOnTeamDelete: true,
  });
  const [teamVoiceSaving, setTeamVoiceSaving] = useState(false);

  // Ticketing save state
  const [ticketingSaving, setTicketingSaving] = useState(false);

  // LFG settings state
  const [lfgSettings, setLfgSettings] = useState<LfgSettingsPayload>({
    lfgChannelId: '',
    autoPostEnabled: true,
    autoLfgVoiceChannelScope: 'all',
    autoLfgAllowedVoiceChannelIds: [],
    smartPingEnabled: true,
    pingCooldownMinutes: 30,
    crossOrgEnabled: false,
    crossOrgAllowList: [],
    crossOrgBlockList: [],
    crossOrgManualAllowTags: [],
    crossOrgManualBlockTags: [],
  });
  const [lfgSaving, setLfgSaving] = useState(false);

  // Event settings state
  const [eventSettings, setEventSettings] = useState({
    eventAnnouncementChannelId: '',
    eventNotificationRoleId: '',
    eventNotificationRoleIds: [] as string[],
    enableEventMentions: true,
    autoDeleteEventMessages: false,
    eventMessageRetentionDays: 30,
    allowEventRsvp: true,
    remindersEnabled: true,
    reminderHoursBefore: [24, 1] as number[],
    eventCreationRoleId: '',
    maxMirrorsPerActivity: 5,
    tempRolesEnabled: false,
    tempRoleColor: 0x3498db,
    createDiscordEvent: false,
    eventVoiceCategoryId: '',
    cleanupMode: 'afterEnd' as 'afterEnd' | 'afterComplete',
    cleanupHoursAfterEnd: 48,
    createEventThread: false,
    autoPublishAnnouncements: false,
  });
  const [eventsSaving, setEventsSaving] = useState(false);
  const [newReminderHour, setNewReminderHour] = useState('');
  const [serverTimezone, setServerTimezone] = useState('');
  const serverTimezoneOptions = React.useMemo(() => {
    const normalizedServerTimezone = serverTimezone.trim();
    const intlWithSupportedValuesOf = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    };
    const discoveredTimezones =
      typeof intlWithSupportedValuesOf.supportedValuesOf === 'function'
        ? intlWithSupportedValuesOf.supportedValuesOf('timeZone')
        : [];

    const timezoneSet = new Set<string>([...COMMON_SERVER_TIMEZONES, ...discoveredTimezones]);
    if (normalizedServerTimezone) {
      timezoneSet.add(normalizedServerTimezone);
    }

    const commonSet = new Set<string>(COMMON_SERVER_TIMEZONES);
    const sortedAll = Array.from(timezoneSet).sort((a, b) => a.localeCompare(b));
    const commonFirst = COMMON_SERVER_TIMEZONES.filter(timezone => timezoneSet.has(timezone));
    const remaining = sortedAll.filter(timezone => !commonSet.has(timezone));

    return [...commonFirst, ...remaining];
  }, [serverTimezone]);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    announcementChannelId: '',
    pinnedAnnouncementChannelId: '',
    memberJoinNotifications: false,
    memberLeaveNotifications: false,
    roleChangeNotifications: false,
    eventNotifications: true,
    systemAlertChannelId: '',
    moderationAlertChannelId: '',
    auditLogChannelId: '',
    enableMentionRolesToNotify: false,
    notificationMentionRoles: '',
    autoPublishAnnouncements: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // Role sync settings state
  const [roleSyncSettings, setRoleSyncSettings] = useState<RoleSyncSettingsState>({
    enabled: false,
    syncRolesFromApi: true,
    autoRoleManagement: false,
    removeRolesOnLeave: true,
    syncIntervalMinutes: 360,
    syncOnBotJoin: true,
    requireManualApproval: false,
    approvalRoleId: '',
    syncErrorNotificationChannelId: '',
    verifiedRoleId: '',
    roleMappings: '',
  });
  const [roleSyncSaving, setRoleSyncSaving] = useState(false);

  // Cross-moderation settings state
  const [crossModSettings, setCrossModSettings] = useState({
    enabled: false,
    sharedBanListEnabled: true,
    sharedMuteListEnabled: false,
    autoBanOnSharedList: false,
    propagateTimeouts: false,
    forwardModerationAlerts: true,
    notifyOnSharedAction: true,
    banAppealsChannelId: '',
    crossGuildAuditLogChannelId: '',
    escalationRoleId: '',
    allowedGuildIds: '',
  });
  const [crossModSaving, setCrossModSaving] = useState(false);

  // Personal user notification preferences
  const [userPrefs, setUserPrefs] = useState<UserDiscordPreferences>({
    dmEnabled: true,
    lfgPingOptIn: true,
    eventReminderOptIn: true,
    ticketDmOptIn: true,
    recruitmentDmOptIn: true,
    moderationAlertOptIn: true,
    timezone: '',
  });
  const [userPrefsSaving, setUserPrefsSaving] = useState(false);

  // Welcome settings state
  const [welcomeSettings, setWelcomeSettings] = useState({
    welcomeEnabled: false,
    welcomeChannelId: '',
    welcomeMessage: 'Welcome to **{server}**, {user}! You are member #{memberCount}.',
    goodbyeEnabled: false,
    goodbyeChannelId: '',
    goodbyeMessage: '{username} has left **{server}**. We now have {memberCount} members.',
    autoRoleIds: '',
    welcomeDmEnabled: false,
    welcomeDmMessage: 'Welcome to **{server}**! We are glad to have you.',
  });
  const [welcomeSaving, setWelcomeSaving] = useState(false);

  // Audit log settings state
  const [auditLogSettings, setAuditLogSettings] = useState({
    enabled: false,
    logChannelId: '',
    logMessageEdits: true,
    logMessageDeletes: true,
    logRoleChanges: true,
    logChannelChanges: false,
    logMemberJoinLeave: true,
    ignoredChannelIds: '',
  });
  const [auditLogSaving, setAuditLogSaving] = useState(false);

  // RSI status panel/channel state
  const [rsiStatusConfig, setRsiStatusConfig] = useState<RsiStatusConfiguration | null>(null);
  const [rsiStatusLoading, setRsiStatusLoading] = useState(false);
  const [rsiStatusSaving, setRsiStatusSaving] = useState(false);
  const [rsiPanelChannelId, setRsiPanelChannelId] = useState('');
  const [rsiApplicationChannelId, setRsiApplicationChannelId] = useState('');
  const [rsiServerChannelId, setRsiServerChannelId] = useState('');

  // Quick responses state
  const [quickResponses, setQuickResponses] = useState<QuickResponseItem[]>([]);
  const [quickResponseCategories, setQuickResponseCategories] = useState<
    QuickResponseCategoryItem[]
  >([]);
  const [newQrName, setNewQrName] = useState('');
  const [newQrContent, setNewQrContent] = useState('');
  const [newQrCategoryId, setNewQrCategoryId] = useState('');
  const [newQrCatName, setNewQrCatName] = useState('');

  // Recruitment custom messages state
  const [recruitDeniedMessage, setRecruitDeniedMessage] = useState(
    'Your application for "{application}" has been denied by {reviewer}.'
  );
  const [recruitConfirmationMessage, setRecruitConfirmationMessage] = useState(
    'Are you sure you want to apply?'
  );
  const [recruitCompletionMessage, setRecruitCompletionMessage] = useState(
    'Your application has been submitted.'
  );

  // Advanced recruitment role/channel state
  const [recruitAdvRoles, setRecruitAdvRoles] = useState<RecruitAdvancedRolesState>({
    restrictedRoleIds: '',
    requiredRoleIds: '',
    requiredRoleMatchMode: 'any' as 'any' | 'all',
    acceptedRemovalRoleIds: '',
    deniedRemovalRoleIds: '',
    removeRolesOnSubmit: '',
    acceptedChannelId: '',
    deniedChannelId: '',
    pendingChannelId: '',
  });

  // Ticket access control state
  const [ticketAccessControl, setTicketAccessControl] = useState<TicketAccessControlState>({
    blockedRoleIds: '',
    requiredRoleIds: '',
    roleMatchMode: 'any' as 'any' | 'all',
  });

  // Ticket extras state
  const [ticketRateSupportEnabled, setTicketRateSupportEnabled] = useState(false);
  const [ticketChannelNameTemplate, setTicketChannelNameTemplate] = useState('ticket-{count}');

  // Event extras state
  const [eventArchiveChannelId, setEventArchiveChannelId] = useState('');
  const [eventArchiveAfterHours, setEventArchiveAfterHours] = useState(24);
  const [eventAllowedRoleIds, setEventAllowedRoleIds] = useState('');
  const [eventBannedRoleIds, setEventBannedRoleIds] = useState('');

  // Sprint F state
  const [recruitTimeLimitMinutes, setRecruitTimeLimitMinutes] = useState(0);
  const [recruitActionOnLeave, setRecruitActionOnLeave] = useState<string>('nothing');
  const [assistantRoleIds, setAssistantRoleIds] = useState<string[]>([]);

  // Voice config save state
  const [voiceSaving, setVoiceSaving] = useState(false);

  // Access control state
  const [adminUserIds, setAdminUserIds] = useState<string[]>([]);
  const [serverManagerRoleIds, setServerManagerRoleIds] = useState<string[]>([]);
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [newServerManagerRoleId, setNewServerManagerRoleId] = useState('');
  const [accessControlSaving, setAccessControlSaving] = useState(false);

  // Form states for new template
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateUserLimit, setNewTemplateUserLimit] = useState(10);
  const [newTemplateNameTemplate, setNewTemplateNameTemplate] = useState("{user}'s Channel");
  const [newTemplateAutoDelete, setNewTemplateAutoDelete] = useState(true);
  const [isCreateTemplateDialogOpen, setIsCreateTemplateDialogOpen] = useState(false);

  const theme = useTheme();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const organizationId = user?.activeOrgId ?? user?.organizationId ?? '';

  // Handle bot invite callback query params
  const [botConnectSuccess, setBotConnectSuccess] = useState(false);
  const [botConnectError, setBotConnectError] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get('bot_connected');
    const botError = searchParams.get('bot_error');

    if (connected === 'true') {
      setBotConnectSuccess(true);
      // Clean up query params
      searchParams.delete('bot_connected');
      searchParams.delete('guild_id');
      setSearchParams(searchParams, { replace: true });
    } else if (botError) {
      const errorMessages: Record<string, string> = {
        oauth_denied: 'Bot authorization was cancelled or denied.',
        missing_params: 'Discord did not return the expected server information.',
        invalid_state: 'Security validation failed. Please try again.',
        state_expired: 'The authorization link expired. Please try again.',
        connection_failed: 'Failed to connect the server. Please try again or link manually below.',
      };
      setBotConnectError(errorMessages[botError] || 'An unexpected error occurred.');
      searchParams.delete('bot_error');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: read query params once on page load
  }, []);

  // Discord guild connection state
  const { data: connectedGuilds = [], isLoading: guildsLoading } = useDiscordGuilds(
    organizationId || undefined
  );
  const connectGuild = useConnectDiscordGuild(organizationId || undefined);
  const [manualGuildId, setManualGuildId] = useState('');
  const [manualGuildName, setManualGuildName] = useState('');
  const [showManualConnect, setShowManualConnect] = useState(false);

  const isConnected = connectedGuilds.length > 0;
  const primaryGuildId = connectedGuilds[0]?.guildId;

  // Check if the current user is a member of the Discord guild
  const { data: myMembership } = useMyGuildMembership(primaryGuildId);

  // Fetch guild settings via React Query — auto-refetch on mount, focus, org/guild change
  const {
    data: guildSettingsData,
    isLoading: guildSettingsLoading,
    error: _guildSettingsError,
  } = useGuildSettings(organizationId || undefined, primaryGuildId);
  const invalidateGuildSettings = useInvalidateGuildSettings(
    organizationId || undefined,
    primaryGuildId
  );

  // Fetch real Discord roles and channels for dropdown population
  const { data: guildRoles = [] } = useDiscordGuildRoles(primaryGuildId);
  const { data: guildChannels = [] } = useDiscordGuildChannels(primaryGuildId);

  // Filter channels by type for dropdowns (0=text, 2=voice, 4=category, 5=announcement)
  const textChannels = guildChannels.filter(ch => ch.type === 0 || ch.type === 5);
  const voiceChannels = guildChannels.filter(ch => ch.type === 2);
  const categoryChannels = guildChannels.filter(ch => ch.type === 4);

  const applyRsiStatusConfiguration = (config: RsiStatusConfiguration) => {
    setRsiStatusConfig(config);
    setRsiPanelChannelId(config.panel?.channelId ?? '');
    setRsiApplicationChannelId(config.channels.application?.channelId ?? '');
    setRsiServerChannelId(config.channels.server?.channelId ?? '');
  };

  const loadRsiStatusConfiguration = async (guildId: string) => {
    if (!organizationId) {
      return;
    }

    try {
      setRsiStatusLoading(true);
      const config = await discordService.getRsiStatusConfiguration(organizationId, guildId);
      applyRsiStatusConfiguration(config);
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to load RSI status channel settings'
      );
    } finally {
      setRsiStatusLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && primaryGuildId) {
      loadTunnels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadTunnels is stable per render; deps drive when to re-fetch
  }, [isConnected, primaryGuildId]);

  useEffect(() => {
    if (!organizationId || !primaryGuildId || !isConnected) {
      setRsiStatusConfig(null);
      setRsiPanelChannelId('');
      setRsiApplicationChannelId('');
      setRsiServerChannelId('');
      return;
    }

    void loadRsiStatusConfiguration(primaryGuildId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load helper intentionally captures latest state
  }, [organizationId, primaryGuildId, isConnected]);

  /**
   * Hydrate per-tab form state whenever the React Query guild settings data changes.
   * This replaces the old imperative hydrateGuildSettings() async function.
   *
   * After the initial hydration for a guild, subsequent data updates (e.g. from
   * cache invalidation after a single tab's save) are NOT re-applied to prevent
   * overwriting unsaved edits on other tabs. A full re-hydration only triggers
   * when the connected guild changes (different primaryGuildId).
   */
  useEffect(() => {
    if (!guildSettingsData || !primaryGuildId) return;

    // Skip re-hydration if we already hydrated this guild and the guildId hasn't
    // changed. This prevents save → invalidate → refetch from blowing away
    // unsaved form state on tabs the user hasn't saved yet.
    if (initialHydrationDone.current && lastHydratedGuildId.current === primaryGuildId) {
      return;
    }

    initialHydrationDone.current = true;
    lastHydratedGuildId.current = primaryGuildId;

    const guildData = guildSettingsData;

    // Team voice — always apply (use defaults if DB returned null)
    const savedTeamVoice = guildData.teamVoiceSettings;
    setTeamVoiceSettings(prev => savedTeamVoice ?? prev);

    // Recruitment — always apply (use defaults if DB returned null)
    const savedRecruitment = guildData.recruitmentSettings;
    setRecruitmentSettings(prev => ({
      ...prev,
      enabled: savedRecruitment?.enabled ?? prev.enabled,
      applicationChannelId: savedRecruitment?.applicationChannelId ?? prev.applicationChannelId,
      approvedRoleId: savedRecruitment?.acceptRoleId ?? prev.approvedRoleId,
      pendingRoleId: savedRecruitment?.pendingRoleId ?? prev.pendingRoleId,
      requireDiscordVerification:
        savedRecruitment?.requireDiscordVerification ?? prev.requireDiscordVerification,
      autoAssignRole: savedRecruitment?.autoAssignRole ?? prev.autoAssignRole,
      welcomeMessage: savedRecruitment?.welcomeMessage ?? prev.welcomeMessage,
      inviteFormEnabled: savedRecruitment?.inviteFormEnabled ?? prev.inviteFormEnabled,
      inviteFormBindingCode: savedRecruitment?.inviteFormBindingCode ?? prev.inviteFormBindingCode,
      discordInviteUrl: savedRecruitment?.discordInviteUrl ?? '',
      autoResolveOnRoleChange: savedRecruitment?.autoResolveOnRoleChange ?? true,
    }));

    // Recruitment embed messages
    setRecruitDeniedMessage((savedRecruitment?.deniedMessage as string) ?? recruitDeniedMessage);
    setRecruitConfirmationMessage(
      (savedRecruitment?.confirmationMessage as string) ?? recruitConfirmationMessage
    );
    setRecruitCompletionMessage(
      (savedRecruitment?.completionMessage as string) ?? recruitCompletionMessage
    );

    // Recruitment extras
    setRecruitTimeLimitMinutes((savedRecruitment?.applicationTimeLimitMinutes as number) ?? 0);
    setRecruitActionOnLeave((savedRecruitment?.actionOnApplicantLeave as string) ?? 'nothing');

    // Advanced recruitment roles/channels
    setRecruitAdvRoles(prev => ({
      ...prev,
      restrictedRoleIds: ((savedRecruitment?.restrictedRoleIds as string[]) ?? []).join(', '),
      requiredRoleIds: ((savedRecruitment?.requiredRoleIds as string[]) ?? []).join(', '),
      requiredRoleMatchMode:
        (savedRecruitment?.requiredRoleMatchMode as 'any' | 'all') ?? prev.requiredRoleMatchMode,
      acceptedRemovalRoleIds: ((savedRecruitment?.acceptedRemovalRoleIds as string[]) ?? []).join(
        ', '
      ),
      deniedRemovalRoleIds: ((savedRecruitment?.deniedRemovalRoleIds as string[]) ?? []).join(', '),
      removeRolesOnSubmit: ((savedRecruitment?.removeRolesOnSubmit as string[]) ?? []).join(', '),
      acceptedChannelId: (savedRecruitment?.acceptedChannelId as string) ?? '',
      deniedChannelId: (savedRecruitment?.deniedChannelId as string) ?? '',
      pendingChannelId: (savedRecruitment?.pendingChannelId as string) ?? '',
    }));

    // Ticketing
    const savedTicket = guildData.ticketSettings;
    if (savedTicket) {
      setTicketSettings(prev => ({
        ...prev,
        enabled: savedTicket.enabled ?? prev.enabled,
        defaultCategoryId: savedTicket.defaultCategoryId ?? prev.defaultCategoryId,
        transcriptChannelId: savedTicket.transcriptChannelId ?? prev.transcriptChannelId,
        supportRoleId: savedTicket.supportRoleId ?? prev.supportRoleId,
        escalationRoleId: savedTicket.escalationRoleId ?? prev.escalationRoleId,
        formChannelId: savedTicket.formChannelId ?? prev.formChannelId,
        autoCloseHours: savedTicket.autoCloseHours ?? prev.autoCloseHours,
        maxOpenTicketsPerUser: savedTicket.maxOpenTicketsPerUser ?? prev.maxOpenTicketsPerUser,
        mentionSupportRoleOnCreate:
          savedTicket.mentionSupportRoleOnCreate ?? prev.mentionSupportRoleOnCreate,
        notifyOnClose: savedTicket.notifyOnClose ?? prev.notifyOnClose,
        allowMemberClose: savedTicket.allowMemberClose ?? prev.allowMemberClose,
      }));

      // Quick responses hydration
      setQuickResponses((savedTicket.quickResponses as QuickResponseItem[]) ?? []);
      setQuickResponseCategories(
        (savedTicket.quickResponseCategories as QuickResponseCategoryItem[]) ?? []
      );

      // Ticket access control hydration
      setTicketAccessControl(prev => ({
        ...prev,
        blockedRoleIds: ((savedTicket.blockedRoleIds as string[]) ?? []).join(', '),
        requiredRoleIds: ((savedTicket.requiredRoleIds as string[]) ?? []).join(', '),
        roleMatchMode: (savedTicket.roleMatchMode as 'any' | 'all') ?? prev.roleMatchMode,
      }));

      // Ticket extras hydration
      setTicketRateSupportEnabled((savedTicket.rateSupportEnabled as boolean) ?? false);
      setTicketChannelNameTemplate((savedTicket.channelNameTemplate as string) ?? 'ticket-{count}');
    }

    // Voice channels
    const savedVoice = guildData.voiceChannelSettings;
    if (savedVoice) {
      setVoiceConfig(prev => ({
        guildId: primaryGuildId,
        nameTemplate:
          (savedVoice.channelNameTemplate as string) ?? prev?.nameTemplate ?? "{user}'s Channel",
        hubChannelId: (savedVoice.hubChannelId as string) ?? prev?.hubChannelId,
        hubChannelIds: (savedVoice.hubChannelIds as string[]) ?? prev?.hubChannelIds ?? [],
        autoCreateChannels:
          (savedVoice.autoCreateChannels as boolean) ?? prev?.autoCreateChannels ?? false,
        defaultUserLimit: (savedVoice.defaultUserLimit as number) ?? prev?.defaultUserLimit ?? 0,
        bitrate: (savedVoice.bitrate as number) ?? prev?.bitrate ?? 64000,
        categoryId: (savedVoice.parentCategoryId as string) ?? prev?.categoryId,
        autoDeleteEmpty:
          (savedVoice.autoDeleteEmptyChannels as boolean) ?? prev?.autoDeleteEmpty ?? true,
        deleteEmptyChannelDelaySeconds:
          (savedVoice.deleteEmptyChannelDelaySeconds as number) ??
          prev?.deleteEmptyChannelDelaySeconds ??
          3,
        allowRename: (savedVoice.userCanRename as boolean) ?? prev?.allowRename ?? true,
        allowUserLimit: (savedVoice.allowUserLimit as boolean) ?? prev?.allowUserLimit ?? true,
      }));

      // Hydrate voice templates from guild settings
      const savedTemplates = savedVoice.templates as
        | Array<{
            id: string;
            name: string;
            description?: string;
            userLimit?: number;
            bitrate?: number;
            nameTemplate?: string;
            autoDelete?: boolean;
            createdBy?: string;
            createdAt?: string;
          }>
        | undefined;
      if (savedTemplates && savedTemplates.length > 0) {
        setSettings(prev =>
          prev
            ? {
                ...prev,
                voiceTemplates: savedTemplates.map(t => ({
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  userLimit: t.userLimit,
                  bitrate: t.bitrate,
                  nameTemplate: t.nameTemplate ?? "{user}'s Channel",
                  autoDelete: t.autoDelete ?? true,
                  createdBy: t.createdBy ?? '',
                  createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
                })),
              }
            : prev
        );
      }
    } else {
      // Ensure voice config is initialized with defaults
      setVoiceConfig(
        prev =>
          prev ?? {
            guildId: primaryGuildId,
            nameTemplate: "{user}'s Channel",
            hubChannelId: undefined,
            hubChannelIds: [],
            autoCreateChannels: false,
            defaultUserLimit: 0,
            bitrate: 64000,
            autoDeleteEmpty: true,
            deleteEmptyChannelDelaySeconds: 3,
            allowRename: true,
            allowUserLimit: true,
          }
      );
    }

    // LFG — always apply (use defaults if DB returned null)
    const savedLfg = guildData.lfgNetworkSettings;
    const savedSmartPing = guildData.smartLfgPingSettings;
    const savedLfgGame = guildData.lfgSettings;
    setLfgSettings(prev => ({
      ...prev,
      lfgChannelId: (savedLfg?.lfgChannelId as string) ?? prev.lfgChannelId,
      autoPostEnabled: (savedLfg?.autoPostEnabled as boolean) ?? prev.autoPostEnabled,
      autoLfgVoiceChannelScope:
        (savedLfg?.autoLfgVoiceChannelScope as 'all' | 'selected') ?? prev.autoLfgVoiceChannelScope,
      autoLfgAllowedVoiceChannelIds:
        (savedLfg?.autoLfgAllowedVoiceChannelIds as string[]) ?? prev.autoLfgAllowedVoiceChannelIds,
      crossOrgEnabled: (savedLfg?.crossOrgEnabled as boolean) ?? prev.crossOrgEnabled,
      crossOrgAllowList: (savedLfg?.crossOrgAllowList as string[]) ?? prev.crossOrgAllowList,
      crossOrgBlockList: (savedLfg?.crossOrgBlockList as string[]) ?? prev.crossOrgBlockList,
      crossOrgManualAllowTags:
        (savedLfg?.crossOrgManualAllowTags as string[]) ?? prev.crossOrgManualAllowTags,
      crossOrgManualBlockTags:
        (savedLfg?.crossOrgManualBlockTags as string[]) ?? prev.crossOrgManualBlockTags,
      region: (savedLfg?.region as string) ?? prev.region,
      language: (savedLfg?.language as string) ?? prev.language,
      smartPingEnabled: (savedSmartPing?.enabled as boolean) ?? prev.smartPingEnabled,
      pingCooldownMinutes: savedSmartPing?.cooldownHours
        ? (savedSmartPing.cooldownHours as number) * 60
        : prev.pingCooldownMinutes,
      defaultGame: (savedLfgGame?.defaultGame as string) ?? prev.defaultGame,
      gameFilters: savedLfgGame?.gameFilters
        ? (savedLfgGame.gameFilters as string[]).join(', ')
        : prev.gameFilters,
      otherGamesChannelId:
        (savedLfgGame?.otherGamesChannelId as string) ?? prev.otherGamesChannelId,
      publicLfgEnabled: (savedLfgGame?.publicLfgEnabled as boolean) ?? prev.publicLfgEnabled,
      publicLfgDelivery:
        (savedLfgGame?.publicLfgDelivery as 'dm' | 'channel') ?? prev.publicLfgDelivery,
      publicLfgChannelId: (savedLfgGame?.publicLfgChannelId as string) ?? prev.publicLfgChannelId,
      publicLfgOptInRoleId:
        (savedLfgGame?.publicLfgOptInRoleId as string) ?? prev.publicLfgOptInRoleId,
      lfgMentionRoleId: (savedLfgGame?.lfgMentionRoleId as string) ?? prev.lfgMentionRoleId,
    }));

    // LFG role filter mappings
    const roleFilters = (savedLfg?.roleFilterMappings as Record<string, string>) ?? {};
    const roleFilterStr = Object.entries(roleFilters)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    setLfgSettings(prev => ({ ...prev, roleFilterMappings: roleFilterStr }));

    // Server timezone
    setServerTimezone((guildData.timezone as string) ?? '');

    // Assistant roles
    setAssistantRoleIds((guildData.assistantRoleIds as string[]) ?? []);

    // Access control
    setAdminUserIds((guildData.adminUserIds as string[]) ?? []);
    setServerManagerRoleIds((guildData.serverManagerRoleIds as string[]) ?? []);

    // Events — always apply (use defaults if DB returned null)
    const savedEvents = guildData.eventSettings;
    setEventSettings(prev => ({
      ...prev,
      eventAnnouncementChannelId:
        (savedEvents?.eventAnnouncementChannelId as string) ?? prev.eventAnnouncementChannelId,
      eventNotificationRoleId:
        (savedEvents?.eventNotificationRoleId as string) ?? prev.eventNotificationRoleId,
      eventNotificationRoleIds:
        (savedEvents?.eventNotificationRoleIds as string[]) ?? prev.eventNotificationRoleIds,
      enableEventMentions:
        (savedEvents?.enableEventMentions as boolean) ?? prev.enableEventMentions,
      autoDeleteEventMessages:
        (savedEvents?.autoDeleteEventMessages as boolean) ?? prev.autoDeleteEventMessages,
      eventMessageRetentionDays:
        (savedEvents?.eventMessageRetentionDays as number) ?? prev.eventMessageRetentionDays,
      allowEventRsvp: (savedEvents?.allowEventRsvp as boolean) ?? prev.allowEventRsvp,
      remindersEnabled: (savedEvents?.remindersEnabled as boolean) ?? prev.remindersEnabled,
      reminderHoursBefore:
        (savedEvents?.reminderHoursBefore as number[]) ?? prev.reminderHoursBefore,
      eventCreationRoleId: (savedEvents?.eventCreationRoleId as string) ?? prev.eventCreationRoleId,
      maxMirrorsPerActivity:
        (savedEvents?.maxMirrorsPerActivity as number) ?? prev.maxMirrorsPerActivity,
      tempRolesEnabled: (savedEvents?.tempRolesEnabled as boolean) ?? prev.tempRolesEnabled,
      tempRoleColor: (savedEvents?.tempRoleColor as number) ?? prev.tempRoleColor,
      createDiscordEvent: (savedEvents?.createDiscordEvent as boolean) ?? prev.createDiscordEvent,
      eventVoiceCategoryId:
        (savedEvents?.eventVoiceCategoryId as string) ?? prev.eventVoiceCategoryId,
      cleanupMode: (savedEvents?.cleanupMode as 'afterEnd' | 'afterComplete') ?? prev.cleanupMode,
      cleanupHoursAfterEnd:
        (savedEvents?.cleanupHoursAfterEnd as number) ?? prev.cleanupHoursAfterEnd,
      createEventThread: (savedEvents?.createEventThread as boolean) ?? prev.createEventThread,
      autoPublishAnnouncements:
        (savedEvents?.autoPublishAnnouncements as boolean) ?? prev.autoPublishAnnouncements,
    }));

    // Event extras hydration
    setEventArchiveChannelId((savedEvents?.archiveChannelId as string) ?? '');
    setEventArchiveAfterHours((savedEvents?.archiveAfterHours as number) ?? 24);
    setEventAllowedRoleIds(((savedEvents?.allowedRoleIds as string[]) ?? []).join(', '));
    setEventBannedRoleIds(((savedEvents?.bannedRoleIds as string[]) ?? []).join(', '));

    // Notifications — always apply (use defaults if DB returned null)
    const savedNotif = guildData.notificationPreferences;
    const notifDestinations = getNotificationChannelDestinations(savedNotif);
    const announcementDestination = notifDestinations.find(
      destination => destination.channelType === 'announcement'
    );
    const pinnedAnnouncementDestination = notifDestinations.find(
      destination => destination.channelType === 'pinned_announcement'
    );
    setNotifPrefs(prev => ({
      ...prev,
      announcementChannelId: announcementDestination?.channelId ?? prev.announcementChannelId,
      pinnedAnnouncementChannelId:
        pinnedAnnouncementDestination?.channelId ?? prev.pinnedAnnouncementChannelId,
      memberJoinNotifications:
        (savedNotif?.memberJoinNotifications as boolean) ?? prev.memberJoinNotifications,
      memberLeaveNotifications:
        (savedNotif?.memberLeaveNotifications as boolean) ?? prev.memberLeaveNotifications,
      roleChangeNotifications:
        (savedNotif?.roleChangeNotifications as boolean) ?? prev.roleChangeNotifications,
      eventNotifications: (savedNotif?.eventNotifications as boolean) ?? prev.eventNotifications,
      systemAlertChannelId:
        (savedNotif?.systemAlertChannelId as string) ?? prev.systemAlertChannelId,
      moderationAlertChannelId:
        (savedNotif?.moderationAlertChannelId as string) ?? prev.moderationAlertChannelId,
      auditLogChannelId: (savedNotif?.auditLogChannelId as string) ?? prev.auditLogChannelId,
      enableMentionRolesToNotify:
        (savedNotif?.enableMentionRolesToNotify as boolean) ?? prev.enableMentionRolesToNotify,
      notificationMentionRoles: ((savedNotif?.notificationMentionRoles as string[]) ?? []).join(
        ', '
      ),
      autoPublishAnnouncements:
        (savedNotif?.autoPublishAnnouncements as boolean) ?? prev.autoPublishAnnouncements,
    }));

    // Role Sync — always apply
    const savedRoleSync = guildData.roleSyncSettings;
    const mappingsObj = (savedRoleSync?.roleMappings as Record<string, string>) ?? {};
    const mappingsStr = Object.entries(mappingsObj)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    setRoleSyncSettings(prev => ({
      ...prev,
      enabled: (savedRoleSync?.enabled as boolean) ?? prev.enabled,
      syncRolesFromApi: (savedRoleSync?.syncRolesFromApi as boolean) ?? prev.syncRolesFromApi,
      autoRoleManagement: (savedRoleSync?.autoRoleManagement as boolean) ?? prev.autoRoleManagement,
      removeRolesOnLeave: (savedRoleSync?.removeRolesOnLeave as boolean) ?? prev.removeRolesOnLeave,
      syncIntervalMinutes:
        (savedRoleSync?.syncIntervalMinutes as number) ?? prev.syncIntervalMinutes,
      syncOnBotJoin: (savedRoleSync?.syncOnBotJoin as boolean) ?? prev.syncOnBotJoin,
      requireManualApproval:
        (savedRoleSync?.requireManualApproval as boolean) ?? prev.requireManualApproval,
      approvalRoleId: (savedRoleSync?.approvalRoleId as string) ?? prev.approvalRoleId,
      syncErrorNotificationChannelId:
        (savedRoleSync?.syncErrorNotificationChannelId as string) ??
        prev.syncErrorNotificationChannelId,
      verifiedRoleId: (savedRoleSync?.verifiedRoleId as string) ?? prev.verifiedRoleId,
      roleMappings: mappingsStr || prev.roleMappings,
    }));

    // Cross-Moderation — always apply
    const savedCrossMod = guildData.crossModerationSettings;
    setCrossModSettings(prev => ({
      ...prev,
      enabled: (savedCrossMod?.enabled as boolean) ?? prev.enabled,
      sharedBanListEnabled:
        (savedCrossMod?.sharedBanListEnabled as boolean) ?? prev.sharedBanListEnabled,
      sharedMuteListEnabled:
        (savedCrossMod?.sharedMuteListEnabled as boolean) ?? prev.sharedMuteListEnabled,
      autoBanOnSharedList:
        (savedCrossMod?.autoBanOnSharedList as boolean) ?? prev.autoBanOnSharedList,
      propagateTimeouts: (savedCrossMod?.propagateTimeouts as boolean) ?? prev.propagateTimeouts,
      forwardModerationAlerts:
        (savedCrossMod?.forwardModerationAlerts as boolean) ?? prev.forwardModerationAlerts,
      notifyOnSharedAction:
        (savedCrossMod?.notifyOnSharedAction as boolean) ?? prev.notifyOnSharedAction,
      banAppealsChannelId:
        (savedCrossMod?.banAppealsChannelId as string) ?? prev.banAppealsChannelId,
      crossGuildAuditLogChannelId:
        (savedCrossMod?.crossGuildAuditLogChannelId as string) ?? prev.crossGuildAuditLogChannelId,
      escalationRoleId: (savedCrossMod?.escalationRoleId as string) ?? prev.escalationRoleId,
      allowedGuildIds: ((savedCrossMod?.allowedGuildIds as string[]) ?? []).join(', '),
    }));

    // Welcome settings — always apply
    const savedWelcome = guildData.welcomeSettings;
    setWelcomeSettings(prev => ({
      ...prev,
      welcomeEnabled: (savedWelcome?.welcomeEnabled as boolean) ?? prev.welcomeEnabled,
      welcomeChannelId: (savedWelcome?.welcomeChannelId as string) ?? prev.welcomeChannelId,
      welcomeMessage: (savedWelcome?.welcomeMessage as string) ?? prev.welcomeMessage,
      goodbyeEnabled: (savedWelcome?.goodbyeEnabled as boolean) ?? prev.goodbyeEnabled,
      goodbyeChannelId: (savedWelcome?.goodbyeChannelId as string) ?? prev.goodbyeChannelId,
      goodbyeMessage: (savedWelcome?.goodbyeMessage as string) ?? prev.goodbyeMessage,
      autoRoleIds: ((savedWelcome?.autoRoleIds as string[]) ?? []).join(', '),
      welcomeDmEnabled: (savedWelcome?.welcomeDmEnabled as boolean) ?? prev.welcomeDmEnabled,
      welcomeDmMessage: (savedWelcome?.welcomeDmMessage as string) ?? prev.welcomeDmMessage,
    }));

    // Audit Log settings — always apply
    const savedAuditLog = guildData.auditLogSettings;
    setAuditLogSettings(prev => ({
      ...prev,
      enabled: (savedAuditLog?.enabled as boolean) ?? prev.enabled,
      logChannelId: (savedAuditLog?.logChannelId as string) ?? prev.logChannelId,
      logMessageEdits: (savedAuditLog?.logMessageEdits as boolean) ?? prev.logMessageEdits,
      logMessageDeletes: (savedAuditLog?.logMessageDeletes as boolean) ?? prev.logMessageDeletes,
      logRoleChanges: (savedAuditLog?.logRoleChanges as boolean) ?? prev.logRoleChanges,
      logChannelChanges: (savedAuditLog?.logChannelChanges as boolean) ?? prev.logChannelChanges,
      logMemberJoinLeave: (savedAuditLog?.logMemberJoinLeave as boolean) ?? prev.logMemberJoinLeave,
      ignoredChannelIds: ((savedAuditLog?.ignoredChannelIds as string[]) ?? []).join(', '),
    }));

    // Personal user preferences (fire-and-forget — non-critical)
    if (organizationId && primaryGuildId) {
      discordService.getUserPreferences(organizationId, primaryGuildId).then(
        prefs => setUserPrefs({ ...prefs, timezone: prefs.timezone ?? '' }),
        () => {
          /* Non-fatal — use defaults */
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes organizationId and recruit message state to avoid re-hydrating on every keystroke
  }, [guildSettingsData, primaryGuildId]);

  /**
   * Load tunnel (Jump Point) data only. Guild settings are loaded via React Query.
   */
  const loadTunnels = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await discordService.getSettings(organizationId, primaryGuildId);

      // Populate guildId from connected guilds so all save handlers can use it
      if (connectedGuilds.length > 0) {
        data.guildId = connectedGuilds[0].guildId;
      }

      setSettings(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Discord settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVoiceConfig = async () => {
    const guildId = connectedGuilds[0]?.guildId ?? settings?.guildId;
    if (!guildId) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    if (!voiceConfig) {
      notification.error('Voice settings are still loading. Please try again.');
      return;
    }

    try {
      setVoiceSaving(true);
      await discordService.updateVoiceConfig(organizationId, guildId, voiceConfig);
      notification.success('Voice settings saved successfully.');
      // Invalidate React Query cache so the form re-hydrates from the server
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save voice settings');
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleSaveRecruitmentSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    try {
      setRecruitmentSaving(true);
      await discordService.updateRecruitmentSettings(organizationId, guildId, {
        enabled: recruitmentSettings.enabled,
        applicationChannelId: recruitmentSettings.applicationChannelId || undefined,
        acceptRoleId: recruitmentSettings.approvedRoleId || undefined,
        pendingRoleId: recruitmentSettings.pendingRoleId || undefined,
        requireDiscordVerification: recruitmentSettings.requireDiscordVerification,
        autoAssignRole: recruitmentSettings.autoAssignRole,
        welcomeMessage: recruitmentSettings.welcomeMessage,
        deniedMessage: recruitDeniedMessage,
        confirmationMessage: recruitConfirmationMessage,
        completionMessage: recruitCompletionMessage,
        inviteFormEnabled: recruitmentSettings.inviteFormEnabled,
        inviteFormBindingCode: recruitmentSettings.inviteFormBindingCode || undefined,
        discordInviteUrl: recruitmentSettings.discordInviteUrl || undefined,
        autoResolveOnRoleChange: recruitmentSettings.autoResolveOnRoleChange,
        restrictedRoleIds: recruitAdvRoles.restrictedRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        requiredRoleIds: recruitAdvRoles.requiredRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        requiredRoleMatchMode: recruitAdvRoles.requiredRoleMatchMode,
        acceptedRemovalRoleIds: recruitAdvRoles.acceptedRemovalRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        deniedRemovalRoleIds: recruitAdvRoles.deniedRemovalRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        removeRolesOnSubmit: recruitAdvRoles.removeRolesOnSubmit
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        acceptedChannelId: recruitAdvRoles.acceptedChannelId || undefined,
        deniedChannelId: recruitAdvRoles.deniedChannelId || undefined,
        pendingChannelId: recruitAdvRoles.pendingChannelId || undefined,
        applicationTimeLimitMinutes: recruitTimeLimitMinutes || undefined,
        actionOnApplicantLeave: recruitActionOnLeave as
          | 'nothing'
          | 'withdraw'
          | 'notify'
          | 'archive',
      });
      notification.success('Recruitment settings saved successfully.');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to save recruitment settings'
      );
    } finally {
      setRecruitmentSaving(false);
    }
  };

  const handleSaveTicketSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    try {
      setTicketingSaving(true);
      await discordService.updateTicketSettings(organizationId, guildId, {
        enabled: ticketSettings.enabled,
        defaultCategoryId: ticketSettings.defaultCategoryId || undefined,
        transcriptChannelId: ticketSettings.transcriptChannelId || undefined,
        supportRoleId: ticketSettings.supportRoleId || undefined,
        escalationRoleId: ticketSettings.escalationRoleId || undefined,
        formChannelId: ticketSettings.formChannelId || undefined,
        autoCloseHours: ticketSettings.autoCloseHours,
        maxOpenTicketsPerUser: ticketSettings.maxOpenTicketsPerUser,
        mentionSupportRoleOnCreate: ticketSettings.mentionSupportRoleOnCreate,
        notifyOnClose: ticketSettings.notifyOnClose,
        allowMemberClose: ticketSettings.allowMemberClose,
        blockedRoleIds: ticketAccessControl.blockedRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        requiredRoleIds: ticketAccessControl.requiredRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        roleMatchMode: ticketAccessControl.roleMatchMode,
        rateSupportEnabled: ticketRateSupportEnabled,
        channelNameTemplate: ticketChannelNameTemplate || undefined,
      });
      notification.success('Ticketing settings saved successfully.');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save ticketing settings');
    } finally {
      setTicketingSaving(false);
    }
  };

  const handleSaveLfgSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    try {
      setLfgSaving(true);
      await discordService.updateLfgSettings(organizationId, guildId, lfgSettings);
      notification.success('LFG settings saved successfully.');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save LFG settings');
    } finally {
      setLfgSaving(false);
    }
  };

  const handleSaveTeamVoiceSettings = async () => {
    const guildId = connectedGuilds[0]?.guildId ?? settings?.guildId;
    if (!organizationId || !guildId) {
      return;
    }

    setTeamVoiceSaving(true);
    try {
      await discordService.updateTeamVoiceSettings(organizationId, guildId, teamVoiceSettings);
      notification.success('Team voice settings saved successfully.');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save team voice settings');
    } finally {
      setTeamVoiceSaving(false);
    }
  };

  const handleSaveEventSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    try {
      setEventsSaving(true);
      await discordService.updateEventSettings(organizationId, guildId, {
        eventAnnouncementChannelId: eventSettings.eventAnnouncementChannelId || null,
        eventNotificationRoleId: eventSettings.eventNotificationRoleId || null,
        eventNotificationRoleIds: eventSettings.eventNotificationRoleIds,
        enableEventMentions: eventSettings.enableEventMentions,
        autoDeleteEventMessages: eventSettings.autoDeleteEventMessages,
        eventMessageRetentionDays: eventSettings.eventMessageRetentionDays,
        allowEventRsvp: eventSettings.allowEventRsvp,
        remindersEnabled: eventSettings.remindersEnabled,
        reminderHoursBefore: eventSettings.reminderHoursBefore,
        eventCreationRoleId: eventSettings.eventCreationRoleId || null,
        maxMirrorsPerActivity: eventSettings.maxMirrorsPerActivity,
        tempRolesEnabled: eventSettings.tempRolesEnabled,
        tempRoleColor: eventSettings.tempRoleColor,
        createDiscordEvent: eventSettings.createDiscordEvent,
        eventVoiceCategoryId: eventSettings.eventVoiceCategoryId || null,
        cleanupMode: eventSettings.cleanupMode,
        cleanupHoursAfterEnd: eventSettings.cleanupHoursAfterEnd,
        createEventThread: eventSettings.createEventThread,
        autoPublishAnnouncements: eventSettings.autoPublishAnnouncements,
        archiveChannelId: eventArchiveChannelId || null,
        archiveAfterHours: eventArchiveAfterHours,
        allowedRoleIds: eventAllowedRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        bannedRoleIds: eventBannedRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      });
      notification.success('Event settings saved successfully');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save event settings');
    } finally {
      setEventsSaving(false);
    }
  };

  const handleSaveNotifPrefs = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    try {
      setNotifSaving(true);
      await discordService.updateNotificationPreferences(organizationId, guildId, {
        announcementChannelId: notifPrefs.announcementChannelId || null,
        pinnedAnnouncementChannelId: notifPrefs.pinnedAnnouncementChannelId || null,
        memberJoinNotifications: notifPrefs.memberJoinNotifications,
        memberLeaveNotifications: notifPrefs.memberLeaveNotifications,
        roleChangeNotifications: notifPrefs.roleChangeNotifications,
        eventNotifications: notifPrefs.eventNotifications,
        systemAlertChannelId: notifPrefs.systemAlertChannelId || null,
        moderationAlertChannelId: notifPrefs.moderationAlertChannelId || null,
        auditLogChannelId: notifPrefs.auditLogChannelId || null,
        enableMentionRolesToNotify: notifPrefs.enableMentionRolesToNotify,
        notificationMentionRoles: notifPrefs.notificationMentionRoles
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        autoPublishAnnouncements: notifPrefs.autoPublishAnnouncements,
      });
      notification.success('Notification preferences saved successfully');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to save notification preferences'
      );
    } finally {
      setNotifSaving(false);
    }
  };

  const handleSaveRoleSyncSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    // Parse role mappings from "OrgRank=DiscordRoleId, ..." to Record<string,string>
    const mappings: Record<string, string> = {};
    roleSyncSettings.roleMappings
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(pair => {
        const [key, value] = pair.split('=').map(s => s.trim());
        if (key && value) {
          mappings[key] = value;
        }
      });

    try {
      setRoleSyncSaving(true);
      await discordService.updateRoleSyncSettings(organizationId, guildId, {
        enabled: roleSyncSettings.enabled,
        syncRolesFromApi: roleSyncSettings.syncRolesFromApi,
        autoRoleManagement: roleSyncSettings.autoRoleManagement,
        removeRolesOnLeave: roleSyncSettings.removeRolesOnLeave,
        syncIntervalMinutes: roleSyncSettings.syncIntervalMinutes,
        syncOnBotJoin: roleSyncSettings.syncOnBotJoin,
        requireManualApproval: roleSyncSettings.requireManualApproval,
        approvalRoleId: roleSyncSettings.approvalRoleId || null,
        syncErrorNotificationChannelId: roleSyncSettings.syncErrorNotificationChannelId || null,
        verifiedRoleId: roleSyncSettings.verifiedRoleId || null,
        roleMappings: mappings,
      });
      // Save assistant role IDs (top-level guild settings field)
      await discordService.updateAssistantRoles(organizationId, guildId, assistantRoleIds);
      notification.success('Role sync settings saved successfully');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save role sync settings');
    } finally {
      setRoleSyncSaving(false);
    }
  };

  const handleSaveCrossModSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    try {
      setCrossModSaving(true);
      await discordService.updateCrossModerationSettings(organizationId, guildId, {
        enabled: crossModSettings.enabled,
        sharedBanListEnabled: crossModSettings.sharedBanListEnabled,
        sharedMuteListEnabled: crossModSettings.sharedMuteListEnabled,
        autoBanOnSharedList: crossModSettings.autoBanOnSharedList,
        propagateTimeouts: crossModSettings.propagateTimeouts,
        forwardModerationAlerts: crossModSettings.forwardModerationAlerts,
        notifyOnSharedAction: crossModSettings.notifyOnSharedAction,
        banAppealsChannelId: crossModSettings.banAppealsChannelId || null,
        crossGuildAuditLogChannelId: crossModSettings.crossGuildAuditLogChannelId || null,
        escalationRoleId: crossModSettings.escalationRoleId || null,
        allowedGuildIds: crossModSettings.allowedGuildIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      });
      notification.success('Moderation settings saved successfully');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save moderation settings');
    } finally {
      setCrossModSaving(false);
    }
  };

  const handleSaveUserPrefs = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;

    try {
      setUserPrefsSaving(true);
      const updated = await discordService.updateUserPreferences(
        organizationId,
        guildId,
        userPrefs
      );
      setUserPrefs(updated);
      notification.success('Your preferences have been saved');
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setUserPrefsSaving(false);
    }
  };

  const handleSaveWelcomeSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setWelcomeSaving(true);
      await discordService.updateWelcomeSettings(organizationId, guildId, {
        welcomeEnabled: welcomeSettings.welcomeEnabled,
        welcomeChannelId: welcomeSettings.welcomeChannelId || null,
        welcomeMessage: welcomeSettings.welcomeMessage || null,
        goodbyeEnabled: welcomeSettings.goodbyeEnabled,
        goodbyeChannelId: welcomeSettings.goodbyeChannelId || null,
        goodbyeMessage: welcomeSettings.goodbyeMessage || null,
        autoRoleIds: welcomeSettings.autoRoleIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        welcomeDmEnabled: welcomeSettings.welcomeDmEnabled,
        welcomeDmMessage: welcomeSettings.welcomeDmMessage || null,
      });
      notification.success('Welcome settings saved');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save welcome settings');
    } finally {
      setWelcomeSaving(false);
    }
  };

  const handleSaveAuditLogSettings = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setAuditLogSaving(true);
      await discordService.updateAuditLogSettings(organizationId, guildId, {
        enabled: auditLogSettings.enabled,
        logChannelId: auditLogSettings.logChannelId || null,
        logMessageEdits: auditLogSettings.logMessageEdits,
        logMessageDeletes: auditLogSettings.logMessageDeletes,
        logRoleChanges: auditLogSettings.logRoleChanges,
        logChannelChanges: auditLogSettings.logChannelChanges,
        logMemberJoinLeave: auditLogSettings.logMemberJoinLeave,
        ignoredChannelIds: auditLogSettings.ignoredChannelIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      });
      notification.success('Audit log settings saved');
      invalidateGuildSettings();
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to save audit log settings');
    } finally {
      setAuditLogSaving(false);
    }
  };

  const handleCreateTunnel = async () => {
    try {
      setLoading(true);
      await discordService.createTunnel(organizationId, {
        name: newTunnelName,
        guildId: connectedGuilds[0]?.guildId ?? settings?.guildId ?? '',
        channelId: newTunnelChannelId,
        isPublic: newTunnelPublic,
        password: newTunnelPublic ? undefined : newTunnelPassword,
        contentFilterEnabled: newTunnelContentFilter,
      });
      setNewTunnelName('');
      setNewTunnelChannelId('');
      setNewTunnelPublic(true);
      setNewTunnelPassword('');
      await loadTunnels();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create comm link');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTunnel = async (tunnelId: string, guildId: string) => {
    try {
      setLoading(true);
      await discordService.deleteTunnel(tunnelId, guildId);
      await loadTunnels();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete comm link');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditTunnel = (tunnel: Tunnel) => {
    setEditingTunnel(tunnel);
    setEditTunnelName(tunnel.name);
    setEditTunnelContentFilter(tunnel.contentFilterEnabled);
    setEditTunnelAllowBotMessages(tunnel.allowBotMessages);
    setEditTunnelMaxServers(tunnel.maxConnectedServers);
  };

  const handleCloseEditTunnel = () => {
    setEditingTunnel(null);
  };

  const handleAddAdminUser = async () => {
    if (!newAdminUserId.trim()) return;
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setAccessControlSaving(true);
      await discordService.addAdminUser(organizationId, guildId, newAdminUserId.trim());
      setAdminUserIds(prev => [...prev, newAdminUserId.trim()]);
      setNewAdminUserId('');
      notification.success('Access control updated successfully.');
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to add admin user');
    } finally {
      setAccessControlSaving(false);
    }
  };

  const handleRemoveAdminUser = async (userId: string) => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setAccessControlSaving(true);
      await discordService.removeAdminUser(organizationId, guildId, userId);
      setAdminUserIds(prev => prev.filter(id => id !== userId));
      notification.success('Access control updated successfully.');
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to remove admin user');
    } finally {
      setAccessControlSaving(false);
    }
  };

  const handleAddServerManagerRole = async () => {
    if (!newServerManagerRoleId.trim()) return;
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setAccessControlSaving(true);
      await discordService.addServerManagerRole(
        organizationId,
        guildId,
        newServerManagerRoleId.trim()
      );
      setServerManagerRoleIds(prev => [...prev, newServerManagerRoleId.trim()]);
      setNewServerManagerRoleId('');
      notification.success('Access control updated successfully.');
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Failed to add server manager role');
    } finally {
      setAccessControlSaving(false);
    }
  };

  const handleRemoveServerManagerRole = async (roleId: string) => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setAccessControlSaving(true);
      await discordService.removeServerManagerRole(organizationId, guildId, roleId);
      setServerManagerRoleIds(prev => prev.filter(id => id !== roleId));
      notification.success('Access control updated successfully.');
    } catch (err) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to remove server manager role'
      );
    } finally {
      setAccessControlSaving(false);
    }
  };

  const handleSaveEditTunnel = async () => {
    if (!editingTunnel) return;
    try {
      setLoading(true);
      await discordService.updateTunnel(editingTunnel.id, {
        name: editTunnelName,
        contentFilterEnabled: editTunnelContentFilter,
        allowBotMessages: editTunnelAllowBotMessages,
        maxConnectedServers: editTunnelMaxServers,
      });
      setEditingTunnel(null);
      await loadTunnels();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update comm link');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setLoading(true);
      await discordService.createVoiceTemplate(
        organizationId,
        {
          name: newTemplateName,
          description: newTemplateDescription,
          userLimit: newTemplateUserLimit,
          nameTemplate: newTemplateNameTemplate,
          autoDelete: newTemplateAutoDelete,
        },
        guildId
      );
      setNewTemplateName('');
      setNewTemplateDescription('');
      setNewTemplateUserLimit(10);
      setNewTemplateNameTemplate("{user}'s Channel");
      invalidateGuildSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (connectedGuilds.length === 0) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return;
    }
    const guildId = connectedGuilds[0].guildId;
    try {
      setLoading(true);
      await discordService.deleteVoiceTemplate(organizationId, guildId, templateId);
      invalidateGuildSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGuild = async () => {
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
      // Error surfaced via connectGuild.error
    }
  };

  const getConnectedGuildIdForMutation = (): string | null => {
    const guildId = connectedGuilds[0]?.guildId;
    if (!guildId) {
      notification.error('No connected Discord server. Connect a server before saving.');
      return null;
    }

    return guildId;
  };

  const handleRefreshRsiStatus = async () => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }
    await loadRsiStatusConfiguration(guildId);
  };

  const handleDeployRsiStatusPanel = async () => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }
    if (!rsiPanelChannelId) {
      notification.error('Select a text channel before deploying the RSI status panel.');
      return;
    }

    try {
      setRsiStatusSaving(true);
      const config = await discordService.deployRsiStatusPanel(
        organizationId,
        guildId,
        rsiPanelChannelId
      );
      applyRsiStatusConfiguration(config);
      notification.success('RSI status panel deployed successfully.');
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to deploy RSI status panel');
    } finally {
      setRsiStatusSaving(false);
    }
  };

  const handleRemoveRsiStatusPanel = async () => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    try {
      setRsiStatusSaving(true);
      const config = await discordService.removeRsiStatusPanel(organizationId, guildId);
      applyRsiStatusConfiguration(config);
      notification.success('RSI status panel removed.');
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to remove RSI status panel');
    } finally {
      setRsiStatusSaving(false);
    }
  };

  const handleCreateManagedRsiStatusChannels = async () => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    try {
      setRsiStatusSaving(true);
      const config = await discordService.createManagedRsiStatusChannels(organizationId, guildId);
      applyRsiStatusConfiguration(config);
      notification.success('Managed RSI status channels created.');
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to create managed RSI status channels'
      );
    } finally {
      setRsiStatusSaving(false);
    }
  };

  const handleAssignRsiStatusChannel = async (role: RsiStatusRole) => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    const channelId = role === 'application' ? rsiApplicationChannelId : rsiServerChannelId;
    if (!channelId) {
      notification.error('Select a channel before saving RSI status channel mapping.');
      return;
    }

    try {
      setRsiStatusSaving(true);
      const config = await discordService.assignRsiStatusChannel(
        organizationId,
        guildId,
        role,
        channelId
      );
      applyRsiStatusConfiguration(config);
      notification.success(
        role === 'application'
          ? 'Application status channel updated.'
          : 'Server status channel updated.'
      );
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to assign RSI status channel'
      );
    } finally {
      setRsiStatusSaving(false);
    }
  };

  const handleRemoveRsiStatusChannels = async () => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    try {
      setRsiStatusSaving(true);
      const config = await discordService.removeRsiStatusChannels(organizationId, guildId);
      applyRsiStatusConfiguration(config);
      notification.success('RSI status channels removed.');
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to remove RSI status channels'
      );
    } finally {
      setRsiStatusSaving(false);
    }
  };

  const handleRemoveReminderHour = (hour: number) => {
    setEventSettings(prev => ({
      ...prev,
      reminderHoursBefore: prev.reminderHoursBefore.filter(v => v !== hour),
    }));
  };

  const handleAddReminderHour = () => {
    const hourValue = Number(newReminderHour);
    if (hourValue <= 0 || eventSettings.reminderHoursBefore.includes(hourValue)) {
      return;
    }

    setEventSettings(prev => ({
      ...prev,
      reminderHoursBefore: [...prev.reminderHoursBefore, hourValue].sort((a, b) => b - a),
    }));
    setNewReminderHour('');
  };

  const handleDeleteQuickResponseCategory = async (categoryId: string) => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    try {
      await discordService.deleteQuickResponseCategory(organizationId, guildId, categoryId);
      setQuickResponseCategories(prev => prev.filter(category => category.id !== categoryId));
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to delete quick response category'
      );
    }
  };

  const handleCreateQuickResponseCategory = async () => {
    const categoryName = newQrCatName.trim();
    if (!categoryName) {
      return;
    }

    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    try {
      const created = (await discordService.createQuickResponseCategory(
        organizationId,
        guildId,
        categoryName
      )) as QuickResponseCategoryItem | undefined;

      if (!created) {
        return;
      }

      setQuickResponseCategories(prev => [...prev, created]);
      setNewQrCatName('');
    } catch (err: unknown) {
      notification.error(
        err instanceof Error ? err.message : 'Failed to create quick response category'
      );
    }
  };

  const handleDeleteQuickResponse = async (responseId: string) => {
    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    try {
      await discordService.deleteQuickResponse(organizationId, guildId, responseId);
      setQuickResponses(prev => prev.filter(response => response.id !== responseId));
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to delete quick response');
    }
  };

  const handleCreateQuickResponse = async () => {
    const responseName = newQrName.trim();
    const responseContent = newQrContent.trim();
    if (!responseName || !responseContent) {
      return;
    }

    const guildId = getConnectedGuildIdForMutation();
    if (!guildId) {
      return;
    }

    try {
      const created = (await discordService.createQuickResponse(organizationId, guildId, {
        name: responseName,
        content: responseContent,
        categoryId: newQrCategoryId || undefined,
      })) as QuickResponseItem | undefined;

      if (!created) {
        return;
      }

      setQuickResponses(prev => [...prev, created]);
      setNewQrName('');
      setNewQrContent('');
      setNewQrCategoryId('');
    } catch (err: unknown) {
      notification.error(err instanceof Error ? err.message : 'Failed to create quick response');
    }
  };

  if (!organizationId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Join an organization to configure Discord integration.
        </Typography>
      </Box>
    );
  }

  if (guildsLoading) {
    return <LoadingSpinner />;
  }

  // Show connect flow when no guild is linked
  if (!isConnected) {
    return (
      <Box width="100%">
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 6, p: 3 }}>
          <Stack spacing={3} alignItems="center">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 2,
                bgcolor: alpha(DISCORD_BLUE, 0.2),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SettingsIcon sx={{ color: DISCORD_BLUE, fontSize: 36 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, textAlign: 'center' }}>
              Connect Your Discord Server
            </Typography>
            <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Link a Discord server to enable voice channels, comm links, ticketing, recruitment
              integration, and more.
            </Typography>

            {botConnectSuccess && (
              <Alert
                severity="success"
                sx={{ width: '100%' }}
                onClose={() => setBotConnectSuccess(false)}
              >
                Discord server connected successfully!
              </Alert>
            )}

            {botConnectError && (
              <Alert
                severity="error"
                sx={{ width: '100%' }}
                onClose={() => setBotConnectError(null)}
              >
                {botConnectError}
              </Alert>
            )}

            {connectGuild.error && (
              <Alert severity="error" sx={{ width: '100%' }}>
                Failed to connect. Make sure the bot has been added to your server first.
              </Alert>
            )}

            {/* Step 1: Add bot (auto-connects via redirect) */}
            {(() => {
              const url = buildBotInviteUrl(organizationId, user?.id);
              if (!url) return null;
              return (
                <Button
                  variant="contained"
                  startIcon={<OpenInNewIcon />}
                  component="a"
                  href={url}
                  fullWidth
                  sx={{
                    bgcolor: DISCORD_BLUE,
                    '&:hover': { bgcolor: '#4752C4' },
                    textTransform: 'none',
                    py: 1.25,
                  }}
                >
                  Add Bot to Your Server
                </Button>
              );
            })()}

            <Divider sx={{ width: '100%' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                or link manually
              </Typography>
            </Divider>

            {/* Step 2: Enter Guild ID */}
            {showManualConnect ? (
              <Stack spacing={1.5} sx={{ width: '100%' }}>
                <TextField
                  label="Discord Server ID (Guild ID)"
                  placeholder="e.g. 123456789012345678"
                  value={manualGuildId}
                  onChange={e => {
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
                    {connectGuild.isPending ? <CircularProgress size={20} /> : 'Connect Server'}
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
                fullWidth
                sx={{ textTransform: 'none' }}
              >
                Link Server by Guild ID
              </Button>
            )}

            <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Alternatively, use the <strong>/guild setup</strong> command in your Discord server
              after adding the bot.
            </Typography>
          </Stack>
        </Box>
      </Box>
    );
  }

  if ((loading && !settings) || guildSettingsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Box width="100%">
      {/* Top Navigation Bar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: alpha(theme.palette.background.default, 0.95),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(DISCORD_BLUE, 0.25)}`,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ minHeight: { xs: 56, md: 64 } }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                background: alpha(DISCORD_BLUE, 0.2),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1.5,
              }}
            >
              <SettingsIcon sx={{ color: DISCORD_BLUE, fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              component="h1"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(135deg, ${DISCORD_BLUE} 0%, ${theme.palette.primary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
                fontSize: { xs: '1rem', md: '1.15rem' },
                mr: 2,
              }}
            >
              Discord Dashboard
            </Typography>
            <Typography
              sx={{
                color: alpha(theme.palette.common.white, 0.5),
                fontSize: '0.85rem',
                display: { xs: 'none', sm: 'block' },
                flex: 1,
              }}
            >
              Manage voice channels and comm link configurations
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                loadTunnels();
                // Reset hydration flag so the refetch re-populates all form states
                initialHydrationDone.current = false;
                invalidateGuildSettings();
              }}
              startIcon={<RefreshIcon />}
              sx={{
                color: DISCORD_BLUE,
                borderColor: alpha(DISCORD_BLUE, 0.4),
                textTransform: 'none',
                '&:hover': {
                  borderColor: DISCORD_BLUE,
                  backgroundColor: alpha(DISCORD_BLUE, 0.08),
                },
              }}
            >
              Refresh
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Box sx={{ p: 4 }}>
        <Stack direction="column" spacing={3}>
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

          {/* Server Connection Status */}
          <Box
            sx={{
              borderRadius: 2,
              p: 2.5,
              background: `linear-gradient(135deg, ${alpha(DISCORD_BLUE, 0.18)} 0%, ${alpha(DISCORD_BLUE, 0.06)} 100%)`,
              border: `1px solid ${alpha(DISCORD_BLUE, 0.35)}`,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={sanitizeImageUrl(connectedGuilds[0]?.guildIconUrl) || undefined}
                alt={connectedGuilds[0]?.guildName || settings?.guildName || 'Discord Server'}
                variant="rounded"
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: alpha(DISCORD_BLUE, 0.25),
                  color: DISCORD_BLUE,
                  fontSize: '1.5rem',
                  fontWeight: 700,
                }}
              >
                {(connectedGuilds[0]?.guildName || settings?.guildName || 'D')[0]}
              </Avatar>
              <Stack direction="column" flex={1} spacing={0.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 700, color: 'common.white', fontSize: '1.1rem' }}>
                    {connectedGuilds[0]?.guildName || settings?.guildName || 'Discord Server'}
                  </Typography>
                  <Chip
                    label="Connected"
                    color="success"
                    size="small"
                    sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                  />
                </Stack>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  Guild ID: {connectedGuilds[0]?.guildId || settings?.guildId || 'Unknown'}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <MembershipStatusChip
                  membership={myMembership}
                  onOpenPreferences={() => setSelectedTab('my-prefs')}
                />
                <Chip
                  label="Discord"
                  size="small"
                  sx={{
                    bgcolor: alpha(DISCORD_BLUE, 0.2),
                    color: DISCORD_BLUE,
                    fontWeight: 600,
                    border: `1px solid ${alpha(DISCORD_BLUE, 0.3)}`,
                  }}
                />
              </Stack>
            </Stack>
          </Box>

          {/* Tabs for Voice, Comm Links, Ticketing, and Recruitment */}
          <Tabs
            value={selectedTab}
            onChange={(_, value) => setSelectedTab(String(value))}
            aria-label="Discord settings tabs"
          >
            <Tab icon={<RecordVoiceOver />} label="Voice Channels" value="voice" />
            <Tab icon={<EventIcon />} label="Events" value="events" />
            <Tab icon={<NotificationsIcon />} label="Notifications" value="notifications" />
            <Tab icon={<InfoIcon />} label="RSI Status" value="rsi-status" />
            <Tab icon={<LinkIcon />} label="Comm Links" value="tunnels" />
            <Tab icon={<Work />} label="Ticketing" value="ticketing" />
            <Tab icon={<People />} label="Recruitment" value="recruitment" />
            <Tab icon={<GroupsIcon />} label="LFG" value="lfg" />
            <Tab icon={<HeadsetIcon />} label="Team Voice" value="team-voice" />
            <Tab icon={<SyncIcon />} label="Role Sync" value="role-sync" />
            <Tab icon={<ShieldIcon />} label="Moderation" value="cross-moderation" />
            <Tab icon={<WelcomeIcon />} label="Welcome" value="welcome" />
            <Tab icon={<AuditLogIcon />} label="Audit Log" value="audit-log" />
            <Tab icon={<BarChart />} label="Stats" value="stats" />
            <Tab icon={<Mail />} label="DM Notifications" value="dm-notifications" />
            <Tab icon={<CardGiftcard />} label="Giveaways" value="giveaways" />
            <Tab icon={<AdminPanelSettingsIcon />} label="Access Control" value="access-control" />
          </Tabs>
          {/* Voice Channels Tab */}
          <TabPanel selectedTab={selectedTab} tab="voice">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              {/* Temporary Voice Channel Settings */}
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h3" sx={{ color: 'primary.main' }}>
                    Temporary Voice Channel Settings
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', marginBottom: '16px' }}>
                    Configure how temporary voice channels are created and managed (like
                    tempvoice.xyz)
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={voiceConfig?.autoCreateChannels || false}
                        onChange={(_, checked) =>
                          setVoiceConfig(prev =>
                            prev ? { ...prev, autoCreateChannels: checked } : null
                          )
                        }
                      />
                    }
                    label="Enable Temporary Voice Channels"
                  />

                  <MultiChannelPicker
                    label="Hub Channels (Join to Create)"
                    values={(() => {
                      if (voiceConfig?.hubChannelIds?.length) return voiceConfig.hubChannelIds;
                      if (voiceConfig?.hubChannelId) return [voiceConfig.hubChannelId];
                      return [];
                    })()}
                    onChange={values =>
                      setVoiceConfig(prev =>
                        prev
                          ? {
                              ...prev,
                              hubChannelIds: values,
                              hubChannelId: values[0] || undefined,
                            }
                          : null
                      )
                    }
                    channels={voiceChannels}
                    channelType="voice"
                    helperText="Users joining any of these voice channels will automatically get a new temporary channel"
                  />

                  <ChannelPicker
                    label="Parent Category"
                    value={voiceConfig?.categoryId || ''}
                    onChange={v =>
                      setVoiceConfig(prev => (prev ? { ...prev, categoryId: v } : null))
                    }
                    channels={categoryChannels}
                    channelType="category"
                    helperText="Category where temporary voice channels are created"
                  />

                  <Stack direction="column" spacing={2}>
                    <TextField
                      label="Name Template"
                      value={voiceConfig?.nameTemplate || ''}
                      onChange={e =>
                        setVoiceConfig(prev =>
                          prev ? { ...prev, nameTemplate: e.target.value } : null
                        )
                      }
                      size="small"
                      fullWidth
                      helperText="Variables: {user} (username), {nickname} (server nickname), {game} (current game), {count} (channel number)"
                    />
                    <TextField
                      label="Default User Limit"
                      type="number"
                      value={voiceConfig?.defaultUserLimit || 0}
                      onChange={e =>
                        setVoiceConfig(prev =>
                          prev ? { ...prev, defaultUserLimit: Number(e.target.value) } : null
                        )
                      }
                      slotProps={{ htmlInput: { min: 0, max: 99 } }}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Bitrate (kbps)"
                      type="number"
                      value={(voiceConfig?.bitrate || 64000) / 1000}
                      onChange={e =>
                        setVoiceConfig(prev =>
                          prev ? { ...prev, bitrate: Number(e.target.value) * 1000 } : null
                        )
                      }
                      slotProps={{ htmlInput: { min: 8, max: 384 } }}
                      size="small"
                      fullWidth
                    />
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Stack direction="row" spacing={4} flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <MuiSwitch
                          checked={voiceConfig?.autoDeleteEmpty || false}
                          onChange={(_, checked) =>
                            setVoiceConfig(prev =>
                              prev ? { ...prev, autoDeleteEmpty: checked } : null
                            )
                          }
                        />
                      }
                      label="Auto-delete when empty"
                    />
                    <FormControlLabel
                      control={
                        <MuiSwitch
                          checked={voiceConfig?.allowRename || false}
                          onChange={(_, checked) =>
                            setVoiceConfig(prev =>
                              prev ? { ...prev, allowRename: checked } : null
                            )
                          }
                        />
                      }
                      label="Allow users to rename"
                    />
                    <FormControlLabel
                      control={
                        <MuiSwitch
                          checked={voiceConfig?.allowUserLimit || false}
                          onChange={(_, checked) =>
                            setVoiceConfig(prev =>
                              prev ? { ...prev, allowUserLimit: checked } : null
                            )
                          }
                        />
                      }
                      label="Allow users to set limit"
                    />
                  </Stack>

                  {voiceConfig?.autoDeleteEmpty && (
                    <TextField
                      label="Delete Delay (seconds)"
                      type="number"
                      value={voiceConfig?.deleteEmptyChannelDelaySeconds ?? 3}
                      onChange={e =>
                        setVoiceConfig(prev =>
                          prev
                            ? {
                                ...prev,
                                deleteEmptyChannelDelaySeconds: Math.max(
                                  0,
                                  Math.min(300, Number(e.target.value))
                                ),
                              }
                            : null
                        )
                      }
                      slotProps={{ htmlInput: { min: 0, max: 300 } }}
                      size="small"
                      fullWidth
                      helperText="Seconds to wait before deleting an empty channel (0 = immediate, default 3)"
                    />
                  )}

                  <Stack direction="row" justifyContent="end" sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleSaveVoiceConfig}
                      disabled={voiceSaving}
                      startIcon={voiceSaving ? <CircularProgress size={16} /> : null}
                    >
                      {voiceSaving ? 'Saving...' : 'Save Voice Settings'}
                    </Button>
                  </Stack>
                </Stack>
              </Box>

              {/* Voice Channel Templates */}
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <div>
                      <Typography variant="h3" sx={{ color: 'primary.main' }}>
                        Voice Channel Templates
                      </Typography>
                      <Typography sx={{ color: 'text.secondary' }}>
                        Pre-configured templates for different activities
                      </Typography>
                    </div>
                    <Button
                      variant="outlined"
                      onClick={() => setIsCreateTemplateDialogOpen(true)}
                      startIcon={<Add />}
                    >
                      New Template
                    </Button>
                  </Stack>

                  <Dialog
                    open={isCreateTemplateDialogOpen}
                    onClose={() => setIsCreateTemplateDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                  >
                    <DialogTitle>Create Voice Template</DialogTitle>
                    <Divider />
                    <DialogContent>
                      <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
                        <TextField
                          label="Template Name"
                          value={newTemplateName}
                          onChange={e => setNewTemplateName(e.target.value)}
                          required
                          fullWidth
                        />
                        <TextField
                          label="Description"
                          value={newTemplateDescription}
                          onChange={e => setNewTemplateDescription(e.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="Channel Name Template"
                          value={newTemplateNameTemplate}
                          onChange={e => setNewTemplateNameTemplate(e.target.value)}
                          fullWidth
                        />
                        <TextField
                          label="User Limit"
                          type="number"
                          value={newTemplateUserLimit}
                          onChange={e => setNewTemplateUserLimit(Number(e.target.value))}
                          slotProps={{ htmlInput: { min: 0, max: 99 } }}
                          fullWidth
                        />
                        <FormControlLabel
                          control={
                            <MuiSwitch
                              checked={newTemplateAutoDelete}
                              onChange={e => setNewTemplateAutoDelete(e.target.checked)}
                            />
                          }
                          label="Auto-delete when empty"
                        />
                      </Stack>
                    </DialogContent>
                    <DialogActions>
                      <Button
                        variant="outlined"
                        onClick={() => setIsCreateTemplateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => {
                          handleCreateTemplate();
                          setIsCreateTemplateDialogOpen(false);
                        }}
                      >
                        Create
                      </Button>
                    </DialogActions>
                  </Dialog>

                  <Divider />

                  {settings?.voiceTemplates && settings.voiceTemplates.length > 0 ? (
                    <Stack direction="column" gap="size-100">
                      {settings.voiceTemplates.map(template => (
                        <Box
                          key={template.id}
                          sx={{
                            p: '12px 16px',
                            background: alpha(theme.palette.primary.main, 0.05),
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="column" spacing={0.5}>
                              <Typography sx={{ fontWeight: 600, color: 'common.white' }}>
                                {template.name}
                              </Typography>
                              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                {template.description || template.nameTemplate}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                label={`${template.userLimit || '∞'} users`}
                                color="info"
                                size="small"
                              />
                              {template.autoDelete && <Chip label="Auto-delete" size="small" />}
                              <Tooltip title="Delete template" arrow>
                                <IconButton
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  aria-label="Delete template"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography
                      sx={{ color: 'text.secondary', textAlign: 'center', padding: '20px' }}
                    >
                      No templates created yet
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Active Voice Channels */}
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h3" sx={{ color: 'primary.main' }}>
                    Active Voice Channels
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>
                    Currently active temporary voice channels
                  </Typography>

                  <Divider />

                  {settings?.voiceChannels && settings.voiceChannels.length > 0 ? (
                    <Stack direction="column" spacing={1}>
                      {settings.voiceChannels.map(channel => (
                        <Box
                          key={channel.id}
                          sx={{
                            p: '12px 16px',
                            background: alpha(theme.palette.success.main, 0.05),
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="column" spacing={0.5}>
                              <Typography
                                sx={{
                                  fontWeight: 600,
                                  color: 'common.white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <VolumeUpIcon sx={{ fontSize: '1rem' }} /> {channel.name}
                              </Typography>
                              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                Created {new Date(channel.createdAt).toLocaleString()}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {channel.isTemporary && (
                                <Chip label="Temporary" color="info" size="small" />
                              )}
                              <Chip label="Active" color="success" size="small" />
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography
                      sx={{ color: 'text.secondary', textAlign: 'center', padding: '20px' }}
                    >
                      No active voice channels
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* Events Tab */}
          <TabPanel selectedTab={selectedTab} tab="events">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">Event Discord Settings</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure how events are announced, RSVP'd, and reminded in your Discord server.
                  </Typography>
                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Server Timezone
                  </Typography>
                  <Autocomplete
                    size="small"
                    fullWidth
                    options={serverTimezoneOptions}
                    value={serverTimezone === '' ? null : serverTimezone}
                    onChange={(_, newValue) => setServerTimezone(newValue ?? '')}
                    autoHighlight
                    openOnFocus
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Server Timezone"
                        placeholder="Select a timezone"
                        helperText="Common timezones are listed first, followed by all available IANA timezones."
                      />
                    )}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={async () => {
                      if (connectedGuilds.length === 0) {
                        notification.error(
                          'No connected Discord server. Connect a server before saving.'
                        );
                        return;
                      }
                      try {
                        await discordService.updateTimezone(
                          organizationId,
                          connectedGuilds[0].guildId,
                          serverTimezone
                        );
                      } catch {
                        // handled by save
                      }
                    }}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Save Timezone
                  </Button>

                  <Divider />

                  <ChannelPicker
                    label="Announcement Channel"
                    value={eventSettings.eventAnnouncementChannelId}
                    onChange={v =>
                      setEventSettings(prev => ({ ...prev, eventAnnouncementChannelId: v }))
                    }
                    channels={textChannels}
                    helperText="Events will be posted to this channel automatically. Announcement channels (📢) are included."
                    channelType="text"
                  />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.autoPublishAnnouncements}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            autoPublishAnnouncements: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Auto-publish messages in announcement channels"
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
                    When enabled, messages sent to Discord announcement channels will be
                    automatically published (crossposted) to all servers following the channel.
                  </Typography>

                  <RolePicker
                    label="Notification Role (legacy single role)"
                    value={eventSettings.eventNotificationRoleId}
                    onChange={v =>
                      setEventSettings(prev => ({ ...prev, eventNotificationRoleId: v }))
                    }
                    roles={guildRoles}
                    helperText="Optional. Use the multi-role picker below for new configurations."
                  />

                  <MultiRolePicker
                    label="Event Notification Roles"
                    values={eventSettings.eventNotificationRoleIds}
                    onChange={vals =>
                      setEventSettings(prev => ({ ...prev, eventNotificationRoleIds: vals }))
                    }
                    roles={guildRoles}
                    helperText="All selected roles will be pinged when a new event is announced. Pre-populated as defaults when creating events."
                  />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.enableEventMentions}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            enableEventMentions: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Mention selected roles when posting new events"
                  />

                  <RolePicker
                    label="Event Creation Role"
                    value={eventSettings.eventCreationRoleId}
                    onChange={v => setEventSettings(prev => ({ ...prev, eventCreationRoleId: v }))}
                    roles={guildRoles}
                    helperText="Only members with this role can create events via Discord. Leave blank to allow all."
                  />

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Discord Scheduled Events
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.createDiscordEvent}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            createDiscordEvent: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Auto-create Discord Scheduled Events for new activities"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                    Events will appear in Discord's calendar sidebar and members get native
                    notifications. Can be overridden per event.
                  </Typography>

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Voice Channels
                  </Typography>

                  <ChannelPicker
                    label="Event Voice Channel Category"
                    value={eventSettings.eventVoiceCategoryId}
                    onChange={v => setEventSettings(prev => ({ ...prev, eventVoiceCategoryId: v }))}
                    channels={categoryChannels}
                    channelType="category"
                    helperText="Category under which voice channels for scheduled events are created. Leave empty for Discord default."
                  />

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Event Threads
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.createEventThread}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            createEventThread: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Auto-create discussion thread on event embeds"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                    A thread will be created on the event announcement message where participants
                    can discuss, coordinate, and view event logs.
                  </Typography>

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    RSVP &amp; Participation
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.allowEventRsvp}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            allowEventRsvp: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Enable RSVP buttons on event posts"
                  />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.tempRolesEnabled}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            tempRolesEnabled: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Create temporary Discord roles for event participants"
                  />

                  {eventSettings.tempRolesEnabled && (
                    <TextField
                      label="Temp Role Color (hex)"
                      placeholder="#3498db"
                      size="small"
                      sx={{ maxWidth: 200 }}
                      value={`#${eventSettings.tempRoleColor.toString(16).padStart(6, '0')}`}
                      onChange={e => {
                        const hex = e.target.value.replace('#', '');
                        const parsed = Number.parseInt(hex, 16);
                        if (!Number.isNaN(parsed)) {
                          setEventSettings(prev => ({
                            ...prev,
                            tempRoleColor: parsed,
                          }));
                        }
                      }}
                    />
                  )}

                  <TextField
                    label="Max Cross-Server Mirrors"
                    type="number"
                    size="small"
                    sx={{ maxWidth: 200 }}
                    value={eventSettings.maxMirrorsPerActivity}
                    onChange={e =>
                      setEventSettings(prev => ({
                        ...prev,
                        maxMirrorsPerActivity: Math.max(
                          1,
                          Math.min(10, Number(e.target.value) || 1)
                        ),
                      }))
                    }
                    helperText="How many servers can mirror a single event (1-10)"
                    slotProps={{ htmlInput: { min: 1, max: 10 } }}
                  />

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Reminders
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.remindersEnabled}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            remindersEnabled: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Enable event reminders"
                  />

                  {eventSettings.remindersEnabled && (
                    <Stack direction="column" spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        Remind members this many hours before the event:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {eventSettings.reminderHoursBefore.map(h => (
                          <Chip
                            key={h}
                            label={h >= 1 ? `${h}h` : `${h * 60}m`}
                            onDelete={() => handleRemoveReminderHour(h)}
                          />
                        ))}
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            size="small"
                            sx={{ width: 100 }}
                            placeholder="Hours"
                            type="number"
                            value={newReminderHour}
                            onChange={e => setNewReminderHour(e.target.value)}
                            slotProps={{ htmlInput: { min: 0.25, max: 168, step: 0.25 } }}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!newReminderHour}
                            onClick={handleAddReminderHour}
                          >
                            Add
                          </Button>
                        </Stack>
                      </Stack>
                    </Stack>
                  )}

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Message Cleanup
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={eventSettings.autoDeleteEventMessages}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            autoDeleteEventMessages: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Auto-delete event messages after the event"
                  />

                  {eventSettings.autoDeleteEventMessages && (
                    <Stack direction="column" spacing={2}>
                      <TextField
                        label="Cleanup Trigger"
                        value={eventSettings.cleanupMode}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            cleanupMode: e.target.value as 'afterEnd' | 'afterComplete',
                          }))
                        }
                        size="small"
                        fullWidth
                        select
                        helperText="When to start counting cleanup time"
                        sx={{ maxWidth: 340 }}
                        slotProps={{
                          select: {
                            inputProps: {
                              title: 'Cleanup Trigger',
                              'aria-label': 'Cleanup Trigger',
                            },
                          },
                        }}
                      >
                        <MenuItem value="afterEnd">
                          After the event&apos;s scheduled end time
                        </MenuItem>
                        <MenuItem value="afterComplete">
                          After the event is marked completed
                        </MenuItem>
                      </TextField>

                      <TextField
                        label="Cleanup Delay (hours)"
                        type="number"
                        size="small"
                        sx={{ maxWidth: 200 }}
                        value={eventSettings.cleanupHoursAfterEnd}
                        onChange={e =>
                          setEventSettings(prev => ({
                            ...prev,
                            cleanupHoursAfterEnd: Math.max(
                              1,
                              Math.min(720, Number(e.target.value) || 48)
                            ),
                          }))
                        }
                        helperText="Hours to wait after the trigger before deleting messages (1–720)"
                        slotProps={{ htmlInput: { min: 1, max: 720 } }}
                      />
                    </Stack>
                  )}

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Event Archive
                  </Typography>
                  <ChannelPicker
                    label="Archive Channel"
                    value={eventArchiveChannelId}
                    onChange={v => setEventArchiveChannelId(v)}
                    channels={textChannels}
                    channelType="text"
                    helperText="Completed events will be summarized and posted here"
                  />
                  <TextField
                    label="Archive After (hours)"
                    type="number"
                    size="small"
                    sx={{ maxWidth: 200 }}
                    value={eventArchiveAfterHours}
                    onChange={e =>
                      setEventArchiveAfterHours(
                        Math.max(1, Math.min(168, Number(e.target.value) || 24))
                      )
                    }
                    helperText="Hours after event ends before archiving (1-168)"
                    slotProps={{ htmlInput: { min: 1, max: 168 } }}
                  />

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    RSVP Role Restrictions
                  </Typography>
                  <MultiRolePicker
                    label="Allowed Roles"
                    values={eventAllowedRoleIds
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)}
                    onChange={vals => setEventAllowedRoleIds(vals.join(', '))}
                    roles={guildRoles}
                    helperText="Only members with these roles can RSVP. Leave blank to allow everyone."
                  />
                  <MultiRolePicker
                    label="Banned Roles"
                    values={eventBannedRoleIds
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)}
                    onChange={vals => setEventBannedRoleIds(vals.join(', '))}
                    roles={guildRoles}
                    helperText="Members with any of these roles are blocked from RSVPing"
                  />

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Advanced Event Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fine-tune event behaviour for capacity, waitlists, and duplicate prevention.
                  </Typography>
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(
                          guildSettingsData?.advancedEventSettings?.lockWhenFull ?? false
                        )}
                        onChange={async e => {
                          try {
                            await discordService.updateAdvancedEventSettings(
                              organizationId,
                              connectedGuilds[0]?.guildId ?? settings?.guildId,
                              {
                                lockWhenFull: e.target.checked,
                              }
                            );
                            invalidateGuildSettings();
                            notification.success('Lock-when-full updated');
                          } catch {
                            notification.error('Failed to update lock-when-full setting');
                          }
                        }}
                      />
                    }
                    label="Auto-lock signup when event reaches capacity"
                  />
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(
                          guildSettingsData?.advancedEventSettings?.benchEnabled ?? false
                        )}
                        onChange={async e => {
                          try {
                            await discordService.updateAdvancedEventSettings(
                              organizationId,
                              connectedGuilds[0]?.guildId ?? settings?.guildId,
                              {
                                benchEnabled: e.target.checked,
                              }
                            );
                            invalidateGuildSettings();
                            notification.success('Bench/waitlist updated');
                          } catch {
                            notification.error('Failed to update bench/waitlist setting');
                          }
                        }}
                      />
                    }
                    label="Enable bench/overflow waitlist"
                  />
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(
                          guildSettingsData?.advancedEventSettings?.preventDuplicateRsvp ?? false
                        )}
                        onChange={async e => {
                          try {
                            await discordService.updateAdvancedEventSettings(
                              organizationId,
                              connectedGuilds[0]?.guildId ?? settings?.guildId,
                              {
                                preventDuplicateRsvp: e.target.checked,
                              }
                            );
                            invalidateGuildSettings();
                            notification.success('Duplicate RSVP prevention updated');
                          } catch {
                            notification.error('Failed to update duplicate RSVP setting');
                          }
                        }}
                      />
                    }
                    label="Prevent duplicate RSVPs across overlapping events"
                  />
                  <TextField
                    label="Signup deadline (hours before start, 0 = none)"
                    type="number"
                    size="small"
                    defaultValue={
                      guildSettingsData?.advancedEventSettings?.signupDeadlineHours ?? 0
                    }
                    slotProps={{ htmlInput: { min: 0, max: 168 } }}
                    onBlur={async e => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (val >= 0 && val <= 168) {
                        try {
                          await discordService.updateAdvancedEventSettings(
                            organizationId,
                            connectedGuilds[0]?.guildId ?? settings?.guildId,
                            {
                              signupDeadlineHours: val,
                            }
                          );
                          invalidateGuildSettings();
                          notification.success('Signup deadline updated');
                        } catch {
                          notification.error('Failed to update signup deadline');
                        }
                      }
                    }}
                    sx={{ maxWidth: 320 }}
                  />

                  <Divider />

                  <Button
                    variant="contained"
                    onClick={handleSaveEventSettings}
                    disabled={eventsSaving}
                    startIcon={eventsSaving ? <CircularProgress size={16} /> : <SettingsIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {eventsSaving ? 'Saving...' : 'Save Event Settings'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* Notifications Tab */}
          <TabPanel selectedTab={selectedTab} tab="notifications">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">Notification Channels</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure which Discord channels receive automated notifications from the
                    platform.
                  </Typography>
                  <Divider />

                  <ChannelPicker
                    label="Announcement Channel"
                    value={notifPrefs.announcementChannelId}
                    onChange={v => setNotifPrefs(prev => ({ ...prev, announcementChannelId: v }))}
                    channels={textChannels}
                    channelType="text"
                    helperText="Channel for general announcements"
                  />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={notifPrefs.autoPublishAnnouncements}
                        onChange={e =>
                          setNotifPrefs(prev => ({
                            ...prev,
                            autoPublishAnnouncements: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Auto-publish messages in announcement channels"
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
                    When enabled, messages sent to Discord announcement channels will be
                    automatically published (crossposted) to all servers following the channel.
                  </Typography>

                  <ChannelPicker
                    label="Pinned Announcement Channel"
                    value={notifPrefs.pinnedAnnouncementChannelId}
                    onChange={v =>
                      setNotifPrefs(prev => ({ ...prev, pinnedAnnouncementChannelId: v }))
                    }
                    channels={textChannels}
                    channelType="text"
                    helperText="Channel for important pinned announcements"
                  />

                  <ChannelPicker
                    label="System Alert Channel"
                    value={notifPrefs.systemAlertChannelId}
                    onChange={v => setNotifPrefs(prev => ({ ...prev, systemAlertChannelId: v }))}
                    channels={textChannels}
                    channelType="text"
                    helperText="Channel for system status alerts"
                  />

                  <ChannelPicker
                    label="Moderation Alert Channel"
                    value={notifPrefs.moderationAlertChannelId}
                    onChange={v =>
                      setNotifPrefs(prev => ({ ...prev, moderationAlertChannelId: v }))
                    }
                    channels={textChannels}
                    channelType="text"
                    helperText="Channel for moderation incident alerts"
                  />

                  <ChannelPicker
                    label="Audit Log Channel"
                    value={notifPrefs.auditLogChannelId}
                    onChange={v => setNotifPrefs(prev => ({ ...prev, auditLogChannelId: v }))}
                    channels={textChannels}
                    channelType="text"
                    helperText="Channel for audit log entries"
                  />

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Event Triggers
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={notifPrefs.memberJoinNotifications}
                        onChange={e =>
                          setNotifPrefs(prev => ({
                            ...prev,
                            memberJoinNotifications: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Notify when a new member joins"
                  />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={notifPrefs.memberLeaveNotifications}
                        onChange={e =>
                          setNotifPrefs(prev => ({
                            ...prev,
                            memberLeaveNotifications: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Notify when a member leaves"
                  />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={notifPrefs.roleChangeNotifications}
                        onChange={e =>
                          setNotifPrefs(prev => ({
                            ...prev,
                            roleChangeNotifications: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Notify on role changes"
                  />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={notifPrefs.eventNotifications}
                        onChange={e =>
                          setNotifPrefs(prev => ({
                            ...prev,
                            eventNotifications: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Notify for event activity (create, cancel, update)"
                  />

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Mention Roles
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={notifPrefs.enableMentionRolesToNotify}
                        onChange={e =>
                          setNotifPrefs(prev => ({
                            ...prev,
                            enableMentionRolesToNotify: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Mention specific roles in notifications"
                  />

                  {notifPrefs.enableMentionRolesToNotify && (
                    <MultiRolePicker
                      label="Mention Roles"
                      values={notifPrefs.notificationMentionRoles
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean)}
                      onChange={vals =>
                        setNotifPrefs(prev => ({
                          ...prev,
                          notificationMentionRoles: vals.join(', '),
                        }))
                      }
                      roles={guildRoles}
                      helperText="Roles to mention in notifications"
                    />
                  )}

                  <Divider />

                  <Button
                    variant="contained"
                    onClick={handleSaveNotifPrefs}
                    disabled={notifSaving}
                    startIcon={notifSaving ? <CircularProgress size={16} /> : <SettingsIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {notifSaving ? 'Saving...' : 'Save Notification Settings'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* RSI Status Tab */}
          <TabPanel selectedTab={selectedTab} tab="rsi-status">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Typography variant="h6">RSI Status Panel</Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        void handleRefreshRsiStatus();
                      }}
                      disabled={rsiStatusLoading || rsiStatusSaving}
                    >
                      Refresh
                    </Button>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Deploy a live RSI status panel to a text channel. The panel auto-updates every 5
                    minutes.
                  </Typography>

                  <ChannelPicker
                    label="Panel Channel"
                    value={rsiPanelChannelId}
                    onChange={setRsiPanelChannelId}
                    channels={textChannels}
                    channelType="text"
                    helperText="Text channel used for the status panel message"
                  />

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      variant="contained"
                      onClick={() => {
                        void handleDeployRsiStatusPanel();
                      }}
                      disabled={rsiStatusSaving || rsiStatusLoading || !rsiPanelChannelId}
                      startIcon={rsiStatusSaving ? <CircularProgress size={16} /> : <InfoIcon />}
                    >
                      Deploy / Replace Panel
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        void handleRemoveRsiStatusPanel();
                      }}
                      disabled={rsiStatusSaving || rsiStatusLoading}
                    >
                      Remove Panel
                    </Button>
                  </Stack>

                  {rsiStatusConfig?.panel ? (
                    <Alert severity="info">
                      Panel is currently deployed in{' '}
                      <strong>{rsiStatusConfig.panel.channelId}</strong>.{' '}
                      <Button
                        size="small"
                        component="a"
                        href={rsiStatusConfig.panel.messageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ ml: 1 }}
                      >
                        Open Panel
                      </Button>
                    </Alert>
                  ) : (
                    <Alert severity="warning">No RSI status panel is currently deployed.</Alert>
                  )}
                </Stack>
              </Box>

              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">RSI Status Channels</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Application mirrors RSI Platform status. Servers mirrors RSI Persistent Universe
                    status. Choose either a text or voice channel for each role.
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      onClick={() => {
                        void handleCreateManagedRsiStatusChannels();
                      }}
                      disabled={rsiStatusSaving || rsiStatusLoading}
                    >
                      Create Managed Voice Channels
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        void handleRemoveRsiStatusChannels();
                      }}
                      disabled={rsiStatusSaving || rsiStatusLoading}
                    >
                      Remove All Status Channels
                    </Button>
                  </Stack>

                  <Divider />

                  <ChannelPicker
                    label="Application Status Channel"
                    value={rsiApplicationChannelId}
                    onChange={setRsiApplicationChannelId}
                    channels={guildChannels}
                    channelType="status"
                    helperText="Channel name will reflect RSI Platform status"
                  />
                  <Button
                    variant="contained"
                    onClick={() => {
                      void handleAssignRsiStatusChannel('application');
                    }}
                    disabled={rsiStatusSaving || rsiStatusLoading || !rsiApplicationChannelId}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Save Application Channel
                  </Button>

                  {rsiStatusConfig?.channels.application ? (
                    <Alert severity="success">
                      Application currently targets{' '}
                      <strong>
                        {rsiStatusConfig.channels.application.channelName ?? 'Unknown'}
                      </strong>{' '}
                      ({rsiStatusConfig.channels.application.channelType},
                      {rsiStatusConfig.channels.application.managed ? ' managed' : ' existing'}).
                    </Alert>
                  ) : null}

                  <Divider />

                  <ChannelPicker
                    label="Server Status Channel"
                    value={rsiServerChannelId}
                    onChange={setRsiServerChannelId}
                    channels={guildChannels}
                    channelType="status"
                    helperText="Channel name will reflect RSI Persistent Universe status"
                  />
                  <Button
                    variant="contained"
                    onClick={() => {
                      void handleAssignRsiStatusChannel('server');
                    }}
                    disabled={rsiStatusSaving || rsiStatusLoading || !rsiServerChannelId}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Save Server Channel
                  </Button>

                  {rsiStatusConfig?.channels.server ? (
                    <Alert severity="success">
                      Servers currently target{' '}
                      <strong>{rsiStatusConfig.channels.server.channelName ?? 'Unknown'}</strong> (
                      {rsiStatusConfig.channels.server.channelType},
                      {rsiStatusConfig.channels.server.managed ? ' managed' : ' existing'}).
                    </Alert>
                  ) : null}
                </Stack>
              </Box>

              {rsiStatusConfig?.latestSnapshot ? (
                <Box sx={{ borderRadius: 1, p: 2 }}>
                  <Stack direction="column" spacing={1.5}>
                    <Typography variant="h6">Latest RSI Snapshot</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {rsiStatusConfig.latestSnapshot.overallStatus}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {rsiStatusConfig.latestSnapshot.components.map(component => (
                        <Chip
                          key={component.name}
                          size="small"
                          label={`${component.emoji} ${component.name}: ${component.status}`}
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </TabPanel>

          {/* Comm Links Tab */}
          <TabPanel selectedTab={selectedTab} tab="tunnels">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              {/* Create New Comm Link */}
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h3" sx={{ color: 'primary.main' }}>
                    Create New Comm Link
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', marginBottom: '8px' }}>
                    Connect text channels across different Discord servers via comm links
                  </Typography>

                  <Stack direction="column" spacing={2}>
                    <TextField
                      label="Comm Link Name"
                      value={newTunnelName}
                      onChange={e => setNewTunnelName(e.target.value)}
                      size="small"
                      fullWidth
                      placeholder="e.g., Alliance Chat"
                    />
                    <ChannelPicker
                      label="Channel"
                      value={newTunnelChannelId}
                      onChange={v => setNewTunnelChannelId(v)}
                      channels={textChannels}
                      channelType="text"
                      helperText="Text channel to connect to the comm link"
                    />
                    {!newTunnelPublic && (
                      <TextField
                        label="Password"
                        value={newTunnelPassword}
                        onChange={e => setNewTunnelPassword(e.target.value)}
                        type="password"
                        size="small"
                        fullWidth
                      />
                    )}
                    <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={newTunnelPublic}
                            onChange={(_, checked) => setNewTunnelPublic(checked)}
                          />
                        }
                        label="Public Comm Link"
                      />
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={newTunnelContentFilter}
                            onChange={(_, checked) => setNewTunnelContentFilter(checked)}
                          />
                        }
                        label="Content Filter"
                      />
                      <Button
                        variant="contained"
                        onClick={handleCreateTunnel}
                        disabled={!newTunnelName || !newTunnelChannelId}
                        startIcon={<Add />}
                      >
                        Create Comm Link
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Box>

              {/* Active Tunnels */}
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h3" sx={{ color: 'primary.main' }}>
                    Active Comm Links
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>
                    Manage your organization's cross-server text channel connections
                  </Typography>

                  <Divider />

                  {settings?.tunnels && settings.tunnels.length > 0 ? (
                    <Stack direction="column" spacing={2}>
                      {settings.tunnels.map(tunnel => (
                        <Box
                          key={tunnel.id}
                          sx={{
                            p: '16px',
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                            borderRadius: 3,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          }}
                        >
                          <Stack direction="column" spacing={1.5}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box
                                  sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 2,
                                    background: alpha(theme.palette.primary.main, 0.2),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <LinkIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                                </Box>
                                <Stack direction="column">
                                  <Typography
                                    sx={{
                                      fontWeight: 600,
                                      color: 'common.white',
                                      fontSize: '1rem',
                                    }}
                                  >
                                    {tunnel.name}
                                  </Typography>
                                  <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                    ID: {tunnel.id}
                                  </Typography>
                                </Stack>
                              </Stack>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  label={tunnel.isPublic ? 'Public' : 'Private'}
                                  color={tunnel.isPublic ? 'success' : 'default'}
                                  size="small"
                                />
                                {tunnel.contentFilterEnabled && (
                                  <Chip label="Filtered" color="info" size="small" />
                                )}
                                <Tooltip title="Edit comm link" arrow>
                                  <IconButton
                                    aria-label="Edit comm link"
                                    onClick={() => handleOpenEditTunnel(tunnel)}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete comm link" arrow>
                                  <IconButton
                                    aria-label="Delete comm link"
                                    onClick={() =>
                                      handleDeleteTunnel(tunnel.id, tunnel.creatorGuildId)
                                    }
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </Stack>

                            <Divider />

                            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                <Box component="strong" sx={{ color: 'primary.main' }}>
                                  {tunnel.connectedChannels.length}
                                </Box>{' '}
                                connected channel
                                {tunnel.connectedChannels.length === 1 ? '' : 's'}
                              </Typography>
                              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                Created {new Date(tunnel.createdAt).toLocaleDateString()}
                              </Typography>
                              {tunnel.rateLimitConfig && (
                                <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                  Rate limit: {tunnel.rateLimitConfig.maxMessages} msgs/
                                  {tunnel.rateLimitConfig.windowMs / 1000}s
                                </Typography>
                              )}
                            </Stack>

                            {tunnel.connectedChannels.length > 0 && (
                              <Stack direction="column" spacing={0.5}>
                                <Typography
                                  sx={{
                                    color: 'text.secondary',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  Linked Servers &amp; Channels
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  {tunnel.connectedChannels.map(conn => {
                                    const guildName =
                                      conn.guildName ??
                                      connectedGuilds.find(g => g.guildId === conn.guildId)
                                        ?.guildName ??
                                      conn.guildId;
                                    const channelName =
                                      conn.channelName ??
                                      guildChannels.find(ch => ch.id === conn.channelId)?.name ??
                                      conn.channelId;
                                    return (
                                      <Chip
                                        key={`${conn.guildId}-${conn.channelId}`}
                                        label={`${guildName} → #${channelName}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          borderColor: alpha(theme.palette.primary.main, 0.4),
                                          color: 'text.secondary',
                                          fontSize: '0.75rem',
                                        }}
                                      />
                                    );
                                  })}
                                </Stack>
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography
                      sx={{ color: 'text.secondary', textAlign: 'center', padding: '20px' }}
                    >
                      No active comm links. Create a comm link to connect text channels across
                      servers.
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Edit Tunnel Dialog */}
              <Dialog
                open={!!editingTunnel}
                onClose={handleCloseEditTunnel}
                maxWidth="sm"
                fullWidth
              >
                <DialogTitle>Edit Comm Link</DialogTitle>
                <Divider />
                <DialogContent>
                  <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
                    <TextField
                      label="Comm Link Name"
                      value={editTunnelName}
                      onChange={e => setEditTunnelName(e.target.value)}
                      fullWidth
                      required
                    />
                    {editingTunnel && !editingTunnel.isPublic && (
                      <TextField
                        label="Invite Code"
                        value={editingTunnel.inviteCode}
                        fullWidth
                        slotProps={{
                          input: {
                            readOnly: true,
                            endAdornment: (
                              <InputAdornment position="end">
                                <Tooltip title="Copy invite code" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      navigator.clipboard.writeText(editingTunnel.inviteCode);
                                    }}
                                  >
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Regenerate invite code" arrow>
                                  <IconButton
                                    size="small"
                                    disabled={loading}
                                    onClick={async () => {
                                      try {
                                        setLoading(true);
                                        const newCode = await discordService.regenerateInviteCode(
                                          editingTunnel.id
                                        );
                                        setEditingTunnel({
                                          ...editingTunnel,
                                          inviteCode: newCode,
                                        });
                                      } catch (err: unknown) {
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Failed to regenerate invite code'
                                        );
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                  >
                                    <RefreshIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </InputAdornment>
                            ),
                          },
                        }}
                        helperText="Share this code to let other servers join this private comm link"
                      />
                    )}
                    <FormControlLabel
                      control={
                        <MuiSwitch
                          checked={editTunnelContentFilter}
                          onChange={(_, checked) => setEditTunnelContentFilter(checked)}
                        />
                      }
                      label="Content Filter"
                    />
                    <FormControlLabel
                      control={
                        <MuiSwitch
                          checked={editTunnelAllowBotMessages}
                          onChange={(_, checked) => setEditTunnelAllowBotMessages(checked)}
                        />
                      }
                      label="Allow Bot Messages"
                    />
                    <TextField
                      label="Max Connected Servers"
                      type="number"
                      value={editTunnelMaxServers}
                      onChange={e => setEditTunnelMaxServers(Number(e.target.value))}
                      slotProps={{ htmlInput: { min: 0, max: 1000 } }}
                      helperText="0 = unlimited"
                      fullWidth
                    />

                    {editingTunnel && editingTunnel.connectedChannels.length > 0 && (
                      <>
                        <Typography
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            mt: 1,
                          }}
                        >
                          Connected Channels
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {editingTunnel.connectedChannels.map(conn => {
                            const guildName =
                              conn.guildName ??
                              connectedGuilds.find(g => g.guildId === conn.guildId)?.guildName ??
                              conn.guildId;
                            const channelName =
                              conn.channelName ??
                              guildChannels.find(ch => ch.id === conn.channelId)?.name ??
                              conn.channelId;
                            return (
                              <Chip
                                key={`${conn.guildId}-${conn.channelId}`}
                                label={`${guildName} → #${channelName}`}
                                size="small"
                                variant="outlined"
                              />
                            );
                          })}
                        </Stack>
                      </>
                    )}
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" onClick={handleCloseEditTunnel} disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveEditTunnel}
                    disabled={!editTunnelName || loading}
                  >
                    {loading ? 'Saving…' : 'Save'}
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Tunnel Info */}
              <Box
                sx={{
                  borderRadius: 1,
                  p: 2,
                  background: alpha(theme.palette.warning.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                }}
              >
                <Stack direction="column" spacing={1}>
                  <Typography variant="h4" sx={{ color: 'warning.main' }}>
                    <LightbulbOutlinedIcon
                      sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }}
                    />{' '}
                    How Comm Links Work
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                    Comm links relay messages between text channels across different Discord
                    servers. When someone sends a message in a connected channel, it appears in all
                    other linked channels — showing the sender&apos;s server nickname and which
                    server they&apos;re writing from.
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 1 }}>
                    <strong>What gets relayed:</strong> text messages, images, files, stickers, rich
                    embeds, and replies (with a quoted preview of the original message). When
                    someone edits a message, the edit is automatically forwarded to all connected
                    channels. System messages like joins, pins, and boosts are filtered out. For
                    safety, @everyone and @here pings are blocked — only individual user mentions go
                    through.
                  </Typography>
                  <Typography
                    sx={{ color: 'text.secondary', fontSize: '0.875rem', marginTop: '8px' }}
                  >
                    <strong>Bot Commands:</strong> Type <code>/commlink</code> in Discord to open
                    the comm link panel. All actions are buttons: <strong>List</strong> (see your
                    tunnels), <strong>Create</strong> (start a new tunnel), <strong>Join</strong>{' '}
                    (pick a tunnel from a menu), <strong>Link by Code</strong> (paste an invite
                    code), <strong>Leave</strong> (disconnect this channel), <strong>Info</strong>{' '}
                    (view tunnel details), <strong>Settings</strong> (rename, toggle public, set
                    password), and <strong>Delete</strong> (remove a tunnel).
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* Ticketing Tab */}
          <TabPanel selectedTab={selectedTab} tab="ticketing">
            <TicketingTabContent
              ticketSettings={ticketSettings}
              setTicketSettings={setTicketSettings}
              categoryChannels={categoryChannels}
              textChannels={textChannels}
              guildRoles={guildRoles}
              ticketAccessControl={ticketAccessControl}
              setTicketAccessControl={setTicketAccessControl}
              ticketRateSupportEnabled={ticketRateSupportEnabled}
              setTicketRateSupportEnabled={setTicketRateSupportEnabled}
              ticketChannelNameTemplate={ticketChannelNameTemplate}
              setTicketChannelNameTemplate={setTicketChannelNameTemplate}
              onSaveTicketSettings={handleSaveTicketSettings}
              ticketingSaving={ticketingSaving}
              quickResponseCategories={quickResponseCategories}
              quickResponses={quickResponses}
              newQrCatName={newQrCatName}
              setNewQrCatName={setNewQrCatName}
              onCreateQuickResponseCategory={handleCreateQuickResponseCategory}
              onDeleteQuickResponseCategory={handleDeleteQuickResponseCategory}
              newQrName={newQrName}
              setNewQrName={setNewQrName}
              newQrContent={newQrContent}
              setNewQrContent={setNewQrContent}
              onCreateQuickResponse={handleCreateQuickResponse}
              onDeleteQuickResponse={handleDeleteQuickResponse}
            />
          </TabPanel>

          {/* Recruitment Tab */}
          <TabPanel selectedTab={selectedTab} tab="recruitment">
            <RecruitmentTabContent
              recruitmentSettings={recruitmentSettings}
              setRecruitmentSettings={setRecruitmentSettings}
              textChannels={textChannels}
              guildRoles={guildRoles}
              recruitDeniedMessage={recruitDeniedMessage}
              setRecruitDeniedMessage={setRecruitDeniedMessage}
              recruitConfirmationMessage={recruitConfirmationMessage}
              setRecruitConfirmationMessage={setRecruitConfirmationMessage}
              recruitCompletionMessage={recruitCompletionMessage}
              setRecruitCompletionMessage={setRecruitCompletionMessage}
              recruitAdvRoles={recruitAdvRoles}
              setRecruitAdvRoles={setRecruitAdvRoles}
              recruitTimeLimitMinutes={recruitTimeLimitMinutes}
              setRecruitTimeLimitMinutes={setRecruitTimeLimitMinutes}
              recruitActionOnLeave={recruitActionOnLeave}
              setRecruitActionOnLeave={setRecruitActionOnLeave}
              onSaveRecruitmentSettings={handleSaveRecruitmentSettings}
              recruitmentSaving={recruitmentSaving}
            />
          </TabPanel>

          {/* LFG Tab */}
          <TabPanel selectedTab={selectedTab} tab="lfg">
            <LfgSettingsPanel
              settings={lfgSettings}
              onChange={setLfgSettings}
              onSave={handleSaveLfgSettings}
              saving={lfgSaving}
              textChannels={textChannels}
              voiceChannels={voiceChannels}
              roles={guildRoles}
              organizationId={organizationId}
            />
          </TabPanel>

          {/* Team Voice Tab */}
          <TabPanel selectedTab={selectedTab} tab="team-voice">
            <TeamVoiceTabContent
              teamVoiceSettings={teamVoiceSettings}
              setTeamVoiceSettings={setTeamVoiceSettings}
              categoryChannels={categoryChannels}
              guildRoles={guildRoles}
              teamVoiceSaving={teamVoiceSaving}
              onSaveTeamVoiceSettings={handleSaveTeamVoiceSettings}
            />
          </TabPanel>

          {/* Role Sync Tab */}
          <TabPanel selectedTab={selectedTab} tab="role-sync">
            <RoleSyncTabContent
              roleSyncSettings={roleSyncSettings}
              setRoleSyncSettings={setRoleSyncSettings}
              guildRoles={guildRoles}
              textChannels={textChannels}
              assistantRoleIds={assistantRoleIds}
              setAssistantRoleIds={setAssistantRoleIds}
              roleSyncSaving={roleSyncSaving}
              onSaveRoleSyncSettings={handleSaveRoleSyncSettings}
            />
          </TabPanel>

          {/* Cross-Moderation Tab */}
          <TabPanel selectedTab={selectedTab} tab="cross-moderation">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">Cross-Server Moderation</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Share ban/mute lists across allied Discord servers and propagate moderation
                    actions automatically.
                  </Typography>
                  <Divider />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={crossModSettings.enabled}
                        onChange={e =>
                          setCrossModSettings(prev => ({ ...prev, enabled: e.target.checked }))
                        }
                      />
                    }
                    label="Enable Cross-Server Moderation"
                  />

                  {crossModSettings.enabled && (
                    <Stack direction="column" spacing={2} sx={{ pl: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Shared Lists
                      </Typography>

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={crossModSettings.sharedBanListEnabled}
                            onChange={e =>
                              setCrossModSettings(prev => ({
                                ...prev,
                                sharedBanListEnabled: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Share ban list with allied servers"
                      />

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={crossModSettings.sharedMuteListEnabled}
                            onChange={e =>
                              setCrossModSettings(prev => ({
                                ...prev,
                                sharedMuteListEnabled: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Share mute list with allied servers"
                      />

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={crossModSettings.autoBanOnSharedList}
                            onChange={e =>
                              setCrossModSettings(prev => ({
                                ...prev,
                                autoBanOnSharedList: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Auto-ban users on shared ban list"
                      />
                      {crossModSettings.autoBanOnSharedList && (
                        <Alert severity="warning" sx={{ ml: 2 }}>
                          Users banned by allied servers will be automatically banned here. Use with
                          caution.
                        </Alert>
                      )}

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={crossModSettings.propagateTimeouts}
                            onChange={e =>
                              setCrossModSettings(prev => ({
                                ...prev,
                                propagateTimeouts: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Propagate timeouts to allied servers"
                      />

                      <Divider />

                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Notifications
                      </Typography>

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={crossModSettings.forwardModerationAlerts}
                            onChange={e =>
                              setCrossModSettings(prev => ({
                                ...prev,
                                forwardModerationAlerts: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Forward moderation alerts from allied servers"
                      />

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={crossModSettings.notifyOnSharedAction}
                            onChange={e =>
                              setCrossModSettings(prev => ({
                                ...prev,
                                notifyOnSharedAction: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Notify when a shared action is executed"
                      />

                      <Divider />

                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Channels &amp; Roles
                      </Typography>

                      <ChannelPicker
                        label="Ban Appeals Channel"
                        value={crossModSettings.banAppealsChannelId}
                        onChange={v =>
                          setCrossModSettings(prev => ({ ...prev, banAppealsChannelId: v }))
                        }
                        channels={textChannels}
                        channelType="text"
                        helperText="Channel where ban appeals are reviewed"
                      />

                      <ChannelPicker
                        label="Cross-Guild Audit Log Channel"
                        value={crossModSettings.crossGuildAuditLogChannelId}
                        onChange={v =>
                          setCrossModSettings(prev => ({ ...prev, crossGuildAuditLogChannelId: v }))
                        }
                        channels={textChannels}
                        channelType="text"
                        helperText="Channel for cross-server moderation logs"
                      />

                      <RolePicker
                        label="Escalation Role"
                        value={crossModSettings.escalationRoleId}
                        onChange={v =>
                          setCrossModSettings(prev => ({ ...prev, escalationRoleId: v }))
                        }
                        roles={guildRoles}
                        helperText="Role to ping for escalated moderation actions"
                      />

                      <Divider />

                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Allowed Guilds
                      </Typography>

                      <TextField
                        label="Allowed Guild IDs"
                        placeholder="Comma-separated Discord server IDs"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={crossModSettings.allowedGuildIds}
                        onChange={e =>
                          setCrossModSettings(prev => ({
                            ...prev,
                            allowedGuildIds: e.target.value,
                          }))
                        }
                        helperText="Only share moderation data with these servers. Leave blank for all allied orgs."
                      />
                    </Stack>
                  )}

                  <Divider />

                  <Button
                    variant="contained"
                    onClick={handleSaveCrossModSettings}
                    disabled={crossModSaving}
                    startIcon={crossModSaving ? <CircularProgress size={16} /> : <ShieldIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {crossModSaving ? 'Saving...' : 'Save Moderation Settings'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* Welcome Tab */}
          <TabPanel selectedTab={selectedTab} tab="welcome">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">Welcome &amp; Goodbye</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Greet new members with a channel message and optional DM. Send farewell messages
                    when members leave. Assign roles automatically on join.
                  </Typography>
                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Welcome Message
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={welcomeSettings.welcomeEnabled}
                        onChange={e =>
                          setWelcomeSettings(prev => ({
                            ...prev,
                            welcomeEnabled: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Send welcome message when a member joins"
                  />
                  {welcomeSettings.welcomeEnabled && (
                    <Stack direction="column" spacing={2} sx={{ pl: 2 }}>
                      <ChannelPicker
                        label="Welcome Channel"
                        value={welcomeSettings.welcomeChannelId}
                        onChange={v =>
                          setWelcomeSettings(prev => ({ ...prev, welcomeChannelId: v }))
                        }
                        channels={textChannels}
                        channelType="text"
                      />
                      <TextField
                        label="Welcome Message"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={welcomeSettings.welcomeMessage}
                        onChange={e =>
                          setWelcomeSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))
                        }
                        helperText="Variables: {user} {username} {server} {memberCount}"
                      />
                    </Stack>
                  )}

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={welcomeSettings.welcomeDmEnabled}
                        onChange={e =>
                          setWelcomeSettings(prev => ({
                            ...prev,
                            welcomeDmEnabled: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Send welcome DM to new members"
                  />
                  {welcomeSettings.welcomeDmEnabled && (
                    <TextField
                      label="Welcome DM Message"
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      value={welcomeSettings.welcomeDmMessage}
                      onChange={e =>
                        setWelcomeSettings(prev => ({ ...prev, welcomeDmMessage: e.target.value }))
                      }
                      helperText="Variables: {user} {username} {server} {memberCount}"
                      sx={{ pl: 2 }}
                    />
                  )}

                  <Divider />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Goodbye Message
                  </Typography>

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={welcomeSettings.goodbyeEnabled}
                        onChange={e =>
                          setWelcomeSettings(prev => ({
                            ...prev,
                            goodbyeEnabled: e.target.checked,
                          }))
                        }
                      />
                    }
                    label="Send goodbye message when a member leaves"
                  />
                  {welcomeSettings.goodbyeEnabled && (
                    <Stack direction="column" spacing={2} sx={{ pl: 2 }}>
                      <ChannelPicker
                        label="Goodbye Channel"
                        value={welcomeSettings.goodbyeChannelId}
                        onChange={v =>
                          setWelcomeSettings(prev => ({ ...prev, goodbyeChannelId: v }))
                        }
                        channels={textChannels}
                        channelType="text"
                      />
                      <TextField
                        label="Goodbye Message"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={welcomeSettings.goodbyeMessage}
                        onChange={e =>
                          setWelcomeSettings(prev => ({ ...prev, goodbyeMessage: e.target.value }))
                        }
                        helperText="Variables: {username} {server} {memberCount}"
                      />
                    </Stack>
                  )}

                  <Divider />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Auto-Roles
                  </Typography>
                  <MultiRolePicker
                    label="Auto-Assign Roles"
                    values={welcomeSettings.autoRoleIds
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)}
                    onChange={vals =>
                      setWelcomeSettings(prev => ({ ...prev, autoRoleIds: vals.join(', ') }))
                    }
                    roles={guildRoles}
                    helperText="Roles to assign when a member joins"
                  />

                  <Divider />
                  <Button
                    variant="contained"
                    onClick={handleSaveWelcomeSettings}
                    disabled={welcomeSaving}
                    startIcon={welcomeSaving ? <CircularProgress size={16} /> : <WelcomeIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {welcomeSaving ? 'Saving...' : 'Save Welcome Settings'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* Audit Log Tab */}
          <TabPanel selectedTab={selectedTab} tab="audit-log">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">Audit Logging</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Log Discord events (message edits/deletes, role changes, member joins/leaves,
                    channel changes) to a designated channel.
                  </Typography>
                  <Divider />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={auditLogSettings.enabled}
                        onChange={e =>
                          setAuditLogSettings(prev => ({ ...prev, enabled: e.target.checked }))
                        }
                      />
                    }
                    label="Enable Audit Logging"
                  />

                  {auditLogSettings.enabled && (
                    <Stack direction="column" spacing={2} sx={{ pl: 2 }}>
                      <ChannelPicker
                        label="Log Channel"
                        value={auditLogSettings.logChannelId}
                        onChange={v => setAuditLogSettings(prev => ({ ...prev, logChannelId: v }))}
                        channels={textChannels}
                        channelType="text"
                        helperText="Discord channel where audit log embeds will be posted"
                      />

                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Logged Events
                      </Typography>
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={auditLogSettings.logMessageEdits}
                            onChange={e =>
                              setAuditLogSettings(prev => ({
                                ...prev,
                                logMessageEdits: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Message edits"
                      />
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={auditLogSettings.logMessageDeletes}
                            onChange={e =>
                              setAuditLogSettings(prev => ({
                                ...prev,
                                logMessageDeletes: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Message deletes"
                      />
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={auditLogSettings.logRoleChanges}
                            onChange={e =>
                              setAuditLogSettings(prev => ({
                                ...prev,
                                logRoleChanges: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Role changes"
                      />
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={auditLogSettings.logChannelChanges}
                            onChange={e =>
                              setAuditLogSettings(prev => ({
                                ...prev,
                                logChannelChanges: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Channel create/delete"
                      />
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={auditLogSettings.logMemberJoinLeave}
                            onChange={e =>
                              setAuditLogSettings(prev => ({
                                ...prev,
                                logMemberJoinLeave: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Member join/leave"
                      />

                      <Divider />
                      <MultiChannelPicker
                        label="Ignored Channels"
                        values={auditLogSettings.ignoredChannelIds
                          .split(',')
                          .map(s => s.trim())
                          .filter(Boolean)}
                        onChange={vals =>
                          setAuditLogSettings(prev => ({
                            ...prev,
                            ignoredChannelIds: vals.join(', '),
                          }))
                        }
                        channels={guildChannels}
                        helperText="Channels to exclude from logging"
                      />
                    </Stack>
                  )}

                  <Divider />
                  <Button
                    variant="contained"
                    onClick={handleSaveAuditLogSettings}
                    disabled={auditLogSaving}
                    startIcon={auditLogSaving ? <CircularProgress size={16} /> : <AuditLogIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {auditLogSaving ? 'Saving...' : 'Save Audit Log Settings'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* Stats Tab */}
          <TabPanel selectedTab={selectedTab} tab="stats">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">Engagement Tracking</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Track message counts, voice minutes, and invites for your server members.
                  </Typography>
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(guildSettingsData?.statSettings?.enabled ?? false)}
                        onChange={async e => {
                          const guildId = connectedGuilds[0]?.guildId ?? settings?.guildId;
                          if (!organizationId || !guildId) return;
                          await discordService.updateStatSettings(organizationId, guildId, {
                            enabled: e.target.checked,
                          });
                          invalidateGuildSettings();
                          notification.success('Stat tracking updated');
                        }}
                      />
                    }
                    label="Enable stat tracking"
                  />
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(guildSettingsData?.statSettings?.trackMessages ?? true)}
                        onChange={async e => {
                          await discordService.updateStatSettings(
                            organizationId,
                            connectedGuilds[0]?.guildId ?? settings?.guildId,
                            {
                              trackMessages: e.target.checked,
                            }
                          );
                          invalidateGuildSettings();
                          notification.success('Message tracking updated');
                        }}
                      />
                    }
                    label="Track messages"
                  />
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(guildSettingsData?.statSettings?.trackVoice ?? true)}
                        onChange={async e => {
                          await discordService.updateStatSettings(
                            organizationId,
                            connectedGuilds[0]?.guildId ?? settings?.guildId,
                            {
                              trackVoice: e.target.checked,
                            }
                          );
                          invalidateGuildSettings();
                          notification.success('Voice tracking updated');
                        }}
                      />
                    }
                    label="Track voice minutes"
                  />
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(guildSettingsData?.statSettings?.trackInvites ?? false)}
                        onChange={async e => {
                          await discordService.updateStatSettings(
                            organizationId,
                            connectedGuilds[0]?.guildId ?? settings?.guildId,
                            {
                              trackInvites: e.target.checked,
                            }
                          );
                          invalidateGuildSettings();
                          notification.success('Invite tracking updated');
                        }}
                      />
                    }
                    label="Track invites"
                  />
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* DM Notifications Tab */}
          <TabPanel selectedTab={selectedTab} tab="dm-notifications">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">DM Notification Events</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose which events trigger a DM to the affected user.
                  </Typography>
                  {[
                    { key: 'enabled', label: 'All DM notifications (master toggle)' },
                    { key: 'ticketCreated', label: 'Ticket created' },
                    { key: 'ticketAssigned', label: 'Ticket assigned' },
                    { key: 'ticketReplied', label: 'Ticket replied' },
                    { key: 'ticketClosed', label: 'Ticket closed' },
                    { key: 'ticketEscalated', label: 'Ticket escalated' },
                    { key: 'recruitmentReceived', label: 'Application received' },
                    { key: 'recruitmentAccepted', label: 'Application accepted' },
                    { key: 'recruitmentDenied', label: 'Application denied' },
                    { key: 'eventReminder', label: 'Event reminder' },
                    { key: 'eventCancelled', label: 'Event cancelled' },
                    { key: 'lfgPlayerJoined', label: 'LFG player joined' },
                  ].map(({ key, label }) => (
                    <FormControlLabel
                      key={key}
                      control={
                        <MuiSwitch
                          checked={
                            (
                              guildSettingsData?.dmNotificationSettings as
                                | Record<string, boolean>
                                | undefined
                            )?.[key] ?? key === 'enabled'
                          }
                          onChange={async e => {
                            await discordService.updateDmNotificationSettings(
                              organizationId,
                              connectedGuilds[0]?.guildId ?? settings?.guildId,
                              {
                                [key]: e.target.checked,
                              }
                            );
                            invalidateGuildSettings();
                            notification.success(`DM notification "${label}" updated`);
                          }}
                        />
                      }
                      label={label}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* Giveaways Tab */}
          <TabPanel selectedTab={selectedTab} tab="giveaways">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">Giveaway Settings</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure defaults for the giveaway system.
                  </Typography>
                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={Boolean(guildSettingsData?.giveawaySettings?.enabled ?? false)}
                        onChange={async e => {
                          await discordService.updateGiveawaySettings(
                            organizationId,
                            connectedGuilds[0]?.guildId ?? settings?.guildId,
                            {
                              enabled: e.target.checked,
                            }
                          );
                          invalidateGuildSettings();
                          notification.success('Giveaway settings updated');
                        }}
                      />
                    }
                    label="Enable giveaways"
                  />
                  <TextField
                    label="Max active giveaways"
                    type="number"
                    size="small"
                    defaultValue={guildSettingsData?.giveawaySettings?.maxActivegiveaways ?? 5}
                    slotProps={{ htmlInput: { min: 1, max: 25 } }}
                    onBlur={async e => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (val >= 1 && val <= 25) {
                        await discordService.updateGiveawaySettings(
                          organizationId,
                          connectedGuilds[0]?.guildId ?? settings?.guildId,
                          {
                            maxActivegiveaways: val,
                          }
                        );
                        invalidateGuildSettings();
                        notification.success('Max giveaways updated');
                      }
                    }}
                    sx={{ maxWidth: 220 }}
                  />
                  <TextField
                    label="Default duration (minutes)"
                    type="number"
                    size="small"
                    defaultValue={
                      guildSettingsData?.giveawaySettings?.defaultDurationMinutes ?? 1440
                    }
                    slotProps={{ htmlInput: { min: 5, max: 43200 } }}
                    onBlur={async e => {
                      const val = Number.parseInt(e.target.value, 10);
                      if (val >= 5 && val <= 43200) {
                        await discordService.updateGiveawaySettings(
                          organizationId,
                          connectedGuilds[0]?.guildId ?? settings?.guildId,
                          {
                            defaultDurationMinutes: val,
                          }
                        );
                        invalidateGuildSettings();
                        notification.success('Default duration updated');
                      }
                    }}
                    sx={{ maxWidth: 220 }}
                  />
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          {/* My Preferences Tab */}
          <TabPanel selectedTab={selectedTab} tab="my-prefs">
            <Stack direction="column" spacing={3} sx={{ mt: 3 }}>
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Stack direction="column" spacing={2}>
                  <Typography variant="h6">My Notification Preferences</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Control which DM notifications you receive from this server. These are your
                    personal preferences — they override the server-wide defaults set by admins.
                  </Typography>
                  <Divider />

                  <FormControlLabel
                    control={
                      <MuiSwitch
                        checked={userPrefs.dmEnabled}
                        onChange={e =>
                          setUserPrefs(prev => ({ ...prev, dmEnabled: e.target.checked }))
                        }
                      />
                    }
                    label="Receive DM notifications from this server"
                  />

                  {userPrefs.dmEnabled && (
                    <Stack direction="column" spacing={1} sx={{ pl: 2 }}>
                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={userPrefs.lfgPingOptIn}
                            onChange={e =>
                              setUserPrefs(prev => ({
                                ...prev,
                                lfgPingOptIn: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="LFG smart ping notifications"
                      />

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={userPrefs.eventReminderOptIn}
                            onChange={e =>
                              setUserPrefs(prev => ({
                                ...prev,
                                eventReminderOptIn: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Event reminder notifications"
                      />

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={userPrefs.ticketDmOptIn}
                            onChange={e =>
                              setUserPrefs(prev => ({
                                ...prev,
                                ticketDmOptIn: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Ticket update notifications"
                      />

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={userPrefs.recruitmentDmOptIn}
                            onChange={e =>
                              setUserPrefs(prev => ({
                                ...prev,
                                recruitmentDmOptIn: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Recruitment notifications"
                      />

                      <FormControlLabel
                        control={
                          <MuiSwitch
                            checked={userPrefs.moderationAlertOptIn}
                            onChange={e =>
                              setUserPrefs(prev => ({
                                ...prev,
                                moderationAlertOptIn: e.target.checked,
                              }))
                            }
                          />
                        }
                        label="Moderation alert notifications"
                      />
                    </Stack>
                  )}

                  <Divider />

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Timezone
                  </Typography>
                  <TextField
                    label="Your Timezone"
                    placeholder="e.g., America/New_York, Europe/London, Asia/Tokyo"
                    size="small"
                    fullWidth
                    value={userPrefs.timezone ?? ''}
                    onChange={e => setUserPrefs(prev => ({ ...prev, timezone: e.target.value }))}
                    helperText="IANA timezone name — used to display event times in your local timezone"
                  />

                  <Divider />

                  <Button
                    variant="contained"
                    onClick={handleSaveUserPrefs}
                    disabled={userPrefsSaving}
                    startIcon={userPrefsSaving ? <CircularProgress size={16} /> : <PersonIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {userPrefsSaving ? 'Saving...' : 'Save My Preferences'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </TabPanel>

          <TabPanel selectedTab={selectedTab} tab="access-control">
            <Stack spacing={3}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Access Control
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage which Discord users and roles have administrative access to this server's
                settings.
              </Typography>

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Admin Users
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Discord user IDs that can manage all settings for this server.
              </Typography>

              <Stack spacing={1}>
                {adminUserIds.map(uid => (
                  <Stack key={uid} direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                      {uid}
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleRemoveAdminUser(uid)}
                      disabled={accessControlSaving}
                    >
                      Remove
                    </Button>
                  </Stack>
                ))}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Discord User ID"
                  size="small"
                  value={newAdminUserId}
                  onChange={e => setNewAdminUserId(e.target.value)}
                  placeholder="Enter Discord user ID"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddAdminUser}
                  disabled={accessControlSaving || !newAdminUserId.trim()}
                >
                  Add
                </Button>
              </Stack>

              <Divider />

              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Server Manager Roles
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Discord roles whose members can manage server settings.
              </Typography>

              <Stack spacing={1}>
                {serverManagerRoleIds.map(rid => {
                  const roleName = guildRoles.find(r => r.id === rid)?.name;
                  return (
                    <Stack key={rid} direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                        {roleName ? `@${roleName}` : rid}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleRemoveServerManagerRole(rid)}
                        disabled={accessControlSaving}
                      >
                        Remove
                      </Button>
                    </Stack>
                  );
                })}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <RolePicker
                  label="Server Manager Role"
                  value={newServerManagerRoleId}
                  onChange={v => setNewServerManagerRoleId(v)}
                  roles={guildRoles}
                  helperText={
                    guildRoles.length > 0
                      ? 'Select a role to grant server manager access'
                      : 'Enter a Discord role ID (roles could not be loaded from Discord)'
                  }
                />
                <Button
                  variant="outlined"
                  onClick={handleAddServerManagerRole}
                  disabled={accessControlSaving || !newServerManagerRoleId.trim()}
                >
                  Add
                </Button>
              </Stack>
            </Stack>
          </TabPanel>
        </Stack>
      </Box>
    </Box>
  );
};

export const DiscordSettingsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Discord Settings"
    fallbackMessage="Unable to load Discord settings. Please try again later."
    showHomeButton={true}
  >
    <DiscordSettingsPage />
  </FeatureErrorBoundary>
);
