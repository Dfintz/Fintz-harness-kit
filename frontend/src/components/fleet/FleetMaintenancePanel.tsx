/**
 * FleetMaintenancePanel
 *
 * Shows per-ship health & readiness status for a fleet:
 * - Hull HP, shield HP, flight-ready status per ship
 * - For large/capital ships: supply capacity breakdown (ammo, fuel, repair material)
 * - Fleet-wide supply summary feeding into readiness
 */

import { useFleetHealth } from '@/hooks/queries/useFleetQueries';
import type { FleetMaintenanceHealth, ShipMaintenanceStatus } from '@/types/apiV2';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import SecurityIcon from '@mui/icons-material/Security';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningIcon from '@mui/icons-material/Warning';
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
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// Sub-components
// ============================================================================

/** Status chip for flight readiness */
const ReadinessChip: React.FC<Readonly<{ isFlightReady: boolean; status: string }>> = ({
  isFlightReady,
  status,
}) => {
  if (isFlightReady) {
    return (
      <Chip
        size="small"
        icon={<CheckCircleIcon />}
        label="Flight Ready"
        color="success"
        variant="outlined"
        sx={{ fontSize: '0.7rem', height: 22 }}
      />
    );
  }

  const label = status.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <Chip
      size="small"
      icon={<WarningIcon />}
      label={label}
      color="warning"
      variant="outlined"
      sx={{ fontSize: '0.7rem', height: 22 }}
    />
  );
};

/** Supply bar showing SCU allocation for a resource type */
const SupplyBar: React.FC<
  Readonly<{
    label: string;
    icon: ReactNode;
    scu: number;
    totalScu: number;
    color: string;
  }>
> = ({ label, icon, scu, totalScu, color }) => {
  const pct = totalScu > 0 ? (scu / totalScu) * 100 : 0;
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ width: 20, textAlign: 'center', display: 'flex', justifyContent: 'center', color: 'text.secondary' }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.65rem' }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {scu} SCU
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 4,
            borderRadius: 2,
            bgcolor: alpha(color, 0.1),
            '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: color },
          }}
        />
      </Box>
    </Stack>
  );
};

/** Individual ship card */
const ShipMaintenanceCard: React.FC<Readonly<{ ship: ShipMaintenanceStatus }>> = ({ ship }) => {
  const theme = useTheme();
  const sizeLabel = ship.size.charAt(0).toUpperCase() + ship.size.slice(1);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: ship.isFlightReady
          ? alpha(theme.palette.success.main, 0.3)
          : alpha(theme.palette.warning.main, 0.3),
      }}
    >
      {/* Header: name + size + status */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {ship.shipName}
          </Typography>
          <Chip
            label={sizeLabel}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.62rem',
              textTransform: 'capitalize',
              bgcolor: alpha(theme.palette.info.main, 0.1),
              color: theme.palette.info.main,
            }}
          />
        </Stack>
        <ReadinessChip isFlightReady={ship.isFlightReady} status={ship.status} />
      </Stack>

      {/* Stats row: Hull, Shields, Crew, Cargo */}
      <Stack direction="row" spacing={1.5} sx={{ mb: ship.isSupplyCapable ? 1 : 0 }}>
        {ship.hullHp > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <SecurityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {ship.hullHp.toLocaleString()} HP
            </Typography>
          </Stack>
        )}
        {ship.shieldHp > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <ShieldIcon sx={{ fontSize: 14, color: theme.palette.info.main }} />
            <Typography variant="caption" color="text.secondary">
              {ship.shieldHp.toLocaleString()} SHP
            </Typography>
          </Stack>
        )}
        <Stack direction="row" spacing={0.5} alignItems="center">
          <GroupsIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {ship.maxCrew} crew
          </Typography>
        </Stack>
        {ship.cargoScu > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Inventory2Icon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {ship.cargoScu} SCU
            </Typography>
          </Stack>
        )}
      </Stack>

      {/* Supply allocation (large/capital only) */}
      {ship.isSupplyCapable && (
        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.background.default, 0.5),
            border: '1px solid',
            borderColor: alpha(theme.palette.divider, 0.5),
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, mb: 0.5, display: 'block', fontSize: '0.68rem' }}
          >
            Supply Capacity ({ship.supplyCapacity.totalAllocated} SCU)
          </Typography>
          <Stack spacing={0.5}>
            <SupplyBar
              label="Ammunition"
              icon={<GpsFixedIcon sx={{ fontSize: 14 }} />}
              scu={ship.supplyCapacity.ammunition}
              totalScu={ship.supplyCapacity.totalAllocated}
              color={theme.palette.error.main}
            />
            <SupplyBar
              label="Fuel Reserves"
              icon={<LocalGasStationIcon sx={{ fontSize: 14 }} />}
              scu={ship.supplyCapacity.fuel}
              totalScu={ship.supplyCapacity.totalAllocated}
              color={theme.palette.warning.main}
            />
            <SupplyBar
              label="Repair Material"
              icon={<BuildIcon sx={{ fontSize: 14 }} />}
              scu={ship.supplyCapacity.repairMaterial}
              totalScu={ship.supplyCapacity.totalAllocated}
              color={theme.palette.info.main}
            />
          </Stack>
        </Box>
      )}
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface FleetMaintenancePanelProps {
  fleetId: string;
}

export const FleetMaintenancePanel: React.FC<Readonly<FleetMaintenancePanelProps>> = ({
  fleetId,
}) => {
  const theme = useTheme();
  const { data: healthData, isLoading } = useFleetHealth(fleetId);

  const maintenance: FleetMaintenanceHealth | undefined = healthData?.maintenanceHealth;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!maintenance || maintenance.totalShips === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <BuildIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
        <Typography color="text.secondary">No ships to show maintenance data for</Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
          Add ships to this fleet to see health and supply readiness
        </Typography>
      </Box>
    );
  }

  const readinessPct =
    maintenance.totalShips > 0
      ? Math.round((maintenance.flightReadyShips / maintenance.totalShips) * 100)
      : 0;

  let readinessColor = theme.palette.error.main;
  if (readinessPct >= 75) readinessColor = theme.palette.success.main;
  else if (readinessPct >= 50) readinessColor = theme.palette.warning.main;

  return (
    <Stack spacing={2}>
      {/* ── Fleet-wide Summary ──────────────────────────────── */}
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
            <BuildIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Fleet Readiness & Supply
            </Typography>
          </Stack>
          <Chip
            icon={readinessPct >= 75 ? <CheckCircleIcon /> : <ErrorIcon />}
            label={`${maintenance.flightReadyShips}/${maintenance.totalShips} Flight Ready`}
            size="small"
            sx={{
              fontWeight: 600,
              bgcolor: alpha(readinessColor, 0.12),
              color: readinessColor,
            }}
          />
        </Stack>

        {/* Readiness bar */}
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="body2">Ship Readiness</Typography>
          <Typography variant="caption" color="text.secondary">
            {readinessPct}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={readinessPct}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              bgcolor: readinessColor,
            },
          }}
        />

        {/* Supply summary chips */}
        {maintenance.supplyCapableShips > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.75, display: 'block' }}>
              Fleet Supply Totals ({maintenance.totalSupply.totalScu} SCU across{' '}
              {maintenance.supplyCapableShips} supply ships)
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                icon={<GpsFixedIcon sx={{ fontSize: 14 }} />}
                size="small"
                label={`${maintenance.totalSupply.ammunition} SCU Ammo`}
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  color: theme.palette.error.main,
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                }}
              />
              <Chip
                icon={<LocalGasStationIcon sx={{ fontSize: 14 }} />}
                size="small"
                label={`${maintenance.totalSupply.fuel} SCU Fuel`}
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: theme.palette.warning.main,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                }}
              />
              <Chip
                icon={<BuildIcon sx={{ fontSize: 14 }} />}
                size="small"
                label={`${maintenance.totalSupply.repairMaterial} SCU Repair`}
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  color: theme.palette.info.main,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                }}
              />
            </Stack>
          </>
        )}

        {maintenance.supplyCapableShips === 0 && maintenance.totalShips > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Alert severity="info" sx={{ borderRadius: 1, py: 0 }}>
              <Typography variant="caption">
                No large or capital ships — fleet has no supply carrying capacity. Add ships with
                cargo to enable supply logistics.
              </Typography>
            </Alert>
          </>
        )}
      </Paper>

      {/* ── Per-Ship Breakdown ──────────────────────────────── */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ pl: 0.5 }}>
        Ship Status ({maintenance.perShip.length} ships)
      </Typography>

      <Stack spacing={1}>
        {maintenance.perShip.map(ship => (
          <ShipMaintenanceCard key={ship.shipId} ship={ship} />
        ))}
      </Stack>
    </Stack>
  );
};
