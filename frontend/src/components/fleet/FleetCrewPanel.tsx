/**
 * FleetCrewPanel
 *
 * Merged Crew & Squadrons tab content.  Shows per-ship crew positions
 * with lean/conservative gate indicators, crew member lists, and
 * self-selection — all in one unified bar per ship.
 */

import {
  useFleetCrewPositions,
  useFleetHealth,
  useFleetShips,
  useSelectCrewPosition,
  useUnselectCrewPosition,
} from '@/hooks/queries/useFleetQueries';
import type { CrewPositionMember, CrewPositionShip } from '@/services/fleetServiceV2';
import { selectUser, useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import type { ShipCrewGate } from '@/types/apiV2';
import {
  CREW_ROLE_OPTIONS,
  getRoleBgColor,
  getRoleColor,
  getRoleLabel,
} from '@/utils/crewRoleHelpers';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import GroupsIcon from '@mui/icons-material/Groups';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';

import { FleetCrewMembersPanel } from './FleetCrewMembersPanel';

// ============================================================================
// Types
// ============================================================================

interface FleetCrewPanelProps {
  fleetId: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Resolve gate status to a single color key */
function getGateColor(
  passesConservative: boolean,
  passesLean: boolean
): 'success' | 'warning' | 'error' {
  if (passesConservative) return 'success';
  if (passesLean) return 'warning';
  return 'error';
}

/** Resolve fill-rate percentage to a bar color key */
function getFillBarColor(pct: number): string {
  if (pct >= 100) return 'success.main';
  if (pct >= 50) return 'warning.main';
  return 'error.main';
}

/** Resolve select button label based on mutation state and policy */
function getSelectButtonLabel(isPending: boolean, joinPolicy: string): string {
  if (isPending) return 'Selecting...';
  return joinPolicy === 'closed' ? 'Request Position' : 'Confirm Selection';
}

/** Merged data: gate health + crew position info for a single ship */
interface MergedShipCrew {
  shipId: string;
  shipName: string;
  maxCrew: number;
  filled: number;
  leanRequired: number;
  conservativeRequired: number;
  passesLean: boolean;
  passesConservative: boolean;
  crew: CrewPositionMember[];
}

// ============================================================================
// Sub-components
// ============================================================================

const GateIndicator: React.FC<Readonly<{ passed: boolean; label: string }>> = ({
  passed,
  label,
}) => {
  const theme = useTheme();
  return (
    <Chip
      size="small"
      icon={passed ? <CheckCircleIcon /> : <WarningIcon />}
      label={label}
      sx={{
        bgcolor: alpha(passed ? theme.palette.success.main : theme.palette.warning.main, 0.12),
        color: passed ? 'success.main' : 'warning.main',
        fontWeight: 500,
        fontSize: '0.75rem',
      }}
    />
  );
};

/** Unified ship crew bar: gates + crew list + select/your position */
const UnifiedShipCrewRow: React.FC<
  Readonly<{
    ship: MergedShipCrew;
    currentUserId: string | undefined;
    onSelect: (shipId: string) => void;
  }>
> = ({ ship, currentUserId, onSelect }) => {
  const theme = useTheme();
  const fillPct = ship.maxCrew > 0 ? (ship.filled / ship.maxCrew) * 100 : 0;
  const isFull = ship.filled >= ship.maxCrew;
  const userOnShip = currentUserId ? ship.crew.find(c => c.userId === currentUserId) : undefined;

  const gateStatus = getGateColor(ship.passesConservative, ship.passesLean);
  const borderColor = userOnShip
    ? alpha(theme.palette.success.main, 0.5)
    : alpha(theme.palette[gateStatus].main, 0.3);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor,
        bgcolor: userOnShip ? alpha(theme.palette.success.main, 0.04) : 'background.paper',
      }}
    >
      {/* Header: ship name + crew count */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {ship.shipName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {ship.filled}/{ship.maxCrew} crew
        </Typography>
      </Stack>

      {/* Fill bar */}
      <LinearProgress
        variant="determinate"
        value={Math.min(fillPct, 100)}
        sx={{
          height: 5,
          borderRadius: 2,
          mb: 0.5,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          '& .MuiLinearProgress-bar': {
            borderRadius: 2,
            bgcolor: `${gateStatus}.main`,
          },
        }}
      />

      {/* Gate indicators */}
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
        <GateIndicator passed={ship.passesLean} label={`Lean ≥${ship.leanRequired}`} />
        <GateIndicator
          passed={ship.passesConservative}
          label={`Cons. ≥${ship.conservativeRequired}`}
        />
      </Stack>

      {/* Crew member list */}
      {ship.crew.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {ship.crew.map((member, index) => (
            <Stack
              key={member.userId}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ pl: 0.5 }}
            >
              <Typography
                variant="caption"
                sx={{
                  width: 18,
                  textAlign: 'right',
                  color: 'text.disabled',
                  fontWeight: 500,
                  fontSize: '0.65rem',
                }}
              >
                {index + 1}.
              </Typography>
              <Avatar
                src={sanitizeImageUrl(member.avatar) || undefined}
                sx={{ width: 20, height: 20, fontSize: '0.7rem' }}
              >
                {member.username.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="caption" sx={{ flex: 1 }}>
                {member.username}
                {member.userId === currentUserId && ' (you)'}
              </Typography>
              <Chip
                size="small"
                label={getRoleLabel(member.role)}
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: getRoleBgColor(member.role),
                  color: getRoleColor(member.role),
                }}
              />
            </Stack>
          ))}
        </Stack>
      )}

      {/* Action: Select / Your Position */}
      {currentUserId && (
        <Box sx={{ mt: 1 }}>
          {userOnShip ? (
            <Chip
              size="small"
              icon={<CheckCircleIcon />}
              label="Your Position"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => onSelect(ship.shipId)}
              disabled={isFull}
              sx={{ fontSize: '0.75rem', py: 0.25 }}
            >
              {isFull ? 'Full' : 'Select This Ship'}
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
};

// ============================================================================
// Hooks
// ============================================================================

/** Encapsulates crew position selection state & handlers */
function useCrewPositionActions(fleetId: string) {
  const selectMutation = useSelectCrewPosition();
  const unselectMutation = useUnselectCrewPosition();
  const [selectDialogShipId, setSelectDialogShipId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('crew');
  const notification = useNotification();

  const openSelect = (shipId: string) => {
    setSelectDialogShipId(shipId);
    setSelectedRole('crew');
  };

  const confirmSelect = async () => {
    if (!selectDialogShipId) return;
    try {
      const result = await selectMutation.mutateAsync({
        fleetId,
        shipId: selectDialogShipId,
        role: selectedRole,
      });
      setSelectDialogShipId(null);
      notification.success(
        result.pending
          ? 'Position request submitted — awaiting approval'
          : 'Crew position selected!'
      );
    } catch (err) {
      logger.error(
        'Failed to select crew position',
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error(err instanceof Error ? err.message : 'Failed to select position');
    }
  };

  const vacate = async () => {
    try {
      await unselectMutation.mutateAsync(fleetId);
      notification.success('Crew position vacated');
    } catch (err) {
      logger.error(
        'Failed to vacate crew position',
        err instanceof Error ? err : new Error(String(err))
      );
      notification.error(err instanceof Error ? err.message : 'Failed to vacate position');
    }
  };

  const closeDialog = () => setSelectDialogShipId(null);

  return {
    selectDialogShipId,
    selectedRole,
    setSelectedRole,
    selectMutation,
    unselectMutation,
    openSelect,
    confirmSelect,
    vacate,
    closeDialog,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export const FleetCrewPanel: React.FC<Readonly<FleetCrewPanelProps>> = ({ fleetId }) => {
  const theme = useTheme();
  const { data: healthData, isLoading: healthLoading } = useFleetHealth(fleetId);
  const { data: shipsData } = useFleetShips(fleetId);
  const { data: positionsData } = useFleetCrewPositions(fleetId);
  const [showStandby, setShowStandby] = useState(false);
  const [crewSubTab, setCrewSubTab] = useState<'positions' | 'members'>('positions');
  const user = useAuthStore(selectUser);

  const actions = useCrewPositionActions(fleetId);

  const crewHealth = healthData?.crewHealth;
  const ships = shipsData?.items ?? [];
  const positionShips = positionsData?.ships;
  const joinPolicy = positionsData?.joinPolicy ?? 'closed';

  // Merge gate data with position data by shipId
  const mergedShips: MergedShipCrew[] = useMemo(() => {
    if (!crewHealth) return [];
    const positionMap = new Map<string, CrewPositionShip>();
    if (positionShips) {
      for (const ps of positionShips) {
        positionMap.set(ps.shipId, ps);
      }
    }
    return crewHealth.perShip.map((gate: ShipCrewGate) => {
      const pos = positionMap.get(gate.shipId);
      return {
        shipId: gate.shipId,
        shipName: gate.shipName,
        maxCrew: gate.maxCrew,
        filled: gate.filled,
        leanRequired: gate.leanRequired,
        conservativeRequired: gate.conservativeRequired,
        passesLean: gate.passesLean,
        passesConservative: gate.passesConservative,
        crew: pos?.crew ?? [],
      };
    });
  }, [crewHealth, positionShips]);

  // Find current user's assignment
  const currentAssignment = useMemo(() => {
    if (!positionShips || !user?.id) return null;
    for (const ship of positionShips) {
      const member = ship.crew.find(c => c.userId === user.id);
      if (member) return { shipId: ship.shipId, shipName: ship.shipName, role: member.role };
    }
    return null;
  }, [positionShips, user?.id]);

  const selectedShip = positionShips?.find(s => s.shipId === actions.selectDialogShipId);

  if (healthLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!crewHealth || ships.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <GroupsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
        <Typography color="text.secondary">Crew assignments for this fleet&apos;s ships</Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
          {ships.length === 0
            ? 'Add ships to see crew positions and gate status'
            : 'Health data unavailable'}
        </Typography>
      </Box>
    );
  }

  const overallFillPct = crewHealth.crewFillRate;

  return (
    <Stack spacing={2}>
      {/* ── Overall Summary ──────────────────────────────────── */}
      <Paper
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ShieldIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Crew Manifest
            </Typography>
          </Stack>
          <Chip
            icon={crewHealth.overallGatePassed ? <CheckCircleIcon /> : <ErrorIcon />}
            label={
              crewHealth.overallGatePassed
                ? `${crewHealth.crewMode.toUpperCase()} GATE PASSED`
                : `${crewHealth.crewMode.toUpperCase()} GATE FAILED`
            }
            size="small"
            sx={{
              fontWeight: 700,
              bgcolor: alpha(
                crewHealth.overallGatePassed
                  ? theme.palette.success.main
                  : theme.palette.error.main,
                0.12
              ),
              color: crewHealth.overallGatePassed ? 'success.main' : 'error.main',
            }}
          />
        </Stack>

        {/* Fill rate bar */}
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="body2">
            {crewHealth.totalFilled}/{crewHealth.totalRequired} positions filled
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Math.round(overallFillPct)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={overallFillPct}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              bgcolor: getFillBarColor(overallFillPct),
            },
          }}
        />

        {/* Crew stats chips */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={`Max crew: ${crewHealth.totalMaxCrew}`}
            sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main' }}
          />
          <Chip
            size="small"
            label={`Mode: ${crewHealth.crewMode}`}
            sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main' }}
          />
          <Chip
            size="small"
            label={`Standby: ${crewHealth.standbyFilled}/${crewHealth.standbySlots}`}
            onClick={() => setShowStandby(!showStandby)}
            sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              color: 'warning.main',
              cursor: 'pointer',
            }}
          />
        </Stack>
      </Paper>

      {/* ── Standby Pool (Collapsible) ──────────────────────── */}
      <Collapse in={showStandby}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Standby Pool — {crewHealth.standbySlots} slots (30% reserve)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {crewHealth.standbyFilled} members available as replacements. Standby crew can be
            deployed when positions open due to leave, unavailability, or ship reassignment.
          </Typography>
        </Alert>
      </Collapse>

      {/* ── Sub-tabs: Positions vs Members ─────────────────── */}
      <Tabs
        value={crewSubTab}
        onChange={(_, v) => setCrewSubTab(v)}
        sx={{
          minHeight: 32,
          '& .MuiTab-root': { minHeight: 32, py: 0.25, fontSize: '0.8rem' },
        }}
      >
        <Tab label="Positions" value="positions" />
        <Tab label="Members" value="members" />
      </Tabs>

      <Divider />

      {crewSubTab === 'positions' && (
        <>
          {/* ── Join policy & current assignment ────────────────── */}
          {user?.id && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                {joinPolicy === 'open' ? (
                  <Chip
                    size="small"
                    icon={<LockOpenIcon />}
                    label="Open Team — join directly"
                    color="success"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                ) : (
                  <Chip
                    size="small"
                    icon={<LockIcon />}
                    label="Closed Team — requires approval"
                    color="warning"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
              </Stack>

              {currentAssignment && (
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.success.main, 0.06),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.success.main, 0.3),
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      <Typography variant="body2">
                        You are assigned to <strong>{currentAssignment.shipName}</strong> as{' '}
                        <Chip
                          size="small"
                          label={getRoleLabel(currentAssignment.role)}
                          sx={{
                            height: 18,
                            fontSize: '0.7rem',
                            bgcolor: getRoleBgColor(currentAssignment.role),
                            color: getRoleColor(currentAssignment.role),
                          }}
                        />
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      startIcon={<ExitToAppIcon />}
                      onClick={actions.vacate}
                      disabled={actions.unselectMutation.isPending}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {actions.unselectMutation.isPending ? 'Leaving...' : 'Leave Position'}
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}

          {/* ── Unified Per-Ship Crew Breakdown ─────────────────── */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ pl: 0.5 }}>
            Ship Crew Positions ({mergedShips.length} ships)
          </Typography>

          <Stack spacing={1}>
            {mergedShips.map(ship => (
              <UnifiedShipCrewRow
                key={ship.shipId}
                ship={ship}
                currentUserId={user?.id}
                onSelect={actions.openSelect}
              />
            ))}
          </Stack>
        </>
      )}

      {crewSubTab === 'members' && <FleetCrewMembersPanel fleetId={fleetId} />}

      {/* ── Role selection dialog ──────────────────────────── */}
      <Dialog
        open={!!actions.selectDialogShipId}
        onClose={actions.closeDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Select Crew Position</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose your crew role on <strong>{selectedShip?.shipName}</strong>
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Crew Role</InputLabel>
            <Select
              value={actions.selectedRole}
              label="Crew Role"
              onChange={(e: SelectChangeEvent) => actions.setSelectedRole(e.target.value)}
            >
              {CREW_ROLE_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: getRoleColor(opt.value),
                      }}
                    />
                    <span>{opt.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={actions.closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={actions.confirmSelect}
            disabled={actions.selectMutation.isPending}
            startIcon={joinPolicy === 'closed' ? <HourglassEmptyIcon /> : undefined}
          >
            {getSelectButtonLabel(actions.selectMutation.isPending, joinPolicy)}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
