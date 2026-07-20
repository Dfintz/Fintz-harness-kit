import {
  Event as EventIcon,
  Notifications as NotificationsIcon,
  Shield as ShieldIcon,
  RecordVoiceOver as VoiceIcon,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useFederationGuildSettings,
  useUpdateFederationGuildSettingsSection,
} from '@/hooks/queries/useFederationManagementQueries';
import { useDiscordGuildChannels } from '@/hooks/queries/useOrgSettingsQueries';
import { useNotification } from '@/store/uiStore';
import { darkFieldSx } from '@/utils/formStyles';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

interface FederationGuildSettingsPanelProps {
  readonly federationId: string;
  readonly guildId: string;
  readonly canEdit: boolean;
}

interface EventSettingsState {
  eventAnnouncementChannelId: string;
  eventNotificationRoleId: string;
  eventCreationRoleId: string;
  createDiscordEvent: boolean;
  eventVoiceCategoryId: string;
  createEventThread: boolean;
  allowEventRsvp: boolean;
  tempRolesEnabled: boolean;
  tempRoleColor: string;
  maxMirrorsPerActivity: number;
  remindersEnabled: boolean;
  reminderHoursBefore: number[];
  autoDeleteEventMessages: boolean;
  cleanupMode: string;
  cleanupHoursAfterEnd: number;
}

interface VoiceSettingsState {
  autoCreateChannels: boolean;
  hubChannelId: string;
  hubChannelIds: string[];
  parentCategoryId: string;
  nameTemplate: string;
  defaultUserLimit: number;
  bitrate: number;
  autoDeleteEmptyChannels: boolean;
  deleteEmptyChannelDelaySeconds: number;
  allowRename: boolean;
  allowUserLimit: boolean;
}

interface ModerationSettingsState {
  enabled: boolean;
  sharedBanListEnabled: boolean;
  sharedMuteListEnabled: boolean;
  autoBanOnSharedList: boolean;
  propagateTimeouts: boolean;
  forwardModerationAlerts: boolean;
  notifyOnSharedAction: boolean;
  banAppealsChannelId: string;
  crossGuildAuditLogChannelId: string;
  escalationRoleId: string;
  allowedGuildIds: string;
}

interface NotificationSettingsState {
  alertChannelId: string;
  logChannelId: string;
  enableJoinLeaveAlerts: boolean;
  enableModerationAlerts: boolean;
  enableEventAlerts: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const cardSx = (theme: Theme) => ({
  background: alpha(theme.palette.background.paper, 0.6),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  borderRadius: 2,
  p: 2,
});

type ChannelOption = { id: string; name: string; type: number };

/** Shared state for multi-select pickers (channels). */
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

/** Return a display prefix for a Discord channel based on its type. */
function channelPrefix(type: number): string {
  const prefixMap: Record<number, string> = { 2: '🔊 ', 4: '📁 ', 5: '📢 ' };
  return prefixMap[type] ?? '# ';
}

/** Multi-select channel picker with chip display and add button. */
const MultiChannelPicker: React.FC<{
  readonly label: string;
  readonly values: string[];
  readonly onChange: (values: string[]) => void;
  readonly channels: ChannelOption[];
  readonly helperText?: string;
  readonly channelType?: 'text' | 'voice' | 'category';
  readonly disabled?: boolean;
}> = ({ label, values, onChange, channels, helperText, channelType, disabled }) => {
  const { open, setOpen, pendingId, add, remove } = useMultiPicker(values, onChange);

  const filtered = useMemo(() => {
    if (!channelType) return channels;
    if (channelType === 'text') return channels.filter(ch => ch.type === 0 || ch.type === 5);
    if (channelType === 'voice') return channels.filter(ch => ch.type === 2);
    if (channelType === 'category') return channels.filter(ch => ch.type === 4);
    return channels;
  }, [channels, channelType]);

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
        disabled={disabled}
        sx={darkFieldSx}
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
              label={ch ? `${channelPrefix(ch.type).trim()} ${ch.name}` : id}
              onDelete={disabled ? undefined : () => remove(id)}
              size="small"
              color="primary"
              variant="outlined"
            />
          );
        })}
        {available.length > 0 && !disabled && (
          <Box>
            {open ? (
              <TextField
                select
                size="small"
                sx={{ minWidth: 180, ...darkFieldSx }}
                value={pendingId}
                onChange={e => add(e.target.value)}
                onBlur={() => setOpen(false)}
                autoFocus
                label="Add channel"
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

const ChannelPicker: React.FC<{
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly channels: ChannelOption[];
  readonly helperText?: string;
  readonly channelType?: 'text' | 'voice' | 'category';
}> = ({ label, value, onChange, channels, helperText, channelType }) => {
  const filteredChannels = useMemo(() => {
    if (!channelType) return channels;
    if (channelType === 'text') return channels.filter(ch => ch.type === 0 || ch.type === 5);
    if (channelType === 'voice') return channels.filter(ch => ch.type === 2);
    if (channelType === 'category') return channels.filter(ch => ch.type === 4);
    return channels;
  }, [channels, channelType]);

  if (filteredChannels.length === 0) {
    return (
      <TextField
        label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        helperText={helperText ?? 'Enter channel ID (bot may not have access to list channels)'}
        fullWidth
        size="small"
        sx={darkFieldSx}
      />
    );
  }

  const selected = filteredChannels.find(c => c.id === value) ?? null;
  return (
    <Autocomplete
      options={filteredChannels}
      getOptionLabel={opt => {
        const prefixMap: Record<number, string> = { 2: '🔊 ', 4: '📁 ', 5: '📢 ' };
        const prefix = prefixMap[opt.type] ?? '# ';
        return `${prefix}${opt.name}`;
      }}
      value={selected}
      onChange={(_, opt) => onChange(opt?.id ?? '')}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          helperText={helperText}
          size="small"
          sx={darkFieldSx}
        />
      )}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      size="small"
    />
  );
};

// ── Default states ───────────────────────────────────────────────────────────

const defaultEventSettings: EventSettingsState = {
  eventAnnouncementChannelId: '',
  eventNotificationRoleId: '',
  eventCreationRoleId: '',
  createDiscordEvent: false,
  eventVoiceCategoryId: '',
  createEventThread: false,
  allowEventRsvp: true,
  tempRolesEnabled: false,
  tempRoleColor: '#00bcd4',
  maxMirrorsPerActivity: 3,
  remindersEnabled: true,
  reminderHoursBefore: [1, 24],
  autoDeleteEventMessages: false,
  cleanupMode: 'afterEnd',
  cleanupHoursAfterEnd: 24,
};

const defaultVoiceSettings: VoiceSettingsState = {
  autoCreateChannels: false,
  hubChannelId: '',
  hubChannelIds: [],
  parentCategoryId: '',
  nameTemplate: "{user}'s Channel",
  defaultUserLimit: 0,
  bitrate: 64,
  autoDeleteEmptyChannels: true,
  deleteEmptyChannelDelaySeconds: 3,
  allowRename: true,
  allowUserLimit: true,
};

const defaultModerationSettings: ModerationSettingsState = {
  enabled: false,
  sharedBanListEnabled: false,
  sharedMuteListEnabled: false,
  autoBanOnSharedList: false,
  propagateTimeouts: false,
  forwardModerationAlerts: false,
  notifyOnSharedAction: false,
  banAppealsChannelId: '',
  crossGuildAuditLogChannelId: '',
  escalationRoleId: '',
  allowedGuildIds: '',
};

const defaultNotificationSettings: NotificationSettingsState = {
  alertChannelId: '',
  logChannelId: '',
  enableJoinLeaveAlerts: true,
  enableModerationAlerts: true,
  enableEventAlerts: true,
};

// ── Main Component ───────────────────────────────────────────────────────────

export const FederationGuildSettingsPanel: React.FC<FederationGuildSettingsPanelProps> = ({
  federationId,
  guildId,
  canEdit,
}) => {
  const theme = useTheme();
  const notification = useNotification();
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: guildSettings, isLoading } = useFederationGuildSettings(federationId, guildId);
  const { data: guildChannels = [] } = useDiscordGuildChannels(guildId);
  const updateSection = useUpdateFederationGuildSettingsSection();

  const textChannels = useMemo(
    () => guildChannels.filter(ch => ch.type === 0 || ch.type === 5),
    [guildChannels]
  );
  const voiceChannels = useMemo(() => guildChannels.filter(ch => ch.type === 2), [guildChannels]);
  const categoryChannels = useMemo(
    () => guildChannels.filter(ch => ch.type === 4),
    [guildChannels]
  );

  // ── State ──
  const [eventSettings, setEventSettings] = useState<EventSettingsState>(defaultEventSettings);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsState>(defaultVoiceSettings);
  const [modSettings, setModSettings] =
    useState<ModerationSettingsState>(defaultModerationSettings);
  const [notifSettings, setNotifSettings] = useState<NotificationSettingsState>(
    defaultNotificationSettings
  );

  // Hydrate from server data
  useEffect(() => {
    if (!guildSettings) return;

    const ev = (guildSettings.eventSettings ?? {}) as Record<string, unknown>;
    setEventSettings({
      eventAnnouncementChannelId: (ev.eventAnnouncementChannelId as string) ?? '',
      eventNotificationRoleId: (ev.eventNotificationRoleId as string) ?? '',
      eventCreationRoleId: (ev.eventCreationRoleId as string) ?? '',
      createDiscordEvent: (ev.createDiscordEvent as boolean) ?? false,
      eventVoiceCategoryId: (ev.eventVoiceCategoryId as string) ?? '',
      createEventThread: (ev.createEventThread as boolean) ?? false,
      allowEventRsvp: (ev.allowEventRsvp as boolean) ?? true,
      tempRolesEnabled: (ev.tempRolesEnabled as boolean) ?? false,
      tempRoleColor:
        typeof ev.tempRoleColor === 'number'
          ? `#${ev.tempRoleColor.toString(16).padStart(6, '0')}`
          : ((ev.tempRoleColor as string) ?? '#00bcd4'),
      maxMirrorsPerActivity: (ev.maxMirrorsPerActivity as number) ?? 3,
      remindersEnabled: (ev.remindersEnabled as boolean) ?? true,
      reminderHoursBefore: Array.isArray(ev.reminderHoursBefore)
        ? (ev.reminderHoursBefore as number[])
        : [1, 24],
      autoDeleteEventMessages: (ev.autoDeleteEventMessages as boolean) ?? false,
      cleanupMode: (ev.cleanupMode as string) ?? 'afterEnd',
      cleanupHoursAfterEnd: (ev.cleanupHoursAfterEnd as number) ?? 24,
    });

    const vc = (guildSettings.voiceChannelSettings ?? {}) as Record<string, unknown>;
    setVoiceSettings({
      autoCreateChannels: (vc.autoCreateChannels as boolean) ?? false,
      hubChannelId: (vc.hubChannelId as string) ?? '',
      hubChannelIds: (vc.hubChannelIds as string[]) ?? [],
      parentCategoryId: (vc.parentCategoryId as string) ?? '',
      nameTemplate:
        (vc.channelNameTemplate as string) ?? (vc.nameTemplate as string) ?? "{user}'s Channel",
      defaultUserLimit: (vc.defaultUserLimit as number) ?? 0,
      bitrate: typeof vc.bitrate === 'number' ? vc.bitrate / 1000 : 64,
      autoDeleteEmptyChannels: (vc.autoDeleteEmptyChannels as boolean) ?? true,
      deleteEmptyChannelDelaySeconds: (vc.deleteEmptyChannelDelaySeconds as number) ?? 3,
      allowRename: (vc.userCanRename as boolean) ?? (vc.allowRename as boolean) ?? true,
      allowUserLimit: (vc.allowUserLimit as boolean) ?? true,
    });

    const cm = (guildSettings.crossModerationSettings ?? {}) as Record<string, unknown>;
    setModSettings({
      enabled: (cm.enabled as boolean) ?? false,
      sharedBanListEnabled: (cm.sharedBanListEnabled as boolean) ?? false,
      sharedMuteListEnabled: (cm.sharedMuteListEnabled as boolean) ?? false,
      autoBanOnSharedList: (cm.autoBanOnSharedList as boolean) ?? false,
      propagateTimeouts: (cm.propagateTimeouts as boolean) ?? false,
      forwardModerationAlerts: (cm.forwardModerationAlerts as boolean) ?? false,
      notifyOnSharedAction: (cm.notifyOnSharedAction as boolean) ?? false,
      banAppealsChannelId: (cm.banAppealsChannelId as string) ?? '',
      crossGuildAuditLogChannelId: (cm.crossGuildAuditLogChannelId as string) ?? '',
      escalationRoleId: (cm.escalationRoleId as string) ?? '',
      allowedGuildIds: Array.isArray(cm.allowedGuildIds)
        ? (cm.allowedGuildIds as string[]).join(', ')
        : '',
    });

    const np = (guildSettings.notificationPreferences ?? {}) as Record<string, unknown>;
    setNotifSettings({
      alertChannelId: (np.alertChannelId as string) ?? '',
      logChannelId: (np.logChannelId as string) ?? '',
      enableJoinLeaveAlerts: (np.enableJoinLeaveAlerts as boolean) ?? true,
      enableModerationAlerts: (np.enableModerationAlerts as boolean) ?? true,
      enableEventAlerts: (np.enableEventAlerts as boolean) ?? true,
    });
  }, [guildSettings]);

  // ── Save handlers ──

  const handleSave = useCallback(
    async (section: string, data: Record<string, unknown>) => {
      setSaving(true);
      try {
        await updateSection.mutateAsync({ federationId, guildId, section, data });
        notification.success('Settings saved');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save settings';
        notification.error(msg);
        logger.error(
          'Failed to save federation guild settings',
          err instanceof Error ? err : new Error(String(err))
        );
      } finally {
        setSaving(false);
      }
    },
    [federationId, guildId, updateSection, notification]
  );

  const handleSaveEvents = () =>
    handleSave('event-settings', {
      eventAnnouncementChannelId: eventSettings.eventAnnouncementChannelId || null,
      eventNotificationRoleId: eventSettings.eventNotificationRoleId || null,
      eventCreationRoleId: eventSettings.eventCreationRoleId || null,
      createDiscordEvent: eventSettings.createDiscordEvent,
      eventVoiceCategoryId: eventSettings.eventVoiceCategoryId || null,
      createEventThread: eventSettings.createEventThread,
      allowEventRsvp: eventSettings.allowEventRsvp,
      tempRolesEnabled: eventSettings.tempRolesEnabled,
      tempRoleColor: eventSettings.tempRoleColor,
      maxMirrorsPerActivity: eventSettings.maxMirrorsPerActivity,
      remindersEnabled: eventSettings.remindersEnabled,
      reminderHoursBefore: eventSettings.reminderHoursBefore,
      autoDeleteEventMessages: eventSettings.autoDeleteEventMessages,
      cleanupMode: eventSettings.cleanupMode,
      cleanupHoursAfterEnd: eventSettings.cleanupHoursAfterEnd,
    });

  const handleSaveVoice = () =>
    handleSave('voice-channel-settings', {
      autoCreateChannels: voiceSettings.autoCreateChannels,
      hubChannelId: voiceSettings.hubChannelIds.length
        ? voiceSettings.hubChannelIds[0]
        : voiceSettings.hubChannelId || null,
      hubChannelIds: voiceSettings.hubChannelIds.length ? voiceSettings.hubChannelIds : undefined,
      parentCategoryId: voiceSettings.parentCategoryId || null,
      channelNameTemplate: voiceSettings.nameTemplate,
      defaultUserLimit: voiceSettings.defaultUserLimit,
      bitrate: voiceSettings.bitrate * 1000,
      autoDeleteEmptyChannels: voiceSettings.autoDeleteEmptyChannels,
      deleteEmptyChannelDelaySeconds: voiceSettings.deleteEmptyChannelDelaySeconds,
      userCanRename: voiceSettings.allowRename,
      allowUserLimit: voiceSettings.allowUserLimit,
    });

  const handleSaveModeration = () =>
    handleSave('cross-moderation-settings', {
      enabled: modSettings.enabled,
      sharedBanListEnabled: modSettings.sharedBanListEnabled,
      sharedMuteListEnabled: modSettings.sharedMuteListEnabled,
      autoBanOnSharedList: modSettings.autoBanOnSharedList,
      propagateTimeouts: modSettings.propagateTimeouts,
      forwardModerationAlerts: modSettings.forwardModerationAlerts,
      notifyOnSharedAction: modSettings.notifyOnSharedAction,
      banAppealsChannelId: modSettings.banAppealsChannelId || null,
      crossGuildAuditLogChannelId: modSettings.crossGuildAuditLogChannelId || null,
      escalationRoleId: modSettings.escalationRoleId || null,
      allowedGuildIds: modSettings.allowedGuildIds
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    });

  const handleSaveNotifications = () =>
    handleSave('notification-preferences', {
      alertChannelId: notifSettings.alertChannelId || null,
      logChannelId: notifSettings.logChannelId || null,
      enableJoinLeaveAlerts: notifSettings.enableJoinLeaveAlerts,
      enableModerationAlerts: notifSettings.enableModerationAlerts,
      enableEventAlerts: notifSettings.enableEventAlerts,
    });

  // ── Render ──

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Paper sx={cardSx(theme)}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
        Guild Feature Settings
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Configure per-feature settings for the central Discord server.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}
      >
        <Tab icon={<VoiceIcon />} label="Voice" iconPosition="start" sx={{ minHeight: 40 }} />
        <Tab icon={<EventIcon />} label="Events" iconPosition="start" sx={{ minHeight: 40 }} />
        <Tab icon={<ShieldIcon />} label="Moderation" iconPosition="start" sx={{ minHeight: 40 }} />
        <Tab
          icon={<NotificationsIcon />}
          label="Notifications"
          iconPosition="start"
          sx={{ minHeight: 40 }}
        />
      </Tabs>

      {/* ── Voice Tab ── */}
      {tab === 0 && (
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={voiceSettings.autoCreateChannels}
                onChange={e =>
                  setVoiceSettings(s => ({ ...s, autoCreateChannels: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Enable Temporary Voice Channels"
          />
          <MultiChannelPicker
            label="Hub Channels (Join to Create)"
            values={(() => {
              if (voiceSettings.hubChannelIds.length) return voiceSettings.hubChannelIds;
              if (voiceSettings.hubChannelId) return [voiceSettings.hubChannelId];
              return [];
            })()}
            onChange={values =>
              setVoiceSettings(s => ({
                ...s,
                hubChannelIds: values,
                hubChannelId: values[0] || '',
              }))
            }
            channels={voiceChannels}
            channelType="voice"
            helperText="Users joining any of these voice channels will automatically get a new temporary channel"
            disabled={!canEdit}
          />
          <ChannelPicker
            label="Parent Category"
            value={voiceSettings.parentCategoryId}
            onChange={v => setVoiceSettings(s => ({ ...s, parentCategoryId: v }))}
            channels={categoryChannels}
            channelType="category"
          />
          <TextField
            label="Name Template"
            value={voiceSettings.nameTemplate}
            onChange={e => setVoiceSettings(s => ({ ...s, nameTemplate: e.target.value }))}
            helperText="Placeholders: {user}, {nickname}, {game}, {count}"
            size="small"
            fullWidth
            disabled={!canEdit}
            sx={darkFieldSx}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Default User Limit"
              type="number"
              value={voiceSettings.defaultUserLimit}
              onChange={e =>
                setVoiceSettings(s => ({
                  ...s,
                  defaultUserLimit: Math.max(0, Math.min(99, Number(e.target.value))),
                }))
              }
              size="small"
              disabled={!canEdit}
              sx={darkFieldSx}
              slotProps={{ htmlInput: { min: 0, max: 99 } }}
            />
            <TextField
              label="Bitrate (kbps)"
              type="number"
              value={voiceSettings.bitrate}
              onChange={e =>
                setVoiceSettings(s => ({
                  ...s,
                  bitrate: Math.max(8, Math.min(384, Number(e.target.value))),
                }))
              }
              size="small"
              disabled={!canEdit}
              sx={darkFieldSx}
              slotProps={{ htmlInput: { min: 8, max: 384 } }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={voiceSettings.autoDeleteEmptyChannels}
                onChange={e =>
                  setVoiceSettings(s => ({ ...s, autoDeleteEmptyChannels: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Auto-delete when empty"
          />
          {voiceSettings.autoDeleteEmptyChannels && (
            <TextField
              label="Delete Delay (seconds)"
              type="number"
              value={voiceSettings.deleteEmptyChannelDelaySeconds}
              onChange={e =>
                setVoiceSettings(s => ({
                  ...s,
                  deleteEmptyChannelDelaySeconds: Math.max(
                    0,
                    Math.min(300, Number(e.target.value))
                  ),
                }))
              }
              size="small"
              fullWidth
              disabled={!canEdit}
              sx={darkFieldSx}
              slotProps={{ htmlInput: { min: 0, max: 300 } }}
              helperText="Seconds to wait before deleting an empty channel (0 = immediate, default 3)"
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={voiceSettings.allowRename}
                onChange={e => setVoiceSettings(s => ({ ...s, allowRename: e.target.checked }))}
                disabled={!canEdit}
              />
            }
            label="Allow users to rename"
          />
          <FormControlLabel
            control={
              <Switch
                checked={voiceSettings.allowUserLimit}
                onChange={e => setVoiceSettings(s => ({ ...s, allowUserLimit: e.target.checked }))}
                disabled={!canEdit}
              />
            }
            label="Allow users to set limit"
          />
          {canEdit && (
            <Button
              variant="contained"
              onClick={handleSaveVoice}
              disabled={saving}
              sx={{ alignSelf: 'flex-start' }}
            >
              {saving ? 'Saving…' : 'Save Voice Settings'}
            </Button>
          )}
        </Stack>
      )}

      {/* ── Events Tab ── */}
      {tab === 1 && (
        <Stack spacing={2}>
          <ChannelPicker
            label="Announcement Channel"
            value={eventSettings.eventAnnouncementChannelId}
            onChange={v => setEventSettings(s => ({ ...s, eventAnnouncementChannelId: v }))}
            channels={textChannels}
            channelType="text"
            helperText="Channel where event announcements are posted"
          />
          <TextField
            label="Notification Role ID"
            value={eventSettings.eventNotificationRoleId}
            onChange={e =>
              setEventSettings(s => ({ ...s, eventNotificationRoleId: e.target.value }))
            }
            helperText="Role to ping for event notifications"
            size="small"
            fullWidth
            disabled={!canEdit}
            sx={darkFieldSx}
          />
          <TextField
            label="Event Creation Role ID"
            value={eventSettings.eventCreationRoleId}
            onChange={e => setEventSettings(s => ({ ...s, eventCreationRoleId: e.target.value }))}
            helperText="Role required to create events (empty = everyone)"
            size="small"
            fullWidth
            disabled={!canEdit}
            sx={darkFieldSx}
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventSettings.createDiscordEvent}
                onChange={e =>
                  setEventSettings(s => ({ ...s, createDiscordEvent: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Auto-create Discord Scheduled Events"
          />
          <ChannelPicker
            label="Event Voice Channel Category"
            value={eventSettings.eventVoiceCategoryId}
            onChange={v => setEventSettings(s => ({ ...s, eventVoiceCategoryId: v }))}
            channels={categoryChannels}
            channelType="category"
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventSettings.createEventThread}
                onChange={e =>
                  setEventSettings(s => ({ ...s, createEventThread: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Auto-create discussion thread"
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventSettings.allowEventRsvp}
                onChange={e => setEventSettings(s => ({ ...s, allowEventRsvp: e.target.checked }))}
                disabled={!canEdit}
              />
            }
            label="Enable RSVP buttons"
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventSettings.tempRolesEnabled}
                onChange={e =>
                  setEventSettings(s => ({ ...s, tempRolesEnabled: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Create temp roles for participants"
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventSettings.remindersEnabled}
                onChange={e =>
                  setEventSettings(s => ({ ...s, remindersEnabled: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Enable event reminders"
          />
          {eventSettings.remindersEnabled && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5 }}>
                Reminder hours before event
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {eventSettings.reminderHoursBefore.map(h => (
                  <Chip
                    key={`reminder-${h}`}
                    label={`${h}h`}
                    size="small"
                    onDelete={
                      canEdit
                        ? () =>
                            setEventSettings(s => ({
                              ...s,
                              reminderHoursBefore: s.reminderHoursBefore.filter(v => v !== h),
                            }))
                        : undefined
                    }
                  />
                ))}
              </Stack>
            </Box>
          )}
          <TextField
            label="Max Cross-Server Mirrors"
            type="number"
            value={eventSettings.maxMirrorsPerActivity}
            onChange={e =>
              setEventSettings(s => ({
                ...s,
                maxMirrorsPerActivity: Math.max(1, Math.min(10, Number(e.target.value))),
              }))
            }
            size="small"
            disabled={!canEdit}
            sx={darkFieldSx}
            slotProps={{ htmlInput: { min: 1, max: 10 } }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventSettings.autoDeleteEventMessages}
                onChange={e =>
                  setEventSettings(s => ({ ...s, autoDeleteEventMessages: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Auto-delete event messages after completion"
          />
          {eventSettings.autoDeleteEventMessages && (
            <Stack direction="row" spacing={2}>
              <TextField
                label="Cleanup Trigger"
                select
                value={eventSettings.cleanupMode}
                onChange={e => setEventSettings(s => ({ ...s, cleanupMode: e.target.value }))}
                size="small"
                disabled={!canEdit}
                sx={{ ...darkFieldSx, minWidth: 180 }}
              >
                <MenuItem value="afterEnd">After Event Ends</MenuItem>
                <MenuItem value="afterComplete">After Marked Complete</MenuItem>
              </TextField>
              <TextField
                label="Cleanup Delay (hours)"
                type="number"
                value={eventSettings.cleanupHoursAfterEnd}
                onChange={e =>
                  setEventSettings(s => ({
                    ...s,
                    cleanupHoursAfterEnd: Math.max(1, Math.min(720, Number(e.target.value))),
                  }))
                }
                size="small"
                disabled={!canEdit}
                sx={darkFieldSx}
                slotProps={{ htmlInput: { min: 1, max: 720 } }}
              />
            </Stack>
          )}
          {canEdit && (
            <Button
              variant="contained"
              onClick={handleSaveEvents}
              disabled={saving}
              sx={{ alignSelf: 'flex-start' }}
            >
              {saving ? 'Saving…' : 'Save Event Settings'}
            </Button>
          )}
        </Stack>
      )}

      {/* ── Moderation Tab ── */}
      {tab === 2 && (
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={modSettings.enabled}
                onChange={e => setModSettings(s => ({ ...s, enabled: e.target.checked }))}
                disabled={!canEdit}
              />
            }
            label="Enable Cross-Server Moderation"
          />
          <FormControlLabel
            control={
              <Switch
                checked={modSettings.sharedBanListEnabled}
                onChange={e =>
                  setModSettings(s => ({ ...s, sharedBanListEnabled: e.target.checked }))
                }
                disabled={!canEdit || !modSettings.enabled}
              />
            }
            label="Share ban list"
          />
          <FormControlLabel
            control={
              <Switch
                checked={modSettings.sharedMuteListEnabled}
                onChange={e =>
                  setModSettings(s => ({ ...s, sharedMuteListEnabled: e.target.checked }))
                }
                disabled={!canEdit || !modSettings.enabled}
              />
            }
            label="Share mute list"
          />
          <FormControlLabel
            control={
              <Switch
                checked={modSettings.autoBanOnSharedList}
                onChange={e =>
                  setModSettings(s => ({ ...s, autoBanOnSharedList: e.target.checked }))
                }
                disabled={!canEdit || !modSettings.enabled}
              />
            }
            label="Auto-ban on shared list"
          />
          {modSettings.autoBanOnSharedList && (
            <Alert severity="warning" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
              Users added to the shared ban list will be automatically banned from this server.
            </Alert>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={modSettings.propagateTimeouts}
                onChange={e => setModSettings(s => ({ ...s, propagateTimeouts: e.target.checked }))}
                disabled={!canEdit || !modSettings.enabled}
              />
            }
            label="Propagate timeouts"
          />
          <FormControlLabel
            control={
              <Switch
                checked={modSettings.forwardModerationAlerts}
                onChange={e =>
                  setModSettings(s => ({ ...s, forwardModerationAlerts: e.target.checked }))
                }
                disabled={!canEdit || !modSettings.enabled}
              />
            }
            label="Forward moderation alerts"
          />
          <FormControlLabel
            control={
              <Switch
                checked={modSettings.notifyOnSharedAction}
                onChange={e =>
                  setModSettings(s => ({ ...s, notifyOnSharedAction: e.target.checked }))
                }
                disabled={!canEdit || !modSettings.enabled}
              />
            }
            label="Notify on shared action"
          />
          <ChannelPicker
            label="Ban Appeals Channel"
            value={modSettings.banAppealsChannelId}
            onChange={v => setModSettings(s => ({ ...s, banAppealsChannelId: v }))}
            channels={textChannels}
            channelType="text"
          />
          <ChannelPicker
            label="Cross-Guild Audit Log Channel"
            value={modSettings.crossGuildAuditLogChannelId}
            onChange={v => setModSettings(s => ({ ...s, crossGuildAuditLogChannelId: v }))}
            channels={textChannels}
            channelType="text"
          />
          <TextField
            label="Escalation Role ID"
            value={modSettings.escalationRoleId}
            onChange={e => setModSettings(s => ({ ...s, escalationRoleId: e.target.value }))}
            helperText="Role to ping for escalated moderation cases"
            size="small"
            fullWidth
            disabled={!canEdit}
            sx={darkFieldSx}
          />
          <TextField
            label="Allowed Guild IDs"
            value={modSettings.allowedGuildIds}
            onChange={e => setModSettings(s => ({ ...s, allowedGuildIds: e.target.value }))}
            helperText="Comma-separated guild IDs that can share moderation data"
            size="small"
            fullWidth
            multiline
            disabled={!canEdit}
            sx={darkFieldSx}
          />
          {canEdit && (
            <Button
              variant="contained"
              onClick={handleSaveModeration}
              disabled={saving}
              sx={{ alignSelf: 'flex-start' }}
            >
              {saving ? 'Saving…' : 'Save Moderation Settings'}
            </Button>
          )}
        </Stack>
      )}

      {/* ── Notifications Tab ── */}
      {tab === 3 && (
        <Stack spacing={2}>
          <ChannelPicker
            label="Alert Channel"
            value={notifSettings.alertChannelId}
            onChange={v => setNotifSettings(s => ({ ...s, alertChannelId: v }))}
            channels={textChannels}
            channelType="text"
            helperText="Channel for real-time alerts and notifications"
          />
          <ChannelPicker
            label="Log Channel"
            value={notifSettings.logChannelId}
            onChange={v => setNotifSettings(s => ({ ...s, logChannelId: v }))}
            channels={textChannels}
            channelType="text"
            helperText="Channel for detailed audit/log messages"
          />
          <FormControlLabel
            control={
              <Switch
                checked={notifSettings.enableJoinLeaveAlerts}
                onChange={e =>
                  setNotifSettings(s => ({ ...s, enableJoinLeaveAlerts: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Join/Leave alerts"
          />
          <FormControlLabel
            control={
              <Switch
                checked={notifSettings.enableModerationAlerts}
                onChange={e =>
                  setNotifSettings(s => ({ ...s, enableModerationAlerts: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Moderation alerts"
          />
          <FormControlLabel
            control={
              <Switch
                checked={notifSettings.enableEventAlerts}
                onChange={e =>
                  setNotifSettings(s => ({ ...s, enableEventAlerts: e.target.checked }))
                }
                disabled={!canEdit}
              />
            }
            label="Event alerts"
          />
          {canEdit && (
            <Button
              variant="contained"
              onClick={handleSaveNotifications}
              disabled={saving}
              sx={{ alignSelf: 'flex-start' }}
            >
              {saving ? 'Saving…' : 'Save Notification Settings'}
            </Button>
          )}
        </Stack>
      )}
    </Paper>
  );
};
