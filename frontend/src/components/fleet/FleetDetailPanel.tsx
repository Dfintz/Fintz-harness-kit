/**
 * FleetDetailPanel
 *
 * Shows the selected fleet's ships with add/remove actions.
 * Uses useFleet, useFleetShips for data, and fleet member mutations
 * for ship assignment operations.
 */

import { FleetAuditLogPanel } from '@/components/fleet/FleetAuditLogPanel';
import { FleetCrewPanel } from '@/components/fleet/FleetCrewPanel';
import { FleetMaintenancePanel } from '@/components/fleet/FleetMaintenancePanel';
import { FleetStatisticsPanel } from '@/components/fleet/FleetStatisticsPanel';
import { ShipPickerDialog } from '@/components/shared/ShipPickerDialog';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FLEET_TYPE_META, getFleetTypeColor } from '@/constants/fleetTypes';
import {
  useBulkAddShipsToFleet,
  useRemoveShipFromFleet,
} from '@/hooks/queries/useFleetMemberQueries';
import { useFleet, useFleetHealth, useFleetShips } from '@/hooks/queries/useFleetQueries';
import { logger } from '@/utils/logger';
import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ============================================================================
// Helpers
// ============================================================================

/** Check whether an error represents a 404 Not Found response. */
function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('statusCode' in error && (error as { statusCode?: unknown }).statusCode === 404) return true;
  if ('status' in error && (error as { status?: unknown }).status === 404) return true;
  return false;
}

// ============================================================================
// Types
// ============================================================================

interface FleetDetailPanelProps {
  fleetId: string;
  /** Called when the fleet no longer exists on the server (404). */
  onFleetNotFound?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const FleetDetailPanel: React.FC<Readonly<FleetDetailPanelProps>> = ({
  fleetId,
  onFleetNotFound,
}) => {
  const theme = useTheme();
  const [showShipPicker, setShowShipPicker] = useState(false);
  const [detailTab, setDetailTab] = useState<
    'ships' | 'health' | 'crew' | 'maintenance' | 'statistics' | 'audit'
  >('ships');

  // Queries
  const { data: fleet, isLoading: fleetLoading, error: fleetError } = useFleet(fleetId);
  const { data: shipsData, isLoading: shipsLoading, error: shipsError } = useFleetShips(fleetId);
  const { data: healthData } = useFleetHealth(fleetId);

  // Auto-deselect when the fleet no longer exists on the server (404).
  useEffect(() => {
    if (fleetError && isNotFoundError(fleetError) && onFleetNotFound) {
      onFleetNotFound();
    }
  }, [fleetError, onFleetNotFound]);

  // Mutations
  const bulkAdd = useBulkAddShipsToFleet();
  const removeShip = useRemoveShipFromFleet();
  const {
    openDialog: openRemoveConfirm,
    closeDialog: closeRemoveConfirm,
    pendingData: pendingRemoveShipId,
    dialogProps: removeDialogProps,
  } = useConfirmDialog<string>();

  const ships = shipsData?.items ?? [];

  // Ship IDs already in this fleet — exclude from picker
  const existingShipIds = useMemo(() => ships.map(s => s.id), [ships]);

  const handleAddShips = useCallback(
    async (shipIds: string[]) => {
      if (shipIds.length === 0) return;
      try {
        await bulkAdd.mutateAsync({ fleetId, shipIds });
      } catch (err: unknown) {
        logger.error(
          'Failed to add ships to fleet',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [fleetId, bulkAdd]
  );

  const handleRemoveShip = useCallback(async () => {
    const shipId = pendingRemoveShipId;
    closeRemoveConfirm();
    if (!shipId) return;
    try {
      await removeShip.mutateAsync({ fleetId, shipId });
    } catch (err: unknown) {
      logger.error(
        'Failed to remove ship from fleet',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [fleetId, pendingRemoveShipId, closeRemoveConfirm, removeShip]);

  // Only block on fleet metadata loading — ships load independently below
  if (fleetLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (fleetError) {
    return (
      <Alert severity="error">
        {fleetError instanceof Error ? fleetError.message : 'Failed to load fleet details'}
      </Alert>
    );
  }

  if (!fleet) {
    return <Alert severity="warning">Fleet not found.</Alert>;
  }

  return (
    <Box>
      {/* Fleet Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {fleet.name}
            </Typography>
            {fleet.type && (
              <Chip
                icon={FLEET_TYPE_META[fleet.type]?.icon as React.ReactElement}
                label={FLEET_TYPE_META[fleet.type]?.label ?? fleet.type}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  bgcolor: alpha(getFleetTypeColor(fleet.type, theme), 0.12),
                  color: getFleetTypeColor(fleet.type, theme),
                  border: `1px solid ${alpha(getFleetTypeColor(fleet.type, theme), 0.3)}`,
                }}
              />
            )}
            {healthData && (
              <Chip
                icon={
                  <FavoriteIcon
                    sx={{
                      fontSize: 14,
                      color: `${
                        healthData.status === 'green'
                          ? theme.palette.success.main
                          : healthData.status === 'yellow'
                            ? theme.palette.warning.main
                            : theme.palette.error.main
                      } !important`,
                    }}
                  />
                }
                label={`${healthData.healthScore}%`}
                size="small"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {ships.length} ship{ships.length === 1 ? '' : 's'} assigned
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setShowShipPicker(true)}
        >
          Add Ships
        </Button>
      </Stack>

      {/* Sub-tabs for fleet-scoped views */}
      <Tabs
        value={detailTab}
        onChange={(_, v) => setDetailTab(v)}
        sx={{
          mb: 2,
          minHeight: 36,
          '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' },
        }}
      >
        <Tab
          label={`Ships (${ships.length})`}
          value="ships"
          icon={<RocketLaunchIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="Health"
          value="health"
          icon={<FavoriteIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="Crew"
          value="crew"
          icon={<GroupsIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="Maintenance"
          value="maintenance"
          icon={<BuildIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="Statistics"
          value="statistics"
          icon={<BarChartIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          label="Audit Log"
          value="audit"
          icon={<HistoryIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
      </Tabs>

      <Divider sx={{ mb: 2 }} />

      {/* Ships Tab */}
      {detailTab === 'ships' && (
        <>
          {/* Ships Table */}
          {shipsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : shipsError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {shipsError instanceof Error ? shipsError.message : 'Failed to load fleet ships'}
            </Alert>
          ) : ships.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <RocketLaunchIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>No ships in this fleet yet.</Typography>
              <Typography variant="body2">
                Click &quot;Add Ships&quot; to assign ships from your organization.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ship</TableCell>
                    <TableCell>Manufacturer</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ships.map(ship => (
                    <TableRow key={ship.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {ship.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {ship.manufacturer || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {ship.role ? (
                          <Chip
                            label={ship.role}
                            size="small"
                            sx={{
                              textTransform: 'capitalize',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: 'primary.main',
                            }}
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {ship.size || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {ship.status || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="No Erkul loadout linked">
                            <span>
                              <IconButton size="small" disabled>
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Remove from fleet">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => openRemoveConfirm(ship.id)}
                              disabled={removeShip.isPending}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Health Tab */}
      {detailTab === 'health' && (
        <Box>
          {healthData ? (
            <Stack spacing={2}>
              <Paper
                sx={{
                  p: 2.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Fleet Health Score
                  </Typography>
                  <Chip
                    label={`${healthData.healthScore}%`}
                    sx={{
                      fontWeight: 700,
                      bgcolor: alpha(
                        healthData.status === 'green'
                          ? theme.palette.success.main
                          : healthData.status === 'yellow'
                            ? theme.palette.warning.main
                            : theme.palette.error.main,
                        0.12
                      ),
                      color:
                        healthData.status === 'green'
                          ? 'success.main'
                          : healthData.status === 'yellow'
                            ? 'warning.main'
                            : 'error.main',
                    }}
                  />
                </Stack>
                <Stack spacing={1.5}>
                  {[
                    {
                      label: 'Readiness',
                      value: healthData.breakdown?.readinessScore ?? 0,
                      weight: '35%',
                    },
                    {
                      label: 'Crew Fill Rate',
                      value:
                        healthData.breakdown?.crewFillRate ??
                        healthData.breakdown?.memberFillRate ??
                        0,
                      weight: '25%',
                    },
                    {
                      label: 'Capability Score',
                      value: healthData.breakdown?.capabilityScore ?? 0,
                      weight: '20%',
                    },
                    {
                      label: 'Operational',
                      value: healthData.breakdown?.operationalScore ?? 0,
                      weight: '20%',
                    },
                  ].map(metric => (
                    <Box key={metric.label}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2">{metric.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(metric.value)}% (weight: {metric.weight})
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={metric.value}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor:
                              metric.value >= 70
                                ? 'success.main'
                                : metric.value >= 40
                                  ? 'warning.main'
                                  : 'error.main',
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Paper>
              <Typography variant="body2" color="text.secondary">
                {ships.length} ships assigned · Health recalculated on each request
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Health data unavailable — assign ships first
            </Typography>
          )}
        </Box>
      )}

      {/* Crew Tab — merged with squadrons: shows per-ship crew breakdown */}
      {detailTab === 'crew' && <FleetCrewPanel fleetId={fleetId} />}

      {/* Maintenance Tab */}
      {detailTab === 'maintenance' && <FleetMaintenancePanel fleetId={fleetId} />}

      {/* Statistics Tab */}
      {detailTab === 'statistics' && <FleetStatisticsPanel fleetId={fleetId} />}

      {/* Audit Log Tab */}
      {detailTab === 'audit' && <FleetAuditLogPanel fleetId={fleetId} />}

      {/* Ship Picker Dialog */}
      <ShipPickerDialog
        open={showShipPicker}
        onClose={() => setShowShipPicker(false)}
        onSelect={handleAddShips}
        excludeShipIds={existingShipIds}
        title={`Add Ships to ${fleet.name}`}
        loading={bulkAdd.isPending}
      />

      {/* Remove confirmation */}
      <ConfirmDialog
        {...removeDialogProps}
        title="Remove Ship"
        message="Remove this ship from the fleet? The ship itself will not be deleted."
        confirmLabel="Remove"
        confirmColor="error"
        onConfirm={handleRemoveShip}
      />
    </Box>
  );
};
