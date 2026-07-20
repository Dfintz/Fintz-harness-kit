/**
 * VoiceServerConfigPanel — Configuration editor for org/federation voice servers.
 *
 * Allows setting: server type, host, port, RBAC restrictions, CAS contribution.
 * Used in OrgSettings and FederationManagePage.
 */

import {
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type {
  UpdateVoiceServerConfigRequest,
  VoiceServerConfig,
  VoiceServerShareEntry,
  VoiceServerShareTargetType,
  VoiceServerType,
  VoiceServerWhitelistSuggestion,
} from '@sc-fleet-manager/shared-types';
import React, { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logger } from '@/utils/logger';

const SERVER_TYPE_OPTIONS: Array<{ value: VoiceServerType; label: string }> = [
  { value: 'mumble', label: 'Mumble' },
  { value: 'teamspeak', label: 'TeamSpeak' },
  { value: 'ventrilo', label: 'Ventrilo' },
  { value: 'stoat', label: 'Stoat' },
  { value: 'custom', label: 'Custom' },
];
const TEAMSPEAK_DEFAULT_QUERY_PORT = 10011;

const getConnectProtocol = (type: VoiceServerType): string => {
  if (type === 'teamspeak') return 'ts3server';
  if (type === 'stoat') return 'https';
  return type;
};

const getDefaultPort = (type: VoiceServerType): number => {
  if (type === 'mumble') return 64738;
  if (type === 'teamspeak') return 9987;
  if (type === 'ventrilo') return 3784;
  if (type === 'stoat') return 443;
  return 64738;
};

/**
 * Defaults applied when an org/federation has no voice server configured yet.
 * Pre-fills the form with the production Mumble shape (Stellar Network Collective)
 * so admins only have to confirm the host. The host comes from VITE_PLATFORM_MUMBLE_HOST
 * (set in the frontend build env to the Azure VM FQDN — see azure/modules/mumble.bicep
 * output `mumbleFqdn`, e.g. `scfm-<baseName>.<region>.cloudapp.azure.com`).
 */
const PLATFORM_MUMBLE_HOST = import.meta.env.VITE_PLATFORM_MUMBLE_HOST ?? '';
const PLATFORM_MUMBLE_DEFAULTS: {
  enabled: boolean;
  serverType: VoiceServerType;
  host: string;
  port: number;
  displayName: string;
  connectUrl: string;
  iceHost: string;
  icePort: number;
  contributeToCAS: boolean;
} = {
  enabled: true,
  serverType: 'mumble',
  host: PLATFORM_MUMBLE_HOST,
  port: 64738,
  displayName: 'Stellar Network Collective Mumble',
  connectUrl: PLATFORM_MUMBLE_HOST ? `mumble://${PLATFORM_MUMBLE_HOST}:64738/` : '',
  iceHost: '127.0.0.1',
  icePort: 6502,
  contributeToCAS: true,
};

interface VoiceServerConfigPanelProps {
  config: VoiceServerConfig | null | undefined;
  isLoading: boolean;
  onSave: (data: UpdateVoiceServerConfigRequest) => Promise<void>;
  onDelete: () => Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
  error?: Error | null;
  /** Whitelist suggestions from federation memberships and positive relationships */
  suggestions?: VoiceServerWhitelistSuggestion[];
  suggestionsLoading?: boolean;
}

export const VoiceServerConfigPanel: React.FC<Readonly<VoiceServerConfigPanelProps>> = ({
  config,
  isLoading,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  error,
  suggestions,
  suggestionsLoading,
}) => {
  const [enabled, setEnabled] = useState(PLATFORM_MUMBLE_DEFAULTS.enabled);
  const [serverType, setServerType] = useState<VoiceServerType>(
    PLATFORM_MUMBLE_DEFAULTS.serverType
  );
  const [host, setHost] = useState(PLATFORM_MUMBLE_DEFAULTS.host);
  const [port, setPort] = useState(PLATFORM_MUMBLE_DEFAULTS.port);
  const [displayName, setDisplayName] = useState(PLATFORM_MUMBLE_DEFAULTS.displayName);
  const [password, setPassword] = useState('');
  const [connectUrl, setConnectUrl] = useState(PLATFORM_MUMBLE_DEFAULTS.connectUrl);
  const [queryPort, setQueryPort] = useState(TEAMSPEAK_DEFAULT_QUERY_PORT);
  const [queryUsername, setQueryUsername] = useState('');
  const [queryPassword, setQueryPassword] = useState('');
  const [minRolePriority, setMinRolePriority] = useState(0);
  const [contributeToCAS, setContributeToCAS] = useState(PLATFORM_MUMBLE_DEFAULTS.contributeToCAS);
  const [iceHost, setIceHost] = useState(PLATFORM_MUMBLE_DEFAULTS.iceHost);
  const [icePort, setIcePort] = useState(PLATFORM_MUMBLE_DEFAULTS.icePort);
  const [iceSecret, setIceSecret] = useState('');
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [whitelist, setWhitelist] = useState<VoiceServerShareEntry[]>([]);
  const [newTargetType, setNewTargetType] = useState<VoiceServerShareTargetType>('federation');
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetId, setNewTargetId] = useState('');
  const { openDialog, closeDialog, dialogProps } = useConfirmDialog<boolean>();

  useEffect(() => {
    if (config) {
      // Existing config — hydrate form from saved values.
      setEnabled(config.enabled);
      setServerType(config.serverType);
      setHost(config.host);
      setPort(config.port);
      setDisplayName(config.displayName ?? '');
      setConnectUrl(config.connectUrl ?? '');
      setQueryPort(config.queryPort ?? TEAMSPEAK_DEFAULT_QUERY_PORT);
      setQueryUsername(config.queryUsername ?? '');
      setQueryPassword('');
      setMinRolePriority(config.minRolePriority ?? 0);
      setContributeToCAS(config.contributeToCAS ?? false);
      setIceHost(config.iceHost ?? '');
      setIcePort(config.icePort ?? 6502);
      setSharingEnabled(config.sharing?.enabled ?? false);
      setWhitelist(config.sharing?.whitelist ?? []);
    } else if (config === null) {
      // No saved config yet — apply production Mumble defaults so admins
      // see a pre-filled form they can save with one click.
      setEnabled(PLATFORM_MUMBLE_DEFAULTS.enabled);
      setServerType(PLATFORM_MUMBLE_DEFAULTS.serverType);
      setHost(PLATFORM_MUMBLE_DEFAULTS.host);
      setPort(PLATFORM_MUMBLE_DEFAULTS.port);
      setDisplayName(PLATFORM_MUMBLE_DEFAULTS.displayName);
      setConnectUrl(PLATFORM_MUMBLE_DEFAULTS.connectUrl);
      setQueryPort(TEAMSPEAK_DEFAULT_QUERY_PORT);
      setQueryUsername('');
      setQueryPassword('');
      setContributeToCAS(PLATFORM_MUMBLE_DEFAULTS.contributeToCAS);
      setIceHost(PLATFORM_MUMBLE_DEFAULTS.iceHost);
      setIcePort(PLATFORM_MUMBLE_DEFAULTS.icePort);
    }
  }, [config]);

  // Auto-generate connect URL
  useEffect(() => {
    if (host && port && !connectUrl) {
      const protocol = getConnectProtocol(serverType);
      setConnectUrl(`${protocol}://${host}:${port}/`);
    }
  }, [host, port, serverType, connectUrl]);

  const handleSave = useCallback(async () => {
    try {
      await onSave({
        enabled,
        serverType,
        host,
        port,
        displayName: displayName || undefined,
        password: password || undefined,
        connectUrl: connectUrl || undefined,
        queryPort: serverType === 'teamspeak' ? queryPort : undefined,
        queryUsername: serverType === 'teamspeak' ? queryUsername || undefined : undefined,
        queryPassword: serverType === 'teamspeak' ? queryPassword || undefined : undefined,
        minRolePriority,
        contributeToCAS,
        iceHost: iceHost || undefined,
        icePort: iceHost ? icePort : undefined,
        iceSecret: iceSecret || undefined,
        sharing: {
          enabled: sharingEnabled,
          whitelist: whitelist.map(e => ({
            type: e.type,
            targetId: e.targetId,
            targetName: e.targetName,
          })),
        },
      });
      setPassword(''); // Clear password after save
      setQueryPassword(''); // Clear TeamSpeak query password after save
      setIceSecret(''); // Clear ICE secret after save
    } catch (err) {
      logger.error(
        'Failed to save voice server config',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [
    enabled,
    serverType,
    host,
    port,
    displayName,
    password,
    connectUrl,
    queryPort,
    queryUsername,
    queryPassword,
    minRolePriority,
    contributeToCAS,
    iceHost,
    icePort,
    iceSecret,
    sharingEnabled,
    whitelist,
    onSave,
  ]);

  const handleAddWhitelistEntry = useCallback(() => {
    if (!newTargetId.trim() || !newTargetName.trim()) return;
    const entry: VoiceServerShareEntry = {
      type: newTargetType,
      targetId: newTargetId.trim(),
      targetName: newTargetName.trim(),
      addedAt: new Date().toISOString(),
    };
    setWhitelist(prev => [...prev, entry]);
    setNewTargetId('');
    setNewTargetName('');
  }, [newTargetType, newTargetId, newTargetName]);

  const handleRemoveWhitelistEntry = useCallback((targetId: string) => {
    setWhitelist(prev => prev.filter(e => e.targetId !== targetId));
  }, []);

  const handleAddSuggestion = useCallback((suggestion: VoiceServerWhitelistSuggestion) => {
    const entry: VoiceServerShareEntry = {
      type: suggestion.type,
      targetId: suggestion.targetId,
      targetName: suggestion.targetName,
      addedAt: new Date().toISOString(),
    };
    setWhitelist(prev => {
      if (prev.some(e => e.targetId === suggestion.targetId)) return prev;
      return [...prev, entry];
    });
  }, []);

  const handleAddAllSuggestions = useCallback(() => {
    if (!suggestions) return;
    setWhitelist(prev => {
      const existingIds = new Set(prev.map(e => e.targetId));
      const newEntries = suggestions
        .filter(s => !existingIds.has(s.targetId))
        .map(s => ({
          type: s.type,
          targetId: s.targetId,
          targetName: s.targetName,
          addedAt: new Date().toISOString(),
        }));
      return [...prev, ...newEntries];
    });
  }, [suggestions]);

  const handleDelete = useCallback(async () => {
    try {
      await onDelete();
      closeDialog();
      setEnabled(false);
      setHost('');
      setPort(64738);
      setDisplayName('');
      setQueryPort(TEAMSPEAK_DEFAULT_QUERY_PORT);
      setQueryUsername('');
      setQueryPassword('');
    } catch (err) {
      logger.error(
        'Failed to delete voice server config',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [onDelete, closeDialog]);

  if (isLoading) {
    return <CircularProgress />;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Voice Server Configuration
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        <Stack spacing={2.5}>
          {/* Enable Toggle */}
          <FormControlLabel
            control={
              <Switch checked={enabled} onChange={(_, v) => setEnabled(v)} color="primary" />
            }
            label="Enable Voice Server Integration"
          />

          {enabled && (
            <>
              {/* Server Type */}
              <FormControl fullWidth size="small">
                <InputLabel>Server Type</InputLabel>
                <Select
                  value={serverType}
                  label="Server Type"
                  onChange={e => {
                    const type = e.target.value as VoiceServerType;
                    setServerType(type);
                    // Set default port by type
                    if (type !== 'custom') {
                      setPort(getDefaultPort(type));
                    }
                  }}
                >
                  {SERVER_TYPE_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Host + Port */}
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Host / IP"
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  size="small"
                  fullWidth
                  required
                  placeholder={
                    PLATFORM_MUMBLE_HOST || 'scfm-<baseName>.<region>.cloudapp.azure.com'
                  }
                  helperText={
                    serverType === 'mumble'
                      ? 'Public FQDN of the Mumble VM (azure/modules/mumble.bicep output `mumbleFqdn`).'
                      : 'Public hostname or IP of the voice server.'
                  }
                />
                <TextField
                  label="Port"
                  type="number"
                  value={port}
                  onChange={e => setPort(Number(e.target.value))}
                  size="small"
                  sx={{ width: 120 }}
                  required
                  slotProps={{ htmlInput: { min: 1, max: 65535 } }}
                />
              </Stack>

              {/* Display Name */}
              <TextField
                label="Display Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                size="small"
                fullWidth
                placeholder="My Org Voice Server"
              />

              {/* Password */}
              <TextField
                label="Server Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                size="small"
                fullWidth
                placeholder={config?.hasPassword ? '••••••• (leave blank to keep)' : 'Optional'}
                helperText="Encrypted at rest. Never displayed after saving."
              />

              {/* Connect URL */}
              <TextField
                label="Connect URL (deep link)"
                value={connectUrl}
                onChange={e => setConnectUrl(e.target.value)}
                size="small"
                fullWidth
                placeholder={`${getConnectProtocol(serverType)}://${host || 'hostname'}:${port}/`}
                helperText="One-click connect link for members"
              />

              {serverType === 'teamspeak' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                    TeamSpeak ServerQuery (required for live user counts)
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="ServerQuery Port"
                      type="number"
                      value={queryPort}
                      onChange={e => setQueryPort(Number(e.target.value))}
                      size="small"
                      sx={{ width: 180 }}
                      slotProps={{ htmlInput: { min: 1, max: 65535 } }}
                    />
                    <TextField
                      label="ServerQuery Username"
                      value={queryUsername}
                      onChange={e => setQueryUsername(e.target.value)}
                      size="small"
                      fullWidth
                      placeholder="serveradmin"
                    />
                  </Stack>
                  <TextField
                    label="ServerQuery Password"
                    type="password"
                    value={queryPassword}
                    onChange={e => setQueryPassword(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder={
                      config?.hasQueryPassword ? '••••••• (leave blank to keep)' : 'Optional'
                    }
                    helperText="Encrypted at rest. Needed for live TeamSpeak user counts."
                  />
                </>
              )}

              {/* RBAC: Min Role Priority */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Minimum Role Priority for Access:{' '}
                  {minRolePriority === 0 ? 'All Members' : minRolePriority}
                </Typography>
                <Slider
                  value={minRolePriority}
                  onChange={(_, v) => setMinRolePriority(v)}
                  min={0}
                  max={100}
                  step={10}
                  marks={[
                    { value: 0, label: 'All' },
                    { value: 10, label: 'Member' },
                    { value: 50, label: 'Officer' },
                    { value: 90, label: 'Admin' },
                    { value: 100, label: 'Owner' },
                  ]}
                  valueLabelDisplay="auto"
                  sx={{ ml: 1, mr: 1 }}
                />
              </Box>

              {/* CAS Contribution */}
              <FormControlLabel
                control={
                  <Switch
                    checked={contributeToCAS}
                    onChange={(_, v) => setContributeToCAS(v)}
                    color="info"
                  />
                }
                label="Contribute voice minutes to CAS (Composite Activity Score)"
              />
              {contributeToCAS && (
                <Alert severity="info" variant="outlined">
                  Voice time on this server will add to your org&apos;s CAS Voice Activity score
                  (15% weight). Requires a server type with query support (Mumble).
                </Alert>
              )}

              {/* ICE Configuration (Mumble only) */}
              {serverType === 'mumble' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                    ICE Connection (optional — enables channel tree &amp; user data)
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="ICE Host"
                      value={iceHost}
                      onChange={e => setIceHost(e.target.value)}
                      size="small"
                      fullWidth
                      placeholder={host || 'Same as server host'}
                      helperText="Mumble ICE RPC endpoint host"
                    />
                    <TextField
                      label="ICE Port"
                      type="number"
                      value={icePort}
                      onChange={e => setIcePort(Number(e.target.value))}
                      size="small"
                      sx={{ width: 120 }}
                      slotProps={{ htmlInput: { min: 1, max: 65535 } }}
                    />
                  </Stack>
                  <TextField
                    label="ICE Secret"
                    type="password"
                    value={iceSecret}
                    onChange={e => setIceSecret(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder={
                      config?.hasIceSecret ? '••••••• (leave blank to keep)' : 'Optional'
                    }
                    helperText="Mumble server ICE read/write secret. Encrypted at rest."
                  />
                </>
              )}

              {/* Federation & 3rd-Party Sharing */}
              <Divider sx={{ mt: 1 }} />
              <Stack direction="row" alignItems="center" spacing={1}>
                <ShareIcon color="info" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Federation &amp; 3rd-Party Sharing
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Share access to your voice server with federations and trusted organizations.
                Whitelisted entities can see your server status and provide connect links to their
                members.
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={sharingEnabled}
                    onChange={(_, v) => setSharingEnabled(v)}
                    color="info"
                  />
                }
                label="Enable sharing with whitelisted federations and organizations"
              />

              {sharingEnabled && (
                <>
                  {/* Existing whitelist */}
                  {whitelist.length > 0 && (
                    <List dense disablePadding>
                      {whitelist.map(entry => (
                        <ListItem
                          key={entry.targetId}
                          secondaryAction={
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleRemoveWhitelistEntry(entry.targetId)}
                              aria-label={`Remove ${entry.targetName}`}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          }
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 0.5,
                          }}
                        >
                          <ListItemText
                            primary={entry.targetName}
                            secondary={
                              <Chip
                                label={entry.type === 'federation' ? 'Federation' : 'Organization'}
                                size="small"
                                color={entry.type === 'federation' ? 'info' : 'default'}
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {whitelist.length === 0 &&
                    !suggestionsLoading &&
                    (!suggestions || suggestions.length === 0) && (
                      <Alert severity="info" variant="outlined">
                        No entities whitelisted yet. Add federations or organizations below to share
                        access.
                      </Alert>
                    )}

                  {/* Auto-populate suggestions from relationships */}
                  {suggestionsLoading && (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Loading suggestions from federations &amp; relationships…
                      </Typography>
                    </Stack>
                  )}

                  {suggestions && suggestions.length > 0 && (
                    <Box>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 1 }}
                      >
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <AutoAwesomeIcon color="info" fontSize="small" />
                          <Typography variant="subtitle2" color="text.secondary">
                            Suggested from your federations &amp; relationships
                          </Typography>
                        </Stack>
                        {suggestions.some(s => !whitelist.some(e => e.targetId === s.targetId)) && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={handleAddAllSuggestions}
                          >
                            Add All
                          </Button>
                        )}
                      </Stack>
                      <List dense disablePadding>
                        {suggestions.map(suggestion => {
                          const isAdded = whitelist.some(e => e.targetId === suggestion.targetId);
                          return (
                            <ListItem
                              key={suggestion.targetId}
                              secondaryAction={
                                <Button
                                  size="small"
                                  variant="text"
                                  startIcon={<AddIcon />}
                                  onClick={() => handleAddSuggestion(suggestion)}
                                  disabled={isAdded}
                                >
                                  {isAdded ? 'Added' : 'Add'}
                                </Button>
                              }
                              sx={{
                                border: '1px solid',
                                borderColor: isAdded ? 'success.main' : 'divider',
                                borderRadius: 1,
                                mb: 0.5,
                                opacity: isAdded ? 0.6 : 1,
                              }}
                            >
                              <ListItemText
                                primary={suggestion.targetName}
                                secondary={
                                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                    <Chip
                                      label={
                                        suggestion.type === 'federation'
                                          ? 'Federation'
                                          : 'Organization'
                                      }
                                      size="small"
                                      color={suggestion.type === 'federation' ? 'info' : 'default'}
                                      variant="outlined"
                                    />
                                    <Tooltip
                                      title={`Source: ${suggestion.source.replaceAll('_', ' ')}`}
                                    >
                                      <Chip
                                        label={suggestion.sourceLabel}
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                      />
                                    </Tooltip>
                                  </Stack>
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    </Box>
                  )}

                  {/* Add new whitelist entry (manual) */}
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                    Manual Entry
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Type</InputLabel>
                      <Select<VoiceServerShareTargetType>
                        value={newTargetType}
                        label="Type"
                        onChange={e => setNewTargetType(e.target.value)}
                      >
                        <MenuItem value="federation">Federation</MenuItem>
                        <MenuItem value="organization">Organization</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Name"
                      value={newTargetName}
                      onChange={e => setNewTargetName(e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                      placeholder={
                        newTargetType === 'federation'
                          ? 'e.g. Stellar Network Collective'
                          : 'e.g. Allied Org'
                      }
                    />
                    <TextField
                      label="ID"
                      value={newTargetId}
                      onChange={e => setNewTargetId(e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                      placeholder="UUID of the federation or org"
                    />
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddWhitelistEntry}
                      disabled={!newTargetId.trim() || !newTargetName.trim()}
                      sx={{ minWidth: 80, height: 40 }}
                    >
                      Add
                    </Button>
                  </Stack>
                </>
              )}
            </>
          )}

          {/* Actions */}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            {config?.enabled && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => openDialog(true)}
                disabled={isDeleting}
              >
                Remove
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={isSaving || (enabled && (!host || !port))}
            >
              {isSaving ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </Stack>
        </Stack>

        <ConfirmDialog
          {...dialogProps}
          title="Remove Voice Server"
          message="This will remove the voice server configuration. Members will lose the connect link."
          onConfirm={handleDelete}
        />
      </CardContent>
    </Card>
  );
};
