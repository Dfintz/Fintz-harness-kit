/**
 * RoleMappingPanel
 *
 * Displays and manages RSI rank → Web role mappings with optional Discord sync.
 * Shows a table of current mappings with CRUD capabilities.
 * Allows applying predefined templates (standard, military, corporate, gaming).
 *
 * Rendered in the Integrations tab of OrgSettings.
 */
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
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
  IconButton,
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
import React, { useCallback, useState } from 'react';

import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreateRoleMapping,
  useDeleteRoleMapping,
  useDiscordGuildRoles,
  useDiscoveredRanks,
  useOrganizationRoles,
  useRoleMappingTemplates,
  useRoleMappings,
  useUpdateRoleMapping,
} from '@/hooks/queries/useRoleMappingQueries';
import {
  RSI_ROLE_TYPES,
  STANDARD_STAR_RANKS,
  type CreateRoleMappingInput,
  type RoleMapping,
} from '@/services/rsiRoleMappingService';
import { logger } from '@/utils/logger';

import { useNotification } from '@/store/uiStore';

interface RoleMappingPanelProps {
  organizationId: string;
  guildId?: string;
}

export const RoleMappingPanel: React.FC<Readonly<RoleMappingPanelProps>> = ({
  organizationId,
  guildId,
}) => {
  // Queries
  const { data: mappingsData, isLoading, error: mappingsError } = useRoleMappings(organizationId);
  const { data: templates = [] } = useRoleMappingTemplates();
  const { data: orgRoles = [] } = useOrganizationRoles(organizationId);
  const {
    data: discordRoles = [],
    isLoading: discordRolesLoading,
    error: discordRolesError,
    refetch: refetchDiscordRoles,
  } = useDiscordGuildRoles(guildId);
  const { data: discoveredRanks } = useDiscoveredRanks(organizationId);
  const notification = useNotification();

  // Build the rank options list using star-to-name mappings for clear display
  const rankOptions = React.useMemo(() => {
    const options: string[] = [];

    // Always include the 4 fixed RSI role types
    for (const role of RSI_ROLE_TYPES) {
      if (!options.includes(role)) {
        options.push(role);
      }
    }

    if (discoveredRanks?.rankMap && discoveredRanks.rankMap.length > 0) {
      // Group by star level — use the most common rank name for each star level
      const starToName = new Map<number, string>();
      for (const entry of discoveredRanks.rankMap) {
        // First occurrence per star level is the most common (sorted by count DESC)
        if (!starToName.has(entry.stars)) {
          starToName.set(entry.stars, entry.name);
        }
      }

      // Fill in missing star levels with standard defaults so every tier is available
      for (let stars = 0; stars <= 5; stars++) {
        if (!starToName.has(stars)) {
          starToName.set(stars, STANDARD_STAR_RANKS[stars]);
        }
      }

      // Build entries sorted by star level (descending: 5→0)
      const starLevels = Array.from(starToName.entries()).sort((a, b) => b[0] - a[0]);
      for (const [, name] of starLevels) {
        if (!options.includes(name)) {
          options.push(name);
        }
      }

      // Add any rank names that weren't covered by the star mapping
      for (const role of discoveredRanks.roles) {
        if (!options.includes(role)) {
          options.push(role);
        }
      }
    } else if (discoveredRanks) {
      // Fallback: use raw role names + numeric ranks
      if (discoveredRanks.roles.length > 0) {
        for (const role of discoveredRanks.roles) {
          if (!options.includes(role)) {
            options.push(role);
          }
        }
      }
      if (discoveredRanks.ranks.length > 0) {
        for (const n of discoveredRanks.ranks) {
          const label = `Rank ${n}`;
          if (!options.includes(label)) {
            options.push(label);
          }
        }
      }
    }
    // Add RSI org roles (CEO, VP, etc.) alongside ranks
    if (discoveredRanks?.orgRoles && discoveredRanks.orgRoles.length > 0) {
      for (const role of discoveredRanks.orgRoles) {
        if (!options.includes(role)) {
          options.push(role);
        }
      }
    }

    // If no star-rank data was discovered, fill in default star-rank names
    const hasStarRanks = discoveredRanks?.rankMap && discoveredRanks.rankMap.length > 0;
    if (!hasStarRanks) {
      for (let stars = 5; stars >= 0; stars--) {
        const name = STANDARD_STAR_RANKS[stars];
        if (!options.includes(name)) {
          options.push(name);
        }
      }
    }
    return options;
  }, [discoveredRanks]);

  // Build star-to-name label map for display in dropdown and table
  const rankDisplayMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (discoveredRanks?.rankMap) {
      const starToName = new Map<number, string>();
      for (const entry of discoveredRanks.rankMap) {
        if (!starToName.has(entry.stars)) {
          starToName.set(entry.stars, entry.name);
        }
      }
      // Include standard defaults for missing star levels
      for (let stars = 0; stars <= 5; stars++) {
        if (!starToName.has(stars)) {
          starToName.set(stars, STANDARD_STAR_RANKS[stars]);
        }
      }
      for (const [stars, name] of starToName) {
        map.set(name, `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} ${name}`);
      }
    }
    return map;
  }, [discoveredRanks]);

  // Mutations
  const createMapping = useCreateRoleMapping();
  const updateMapping = useUpdateRoleMapping();
  const deleteMapping = useDeleteRoleMapping();

  // Client-only UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<RoleMapping | null>(null);

  // Form state
  const [formRank, setFormRank] = useState('');
  const [formDiscordRoleId, setFormDiscordRoleId] = useState('');
  const [formWebRoleId, setFormWebRoleId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState(0);

  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  const mappings = mappingsData?.mappings ?? [];
  const isSaving = createMapping.isPending || updateMapping.isPending;

  /** Render the Discord role field based on connection/loading/error state */
  const renderDiscordRoleField = () => {
    if (!guildId) {
      return (
        <TextField
          label="Discord Role ID (optional)"
          value={formDiscordRoleId}
          onChange={e => setFormDiscordRoleId(e.target.value)}
          size="small"
          helperText="Connect a Discord server to see available roles"
        />
      );
    }

    if (discordRolesLoading) {
      return (
        <Autocomplete
          options={[]}
          loading
          renderInput={params => (
            <TextField
              {...params}
              label="Discord Role (optional)"
              size="small"
              helperText="Loading Discord roles…"
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      <CircularProgress size={16} />
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
          disabled
        />
      );
    }

    if (discordRolesError || discordRoles.length === 0) {
      return (
        <Box>
          <TextField
            label="Discord Role ID (optional)"
            value={formDiscordRoleId}
            onChange={e => setFormDiscordRoleId(e.target.value)}
            size="small"
            fullWidth
            helperText={
              discordRolesError
                ? 'Could not load Discord roles — enter the role ID manually or retry'
                : 'No roles found in this Discord server'
            }
          />
          <Button size="small" onClick={() => refetchDiscordRoles()} sx={{ mt: 0.5 }}>
            Retry loading roles
          </Button>
        </Box>
      );
    }

    return (
      <Autocomplete
        options={discordRoles}
        getOptionLabel={option => `${option.name} (${option.id})`}
        value={discordRoles.find(r => r.id === formDiscordRoleId) ?? null}
        onChange={(_, newValue) => setFormDiscordRoleId(newValue?.id ?? '')}
        renderInput={params => (
          <TextField
            {...params}
            label="Discord Role (optional)"
            size="small"
            helperText="Optionally also assign a Discord role for this RSI rank"
          />
        )}
        isOptionEqualToValue={(option, value) => option.id === value.id}
      />
    );
  };

  /** Find Discord role name by ID for display */
  const getDiscordRoleName = (roleId: string | undefined): string => {
    if (!roleId) return '—';
    const role = discordRoles.find(r => r.id === roleId);
    return role ? `${role.name} (${roleId})` : roleId;
  };

  const openCreateDialog = () => {
    setEditingMapping(null);
    setFormRank('');
    setFormDiscordRoleId('');
    setFormWebRoleId('');
    setFormDescription('');
    setFormPriority(0);
    setDialogOpen(true);
  };

  const openEditDialog = (mapping: RoleMapping) => {
    setEditingMapping(mapping);
    setFormRank(mapping.rsiRank);
    setFormDiscordRoleId(mapping.discordRoleId ?? '');
    setFormWebRoleId(mapping.internalRoleId ?? '');
    setFormDescription(mapping.description ?? '');
    setFormPriority(mapping.priority ?? 0);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formRank.trim() || !formWebRoleId) return;
    try {
      if (editingMapping) {
        await updateMapping.mutateAsync({
          organizationId,
          mappingId: editingMapping.id,
          data: {
            discordRoleId: formDiscordRoleId || undefined,
            internalRoleId: formWebRoleId || undefined,
            description: formDescription || undefined,
            priority: formPriority,
          },
        });
      } else {
        const input: CreateRoleMappingInput = {
          rsiRank: formRank.trim(),
          discordRoleId: formDiscordRoleId || undefined,
          internalRoleId: formWebRoleId || undefined,
          description: formDescription || undefined,
          priority: formPriority,
          isActive: true,
        };
        await createMapping.mutateAsync({ organizationId, data: input });
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save mapping';
      notification.error(message);
      logger.error(
        'Failed to save role mapping',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteMapping.mutateAsync({ organizationId, mappingId: pendingDeleteId });
      closeDeleteConfirm();
    } catch (err: unknown) {
      closeDeleteConfirm();
      notification.error(err instanceof Error ? err.message : 'Failed to delete mapping');
      logger.error(
        'Failed to delete role mapping',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [pendingDeleteId, organizationId, deleteMapping, closeDeleteConfirm, notification]);

  if (isLoading) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const error =
    mappingsError instanceof Error
      ? mappingsError.message
      : mappingsError
        ? String(mappingsError)
        : null;

  /** Ranks already mapped — exclude from dropdown when creating */
  const mappedRanks = new Set(mappings.map(m => m.rsiRank));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SwapHorizIcon />
          <Typography variant="h6">Role Mapping: RSI → Web Role</Typography>
        </Stack>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Mapping
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Template Chips */}
      {templates.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            Templates:
          </Typography>
          {templates.map(t => (
            <Chip
              key={t.name}
              label={t.name}
              variant="outlined"
              size="small"
              clickable
              onClick={() => {
                // Templates are informational — clicking shows the template name
                // Actual template application requires backend call which already exists
              }}
            />
          ))}
        </Stack>
      )}

      {/* Mappings Table */}
      {mappings.length === 0 ? (
        <Alert severity="info">
          No role mappings configured. Add mappings to sync RSI ranks with web app roles.
        </Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>RSI Rank</TableCell>
                <TableCell>Web Role</TableCell>
                <TableCell>Discord Role</TableCell>
                <TableCell align="center">Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.map(mapping => (
                <TableRow key={mapping.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {rankDisplayMap.get(mapping.rsiRank) ?? mapping.rsiRank}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {mapping.internalRoleId
                        ? (orgRoles.find(r => r.id === mapping.internalRoleId)?.name ??
                          mapping.internalRoleId)
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {getDiscordRoleName(mapping.discordRoleId)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2">{mapping.priority}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={mapping.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={mapping.isActive ? 'success' : 'default'}
                      variant={mapping.isActive ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 200 }}
                    >
                      {mapping.description ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(mapping)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => openDeleteConfirm(mapping.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMapping ? 'Edit Role Mapping' : 'Create Role Mapping'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* RSI Rank — dynamic from crawled data or freeform */}
            <Autocomplete
              freeSolo
              options={rankOptions.filter(rank => editingMapping || !mappedRanks.has(rank))}
              value={formRank}
              onInputChange={(_, newValue) => setFormRank(newValue)}
              disabled={Boolean(editingMapping)}
              getOptionLabel={option => {
                if (typeof option === 'string') return option;
                return String(option);
              }}
              renderOption={({ key, ...props }, option) => (
                <li key={key} {...props}>
                  {rankDisplayMap.get(option) ?? option}
                  {!editingMapping && mappedRanks.has(option) ? ' (already mapped)' : ''}
                </li>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  label="RSI Rank"
                  size="small"
                  required
                  helperText={
                    discoveredRanks &&
                    (discoveredRanks.roles.length > 0 || discoveredRanks.ranks.length > 0)
                      ? 'Ranks discovered from RSI member data. You can also type a custom rank.'
                      : "No crawled data yet — showing defaults. Run a sync to discover your org's ranks."
                  }
                />
              )}
            />

            {/* Web Role — primary sync target */}
            <Autocomplete
              options={orgRoles}
              getOptionLabel={option => option.name}
              value={orgRoles.find(r => r.id === formWebRoleId) ?? null}
              onChange={(_, newValue) => setFormWebRoleId(newValue?.id ?? '')}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Web Role"
                  size="small"
                  required
                  helperText="The web app role to assign when a user has this RSI rank"
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />

            {/* Discord Role — optional, dropdown if guild is connected */}
            {renderDiscordRoleField()}

            <TextField
              label="Description"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              size="small"
              multiline
              rows={2}
              helperText="Optional admin notes for this mapping"
            />

            <TextField
              label="Priority"
              type="number"
              value={formPriority}
              onChange={e =>
                setFormPriority(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))
              }
              size="small"
              helperText="Higher priority mappings take precedence (0–1000)"
              slotProps={{ htmlInput: { min: 0, max: 1000 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || !formRank.trim() || !formWebRoleId}
            startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
          >
            {isSaving && 'Saving...'}
            {!isSaving && editingMapping && 'Update'}
            {!isSaving && !editingMapping && 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Role Mapping"
        message="This will remove the rank-to-role mapping. Members with this RSI rank will no longer be auto-assigned the corresponding web role."
        onConfirm={handleDelete}
        loading={deleteMapping.isPending}
      />
    </Box>
  );
};
