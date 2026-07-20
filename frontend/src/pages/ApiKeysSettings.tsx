/**
 * API Keys Settings Page
 * Manage API keys for programmatic access to the Fringe Core API
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/queries/useApiKeyQueries';
import type { ApiKeyCreatedResponse } from '@/services/apiKeyService';
import { logger } from '@/utils/logger';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  VpnKey as KeyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_SCOPES = [
  { value: 'read:profile', label: 'Read Profile', description: 'Read your profile information' },
  { value: 'read:fleet', label: 'Read Fleet', description: 'Read fleet and ship data' },
  {
    value: 'read:activities',
    label: 'Read Activities',
    description: 'Read activities and operations',
  },
  {
    value: 'write:activities',
    label: 'Write Activities',
    description: 'Create and update activities',
  },
  { value: '*', label: 'Full Access', description: 'Unrestricted access to all API endpoints' },
] as const;

const EXPIRY_OPTIONS = [
  { value: 0, label: 'No expiration' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelative(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateString);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ApiKeysSettings: React.FC = () => {
  // ── Data hooks ──
  const { data: apiKeys, isLoading, error } = useApiKeys();
  const createKeyMutation = useCreateApiKey();
  const revokeKeyMutation = useRevokeApiKey();

  // ── Create dialog state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read:profile']);
  const [newKeyExpiry, setNewKeyExpiry] = useState(90);

  // ── Created key reveal state ──
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);
  const [showRawKey, setShowRawKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  // ── Revoke confirm state ──
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  // ── Handlers ──
  const handleOpenCreate = () => {
    setNewKeyName('');
    setNewKeyScopes(['read:profile']);
    setNewKeyExpiry(90);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const result = await createKeyMutation.mutateAsync({
        name: newKeyName.trim(),
        scopes: newKeyScopes,
        expiresInDays: newKeyExpiry || undefined,
      });
      setCreateOpen(false);
      setCreatedKey(result);
      setShowRawKey(true);
      setKeyCopied(false);
    } catch (err) {
      logger.error('Failed to create API key', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCopyKey = () => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.rawKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 3000);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeKeyMutation.mutateAsync({ keyId: revokeTarget.id });
      setRevokeTarget(null);
    } catch (err) {
      logger.error('Failed to revoke API key', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleScopeToggle = (scope: string) => {
    if (scope === '*') {
      setNewKeyScopes(prev => (prev.includes('*') ? ['read:profile'] : ['*']));
      return;
    }
    setNewKeyScopes(prev => {
      const filtered = prev.filter(s => s !== '*');
      return filtered.includes(scope) ? filtered.filter(s => s !== scope) : [...filtered, scope];
    });
  };

  const activeKeys = apiKeys?.filter(k => !k.revoked) ?? [];
  const revokedKeys = apiKeys?.filter(k => k.revoked) ?? [];

  // ── Render ──
  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6">API Keys</Typography>
          <Typography variant="body2" color="text.secondary">
            Create keys for external tools like Wingman AI to access your data programmatically.
            Keys use the <code>X-API-Key</code> header.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          disabled={activeKeys.length >= 10}
        >
          Create Key
        </Button>
      </Stack>

      {activeKeys.length >= 10 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have reached the maximum of 10 active API keys. Revoke an existing key to create a new
          one.
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress />
        </Stack>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load API keys. Please try again.
        </Alert>
      )}

      {/* Active Keys — empty state */}
      {!isLoading && !error && activeKeys.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <KeyIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography color="text.secondary">No API keys yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a key to connect external tools to your Fringe Core account
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            Create Your First Key
          </Button>
        </Paper>
      )}

      {/* Active Keys — table */}
      {activeKeys.length > 0 && (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Scopes</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeKeys.map(key => (
                <TableRow key={key.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {key.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {key.prefix}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {key.scopes.map(scope => (
                        <Chip key={scope} label={scope} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(key.createdAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatRelative(key.lastUsedAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Revoke key">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setRevokeTarget({ id: key.id, name: key.name })}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Revoked Keys
          </Typography>
          <TableContainer component={Paper} sx={{ opacity: 0.6 }}>
            <Table size="small">
              <TableBody>
                {revokedKeys.map(key => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
                        {key.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {key.prefix}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label="Revoked" size="small" color="error" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        Revoked {key.revokedAt ? formatDate(key.revokedAt) : ''}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Key Name"
              placeholder="e.g., Wingman AI, My Script"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 100 } }}
              helperText="A descriptive name to identify this key"
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Permissions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Choose what this key can access. Select only what you need.
              </Typography>
              <Stack spacing={0.5}>
                {AVAILABLE_SCOPES.map(scope => (
                  <FormControlLabel
                    key={scope.value}
                    control={
                      <Checkbox
                        checked={newKeyScopes.includes(scope.value)}
                        onChange={() => handleScopeToggle(scope.value)}
                        disabled={scope.value !== '*' && newKeyScopes.includes('*')}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {scope.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {scope.description}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </Stack>
            </Box>

            <TextField
              select
              label="Expiration"
              value={newKeyExpiry}
              onChange={e => setNewKeyExpiry(Number(e.target.value))}
              fullWidth
              helperText="Expired keys stop working automatically"
            >
              {EXPIRY_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={
              !newKeyName.trim() || newKeyScopes.length === 0 || createKeyMutation.isPending
            }
          >
            {createKeyMutation.isPending ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Creating...
              </>
            ) : (
              'Create Key'
            )}
          </Button>
        </DialogActions>
        {createKeyMutation.isError && (
          <Alert severity="error" sx={{ mx: 3, mb: 2 }}>
            {createKeyMutation.error instanceof Error
              ? createKeyMutation.error.message
              : 'Failed to create API key. You may have reached the 10-key limit or a key with that name already exists.'}
          </Alert>
        )}
      </Dialog>

      {/* ── Key Created — Show Raw Key ── */}
      <Dialog open={!!createdKey} onClose={() => setCreatedKey(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <Typography variant="h6">API Key Created</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy your key now. It will not be shown again.
          </Alert>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {createdKey?.name}
          </Typography>

          <Paper
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              wordBreak: 'break-all',
              position: 'relative',
            }}
          >
            {showRawKey ? createdKey?.rawKey : '\u2022'.repeat(40)}
            <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8 }}>
              <Tooltip title={showRawKey ? 'Hide' : 'Show'}>
                <IconButton size="small" onClick={() => setShowRawKey(!showRawKey)}>
                  {showRawKey ? (
                    <VisibilityOffIcon fontSize="small" />
                  ) : (
                    <VisibilityIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title={keyCopied ? 'Copied!' : 'Copy to clipboard'}>
                <IconButton
                  size="small"
                  onClick={handleCopyKey}
                  color={keyCopied ? 'success' : 'default'}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Paper>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary">
            Use this key in the <code>X-API-Key</code> header when making API requests:
          </Typography>
          <Paper
            sx={{
              p: 1.5,
              mt: 1,
              bgcolor: 'action.hover',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            curl -H &quot;X-API-Key: {createdKey?.rawKey ? `${createdKey.prefix}...` : ''}&quot;
            https://fringecore.space/api/v2/...
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreatedKey(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Revoke Confirmation ── */}
      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Revoke API Key</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revoke <strong>{revokeTarget?.name}</strong>? Any application
            using this key will immediately lose access.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRevoke}
            disabled={revokeKeyMutation.isPending}
          >
            {revokeKeyMutation.isPending ? 'Revoking...' : 'Revoke Key'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export const ApiKeysSettingsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="API Keys Settings">
    <ApiKeysSettings />
  </FeatureErrorBoundary>
);
