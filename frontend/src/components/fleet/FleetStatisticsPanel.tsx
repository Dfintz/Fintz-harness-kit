/**
 * FleetStatisticsPanel
 *
 * Visual breakdown of fleet composition and capabilities:
 * - Ship composition by size and role (stacked bars)
 * - Cargo SCU breakdown per ship (horizontal bar chart with colors)
 * - Crew positions open by role
 * - Average quantum fuel / range
 * - Repair / Rearm / Refuel capability indicators
 */

import { useFleetHealth, useFleetShips } from '@/hooks/queries/useFleetQueries';
import type { ShipV2 } from '@/types/apiV2';
import { CREW_ROLE_COLORS, CREW_ROLE_LABELS } from '@/utils/crewRoleHelpers';
import { getRoleColor } from '@/utils/shipColorUtils';
import BoltIcon from '@mui/icons-material/Bolt';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PropaneTankIcon from '@mui/icons-material/PropaneTank';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React, { useMemo } from 'react';

// ============================================================================
// Constants
// ============================================================================

/**
 * Ship size color map — derived from MUI theme palette.
 */
function getShipSizeColors(theme: Theme): Record<string, string> {
  return {
    vehicle: theme.palette.grey[500],
    snub: theme.palette.grey[400],
    small: theme.palette.info.main,
    medium: theme.palette.success.main,
    large: theme.palette.warning.main,
    sub_capital: theme.palette.warning.dark,
    capital: theme.palette.error.main,
  };
}

/** Build role→color map dynamically from the roles present in the fleet data. */
function buildRoleColorMap(roles: string[], theme: Theme): Record<string, string> {
  const map: Record<string, string> = {};
  for (const role of roles) {
    map[role] = getRoleColor(role, theme);
  }
  return map;
}

const REFUEL_SHIPS = ['starfarer', 'starfarer gemini', 'vulcan'];
const REARM_SHIPS = ['vulcan', 'crucible'];
const REPAIR_SHIPS = ['vulcan', 'crucible', 'odyssey'];
const MEDICAL_SHIPS = [
  'apollo medivac',
  'apollo triage',
  'cutlass red',
  'terrapin medic',
  'c8r pisces rescue',
  'ursa medivac',
  'clipper',
];

// ============================================================================
// Helpers
// ============================================================================

function matchesCapability(name: string, capList: string[]): boolean {
  const lower = name.toLowerCase();
  return capList.some(c => lower.includes(c));
}

/** Collect ships matching each capability list */
function collectCapabilities(ships: ShipV2[]) {
  const refuelShips: string[] = [];
  const rearmShips: string[] = [];
  const repairShips: string[] = [];
  const medicalShips: string[] = [];

  for (const ship of ships) {
    const name = ship.name ?? '';
    if (matchesCapability(name, REFUEL_SHIPS)) refuelShips.push(name);
    if (matchesCapability(name, REARM_SHIPS)) rearmShips.push(name);
    if (matchesCapability(name, REPAIR_SHIPS)) repairShips.push(name);
    if (matchesCapability(name, MEDICAL_SHIPS)) medicalShips.push(name);
  }

  return { refuelShips, rearmShips, repairShips, medicalShips };
}

interface FleetStats {
  bySize: Record<string, number>;
  byRole: Record<string, number>;
  byManufacturer: Record<string, number>;
  cargoPerShip: { name: string; scu: number; size: string }[];
  totalCargo: number;
  totalMaxCrew: number;
  crewByRole: Record<string, number>;
  avgQuantumFuel: number | null;
  totalQuantumFuel: number;
  avgHydrogenFuel: number | null;
  hasRefuel: boolean;
  hasRearm: boolean;
  hasRepair: boolean;
  hasMedical: boolean;
  refuelShips: string[];
  rearmShips: string[];
  repairShips: string[];
  medicalShips: string[];
}

function computeStats(ships: ShipV2[]): FleetStats {
  const bySize: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const byManufacturer: Record<string, number> = {};
  const cargoPerShip: { name: string; scu: number; size: string }[] = [];
  let totalCargo = 0;
  let totalMaxCrew = 0;
  let totalQF = 0;
  let qfCount = 0;
  let totalHF = 0;
  let hfCount = 0;

  for (const ship of ships) {
    const size = (ship.size ?? 'unknown').toLowerCase();
    bySize[size] = (bySize[size] ?? 0) + 1;

    const role = (ship.role ?? 'unknown').toLowerCase();
    byRole[role] = (byRole[role] ?? 0) + 1;

    const mfr = ship.manufacturer ?? 'Unknown';
    byManufacturer[mfr] = (byManufacturer[mfr] ?? 0) + 1;

    const scu = ship.cargo ?? 0;
    if (scu > 0) {
      cargoPerShip.push({ name: ship.name ?? 'Unknown', scu, size });
    }
    totalCargo += scu;
    totalMaxCrew += ship.maxCrew ?? ship.crew ?? 1;

    if (ship.quantumFuelCapacity) {
      totalQF += ship.quantumFuelCapacity;
      qfCount++;
    }
    if (ship.hydrogenFuelCapacity) {
      totalHF += ship.hydrogenFuelCapacity;
      hfCount++;
    }
  }

  cargoPerShip.sort((a, b) => b.scu - a.scu);

  const caps = collectCapabilities(ships);

  return {
    bySize,
    byRole,
    byManufacturer,
    cargoPerShip,
    totalCargo,
    totalMaxCrew,
    crewByRole: {},
    avgQuantumFuel: qfCount > 0 ? Math.round(totalQF / qfCount) : null,
    totalQuantumFuel: totalQF,
    avgHydrogenFuel: hfCount > 0 ? Math.round(totalHF / hfCount) : null,
    hasRefuel: caps.refuelShips.length > 0,
    hasRearm: caps.rearmShips.length > 0,
    hasRepair: caps.repairShips.length > 0,
    hasMedical: caps.medicalShips.length > 0,
    refuelShips: caps.refuelShips,
    rearmShips: caps.rearmShips,
    repairShips: caps.repairShips,
    medicalShips: caps.medicalShips,
  };
}

// ============================================================================
// Sub-components
// ============================================================================

/** Horizontal segmented bar showing distribution by category */
const SegmentedBar: React.FC<
  Readonly<{
    data: Record<string, number>;
    colorMap: Record<string, string>;
    total: number;
    label: string;
  }>
> = ({ data, colorMap, total, label }) => {
  const theme = useTheme();
  const sortedKeys = Object.keys(data).sort((a, b) => (data[b] ?? 0) - (data[a] ?? 0));

  if (total === 0) return null;

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      {/* Stacked bar */}
      <Box sx={{ display: 'flex', height: 20, borderRadius: 1, overflow: 'hidden', mb: 0.5 }}>
        {sortedKeys.map(key => {
          const count = data[key] ?? 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          const color = colorMap[key] ?? theme.palette.grey[500];
          return (
            <Box
              key={key}
              sx={{
                width: `${pct}%`,
                bgcolor: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: pct > 8 ? 'auto' : 0,
              }}
            >
              {pct > 12 && (
                <Typography sx={{ fontSize: '0.6rem', color: 'common.white', fontWeight: 600 }}>
                  {count}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
      {/* Legend */}
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
        {sortedKeys.map(key => {
          const count = data[key] ?? 0;
          if (count === 0) return null;
          const color = colorMap[key] ?? theme.palette.grey[500];
          return (
            <Chip
              key={key}
              size="small"
              label={`${key.charAt(0).toUpperCase() + key.slice(1)}: ${count}`}
              sx={{
                height: 18,
                fontSize: '0.62rem',
                bgcolor: alpha(color, 0.12),
                color,
                border: `1px solid ${alpha(color, 0.3)}`,
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
};

/** Horizontal bars showing SCU per ship */
const CargoBreakdown: React.FC<
  Readonly<{ ships: { name: string; scu: number; size: string }[]; maxScu: number }>
> = ({ ships, maxScu }) => {
  const theme = useTheme();
  const sizeColors = getShipSizeColors(theme);
  if (ships.length === 0) return null;

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
        Cargo Capacity by Ship ({ships.length} ships with cargo)
      </Typography>
      <Stack spacing={0.5}>
        {ships.slice(0, 10).map(ship => {
          const pct = maxScu > 0 ? (ship.scu / maxScu) * 100 : 0;
          const color = sizeColors[ship.size] ?? theme.palette.primary.main;
          return (
            <Box key={ship.name}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 500 }}>
                  {ship.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {ship.scu.toLocaleString()} SCU
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  height: 8,
                  borderRadius: 1,
                  bgcolor: alpha(color, 0.1),
                  '& .MuiLinearProgress-bar': { borderRadius: 1, bgcolor: color },
                }}
              />
            </Box>
          );
        })}
        {ships.length > 10 && (
          <Typography variant="caption" color="text.disabled">
            +{ships.length - 10} more ships
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

/** Crew positions summary by role */
const CrewSummary: React.FC<
  Readonly<{
    crewHealth: {
      totalMaxCrew: number;
      totalFilled: number;
      perShip: { shipName: string; maxCrew: number; filled: number }[];
    };
  }>
> = ({ crewHealth }) => {
  const theme = useTheme();
  const open = crewHealth.totalMaxCrew - crewHealth.totalFilled;
  const fillPct =
    crewHealth.totalMaxCrew > 0 ? (crewHealth.totalFilled / crewHealth.totalMaxCrew) * 100 : 0;

  // Build crew needs per role (estimated based on common ship compositions)
  const roleDistribution = useMemo(() => {
    const totalCrew = crewHealth.totalMaxCrew;
    if (totalCrew === 0) return {};
    return {
      pilot: Math.max(1, crewHealth.perShip.length),
      gunner: Math.round(totalCrew * 0.25),
      engineer: Math.round(totalCrew * 0.2),
      medic: Math.max(1, Math.round(totalCrew * 0.08)),
      navigator: Math.max(1, Math.round(totalCrew * 0.08)),
      cargo: Math.round(totalCrew * 0.1),
      crew: Math.max(0, totalCrew - Math.round(totalCrew * 0.71) - crewHealth.perShip.length),
    };
  }, [crewHealth]);

  let fillColor = 'error.main';
  if (fillPct >= 80) fillColor = 'success.main';
  else if (fillPct >= 50) fillColor = 'warning.main';

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
        Crew Positions — {crewHealth.totalFilled}/{crewHealth.totalMaxCrew} filled ({open} open)
      </Typography>
      <LinearProgress
        variant="determinate"
        value={fillPct}
        sx={{
          height: 6,
          borderRadius: 3,
          mb: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            bgcolor: fillColor,
          },
        }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.75, fontSize: '0.65rem' }}
      >
        Estimated positions needed by role:
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
        {Object.entries(roleDistribution).map(([role, count]) => {
          if (count === 0) return null;
          const color = CREW_ROLE_COLORS[role] ?? theme.palette.grey[500];
          const label = CREW_ROLE_LABELS[role] ?? role;
          return (
            <Chip
              key={role}
              size="small"
              label={`${label}: ${count}`}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: alpha(color, 0.12),
                color,
                border: `1px solid ${alpha(color, 0.3)}`,
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
};

/** Capability indicators for refuel/rearm/repair */
const CapabilityIndicators: React.FC<
  Readonly<{
    hasRefuel: boolean;
    hasRearm: boolean;
    hasRepair: boolean;
    hasMedical: boolean;
    refuelShips: string[];
    rearmShips: string[];
    repairShips: string[];
    medicalShips: string[];
  }>
> = ({
  hasRefuel,
  hasRearm,
  hasRepair,
  hasMedical,
  refuelShips,
  rearmShips,
  repairShips,
  medicalShips,
}) => {
  const theme = useTheme();

  const capabilities = [
    {
      label: 'Refuel',
      icon: <LocalGasStationIcon sx={{ fontSize: '1.3rem' }} />,
      has: hasRefuel,
      ships: refuelShips,
      color: theme.palette.success.main,
    },
    {
      label: 'Rearm',
      icon: <GpsFixedIcon sx={{ fontSize: '1.3rem' }} />,
      has: hasRearm,
      ships: rearmShips,
      color: theme.palette.info.main,
    },
    {
      label: 'Repair',
      icon: <BuildIcon sx={{ fontSize: '1.3rem' }} />,
      has: hasRepair,
      ships: repairShips,
      color: theme.palette.warning.main,
    },
    {
      label: 'Medical',
      icon: <LocalHospitalIcon sx={{ fontSize: '1.3rem' }} />,
      has: hasMedical,
      ships: medicalShips,
      color: theme.palette.error.main,
    },
  ];

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
        Fleet Support Capabilities
      </Typography>
      <Stack direction="row" spacing={1}>
        {capabilities.map(cap => (
          <Paper
            key={cap.label}
            variant="outlined"
            sx={{
              flex: 1,
              p: 1,
              textAlign: 'center',
              borderColor: cap.has ? alpha(cap.color, 0.5) : 'divider',
              bgcolor: cap.has ? alpha(cap.color, 0.04) : 'transparent',
              opacity: cap.has ? 1 : 0.5,
            }}
          >
            <Box sx={{ mb: 0.25, color: cap.has ? cap.color : 'text.disabled' }}>{cap.icon}</Box>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
              {cap.label}
            </Typography>
            {cap.has ? (
              <Stack direction="row" spacing={0.25} justifyContent="center" alignItems="center">
                <CheckCircleIcon sx={{ fontSize: 12, color: cap.color }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {cap.ships.join(', ')}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
                Not available
              </Typography>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface FleetStatisticsPanelProps {
  fleetId: string;
}

export const FleetStatisticsPanel: React.FC<Readonly<FleetStatisticsPanelProps>> = ({
  fleetId,
}) => {
  const theme = useTheme();
  const sizeColors = useMemo(() => getShipSizeColors(theme), [theme]);
  const { data: shipsData, isLoading: shipsLoading } = useFleetShips(fleetId);
  const { data: healthData } = useFleetHealth(fleetId);

  const ships = useMemo(() => shipsData?.items ?? [], [shipsData?.items]);

  const stats = useMemo(() => computeStats(ships as ShipV2[]), [ships]);
  const roleColors = useMemo(
    () => buildRoleColorMap(Object.keys(stats.byRole), theme),
    [stats.byRole, theme]
  );

  if (shipsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (ships.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <BuildIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
        <Typography color="text.secondary">Add ships to see fleet statistics</Typography>
      </Box>
    );
  }

  const maxShipCargo = stats.cargoPerShip.length > 0 ? stats.cargoPerShip[0].scu : 0;

  return (
    <Stack spacing={2}>
      {/* ── Summary Stats ──────────────────────────────────── */}
      <Paper
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Fleet Overview
        </Typography>

        {/* Quick stats row */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
          <Chip
            icon={<RocketLaunchIcon sx={{ fontSize: 14 }} />}
            size="small"
            label={`${ships.length} ships`}
            sx={{ height: 24, fontWeight: 600 }}
          />
          <Chip
            icon={<Inventory2Icon sx={{ fontSize: 14 }} />}
            size="small"
            label={`${stats.totalCargo.toLocaleString()} SCU`}
            sx={{
              height: 24,
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              color: theme.palette.warning.main,
            }}
          />
          <Chip
            icon={<GroupsIcon sx={{ fontSize: 14 }} />}
            size="small"
            label={`${stats.totalMaxCrew} crew max`}
            sx={{
              height: 24,
              bgcolor: alpha(theme.palette.info.main, 0.1),
              color: theme.palette.info.main,
            }}
          />
          {stats.avgQuantumFuel != null && (
            <Chip
              icon={<BoltIcon sx={{ fontSize: 14 }} />}
              size="small"
              label={`~${stats.avgQuantumFuel} QF avg`}
              sx={{
                height: 24,
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.main,
              }}
            />
          )}
          {stats.avgHydrogenFuel != null && (
            <Chip
              icon={<PropaneTankIcon sx={{ fontSize: 14 }} />}
              size="small"
              label={`~${stats.avgHydrogenFuel} H₂ avg`}
              sx={{
                height: 24,
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                color: theme.palette.secondary.main,
              }}
            />
          )}
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* Ship Composition by Size */}
        <SegmentedBar
          data={stats.bySize}
          colorMap={sizeColors}
          total={ships.length}
          label={`Ship Composition by Size (${ships.length} total)`}
        />

        <Divider sx={{ my: 1.5 }} />

        {/* Ship Composition by Role */}
        <SegmentedBar
          data={stats.byRole}
          colorMap={roleColors}
          total={ships.length}
          label="Ship Composition by Role"
        />

        {Object.keys(stats.byManufacturer).length > 1 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            {/* Manufacturer distribution */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                By Manufacturer
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
                {Object.entries(stats.byManufacturer)
                  .sort(([, a], [, b]) => b - a)
                  .map(([mfr, count]) => (
                    <Chip
                      key={mfr}
                      size="small"
                      label={`${mfr}: ${count}`}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  ))}
              </Stack>
            </Box>
          </>
        )}
      </Paper>

      {/* ── Cargo Breakdown ────────────────────────────────── */}
      {stats.cargoPerShip.length > 0 && (
        <Paper
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Inventory2Icon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Cargo Capacity
              </Typography>
            </Stack>
            <Chip
              size="small"
              label={`${stats.totalCargo.toLocaleString()} SCU total`}
              sx={{
                height: 20,
                fontSize: '0.7rem',
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                color: theme.palette.warning.main,
              }}
            />
          </Stack>
          <CargoBreakdown ships={stats.cargoPerShip} maxScu={maxShipCargo} />
        </Paper>
      )}

      {/* ── Crew Positions ─────────────────────────────────── */}
      {healthData?.crewHealth && (
        <Paper
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
            <GroupsIcon sx={{ fontSize: 18, color: 'info.main' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Crew Positions
            </Typography>
          </Stack>
          <CrewSummary crewHealth={healthData.crewHealth} />
        </Paper>
      )}

      {/* ── Fuel & Range ───────────────────────────────────── */}
      {(stats.avgQuantumFuel != null || stats.avgHydrogenFuel != null) && (
        <Paper
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
            <BoltIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Fuel & Range
            </Typography>
          </Stack>
          <Stack spacing={1}>
            {stats.avgQuantumFuel != null && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Avg Quantum Fuel Capacity</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {stats.avgQuantumFuel.toLocaleString()}
                </Typography>
              </Stack>
            )}
            {stats.totalQuantumFuel > 0 && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Total QF across fleet</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {stats.totalQuantumFuel.toLocaleString()}
                </Typography>
              </Stack>
            )}
            {stats.avgHydrogenFuel != null && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Avg Hydrogen Fuel Capacity</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {stats.avgHydrogenFuel.toLocaleString()}
                </Typography>
              </Stack>
            )}
            {!stats.hasRefuel && (
              <Alert severity="warning" sx={{ py: 0, borderRadius: 1 }}>
                <Typography variant="caption">
                  No refueling ship — fleet range limited by lowest-fuel ship. Consider adding a
                  Starfarer or Vulcan.
                </Typography>
              </Alert>
            )}
          </Stack>
        </Paper>
      )}

      {/* ── Support Capabilities ───────────────────────────── */}
      <Paper
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <CapabilityIndicators
          hasRefuel={stats.hasRefuel}
          hasRearm={stats.hasRearm}
          hasRepair={stats.hasRepair}
          hasMedical={stats.hasMedical}
          refuelShips={stats.refuelShips}
          rearmShips={stats.rearmShips}
          repairShips={stats.repairShips}
          medicalShips={stats.medicalShips}
        />
      </Paper>
    </Stack>
  );
};
