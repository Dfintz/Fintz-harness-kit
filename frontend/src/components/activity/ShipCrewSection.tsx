import {
  DirectionsCar as CargoIcon,
  Groups as CrewIcon,
  FlightTakeoff as HangarIcon,
  LocalOffer as LoanerIcon,
  MilitaryTech as MilitaryIcon,
  RocketLaunch as ShipIcon,
} from '@mui/icons-material';
import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import React from 'react';

import { renderRoleIcon } from '@/utils/activityIcons';

import type {
  PassengerCardSlot,
  ShipCrewBreakdownCardEntry,
  ShipCrewRoleSlot,
} from '@sc-fleet-manager/shared-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns 's' for plural counts (0 and 2+ get 's', 1 gets '') */
export function pluralSuffix(count: number): string {
  return count === 1 ? '' : 's';
}

function getRoleIconElement(role: string, sx?: Record<string, unknown>): React.ReactElement {
  return renderRoleIcon(role, { sx: { fontSize: 'inherit', ...sx } });
}

function getRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// ---------------------------------------------------------------------------
// RoleSlotChip
// ---------------------------------------------------------------------------

interface RoleSlotChipProps {
  role: ShipCrewRoleSlot;
}

function getRoleTooltip(r: ShipCrewRoleSlot): string {
  const name = getRoleLabel(r.role);
  if (r.filled >= r.total && r.assignedUserName) return `${name} — ${r.assignedUserName}`;
  if (r.filled >= r.total) return `${name}: Filled`;
  return `${name}: Open`;
}

export const RoleSlotChip: React.FC<Readonly<RoleSlotChipProps>> = ({ role: r }) => {
  const theme = useTheme();
  const isFilled = r.filled >= r.total;
  const label = isFilled && r.assignedUserName ? r.assignedUserName : getRoleLabel(r.role);
  const openSuffix = isFilled ? '' : ' (Open)';

  return (
    <Tooltip title={getRoleTooltip(r)}>
      <Chip
        label={
          <>
            {getRoleIconElement(r.role)} {label}
            {openSuffix}
          </>
        }
        size="small"
        sx={{
          height: 22,
          fontSize: '0.72rem',
          fontWeight: 600,
          bgcolor: isFilled
            ? alpha(theme.palette.info.light, 0.13)
            : theme.palette.background.paper,
          color: isFilled ? theme.palette.info.light : alpha(theme.palette.info.light, 0.6),
          border: `1px ${isFilled ? 'solid' : 'dashed'} ${alpha(theme.palette.info.light, isFilled ? 0.27 : 0.2)}`,
          textTransform: isFilled && r.assignedUserName ? 'none' : 'capitalize',
          opacity: isFilled ? 1 : 0.75,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Tooltip>
  );
};

// ---------------------------------------------------------------------------
// PassengerRow
// ---------------------------------------------------------------------------

const PassengerRow: React.FC<Readonly<{ passenger: PassengerCardSlot }>> = ({ passenger: p }) => {
  const theme = useTheme();
  const open = p.capacity - p.filled;
  return (
    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.3 }}>
      <MilitaryIcon sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, mr: 0.3 }} />
      <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary }}>
        {getRoleLabel(p.role)}s
      </Typography>
      <Chip
        label={`${p.filled}/${p.capacity}`}
        size="small"
        sx={{
          height: 16,
          fontSize: '0.62rem',
          fontWeight: 700,
          bgcolor:
            open > 0
              ? alpha(theme.palette.info.main, 0.09)
              : alpha(theme.palette.success.main, 0.09),
          color: open > 0 ? theme.palette.info.light : theme.palette.success.light,
          border: `1px solid ${open > 0 ? alpha(theme.palette.info.main, 0.2) : alpha(theme.palette.success.main, 0.2)}`,
        }}
      />
      {open > 0 && (
        <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.secondary }}>
          {open} open
        </Typography>
      )}
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// ShipCrewCard (single ship)
// ---------------------------------------------------------------------------

interface ShipCrewCardProps {
  ship: ShipCrewBreakdownCardEntry;
}

function resolveShipBorderColor(
  ship: ShipCrewBreakdownCardEntry,
  transportColor: string,
  theme: Theme
): string {
  if (ship.isLoaner) return alpha(theme.palette.warning.main, 0.2);
  if (ship.isTransported) return alpha(transportColor, 0.2);
  return alpha(theme.palette.common.white, 0.06);
}

const ShipCrewCard: React.FC<Readonly<ShipCrewCardProps>> = ({ ship }) => {
  const theme = useTheme();
  const shipFilled = ship.roles.reduce((s, r) => s + r.filled, 0);
  const shipTotal = ship.roles.reduce((s, r) => s + r.total, 0);
  const shipFull = shipFilled >= shipTotal;
  const shipPct = shipTotal > 0 ? (shipFilled / shipTotal) * 100 : 0;

  const displayRoles = ship.isLoaner ? ship.roles.filter(r => r.filled < r.total) : ship.roles;

  const transportColor =
    ship.transportType === 'hangar' ? theme.palette.secondary.light : theme.palette.warning.main;
  const TransportIcon = ship.transportType === 'hangar' ? HangarIcon : CargoIcon;
  const transportLabel = ship.transportType === 'hangar' ? 'Hangar' : 'Cargo';
  const iconColor = ship.isTransported ? transportColor : theme.palette.info.light;
  const borderColor = resolveShipBorderColor(ship, transportColor, theme);

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.default,
        borderRadius: 1.5,
        border: `1px solid ${borderColor}`,
        p: 1.5,
        '&:hover': { borderColor: alpha(iconColor, 0.33) },
      }}
    >
      {/* Ship header */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
        <ShipIcon sx={{ fontSize: 14, color: iconColor }} />
        <Typography
          sx={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ship.shipName}
        </Typography>
        {ship.isTransported && (
          <Tooltip title={`${transportLabel} — transported inside parent ship`}>
            <Chip
              icon={<TransportIcon sx={{ fontSize: 12, color: transportColor }} />}
              label={transportLabel}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.62rem',
                fontWeight: 700,
                bgcolor: alpha(transportColor, 0.09),
                color: transportColor,
                border: `1px solid ${alpha(transportColor, 0.2)}`,
                '& .MuiChip-label': { px: 0.5 },
                '& .MuiChip-icon': { ml: 0.3, mr: -0.3 },
              }}
            />
          </Tooltip>
        )}
        {ship.isLoaner && (
          <Tooltip title={`Loaner — provided by ${ship.contributedByUserName ?? 'owner'}`}>
            <Chip
              icon={<LoanerIcon sx={{ fontSize: 12, color: theme.palette.warning.main }} />}
              label="Loaner"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.62rem',
                fontWeight: 700,
                bgcolor: alpha(theme.palette.warning.main, 0.09),
                color: theme.palette.warning.main,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          </Tooltip>
        )}
        <Chip
          label={ship.isLoaner ? `${shipTotal - shipFilled} open` : `${shipFilled}/${shipTotal}`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 700,
            bgcolor: shipFull
              ? alpha(theme.palette.warning.main, 0.09)
              : alpha(theme.palette.success.main, 0.09),
            color: shipFull ? theme.palette.warning.main : theme.palette.success.light,
            border: `1px solid ${shipFull ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.success.main, 0.2)}`,
          }}
        />
      </Stack>

      {/* Contributed by info */}
      {ship.contributedByUserName && (
        <Typography
          sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary, mb: 0.5, ml: 0.5 }}
        >
          Ship by {ship.contributedByUserName}
        </Typography>
      )}

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={shipPct}
        sx={{
          height: 4,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.common.white, 0.06),
          mb: 1,
          '& .MuiLinearProgress-bar': {
            bgcolor: shipFull ? theme.palette.warning.main : theme.palette.success.main,
            borderRadius: 2,
          },
        }}
      />

      {/* Role slots */}
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {displayRoles.map((r, i) => (
          <RoleSlotChip key={`${r.role}-${i}`} role={r} />
        ))}
      </Stack>

      {/* Passengers */}
      {ship.passengers && ship.passengers.length > 0 && (
        <Box
          sx={{
            mt: 1,
            pt: 0.8,
            borderTop: `1px dashed ${alpha(theme.palette.common.white, 0.06)}`,
          }}
        >
          {ship.passengers.map((p, i) => (
            <PassengerRow key={`${p.role}-${i}`} passenger={p} />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// ShipCrewSection (public API)
// ---------------------------------------------------------------------------

export interface ShipCrewSectionProps {
  /** Per-ship crew breakdown */
  breakdown: ShipCrewBreakdownCardEntry[];
  /** Max ships to show in compact card (overflow shows "+N more") */
  maxShipsShown?: number;
}

/**
 * ShipCrewSection — per-ship crew breakdown with role slot chips.
 *
 * Extracted from JobPreviewModal / PublicJobCard for reuse across the
 * unified activity card, activity detail, and public job board.
 */
export const ShipCrewSection: React.FC<Readonly<ShipCrewSectionProps>> = ({
  breakdown,
  maxShipsShown = 3,
}) => {
  const theme = useTheme();
  const shown = breakdown.slice(0, maxShipsShown);
  const overflowCount = breakdown.length - maxShipsShown;

  // Aggregate totals
  const totalFilled = breakdown.reduce(
    (s, ship) => s + ship.roles.reduce((rs, r) => rs + r.filled, 0),
    0
  );
  const totalSlots = breakdown.reduce(
    (s, ship) => s + ship.roles.reduce((rs, r) => rs + r.total, 0),
    0
  );
  const openSlots = totalSlots - totalFilled;

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* Aggregate header */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
        <CrewIcon
          sx={{
            fontSize: 16,
            color: openSlots > 0 ? theme.palette.info.light : theme.palette.warning.main,
          }}
        />
        <Typography
          sx={{ fontSize: '0.78rem', color: theme.palette.text.primary, fontWeight: 600 }}
        >
          {openSlots > 0 ? `${openSlots} Open Position${pluralSuffix(openSlots)}` : 'Crew Full'}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: theme.palette.text.secondary,
            ml: 'auto !important',
          }}
        >
          {totalFilled}/{totalSlots} filled
        </Typography>
      </Stack>

      {/* Ships header */}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
        <ShipIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
        <Typography
          sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 600 }}
        >
          Ship{pluralSuffix(breakdown.length)} ({breakdown.length})
        </Typography>
      </Stack>

      {/* Per-ship cards */}
      <Stack spacing={1}>
        {shown.map((ship, i) => (
          <ShipCrewCard key={`${ship.shipName}-${i}`} ship={ship} />
        ))}
        {overflowCount > 0 && (
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: theme.palette.text.secondary,
              textAlign: 'center',
              py: 0.5,
            }}
          >
            +{overflowCount} more ship{pluralSuffix(overflowCount)}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};
