/**
 * Discord Dashboard Component
 * Manage Discord guild settings for organizations
 * - Events
 * - Voice channels & tunnels
 * - Notifications & role sync
 * - Admin users & server managers
 */

import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import ErrorIcon from '@mui/icons-material/Error';
import GavelIcon from '@mui/icons-material/Gavel';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    FormControlLabel,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { apiClient } from '@/services/apiClient';
import { useNotification } from '@/store/uiStore';

interface DiscordGuildSettings {
  organizationId: string;
  guildId: string;
  guildName?: string;
  eventSettings: Record<string, unknown>;
  voiceChannelSettings: Record<string, unknown>;
  tunnelSettings: Record<string, unknown>;
  notificationPreferences: Record<string, unknown>;
  roleSyncSettings: Record<string, unknown>;
  crossModerationSettings?: Record<string, unknown>;
  ticketSettings?: Record<string, unknown>;
  adminUserIds?: string[];
  serverManagerRoleIds?: string[];
  lastModifiedBy?: string;
  lastSyncedAt?: string | Date;
}

interface Props {
  organizationId: string;
  guildId: string;
  guildName?: string;
}

type SettingKey =
  | 'eventSettings'
  | 'voiceChannelSettings'
  | 'tunnelSettings'
  | 'notificationPreferences'
  | 'roleSyncSettings'
  | 'crossModerationSettings'
  | 'ticketSettings';

export const DiscordDashboard: React.FC<Props> = ({ organizationId, guildId, guildName }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState<DiscordGuildSettings | null>(null);
  const notification = useNotification();

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);

      const response = await apiClient.get<DiscordGuildSettings>(
        `/api/orgs/${organizationId}/discord/settings/${guildId}`
      );

      const raw = response.data as unknown as Record<string, unknown> | null;
      const settingsData = (raw?.data ?? raw) as DiscordGuildSettings | null;
      if (!settingsData) {
        throw new Error('Discord settings not found for this guild');
      }

      const normalizedSettings: DiscordGuildSettings = {
        ...settingsData,
        crossModerationSettings: settingsData.crossModerationSettings ?? {},
        ticketSettings: settingsData.ticketSettings ?? {},
      };
      setSettings(normalizedSettings);
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [organizationId, guildId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettingField = (settingKey: SettingKey, field: string, value: unknown) => {
    if (!settings) return;
    const existing = (settings[settingKey] as Record<string, unknown> | undefined) ?? {};
    setSettings({
      ...settings,
      [settingKey]: {
        ...existing,
        [field]: value,
      },
    });
  };

  const saveSetting = async (settingKey: SettingKey, endpoint: string, successMessage: string) => {
    if (!settings) return;
    try {
      setSaving(true);
      await apiClient.patch(
        `/api/orgs/${organizationId}/discord/settings/${guildId}${endpoint}`,
        settings[settingKey]
      );

      notification.success(successMessage);
    } catch (err) {
      notification.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!settings) {
    return (
      <Alert severity="error">
        <ErrorIcon sx={{ mr: 1 }} />
        Failed to load Discord settings
      </Alert>
    );
  }

  const handleEventSave = () =>
    saveSetting('eventSettings', '/events', 'Event settings saved successfully');
  const handleVoiceSave = () =>
    saveSetting(
      'voiceChannelSettings',
      '/voice-channels',
      'Voice channel settings saved successfully'
    );
  const handleTunnelSave = () =>
    saveSetting('tunnelSettings', '/tunnels', 'Tunnel settings saved successfully');
  const handleNotificationSave = () =>
    saveSetting(
      'notificationPreferences',
      '/notifications',
      'Notification settings saved successfully'
    );
  const handleRoleSyncSave = () =>
    saveSetting('roleSyncSettings', '/role-sync', 'Role sync settings saved successfully');
  const handleCrossModerationSave = () =>
    saveSetting(
      'crossModerationSettings',
      '/cross-moderation',
      'Cross moderation settings saved successfully'
    );
  const handleTicketSave = () =>
    saveSetting('ticketSettings', '/tickets', 'Ticket settings saved successfully');

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Stack direction="row" alignItems="center" gap={2}>
          <SettingsIcon sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4">Discord Guild Settings</Typography>
            <Typography variant="body2" color="textSecondary">
              {guildName || guildId}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Settings Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={(e: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
        >
          <Tab label="Events" icon={<SettingsIcon />} />
          <Tab label="Voice Channels" icon={<VolumeUpIcon />} />
          <Tab label="Tunnels" icon={<PeopleIcon />} />
          <Tab label="Notifications" icon={<NotificationsIcon />} />
          <Tab label="Tickets" icon={<ConfirmationNumberIcon />} />
          <Tab label="Cross Moderation" icon={<GavelIcon />} />
          <Tab label="Role Sync" icon={<PeopleIcon />} />
        </Tabs>

        <CardContent>
          {/* Events Tab */}
          {activeTab === 0 && (
            <Stack spacing={2}>
              <Typography variant="h6">Event Settings</Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.eventSettings.allowEventRsvp !== false}
                    onChange={e =>
                      updateSettingField('eventSettings', 'allowEventRsvp', e.target.checked)
                    }
                  />
                }
                label="Allow Event RSVP"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.eventSettings.remindersEnabled !== false}
                    onChange={e =>
                      updateSettingField('eventSettings', 'remindersEnabled', e.target.checked)
                    }
                  />
                }
                label="Enable Event Reminders"
              />

              <TextField
                label="Event Announcement Channel ID"
                value={String(settings.eventSettings.eventAnnouncementChannelId || '')}
                onChange={e =>
                  updateSettingField('eventSettings', 'eventAnnouncementChannelId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Event Notification Role ID"
                value={String(settings.eventSettings.eventNotificationRoleId || '')}
                onChange={e =>
                  updateSettingField('eventSettings', 'eventNotificationRoleId', e.target.value)
                }
                fullWidth
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleEventSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Event Settings'}
              </Button>
            </Stack>
          )}

          {/* Voice Channels Tab */}
          {activeTab === 1 && (
            <Stack spacing={2}>
              <Typography variant="h6">Voice Channel Settings</Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(settings.voiceChannelSettings.autoCreateChannels) ?? false}
                    onChange={e =>
                      updateSettingField(
                        'voiceChannelSettings',
                        'autoCreateChannels',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Auto-Create Temporary Channels"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.voiceChannelSettings.autoDeleteEmptyChannels !== false}
                    onChange={e =>
                      updateSettingField(
                        'voiceChannelSettings',
                        'autoDeleteEmptyChannels',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Auto-Delete Empty Channels"
              />

              <TextField
                label="Parent Category ID"
                value={String(settings.voiceChannelSettings.parentCategoryId || '')}
                onChange={e =>
                  updateSettingField('voiceChannelSettings', 'parentCategoryId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Delete Empty Channel Delay (minutes)"
                type="number"
                value={Number(settings.voiceChannelSettings.deleteEmptyChannelDelayMinutes || 5)}
                onChange={e =>
                  updateSettingField(
                    'voiceChannelSettings',
                    'deleteEmptyChannelDelayMinutes',
                    parseInt(e.target.value)
                  )
                }
                fullWidth
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleVoiceSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Voice Settings'}
              </Button>
            </Stack>
          )}

          {/* Tunnels Tab */}
          {activeTab === 2 && (
            <Stack spacing={2}>
              <Typography variant="h6">Tunnel Settings (Private Voice Channels)</Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(settings.tunnelSettings.enabled) ?? false}
                    onChange={e =>
                      updateSettingField('tunnelSettings', 'enabled', e.target.checked)
                    }
                  />
                }
                label="Enable Tunnels"
              />

              <TextField
                label="Tunnel Category ID"
                value={String(settings.tunnelSettings.tunnelCategoryId || '')}
                onChange={e =>
                  updateSettingField('tunnelSettings', 'tunnelCategoryId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Max Active Tunnels"
                type="number"
                value={Number(settings.tunnelSettings.maxActiveTunnels || 10)}
                onChange={e =>
                  updateSettingField('tunnelSettings', 'maxActiveTunnels', parseInt(e.target.value))
                }
                fullWidth
              />

              <TextField
                label="Tunnel Duration (minutes)"
                type="number"
                value={Number(settings.tunnelSettings.tunnelDurationMinutes || 60)}
                onChange={e =>
                  updateSettingField(
                    'tunnelSettings',
                    'tunnelDurationMinutes',
                    parseInt(e.target.value)
                  )
                }
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.tunnelSettings.autoDeleteTunnel !== false}
                    onChange={e =>
                      updateSettingField('tunnelSettings', 'autoDeleteTunnel', e.target.checked)
                    }
                  />
                }
                label="Auto-Delete Expired Tunnels"
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleTunnelSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Tunnel Settings'}
              </Button>
            </Stack>
          )}

          {/* Notifications Tab */}
          {activeTab === 3 && (
            <Stack spacing={2}>
              <Typography variant="h6">Notification Preferences</Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean(settings.notificationPreferences.memberJoinNotifications) ?? false
                    }
                    onChange={e =>
                      updateSettingField(
                        'notificationPreferences',
                        'memberJoinNotifications',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Member Join Notifications"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean(settings.notificationPreferences.memberLeaveNotifications) ?? false
                    }
                    onChange={e =>
                      updateSettingField(
                        'notificationPreferences',
                        'memberLeaveNotifications',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Member Leave Notifications"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean(settings.notificationPreferences.roleChangeNotifications) ?? false
                    }
                    onChange={e =>
                      updateSettingField(
                        'notificationPreferences',
                        'roleChangeNotifications',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Role Change Notifications"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notificationPreferences.eventNotifications !== false}
                    onChange={e =>
                      updateSettingField(
                        'notificationPreferences',
                        'eventNotifications',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Event Notifications"
              />

              <TextField
                label="Announcement Channel ID"
                value={String(settings.notificationPreferences.announcementChannelId || '')}
                onChange={e =>
                  updateSettingField(
                    'notificationPreferences',
                    'announcementChannelId',
                    e.target.value
                  )
                }
                fullWidth
              />

              <TextField
                label="System Alert Channel ID"
                value={String(settings.notificationPreferences.systemAlertChannelId || '')}
                onChange={e =>
                  updateSettingField(
                    'notificationPreferences',
                    'systemAlertChannelId',
                    e.target.value
                  )
                }
                fullWidth
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleNotificationSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Notification Settings'}
              </Button>
            </Stack>
          )}

          {/* Ticket System Tab */}
          {activeTab === 4 && (
            <Stack spacing={2}>
              <Typography variant="h6">Ticket System</Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean((settings.ticketSettings || {}).enabled) ?? false}
                    onChange={e =>
                      updateSettingField('ticketSettings', 'enabled', e.target.checked)
                    }
                  />
                }
                label="Enable Ticket System"
              />

              <TextField
                label="Default Category ID"
                value={String((settings.ticketSettings || {}).defaultCategoryId || '')}
                onChange={e =>
                  updateSettingField('ticketSettings', 'defaultCategoryId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Transcript Channel ID"
                value={String((settings.ticketSettings || {}).transcriptChannelId || '')}
                onChange={e =>
                  updateSettingField('ticketSettings', 'transcriptChannelId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Form Channel ID"
                value={String((settings.ticketSettings || {}).formChannelId || '')}
                onChange={e =>
                  updateSettingField('ticketSettings', 'formChannelId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Support Role ID"
                value={String((settings.ticketSettings || {}).supportRoleId || '')}
                onChange={e =>
                  updateSettingField('ticketSettings', 'supportRoleId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Escalation Role ID"
                value={String((settings.ticketSettings || {}).escalationRoleId || '')}
                onChange={e =>
                  updateSettingField('ticketSettings', 'escalationRoleId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Auto-Close After (hours)"
                type="number"
                value={Number((settings.ticketSettings || {}).autoCloseHours ?? 72)}
                onChange={e =>
                  updateSettingField('ticketSettings', 'autoCloseHours', parseInt(e.target.value))
                }
                fullWidth
              />

              <TextField
                label="Max Open Tickets Per User"
                type="number"
                value={Number((settings.ticketSettings || {}).maxOpenTicketsPerUser ?? 2)}
                onChange={e =>
                  updateSettingField(
                    'ticketSettings',
                    'maxOpenTicketsPerUser',
                    parseInt(e.target.value)
                  )
                }
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean((settings.ticketSettings || {}).mentionSupportRoleOnCreate) ?? true
                    }
                    onChange={e =>
                      updateSettingField(
                        'ticketSettings',
                        'mentionSupportRoleOnCreate',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Mention Support Role on Ticket Creation"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean((settings.ticketSettings || {}).notifyOnClose) ?? true}
                    onChange={e =>
                      updateSettingField('ticketSettings', 'notifyOnClose', e.target.checked)
                    }
                  />
                }
                label="Notify on Ticket Close"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean((settings.ticketSettings || {}).allowMemberClose) ?? true}
                    onChange={e =>
                      updateSettingField('ticketSettings', 'allowMemberClose', e.target.checked)
                    }
                  />
                }
                label="Allow Members to Close Their Tickets"
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleTicketSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Ticket Settings'}
              </Button>
            </Stack>
          )}

          {/* Cross Moderation Tab */}
          {activeTab === 5 && (
            <Stack spacing={2}>
              <Typography variant="h6">Cross-Discord Moderation</Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean((settings.crossModerationSettings || {}).enabled) ?? false}
                    onChange={e =>
                      updateSettingField('crossModerationSettings', 'enabled', e.target.checked)
                    }
                  />
                }
                label="Enable Cross-Discord Moderation"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean((settings.crossModerationSettings || {}).sharedBanListEnabled) ?? true
                    }
                    onChange={e =>
                      updateSettingField(
                        'crossModerationSettings',
                        'sharedBanListEnabled',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Share Ban List Across Guilds"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean((settings.crossModerationSettings || {}).sharedMuteListEnabled) ??
                      false
                    }
                    onChange={e =>
                      updateSettingField(
                        'crossModerationSettings',
                        'sharedMuteListEnabled',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Share Mute List Across Guilds"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean((settings.crossModerationSettings || {}).autoBanOnSharedList) ?? false
                    }
                    onChange={e =>
                      updateSettingField(
                        'crossModerationSettings',
                        'autoBanOnSharedList',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Auto-Ban Members on Shared Ban List"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean((settings.crossModerationSettings || {}).propagateTimeouts) ?? false
                    }
                    onChange={e =>
                      updateSettingField(
                        'crossModerationSettings',
                        'propagateTimeouts',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Propagate Timeouts to Connected Guilds"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean((settings.crossModerationSettings || {}).forwardModerationAlerts) ??
                      true
                    }
                    onChange={e =>
                      updateSettingField(
                        'crossModerationSettings',
                        'forwardModerationAlerts',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Forward Moderation Alerts Across Guilds"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={
                      Boolean((settings.crossModerationSettings || {}).notifyOnSharedAction) ?? true
                    }
                    onChange={e =>
                      updateSettingField(
                        'crossModerationSettings',
                        'notifyOnSharedAction',
                        e.target.checked
                      )
                    }
                  />
                }
                label="Notify When Shared Actions Execute"
              />

              <TextField
                label="Ban Appeals Channel ID"
                value={String((settings.crossModerationSettings || {}).banAppealsChannelId || '')}
                onChange={e =>
                  updateSettingField(
                    'crossModerationSettings',
                    'banAppealsChannelId',
                    e.target.value
                  )
                }
                fullWidth
              />

              <TextField
                label="Cross-Guild Audit Log Channel ID"
                value={String(
                  (settings.crossModerationSettings || {}).crossGuildAuditLogChannelId || ''
                )}
                onChange={e =>
                  updateSettingField(
                    'crossModerationSettings',
                    'crossGuildAuditLogChannelId',
                    e.target.value
                  )
                }
                fullWidth
              />

              <TextField
                label="Escalation Role ID"
                value={String((settings.crossModerationSettings || {}).escalationRoleId || '')}
                onChange={e =>
                  updateSettingField('crossModerationSettings', 'escalationRoleId', e.target.value)
                }
                fullWidth
              />

              <TextField
                label="Allowed Guild IDs (comma-separated)"
                value={
                  Array.isArray((settings.crossModerationSettings || {}).allowedGuildIds)
                    ? ((settings.crossModerationSettings || {}).allowedGuildIds as string[]).join(
                        ','
                      )
                    : ''
                }
                onChange={e =>
                  updateSettingField(
                    'crossModerationSettings',
                    'allowedGuildIds',
                    e.target.value
                      .split(',')
                      .map(id => id.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="1234567890,0987654321"
                fullWidth
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleCrossModerationSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Cross Moderation Settings'}
              </Button>
            </Stack>
          )}

          {/* Role Sync Tab */}
          {activeTab === 6 && (
            <Stack spacing={2}>
              <Typography variant="h6">Role Synchronization</Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(settings.roleSyncSettings.enabled) ?? false}
                    onChange={e =>
                      updateSettingField('roleSyncSettings', 'enabled', e.target.checked)
                    }
                  />
                }
                label="Enable Role Sync"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.roleSyncSettings.syncRolesFromApi !== false}
                    onChange={e =>
                      updateSettingField('roleSyncSettings', 'syncRolesFromApi', e.target.checked)
                    }
                  />
                }
                label="Sync Roles from API"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(settings.roleSyncSettings.autoRoleManagement) ?? false}
                    onChange={e =>
                      updateSettingField('roleSyncSettings', 'autoRoleManagement', e.target.checked)
                    }
                  />
                }
                label="Auto Role Management"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.roleSyncSettings.removeRolesOnLeave !== false}
                    onChange={e =>
                      updateSettingField('roleSyncSettings', 'removeRolesOnLeave', e.target.checked)
                    }
                  />
                }
                label="Remove Roles on Leave"
              />

              <TextField
                label="Sync Interval (minutes)"
                type="number"
                value={Number(settings.roleSyncSettings.syncIntervalMinutes || 60)}
                onChange={e =>
                  updateSettingField(
                    'roleSyncSettings',
                    'syncIntervalMinutes',
                    parseInt(e.target.value)
                  )
                }
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.roleSyncSettings.syncOnBotJoin !== false}
                    onChange={e =>
                      updateSettingField('roleSyncSettings', 'syncOnBotJoin', e.target.checked)
                    }
                  />
                }
                label="Sync on Bot Join"
              />

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleRoleSyncSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Role Sync Settings'}
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Last Sync Info */}
      {settings.lastSyncedAt && (
        <Box mt={3}>
          <Typography variant="caption" color="textSecondary">
            Last synced: {new Date(settings.lastSyncedAt).toLocaleString()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
