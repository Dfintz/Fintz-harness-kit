/**
 * FleetListPanel
 *
 * Displays the organization's fleets as cards with create/delete actions.
 * Uses useFleets + useCreateFleet + useDeleteFleet hooks.
 * Selecting a fleet notifies the parent via onSelectFleet callback.
 */

import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FLEET_TYPE_META, getFleetTypeColor } from '@/constants/fleetTypes';
import {
  useCreateFleet,
  useDeleteFleet,
  useFleetCrewMembers,
  useFleetHealth,
  useFleets,
  useFleetShips,
} from '@/hooks/queries/useFleetQueries';
import { useAuthStore, useHasMinOrgRole } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import AddIcon from '@mui/icons-material/Add';
import BoltIcon from '@mui/icons-material/Bolt';
import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleIcon from '@mui/icons-material/People';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  Alert,
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';

// ============================================================================
// Sub-components
// ============================================================================

/** Small inline badge showing fleet health score (fetched per-fleet). */
const FleetHealthBadge: React.FC<Readonly<{ fleetId: string }>> = ({ fleetId }) => {
  const { data: health } = useFleetHealth(fleetId);
  const theme = useTheme();

  if (!health) return null;

  const score = health.healthScore;
  let color = theme.palette.error.main;
  if (score >= 75) color = theme.palette.success.main;
  else if (score >= 50) color = theme.palette.warning.main;

  return (
    <Tooltip title={`Fleet readiness: ${score}%`}>
      <Chip
        icon={<FavoriteIcon sx={{ fontSize: 12 }} />}
        label={`${score}%`}
        size="small"
        sx={{
          height: 18,
          fontSize: '0.6rem',
          fontWeight: 600,
          bgcolor: alpha(color, 0.12),
          color,
          border: `1px solid ${alpha(color, 0.3)}`,
          '& .MuiChip-label': { px: 0.4 },
          '& .MuiChip-icon': { ml: 0.3 },
        }}
      />
    </Tooltip>
  );
};

/** Compact preview showing crew member avatars and top ships for the selected fleet. */
const FleetCardPreview: React.FC<Readonly<{ fleetId: string }>> = ({ fleetId }) => {
  const theme = useTheme();
  const { data: crewData } = useFleetCrewMembers(fleetId);
  const { data: shipsData } = useFleetShips(fleetId, { page: 1, limit: 5 });

  const members = crewData?.members ?? [];
  const ships = shipsData?.items ?? [];
  const totalShips = shipsData?.pagination?.total ?? ships.length;

  if (members.length === 0 && ships.length === 0) return null;

  return (
    <Box
      sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Crew avatars */}
      {members.length > 0 && (
        <Box sx={{ mb: ships.length > 0 ? 0.75 : 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.65rem', fontWeight: 600, mb: 0.25, display: 'block' }}
          >
            Crew
          </Typography>
          <AvatarGroup
            max={6}
            sx={{
              justifyContent: 'flex-start',
              '& .MuiAvatar-root': {
                width: 22,
                height: 22,
                fontSize: '0.6rem',
                border: `1.5px solid ${theme.palette.background.paper}`,
              },
            }}
          >
            {members.map(member => (
              <Tooltip key={member.userId} title={member.displayName ?? member.username}>
                <Avatar
                  src={sanitizeImageUrl(member.avatar) || undefined}
                  alt={member.displayName ?? member.username}
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.3) }}
                >
                  {(member.displayName ?? member.username)?.charAt(0)?.toUpperCase()}
                </Avatar>
              </Tooltip>
            ))}
          </AvatarGroup>
        </Box>
      )}
      {/* Ships list */}
      {ships.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.65rem', fontWeight: 600, mb: 0.25, display: 'block' }}
          >
            Ships
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {ships.slice(0, 4).map(ship => (
              <Chip
                key={ship.id}
                label={ship.name || ship.model || 'Unknown'}
                size="small"
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            ))}
            {totalShips > 4 && (
              <Chip
                label={`+${totalShips - 4}`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  bgcolor: alpha(theme.palette.text.secondary, 0.08),
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// Types
// ============================================================================

interface FleetListPanelProps {
  selectedFleetId: string | null;
  onSelectFleet: (fleetId: string | null) => void;
}

// ============================================================================
// Component
// ============================================================================

export const FleetListPanel: React.FC<Readonly<FleetListPanelProps>> = ({
  selectedFleetId,
  onSelectFleet,
}) => {
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId;
  const canManageFleets = useHasMinOrgRole('officer');
  const notification = useNotification();

  // Create fleet inline form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFleetName, setNewFleetName] = useState('');
  const [newFleetDescription, setNewFleetDescription] = useState('');
  const [newFleetType, setNewFleetType] = useState('mixed');

  // Queries
  const { data: fleetsData, isLoading, error: fleetsError } = useFleets(orgId);
  const createFleet = useCreateFleet();
  const deleteFleet = useDeleteFleet();
  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  const fleets = fleetsData?.items ?? [];

  const handleCreate = useCallback(async () => {
    if (!orgId || !newFleetName.trim()) return;
    try {
      const fleet = await createFleet.mutateAsync({
        organizationId: orgId,
        data: {
          name: newFleetName.trim(),
          description: newFleetDescription.trim() || undefined,
          type: newFleetType,
        },
      });
      setNewFleetName('');
      setNewFleetDescription('');
      setNewFleetType('mixed');
      setShowCreateForm(false);
      onSelectFleet(fleet.id);
    } catch (err: unknown) {
      const message =
        (err instanceof Error ? err.message : String(err)) || 'Failed to create fleet';
      notification.error(message);
      logger.error('Failed to create fleet', err instanceof Error ? err : new Error(String(err)));
    }
  }, [orgId, newFleetName, newFleetDescription, newFleetType, createFleet, onSelectFleet]);

  const handleDelete = useCallback(async () => {
    const fleetId = pendingDeleteId;
    closeDeleteConfirm();
    if (!fleetId) return;
    // Unselect first so detail-panel queries unmount before the row disappears,
    // preventing 404 refetches against the deleted fleet.
    if (selectedFleetId === fleetId) {
      onSelectFleet(null);
    }
    try {
      await deleteFleet.mutateAsync(fleetId);
    } catch (err: unknown) {
      logger.error('Failed to delete fleet', err instanceof Error ? err : new Error(String(err)));
    }
  }, [pendingDeleteId, closeDeleteConfirm, deleteFleet, selectedFleetId, onSelectFleet]);

  if (!orgId) {
    return <Alert severity="info">Join an organization to manage fleets.</Alert>;
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Fleets
        </Typography>
        {canManageFleets && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateForm(true)}
            variant="outlined"
          >
            Create Fleet
          </Button>
        )}
      </Stack>

      {/* Create Form */}
      {showCreateForm && (
        <Card sx={{ mb: 2, border: '1px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">New Fleet</Typography>

              <TextField
                size="small"
                label="Fleet Name"
                value={newFleetName}
                onChange={e => setNewFleetName(e.target.value)}
                required
                fullWidth
                autoFocus
                placeholder="e.g., Alpha Strike Force"
              />
              <TextField
                size="small"
                label="Description"
                value={newFleetDescription}
                onChange={e => setNewFleetDescription(e.target.value)}
                fullWidth
                placeholder="Optional description..."
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Focus</InputLabel>
                <Select
                  label="Focus"
                  value={newFleetType}
                  onChange={e => setNewFleetType(e.target.value)}
                >
                  <MenuItem value="combat">Combat</MenuItem>
                  <MenuItem value="mining">Mining</MenuItem>
                  <MenuItem value="trading">Trading</MenuItem>
                  <MenuItem value="exploration">Exploration</MenuItem>
                  <MenuItem value="salvage">Salvage</MenuItem>
                  <MenuItem value="escort">Escort</MenuItem>
                  <MenuItem value="reconnaissance">Reconnaissance</MenuItem>
                  <MenuItem value="medical">Medical</MenuItem>
                  <MenuItem value="mixed">Mixed</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewFleetName('');
                    setNewFleetDescription('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!newFleetName.trim() || createFleet.isPending}
                >
                  {createFleet.isPending ? 'Creating...' : 'Create'}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error */}
      {fleetsError && (
        <Alert severity="error">
          {fleetsError instanceof Error ? fleetsError.message : 'Failed to load fleets'}
        </Alert>
      )}

      {/* Fleet List */}
      {!isLoading && !fleetsError && fleets.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          <GroupWorkIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
          <Typography>No fleets yet. Create your first fleet to get started.</Typography>
        </Box>
      )}

      <Stack spacing={0.5}>
        {fleets.map(fleet => {
          const isSelected = selectedFleetId === fleet.id;
          return (
            <Card
              key={fleet.id}
              sx={{
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                transition: theme.transitions.create(['border-color', 'background-color'], {
                  duration: 150,
                }),
              }}
            >
              <CardActionArea onClick={() => onSelectFleet(isSelected ? null : fleet.id)}>
                <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {fleet.emblem && (
                          <Avatar
                            src={sanitizeImageUrl(fleet.emblem) || undefined}
                            variant="rounded"
                            sx={{
                              width: 24,
                              height: 24,
                              bgcolor: 'action.hover',
                              mr: 0.25,
                            }}
                          >
                            <GroupWorkIcon sx={{ fontSize: 14 }} />
                          </Avatar>
                        )}
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, fontSize: '0.82rem' }}
                          noWrap
                        >
                          {fleet.name}
                        </Typography>
                        {fleet.type && fleet.type !== 'mixed' && (
                          <Chip
                            label={FLEET_TYPE_META[fleet.type]?.label ?? fleet.type}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.6rem',
                              bgcolor: alpha(getFleetTypeColor(fleet.type, theme), 0.12),
                              color: getFleetTypeColor(fleet.type, theme),
                              border: `1px solid ${alpha(getFleetTypeColor(fleet.type, theme), 0.3)}`,
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        )}
                        <Tooltip title="Ships">
                          <Chip
                            icon={<RocketLaunchIcon sx={{ fontSize: 12 }} />}
                            label={fleet.shipCount ?? 0}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 18,
                              '& .MuiChip-label': { px: 0.4, fontSize: '0.65rem' },
                              '& .MuiChip-icon': { ml: 0.4 },
                            }}
                          />
                        </Tooltip>
                        <Tooltip title="Members">
                          <Chip
                            icon={<PeopleIcon sx={{ fontSize: 12 }} />}
                            label={fleet.memberCount ?? 0}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 18,
                              '& .MuiChip-label': { px: 0.4, fontSize: '0.65rem' },
                              '& .MuiChip-icon': { ml: 0.4 },
                            }}
                          />
                        </Tooltip>
                        <FleetHealthBadge fleetId={fleet.id} />
                        {/* Inline logistics stats */}
                        {(fleet.totalCargoCapacity ?? 0) > 0 && (
                          <Tooltip
                            title={`Cargo: ${fleet.totalCargoCapacity!.toLocaleString()} SCU`}
                          >
                            <Chip
                              icon={<Inventory2Icon sx={{ fontSize: 11 }} />}
                              label={`${fleet.totalCargoCapacity!.toLocaleString()}`}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: alpha(theme.palette.warning.main, 0.1),
                                color: theme.palette.warning.light,
                                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                                '& .MuiChip-label': { px: 0.3 },
                                '& .MuiChip-icon': { ml: 0.3 },
                              }}
                            />
                          </Tooltip>
                        )}
                        {fleet.avgQuantumFuel != null && (
                          <Tooltip title={`Avg Quantum Fuel: ~${Math.round(fleet.avgQuantumFuel)}`}>
                            <Chip
                              icon={<BoltIcon sx={{ fontSize: 11 }} />}
                              label={`~${Math.round(fleet.avgQuantumFuel)}`}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.6rem',
                                bgcolor: alpha(theme.palette.info.main, 0.1),
                                color: theme.palette.info.light,
                                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                                '& .MuiChip-label': { px: 0.3 },
                                '& .MuiChip-icon': { ml: 0.3 },
                              }}
                            />
                          </Tooltip>
                        )}
                        {/* Icon-only capability indicators */}
                        {fleet.hasRefuelShip && (
                          <Tooltip
                            title={`Refuel: ${fleet.refuelShipNames?.join(', ') ?? 'Unknown'}`}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 18,
                                borderRadius: '4px',
                                bgcolor: alpha(theme.palette.success.main, 0.12),
                                color: theme.palette.success.light,
                                border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
                              }}
                            >
                              <LocalGasStationIcon sx={{ fontSize: 12 }} />
                            </Box>
                          </Tooltip>
                        )}
                        {fleet.hasRearmShip && (
                          <Tooltip
                            title={`Rearm: ${fleet.rearmShipNames?.join(', ') ?? 'Unknown'}`}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 18,
                                borderRadius: '4px',
                                bgcolor: alpha(theme.palette.info.main, 0.12),
                                color: theme.palette.info.light,
                                border: `1px solid ${alpha(theme.palette.info.main, 0.25)}`,
                              }}
                            >
                              <GpsFixedIcon sx={{ fontSize: 12 }} />
                            </Box>
                          </Tooltip>
                        )}
                        {fleet.hasRepairShip && (
                          <Tooltip
                            title={`Repair: ${fleet.repairShipNames?.join(', ') ?? 'Unknown'}`}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 18,
                                borderRadius: '4px',
                                bgcolor: alpha(theme.palette.warning.main, 0.12),
                                color: theme.palette.warning.light,
                                border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                              }}
                            >
                              <BuildIcon sx={{ fontSize: 12 }} />
                            </Box>
                          </Tooltip>
                        )}
                        {fleet.hasMedicalShip && (
                          <Tooltip
                            title={`Medical: ${fleet.medicalShipNames?.join(', ') ?? 'Unknown'}`}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 18,
                                borderRadius: '4px',
                                bgcolor: alpha(theme.palette.error.main, 0.12),
                                color: theme.palette.error.light,
                                border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
                              }}
                            >
                              <LocalHospitalIcon sx={{ fontSize: 12 }} />
                            </Box>
                          </Tooltip>
                        )}
                      </Stack>
                    </Box>
                    {canManageFleets && (
                      <Button
                        size="small"
                        color="error"
                        onClick={e => {
                          e.stopPropagation();
                          openDeleteConfirm(fleet.id);
                        }}
                        sx={{ minWidth: 'auto', p: 0.5 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </Button>
                    )}
                  </Stack>
                  {isSelected && <FleetCardPreview fleetId={fleet.id} />}
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>

      {/* Delete confirm */}
      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Fleet"
        message="Are you sure you want to delete this fleet? Ships will be unassigned but not deleted."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
      />
    </Box>
  );
};
