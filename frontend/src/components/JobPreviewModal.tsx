import AddShipIcon from '@mui/icons-material/AddCircleOutline';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import BuildIcon from '@mui/icons-material/Build';
import CancelIcon from '@mui/icons-material/Cancel';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EmailIcon from '@mui/icons-material/Email';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import GroupsIcon from '@mui/icons-material/Groups';
import HandshakeIcon from '@mui/icons-material/Handshake';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import UserIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GlobeIcon from '@mui/icons-material/Public';
import RocketIcon from '@mui/icons-material/RocketLaunch';
import ClockIcon from '@mui/icons-material/Schedule';
import SpeedIcon from '@mui/icons-material/Speed';
import {
  Alert,
  Autocomplete,
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
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { JobApplicationsPanel } from '@/components/JobApplicationsPanel';
import { SignInGate } from '@/components/SignInGate';
import { useApplicationMode } from '@/hooks/queries/useApplicationQueries';
import { useCancelJobListing } from '@/hooks/queries/usePublicDirectoryQueries';
import { useUserShips, type PersonalShip } from '@/hooks/queries/useUserShipQueries';
import { selectIsAuthenticated, selectUser, useAuthStore } from '@/store';

import { getErrorMessage, isApiClientError } from '@/services/apiClient';
import type {
  JobApplicationItem,
  JobApplicationType,
  JobType,
  OrgPrimaryFocus,
  PayType,
  PublicJobListItem,
  ShipCrewBreakdownEntry,
} from '@/services/publicDirectoryService';
import {
  getExperienceLevelLabel,
  getFocusIcon,
  getFocusLabel,
  getJobTypeIcon,
  getJobTypeLabel,
  getListingCategoryLabel,
  getPayTypeLabel,
  jobApplicationService,
} from '@/services/publicDirectoryService';
import { renderRoleIcon } from '@/utils/activityIcons';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx, getStatusColor } from '@/utils/statusStyles';

import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';

export interface JobPreBoxModalProps {
  /** Job listing data */
  job: PublicJobListItem | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
}

/**
 * Get color for job type
 */
function getJobTypeColor(type: JobType, theme: Theme): string {
  const colors: Record<JobType, string> = {
    crew: theme.palette.text.secondary,
    pilot: theme.palette.primary.light,
    gunner: theme.palette.error.main,
    engineer: theme.palette.warning.main,
    medic: theme.palette.info.main,
    miner: theme.palette.warning.dark,
    hauler: theme.palette.secondary.main,
    scout: theme.palette.info.light,
    security: theme.palette.success.main,
    leadership: theme.palette.secondary.light,
    support: theme.palette.success.light,
    other: theme.palette.text.disabled,
  };
  return colors[type] || theme.palette.text.secondary;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get role icon — always shows role-specific icon
 */
function getRoleIconElement(role: string): React.ReactElement {
  return renderRoleIcon(role, { sx: { fontSize: 'inherit' } });
}

/**
 * Get role label — always shows role name
 */
function getRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Get role color — unfilled uses muted variant of the role color
 */
function getRoleColor(role: string, isFilled: boolean, theme: Theme): string {
  const colors: Record<string, string> = {
    pilot: theme.palette.primary.light,
    copilot: theme.palette.primary.main,
    gunner: theme.palette.error.main,
    engineer: theme.palette.warning.main,
    crew: theme.palette.text.secondary,
    medic: theme.palette.info.main,
    marine: theme.palette.success.main,
  };
  const color = colors[role] || theme.palette.text.secondary;
  if (!isFilled) return alpha(color, 0.6);
  return color;
}

/** Get display name from owner type */
function getOwnerDisplayName(
  ownerType: string,
  organizationName?: string,
  allianceName?: string
): string {
  if (ownerType === 'organization') return organizationName || 'Unknown';
  if (ownerType === 'alliance') return allianceName || 'Unknown';
  return 'Individual';
}

/** Get owner type icon prefix */
function getOwnerIcon(ownerType: string): React.ReactElement | null {
  if (ownerType === 'alliance')
    return <HandshakeIcon sx={{ fontSize: 'inherit', mr: 0.5, verticalAlign: 'middle' }} />;
  if (ownerType === 'user')
    return <UserIcon sx={{ fontSize: 'inherit', mr: 0.5, verticalAlign: 'middle' }} />;
  return null;
}

/**
 * Build tooltip text for a role slot
 */
function getRoleTooltipText(role: string, isFilled: boolean, assignedUserName?: string): string {
  const roleName = role.charAt(0).toUpperCase() + role.slice(1);
  if (isFilled && assignedUserName) return `${roleName} — ${assignedUserName}`;
  if (isFilled) return `${roleName}: Filled`;
  return `${roleName}: Open — click to fill`;
}

/**
 * ShipCrewCard — renders a single ship's crew info (breakdown card).
 * Supports nested transport with hangar/cargo badge and passenger display.
 */

/**
 * Build chip style properties for a role slot (filled vs open).
 */
function getRoleChipSx(
  isFilled: boolean,
  roleColor: string,
  hasUserName: boolean,
  theme: Theme
): Record<string, unknown> {
  const borderCol = isFilled ? alpha(roleColor, 0.27) : alpha(roleColor, 0.2);
  const base: Record<string, unknown> = {
    height: 22,
    fontSize: '0.72rem',
    fontWeight: 600,
    bgcolor: isFilled ? alpha(roleColor, 0.13) : theme.palette.background.paper,
    color: roleColor,
    border: `1px ${isFilled ? 'solid' : 'dashed'} ${borderCol}`,
    textTransform: isFilled && hasUserName ? 'none' : 'capitalize',
    cursor: isFilled ? 'default' : 'pointer',
    opacity: isFilled ? 1 : 0.75,
    '& .MuiChip-label': { px: 0.75 },
  };
  if (!isFilled) {
    base['&:hover'] = {
      borderColor: alpha(theme.palette.info.light, 0.27),
      bgcolor: alpha(theme.palette.info.light, 0.07),
      opacity: 1,
    };
  }
  return base;
}

/**
 * RoleSlotChip — renders a single role chip inside the ShipCrewCard.
 * Extracted to reduce cognitive complexity of ShipCrewCard.
 */
const RoleSlotChip: React.FC<{
  r: { role: string; total: number; filled: number; assignedUserName?: string | null };
}> = ({ r }) => {
  const theme = useTheme();
  const isFilled = r.filled >= r.total;
  const roleLabel = isFilled && r.assignedUserName ? r.assignedUserName : getRoleLabel(r.role);
  const roleColor = getRoleColor(r.role, isFilled, theme);
  const tooltipText = getRoleTooltipText(r.role, isFilled, r.assignedUserName ?? undefined);
  const openSuffix = isFilled ? '' : ' (Open)';
  return (
    <Tooltip title={tooltipText}>
      <Chip
        label={
          <>
            {getRoleIconElement(r.role)} {roleLabel}
            {openSuffix}
          </>
        }
        size="small"
        sx={getRoleChipSx(isFilled, roleColor, !!r.assignedUserName, theme)}
      />
    </Tooltip>
  );
};

/**
 * Compute border and hover colors for a ship crew card based on state.
 */
function getShipCardBorder(ship: ShipCrewBreakdownEntry, transportColor: string, theme: Theme) {
  const filled = ship.roles.reduce((s, r) => s + r.filled, 0);
  if (ship.isLoaner)
    return {
      border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
      hoverColor: alpha(theme.palette.warning.main, 0.33),
    };
  if (ship.isTransported) {
    // Empty transport slots get dashed border in the transport color
    if (filled === 0)
      return {
        border: `1.5px dashed ${alpha(transportColor, 0.27)}`,
        hoverColor: alpha(transportColor, 0.33),
      };
    return {
      border: `1px solid ${alpha(transportColor, 0.2)}`,
      hoverColor: alpha(transportColor, 0.33),
    };
  }
  // Unfilled ships: blue-tinted dashed border (distinct from grey "Add Ship" placeholders)
  if (filled === 0)
    return {
      border: `1.5px dashed ${alpha(theme.palette.info.light, 0.27)}`,
      hoverColor: alpha(theme.palette.info.light, 0.4),
    };
  return {
    border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
    hoverColor: alpha(theme.palette.common.white, 0.12),
  };
}

/**
 * PassengerSection — renders non-crew passengers (marines, troops) for a ship.
 */
const PassengerSection: React.FC<{ passengers: ShipCrewBreakdownEntry['passengers'] }> = ({
  passengers,
}) => {
  const theme = useTheme();
  if (!passengers || passengers.length === 0) return null;
  return (
    <Box
      sx={{ mt: 1, pt: 0.8, borderTop: `1px dashed ${alpha(theme.palette.common.white, 0.06)}` }}
    >
      {passengers.map((p, pIdx) => {
        const pOpen = p.capacity - p.filled;
        return (
          <Stack
            key={`passenger-${p.role}-${pIdx}`}
            direction="row"
            spacing={0.8}
            alignItems="center"
            sx={{ mb: 0.3 }}
          >
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: theme.palette.text.secondary,
                display: 'flex',
                alignItems: 'center',
                gap: 0.3,
              }}
            >
              <MilitaryTechIcon sx={{ fontSize: '0.85rem' }} />{' '}
              {p.role.charAt(0).toUpperCase() + p.role.slice(1)}s
            </Typography>
            <Chip
              label={`${p.filled}/${p.capacity}`}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.62rem',
                fontWeight: 700,
                bgcolor:
                  pOpen > 0
                    ? alpha(theme.palette.info.main, 0.09)
                    : alpha(theme.palette.success.main, 0.09),
                color: pOpen > 0 ? theme.palette.info.light : theme.palette.success.light,
                border: `1px solid ${pOpen > 0 ? alpha(theme.palette.info.main, 0.2) : alpha(theme.palette.success.main, 0.2)}`,
              }}
            />
            {pOpen > 0 && (
              <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.secondary }}>
                {pOpen} open
              </Typography>
            )}
          </Stack>
        );
      })}
    </Box>
  );
};

const ShipCrewCard: React.FC<{ ship: ShipCrewBreakdownEntry; idx: number; nested?: boolean }> = ({
  ship,
  idx,
  nested: _nested,
}) => {
  const theme = useTheme();
  const shipFilled = ship.roles.reduce((s, r) => s + r.filled, 0);
  const shipTotal = ship.roles.reduce((s, r) => s + r.total, 0);
  const shipOpen = shipTotal - shipFilled;
  const shipPct = shipTotal > 0 ? (shipFilled / shipTotal) * 100 : 0;
  const shipFull = shipFilled >= shipTotal;

  // For loaner ships, only show open (unfilled) positions
  const displayRoles = ship.isLoaner ? ship.roles.filter(r => r.filled < r.total) : ship.roles;

  const transportColor =
    ship.transportType === 'hangar' ? theme.palette.secondary.light : theme.palette.warning.main;
  const TransportIcon = ship.transportType === 'hangar' ? FlightTakeoffIcon : LocalShippingIcon;
  const transportLabel = ship.transportType === 'hangar' ? 'Hangar' : 'Cargo';
  const { border: cardBorder, hoverColor } = getShipCardBorder(ship, transportColor, theme);
  const iconColor = ship.isTransported ? transportColor : theme.palette.info.light;

  return (
    <Box
      key={`${ship.shipName}-${idx}`}
      sx={{
        bgcolor: theme.palette.background.default,
        borderRadius: 1.5,
        border: cardBorder,
        p: 1.5,
        '&:hover': { borderColor: hoverColor },
      }}
    >
      {/* Ship header */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
        <RocketIcon sx={{ fontSize: 14, color: iconColor }} />
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
          <Tooltip title={`Loaner — provided by ${ship.contributedByUserName || 'owner'}`}>
            <Chip
              icon={<LocalOfferIcon sx={{ fontSize: 12, color: theme.palette.warning.main }} />}
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
          label={ship.isLoaner ? `${shipOpen} open` : `${shipFilled}/${shipTotal}`}
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

      {/* Ship progress bar */}
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

      {/* Role slots — loaner ships only show open positions */}
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {displayRoles.map((r, rIdx) => (
          <RoleSlotChip key={`${r.role}-${rIdx}`} r={r} />
        ))}
      </Stack>

      {/* Passengers (marines, troops, etc.) — not counted as crew */}
      <PassengerSection passengers={ship.passengers} />
    </Box>
  );
};

/**
 * RequiredShipsSection — renders required/preferred ships list.
 * Extracted to reduce cognitive complexity of the main modal.
 */
const RequiredShipsSection: React.FC<{
  shipRequirementType: string;
  requiredShips: string[];
}> = ({ shipRequirementType, requiredShips }) => {
  const theme = useTheme();
  const isRequired = shipRequirementType === 'required';
  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        p: 2.5,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <RocketIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
        <Typography sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.9rem' }}>
          {isRequired ? 'Required Ships' : 'Preferred Ships'}
        </Typography>
        <Chip
          label={isRequired ? 'REQUIRED' : 'PREFERRED'}
          size="small"
          sx={{
            bgcolor: isRequired
              ? alpha(theme.palette.warning.main, 0.13)
              : alpha(theme.palette.info.main, 0.13),
            color: isRequired ? theme.palette.warning.main : theme.palette.info.light,
            fontWeight: 700,
            fontSize: '0.65rem',
            height: 20,
            border: `1px solid ${isRequired ? alpha(theme.palette.warning.main, 0.27) : alpha(theme.palette.info.main, 0.27)}`,
          }}
        />
      </Stack>
      <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
        {requiredShips.map(ship => (
          <Chip
            key={ship}
            icon={<RocketIcon sx={{ fontSize: 14 }} />}
            label={ship}
            size="small"
            sx={{
              bgcolor: isRequired
                ? alpha(theme.palette.warning.main, 0.09)
                : alpha(theme.palette.info.main, 0.09),
              color: isRequired ? theme.palette.warning.main : theme.palette.info.light,
              fontSize: '0.8rem',
              border: `1px solid ${isRequired ? alpha(theme.palette.warning.main, 0.27) : alpha(theme.palette.info.main, 0.27)}`,
              fontWeight: 600,
              '& .MuiChip-icon': {
                color: isRequired ? theme.palette.warning.main : theme.palette.info.light,
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

/**
 * JobDetailsSection — renders job detail fields, languages, and tags.
 * Extracted to reduce cognitive complexity of the main modal.
 */
const JobDetailsSection: React.FC<{
  payDisplay: string;
  payType?: PayType;
  experienceLevel: number;
  timezone?: string;
  postedAt: string;
  expiresAt?: string;
  isExpired: boolean | string;
  contactInfo?: string;
  languages?: string[];
  tags?: string[];
}> = ({
  payDisplay,
  payType,
  experienceLevel,
  timezone,
  postedAt,
  expiresAt,
  isExpired,
  contactInfo,
  languages,
  tags,
}) => {
  const theme = useTheme();
  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        <Stack direction="column" spacing={2} flex={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <MoneyIcon sx={{ fontSize: 18, color: theme.palette.success.light }} />
            <Typography
              sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.88rem' }}
            >
              Pay:
            </Typography>
            <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.88rem' }}>
              {payDisplay}
            </Typography>
            {payType && (
              <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.82rem' }}>
                ({getPayTypeLabel(payType)})
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <UserIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
            <Typography
              sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.88rem' }}
            >
              Experience:
            </Typography>
            <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.88rem' }}>
              {getExperienceLevelLabel(experienceLevel)}
            </Typography>
          </Stack>
          {timezone && (
            <Stack direction="row" spacing={1} alignItems="center">
              <GlobeIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
              <Typography
                sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.88rem' }}
              >
                Timezone:
              </Typography>
              <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.88rem' }}>
                {timezone}
              </Typography>
            </Stack>
          )}
        </Stack>
        <Stack direction="column" spacing={2} flex={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ClockIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
            <Typography
              sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.88rem' }}
            >
              Posted:
            </Typography>
            <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.88rem' }}>
              {formatDate(postedAt)}
            </Typography>
          </Stack>
          {expiresAt && (
            <Stack direction="row" spacing={1} alignItems="center">
              <ClockIcon
                sx={{
                  fontSize: 18,
                  color: isExpired ? theme.palette.error.main : theme.palette.text.secondary,
                }}
              />
              <Typography
                sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.88rem' }}
              >
                Expires:
              </Typography>
              <Typography
                sx={{
                  color: isExpired ? theme.palette.error.main : theme.palette.text.primary,
                  fontSize: '0.88rem',
                }}
              >
                {formatDate(expiresAt)}
              </Typography>
            </Stack>
          )}
          {contactInfo && (
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
              <Typography
                sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.88rem' }}
              >
                Contact:
              </Typography>
              <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.88rem' }}>
                {contactInfo}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Stack>
      {languages && languages.length > 0 && (
        <Box>
          <Typography
            sx={{
              fontWeight: 600,
              color: theme.palette.common.white,
              mb: 0.8,
              fontSize: '0.88rem',
            }}
          >
            Required Languages
          </Typography>
          <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {languages.map(lang => (
              <Chip
                key={lang}
                label={lang.toUpperCase()}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.primary,
                  fontSize: '0.75rem',
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
      {tags && tags.length > 0 && (
        <Box>
          <Typography
            sx={{
              fontWeight: 600,
              color: theme.palette.common.white,
              mb: 0.8,
              fontSize: '0.88rem',
            }}
          >
            Tags
          </Typography>
          <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.secondary,
                  fontSize: '0.75rem',
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
    </>
  );
};

/**
 * CrewSection — renders the aggregate crew bar and per-ship breakdown.
 * Shows placeholder "Add Ship" cards for required ships not yet in the breakdown.
 * Extracted to reduce cognitive complexity of the main modal.
 */
const CrewSection: React.FC<{
  aggregateTotal: number;
  aggregateFilled: number;
  aggregatePct: number;
  hasBreakdown: boolean;
  shipCrewBreakdown?: ShipCrewBreakdownEntry[];
  requiredShips?: string[];
  shipRequirementType?: 'none' | 'required' | 'preferred';
}> = ({
  aggregateTotal,
  aggregateFilled,
  aggregatePct,
  hasBreakdown,
  shipCrewBreakdown,
  requiredShips,
  shipRequirementType,
}) => {
  const theme = useTheme();
  const openSpots = aggregateTotal - aggregateFilled;
  const isFull = aggregateFilled >= aggregateTotal;

  // Compute required ships that haven't been added to the breakdown yet
  const addedShipNames = new Set((shipCrewBreakdown ?? []).map(s => s.shipName.toLowerCase()));
  const unaddedShips =
    shipRequirementType && shipRequirementType !== 'none' && requiredShips
      ? requiredShips.filter(name => !addedShipNames.has(name.toLowerCase()))
      : [];

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        p: 2.5,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <GroupsIcon sx={{ fontSize: 20, color: theme.palette.info.light }} />
        <Typography sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.9rem' }}>
          Crew Positions
        </Typography>
        <Chip
          label={openSpots > 0 ? `${openSpots} open` : 'Full'}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.68rem',
            fontWeight: 700,
            bgcolor: isFull
              ? alpha(theme.palette.warning.main, 0.09)
              : alpha(theme.palette.info.light, 0.09),
            color: isFull ? theme.palette.warning.main : theme.palette.info.light,
            border: `1px solid ${isFull ? alpha(theme.palette.warning.main, 0.2) : alpha(theme.palette.info.light, 0.2)}`,
          }}
        />
        <Typography
          sx={{ fontSize: '0.82rem', color: theme.palette.text.secondary, ml: 'auto !important' }}
        >
          {aggregateFilled}/{aggregateTotal} filled
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={aggregatePct}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: alpha(theme.palette.common.white, 0.06),
          mb: hasBreakdown || unaddedShips.length > 0 ? 2 : 0,
          '& .MuiLinearProgress-bar': {
            bgcolor: isFull ? theme.palette.warning.main : theme.palette.info.light,
            borderRadius: 4,
          },
        }}
      />
      <Stack direction="column" spacing={1.5}>
        {/* Ships in the breakdown — grouped by parent for nested transport */}
        {hasBreakdown &&
          (() => {
            const entries = shipCrewBreakdown ?? [];
            // Separate top-level ships and nested (transported) ships
            const topLevel = entries.filter(
              (s, i) => s.parentShipIndex == null || s.parentShipIndex === i
            );
            const childrenByParent = new Map<
              number,
              { ship: ShipCrewBreakdownEntry; origIdx: number }[]
            >();
            entries.forEach((s, i) => {
              if (s.parentShipIndex != null && s.parentShipIndex !== i) {
                const arr = childrenByParent.get(s.parentShipIndex) ?? [];
                arr.push({ ship: s, origIdx: i });
                childrenByParent.set(s.parentShipIndex, arr);
              }
            });

            return topLevel.map(parent => {
              const parentIdx = entries.indexOf(parent);
              const children = childrenByParent.get(parentIdx) ?? [];

              // Standalone ship — no transported children
              if (children.length === 0) {
                return (
                  <ShipCrewCard key={`parent-group-${parentIdx}`} ship={parent} idx={parentIdx} />
                );
              }

              // Parent + transported children grouped in a visual container
              return (
                <Box
                  key={`parent-group-${parentIdx}`}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                    bgcolor: alpha(theme.palette.background.default, 0.27),
                    p: 1,
                    transition: theme.transitions.create('border-color', { duration: 200 }),
                    '&:hover': { borderColor: alpha(theme.palette.common.white, 0.12) },
                  }}
                >
                  <ShipCrewCard ship={parent} idx={parentIdx} />
                  {/* Transported entities — visually connected to parent */}
                  <Box
                    sx={{
                      ml: 2,
                      mt: 1,
                      pl: 1.5,
                      borderLeft: `2px solid ${alpha(theme.palette.common.white, 0.05)}`,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        color: theme.palette.text.secondary,
                        fontWeight: 600,
                        mb: 0.8,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Transported aboard {parent.shipName}
                    </Typography>
                    <Stack spacing={1}>
                      {children.map(({ ship: child, origIdx }) => (
                        <ShipCrewCard
                          key={`nested-${child.shipName}-${origIdx}`}
                          ship={child}
                          idx={origIdx}
                          nested
                        />
                      ))}
                    </Stack>
                  </Box>
                </Box>
              );
            });
          })()}

        {/* Required ships not yet added — dotted placeholder */}
        {unaddedShips.map((shipName, idx) => (
          <Box
            key={`unadded-${shipName}-${idx}`}
            sx={{
              borderRadius: 1.5,
              border: `2px dashed ${alpha(theme.palette.common.white, 0.12)}`,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              minHeight: 56,
              bgcolor: 'transparent',
              transition: theme.transitions.create('border-color', { duration: 200 }),
              '&:hover': { borderColor: alpha(theme.palette.info.light, 0.27) },
            }}
          >
            <AddShipIcon sx={{ fontSize: 20, color: theme.palette.text.disabled }} />
            <Stack direction="column" spacing={0}>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: theme.palette.text.secondary,
                }}
              >
                {shipName}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  color: theme.palette.text.disabled,
                }}
              >
                Add Ship to fill crew positions
              </Typography>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

/**
 * ApplicationStatusBar — displays alerts, current application status, and withdraw button.
 * Extracted to reduce cognitive complexity of JobPreBoxModal.
 */
const ApplicationStatusBar: React.FC<{
  applyError: string | null;
  applySuccess: string | null;
  myApplication: JobApplicationItem | null;
  applyLoading: boolean;
  onWithdraw: () => void;
}> = ({ applyError, applySuccess, myApplication, applyLoading, onWithdraw }) => {
  const theme = useTheme();
  return (
    <>
      {applyError && (
        <Alert
          severity="error"
          sx={{
            mb: 1,
            bgcolor: alpha(theme.palette.error.main, 0.15),
            color: theme.palette.error.light,
            '& .MuiAlert-icon': { color: theme.palette.error.light },
          }}
        >
          {applyError}
        </Alert>
      )}
      {applySuccess && (
        <Alert
          severity="success"
          sx={{
            mb: 1,
            bgcolor: alpha(theme.palette.success.main, 0.15),
            color: theme.palette.success.light,
            '& .MuiAlert-icon': { color: theme.palette.success.light },
          }}
        >
          {applySuccess}
        </Alert>
      )}
      {myApplication && (
        <Box
          sx={{
            mb: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <HowToRegIcon sx={{ fontSize: '1rem', color: theme.palette.text.secondary }} />
            <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.primary }}>
              Your application:
            </Typography>
            <Chip
              label={myApplication.status.charAt(0).toUpperCase() + myApplication.status.slice(1)}
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: '0.72rem',
                ...getStatusChipSx(myApplication.status, theme),
                border: '1px solid',
                borderColor: alpha(getStatusColor(myApplication.status, theme), 0.4),
              }}
            />
            {myApplication.waitlistPosition && (
              <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                Position #{myApplication.waitlistPosition}
              </Typography>
            )}
            {(myApplication.status === 'pending' || myApplication.status === 'waitlisted') && (
              <Button
                size="small"
                onClick={onWithdraw}
                disabled={applyLoading}
                sx={{
                  ml: 'auto',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: theme.palette.error.light,
                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.15) },
                }}
              >
                Withdraw
              </Button>
            )}
          </Stack>
        </Box>
      )}
    </>
  );
};

/**
 * HangarShipAutocomplete — Autocomplete field populated from the user's personal hangar.
 * Allows free-text entry so users can type a ship name even if it's not in their hangar.
 */
const HangarShipAutocomplete: React.FC<{
  vehicleName: string;
  onVehicleChange: (v: string) => void;
}> = ({ vehicleName, onVehicleChange }) => {
  const theme = useTheme();
  // This component only renders inside SignInGate, so user is always authenticated
  const { data: shipsResult, isLoading } = useUserShips({ pageSize: 200 });

  const shipOptions: PersonalShip[] = shipsResult?.items ?? [];

  return (
    <Autocomplete
      freeSolo
      options={shipOptions}
      getOptionLabel={option => {
        if (typeof option === 'string') return option;
        if (option.customName) return `${option.shipName} (${option.customName})`;
        return option.shipName;
      }}
      inputValue={vehicleName}
      onInputChange={(_e, value) => onVehicleChange(value)}
      loading={isLoading}
      size="small"
      fullWidth
      renderInput={params => (
        <TextField
          {...params}
          placeholder="Select a ship from your hangar"
          slotProps={{
            input: {
              ...params.InputProps,
              sx: {
                bgcolor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                borderRadius: 1.5,
                fontSize: '0.85rem',
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              },
            },
          }}
        />
      )}
    />
  );
};

/**
 * OrgQuestionField — renders a single application form question.
 */
const OrgQuestionField: React.FC<{
  question: ApplicationQuestion;
  value: string;
  onChange: (questionId: string, value: string) => void;
  disabled: boolean;
  theme: Theme;
}> = ({ question, value, onChange, disabled, theme }) => {
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: theme.palette.text.primary,
      '& fieldset': { borderColor: alpha(theme.palette.common.white, 0.12) },
      '&:hover fieldset': { borderColor: theme.palette.info.light },
    },
    '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
    '& .MuiFormHelperText-root': { color: theme.palette.text.secondary },
  };

  if (question.type === 'short' || question.type === 'paragraph') {
    return (
      <TextField
        label={question.label}
        required={question.required}
        value={value}
        onChange={e =>
          onChange(
            question.id,
            e.target.value.slice(0, question.maxLength ?? (question.type === 'short' ? 500 : 2000))
          )
        }
        placeholder={question.placeholder}
        fullWidth
        size="small"
        multiline={question.type === 'paragraph'}
        rows={question.type === 'paragraph' ? 3 : undefined}
        disabled={disabled}
        helperText={question.maxLength ? `${value.length}/${question.maxLength}` : undefined}
        sx={fieldSx}
      />
    );
  }

  if (question.type === 'select') {
    return (
      <FormControl fullWidth size="small" required={question.required}>
        <InputLabel sx={{ color: theme.palette.text.secondary }}>{question.label}</InputLabel>
        <Select
          value={value}
          label={question.label}
          onChange={e => onChange(question.id, e.target.value)}
          disabled={disabled}
          sx={{
            color: theme.palette.text.primary,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(theme.palette.common.white, 0.12),
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.info.light,
            },
          }}
        >
          {(question.options ?? []).map(option => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (question.type === 'checkbox' || question.type === 'rules') {
    const isRules = question.type === 'rules';
    const checked = isRules ? value === 'accepted' : value === 'true';
    return (
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={(_e, chk) => {
              let val: string;
              if (isRules) {
                val = chk ? 'accepted' : '';
              } else {
                val = chk ? 'true' : 'false';
              }
              onChange(question.id, val);
            }}
            disabled={disabled}
            sx={{ color: theme.palette.text.secondary }}
          />
        }
        label={
          <Typography variant="body2">
            {question.label}
            {question.required && (
              <Typography component="span" sx={{ color: theme.palette.error.main }}>
                {' *'}
              </Typography>
            )}
          </Typography>
        }
      />
    );
  }

  return null;
};

/**
 * ApplyInputFields — renders the optional message, vehicle name, and org application form questions.
 * Extracted to reduce cognitive complexity of JobPreBoxModal.
 */
const ApplyInputFields: React.FC<{
  applyMessage: string;
  vehicleName: string;
  onMessageChange: (v: string) => void;
  onVehicleChange: (v: string) => void;
  questions?: ApplicationQuestion[];
  formResponses?: Record<string, string>;
  onFormResponseChange?: (questionId: string, value: string) => void;
}> = ({
  applyMessage,
  vehicleName,
  onMessageChange,
  onVehicleChange,
  questions,
  formResponses,
  onFormResponseChange,
}) => {
  const theme = useTheme();
  const sortedQuestions = questions?.length ? [...questions].sort((a, b) => a.order - b.order) : [];

  return (
    <Stack spacing={1.5}>
      <TextField
        placeholder="Optional message to the listing owner..."
        value={applyMessage}
        onChange={e => onMessageChange(e.target.value)}
        multiline
        minRows={1}
        maxRows={3}
        size="small"
        fullWidth
        slotProps={{
          input: {
            sx: {
              bgcolor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
              borderRadius: 1.5,
              fontSize: '0.85rem',
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            },
          },
        }}
      />
      {/* Vehicle/ship selector — populated from user's personal hangar */}
      <HangarShipAutocomplete vehicleName={vehicleName} onVehicleChange={onVehicleChange} />
      {/* Org application form questions */}
      {sortedQuestions.length > 0 && onFormResponseChange && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
          >
            Application Questions
          </Typography>
          {sortedQuestions.map(q => (
            <OrgQuestionField
              key={q.id}
              question={q}
              value={formResponses?.[q.id] ?? ''}
              onChange={onFormResponseChange}
              disabled={false}
              theme={theme}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
};

/**
 * UncappedApplyButtons — ad-hoc join buttons for uncapped listings.
 */
const UncappedApplyButtons: React.FC<{
  applyLoading: boolean;
  vehicleName: string;
  onApply: (type: JobApplicationType) => void;
}> = ({ applyLoading, vehicleName, onApply }) => {
  const theme = useTheme();
  return (
    <>
      <Button
        variant="contained"
        startIcon={applyLoading ? <CircularProgress size={16} /> : <PersonAddIcon />}
        disabled={applyLoading}
        onClick={() => onApply('crew')}
        sx={{
          textTransform: 'none',
          bgcolor: theme.palette.success.dark,
          color: theme.palette.common.white,
          '&:hover': { bgcolor: theme.palette.success.main },
          '&.Mui-disabled': {
            bgcolor: alpha(theme.palette.common.white, 0.06),
            color: theme.palette.text.disabled,
          },
        }}
      >
        Join as Crew
      </Button>
      <Button
        variant="contained"
        startIcon={applyLoading ? <CircularProgress size={16} /> : <GroupsIcon />}
        disabled={applyLoading}
        onClick={() => onApply('passenger')}
        sx={{
          textTransform: 'none',
          bgcolor: theme.palette.info.dark,
          color: theme.palette.common.white,
          '&:hover': { bgcolor: theme.palette.info.main },
          '&.Mui-disabled': {
            bgcolor: alpha(theme.palette.common.white, 0.06),
            color: theme.palette.text.disabled,
          },
        }}
      >
        Join as Passenger
      </Button>
      <Button
        variant="contained"
        startIcon={applyLoading ? <CircularProgress size={16} /> : <DirectionsCarIcon />}
        disabled={applyLoading || !vehicleName.trim()}
        onClick={() => onApply('vehicle')}
        sx={{
          textTransform: 'none',
          bgcolor: theme.palette.secondary.main,
          color: theme.palette.common.white,
          '&:hover': { bgcolor: theme.palette.secondary.light },
          '&.Mui-disabled': {
            bgcolor: alpha(theme.palette.common.white, 0.06),
            color: theme.palette.text.disabled,
          },
        }}
      >
        Join with Vehicle
      </Button>
    </>
  );
};

/**
 * CappedApplyButtons — apply/waitlist buttons for capped listings.
 */
const CappedApplyButtons: React.FC<{
  applyLoading: boolean;
  crewFull: boolean;
  vehicleName: string;
  onApply: (type: JobApplicationType) => void;
}> = ({ applyLoading, crewFull, vehicleName, onApply }) => {
  const theme = useTheme();
  return (
    <>
      <Button
        variant="contained"
        startIcon={applyLoading ? <CircularProgress size={16} /> : <PersonAddIcon />}
        disabled={applyLoading}
        onClick={() => onApply('general')}
        sx={{
          textTransform: 'none',
          bgcolor: crewFull ? theme.palette.warning.main : theme.palette.success.dark,
          color: crewFull ? theme.palette.common.black : theme.palette.common.white,
          '&:hover': {
            bgcolor: crewFull ? theme.palette.warning.light : theme.palette.success.main,
          },
          '&.Mui-disabled': {
            bgcolor: alpha(theme.palette.common.white, 0.06),
            color: theme.palette.text.disabled,
          },
        }}
      >
        {crewFull ? 'Join Waitlist' : 'Apply'}
      </Button>
      {vehicleName.trim() && (
        <Button
          variant="outlined"
          startIcon={applyLoading ? <CircularProgress size={16} /> : <DirectionsCarIcon />}
          disabled={applyLoading}
          onClick={() => onApply('vehicle')}
          sx={{
            textTransform: 'none',
            color: theme.palette.secondary.light,
            borderColor: alpha(theme.palette.secondary.main, 0.27),
            '&:hover': {
              borderColor: theme.palette.secondary.light,
              bgcolor: alpha(theme.palette.secondary.main, 0.07),
            },
            '&.Mui-disabled': {
              borderColor: alpha(theme.palette.common.white, 0.06),
              color: theme.palette.text.disabled,
            },
          }}
        >
          Apply with Vehicle
        </Button>
      )}
    </>
  );
};

/**
 * StatusBadges — horizontal row of status chips (category, type, focus, expired, crew).
 * Extracted to reduce cognitive complexity of the main modal component.
 */
const StatusBadges: React.FC<{
  listingCategory?: string;
  jobType: JobType;
  focus: OrgPrimaryFocus;
  accent: string;
  isExpired: boolean | '' | null | undefined;
  crewFull: boolean;
}> = ({ listingCategory, jobType, focus, accent, isExpired, crewFull }) => {
  const theme = useTheme();
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      {listingCategory === 'service' && (
        <Chip
          icon={<BuildIcon sx={{ fontSize: 16 }} />}
          label={getListingCategoryLabel('service')}
          sx={{
            bgcolor: alpha(theme.palette.secondary.main, 0.15),
            color: theme.palette.secondary.light,
            fontWeight: 600,
            border: `1px solid ${alpha(theme.palette.secondary.main, 0.4)}`,
          }}
        />
      )}
      <Chip
        label={
          <>
            {getJobTypeIcon(jobType)} {getJobTypeLabel(jobType)}
          </>
        }
        sx={{
          bgcolor: alpha(accent, 0.13),
          color: accent,
          fontWeight: 600,
          border: `1px solid ${alpha(accent, 0.27)}`,
        }}
      />
      <Chip
        label={
          <>
            {getFocusIcon(focus)} {getFocusLabel(focus)}
          </>
        }
        sx={{
          bgcolor: alpha(theme.palette.common.white, 0.06),
          color: theme.palette.text.primary,
          border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        }}
      />
      {isExpired && (
        <Chip
          label="Expired"
          sx={{
            bgcolor: alpha(theme.palette.error.main, 0.13),
            color: theme.palette.error.main,
            border: `1px solid ${alpha(theme.palette.error.main, 0.27)}`,
          }}
        />
      )}
      {crewFull && (
        <Chip
          label="Crew Full"
          sx={{
            bgcolor: alpha(theme.palette.warning.main, 0.13),
            color: theme.palette.warning.main,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.27)}`,
          }}
        />
      )}
    </Stack>
  );
};

/**
 * ApprovedVehiclesSection — list of approved vehicles for the listing.
 * Extracted to reduce cognitive complexity of the main modal component.
 */
const ApprovedVehiclesSection: React.FC<{
  vehicles: Array<{ applicationId: string; vehicleName: string; applicantDisplayName?: string }>;
}> = ({ vehicles }) => {
  const theme = useTheme();
  if (vehicles.length === 0) return null;
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <DirectionsCarIcon sx={{ fontSize: 18, color: theme.palette.success.light }} />
        <Typography
          sx={{ fontSize: '0.85rem', fontWeight: 600, color: theme.palette.text.primary }}
        >
          Approved Vehicles ({vehicles.length})
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {vehicles.map(v => (
          <Chip
            key={v.applicationId}
            icon={<RocketIcon sx={{ fontSize: 14 }} />}
            label={`${v.vehicleName} — ${v.applicantDisplayName}`}
            size="small"
            sx={{
              height: 24,
              fontSize: '0.75rem',
              fontWeight: 600,
              bgcolor: alpha(theme.palette.success.main, 0.1),
              color: theme.palette.success.light,
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              '& .MuiChip-icon': { color: theme.palette.success.light },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

/**
 * FleetStatsBar — displays total SCU and average quantum fuel for the fleet.
 * Only rendered when ship breakdown data with stats is available.
 */
const FleetStatsBar: React.FC<{
  totalScu: number;
  averageQuantumFuel: number;
  shipBreakdown?: ShipCrewBreakdownEntry[];
}> = ({ totalScu, averageQuantumFuel, shipBreakdown }) => {
  const theme = useTheme();
  const shipCount = shipBreakdown?.length ?? 0;

  if (shipCount === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <LocalShippingIcon sx={{ fontSize: 20, color: theme.palette.secondary.light }} />
        <Typography sx={{ fontWeight: 600, color: theme.palette.common.white, fontSize: '0.9rem' }}>
          Fleet Stats
        </Typography>
        <Chip
          label={`${shipCount} ${shipCount === 1 ? 'ship' : 'ships'}`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.68rem',
            fontWeight: 700,
            bgcolor: alpha(theme.palette.secondary.light, 0.09),
            color: theme.palette.secondary.light,
            border: `1px solid ${alpha(theme.palette.secondary.light, 0.2)}`,
          }}
        />
      </Stack>
      <Stack direction="row" spacing={3}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <InventoryIcon sx={{ fontSize: 16, color: theme.palette.warning.light }} />
          <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.secondary }}>
            Total SCU:
          </Typography>
          <Typography
            sx={{ fontSize: '0.82rem', fontWeight: 700, color: theme.palette.warning.light }}
          >
            {totalScu.toLocaleString()}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <SpeedIcon sx={{ fontSize: 16, color: theme.palette.info.light }} />
          <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.secondary }}>
            Avg QF:
          </Typography>
          <Typography
            sx={{ fontSize: '0.82rem', fontWeight: 700, color: theme.palette.info.light }}
          >
            {averageQuantumFuel.toLocaleString()}
          </Typography>
        </Stack>
      </Stack>
      {shipBreakdown && shipBreakdown.length > 1 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {shipBreakdown.map(ship => (
            <Chip
              key={`fleet-stat-${ship.shipName}`}
              label={`${ship.shipName}: ${ship.cargo ?? 0} SCU / ${ship.quantumFuelCapacity ?? 0} QF`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: alpha(theme.palette.common.white, 0.04),
                color: theme.palette.text.secondary,
                border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

/**
 * CancelListingButton — cancel button for listing owners.
 * Extracted to reduce cognitive complexity of the main modal.
 */
const CancelListingButton: React.FC<{
  jobId: string;
  onCancelled: () => void;
  onError: (msg: string) => void;
}> = ({ jobId, onCancelled, onError }) => {
  const cancelListing = useCancelJobListing();

  const handleCancel = useCallback(async () => {
    try {
      await cancelListing.mutateAsync(jobId);
      onCancelled();
    } catch (err: unknown) {
      onError('Failed to cancel listing');
      logger.error('Failed to cancel listing', err instanceof Error ? err : new Error(String(err)));
    }
  }, [jobId, cancelListing, onCancelled, onError]);

  return (
    <Button
      variant="outlined"
      color="error"
      startIcon={<CancelIcon />}
      onClick={handleCancel}
      disabled={cancelListing.isPending}
      sx={{ textTransform: 'none' }}
    >
      {cancelListing.isPending ? 'Cancelling...' : 'Cancel Listing'}
    </Button>
  );
};

/** Execute application withdrawal with error handling */
async function executeWithdraw(
  jobId: string,
  applicationId: string,
  setters: ApplySetters
): Promise<void> {
  setters.setLoading(true);
  try {
    await jobApplicationService.withdrawApplication(jobId, applicationId);
    setters.setMyApplication(null);
    setters.setSuccess('Application withdrawn');
  } catch (err: unknown) {
    setters.setError('Failed to withdraw application');
    logger.error(
      'Failed to withdraw application',
      err instanceof Error ? err : new Error(String(err))
    );
  } finally {
    setters.setLoading(false);
  }
}

/** State setters for application UI */
interface ApplySetters {
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
  setMyApplication: (app: JobApplicationItem | null) => void;
}

/** Check if user owns or has org access to the listing */
function checkListingOwnership(
  currentUser: { id: string; organizationId?: string } | null,
  job: PublicJobListItem | null
): boolean {
  if (!currentUser || !job) return false;
  if (job.createdBy === currentUser.id) return true;
  return (
    job.ownerType === 'organization' &&
    !!job.organizationId &&
    currentUser.organizationId === job.organizationId
  );
}

/** Execute job application with error handling */
async function executeApply(
  jobId: string,
  applicationType: JobApplicationType,
  opts: {
    message: string;
    vehicleName: string;
    formResponses?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
  setters: ApplySetters
): Promise<void> {
  setters.setLoading(true);
  setters.setError(null);
  setters.setSuccess(null);
  try {
    const hasFormResponses = opts.formResponses && Object.keys(opts.formResponses).length > 0;
    const result = await jobApplicationService.applyToJob(jobId, {
      applicationType,
      message: opts.message || undefined,
      vehicleName: applicationType === 'vehicle' ? opts.vehicleName : undefined,
      formResponses: hasFormResponses ? opts.formResponses : undefined,
      ...opts.extra,
    });
    setters.setMyApplication(result);
    if (result.status === 'waitlisted') {
      setters.setSuccess(`Added to waitlist (position #${result.waitlistPosition})`);
    } else {
      setters.setSuccess('Application submitted!');
    }
  } catch (err: unknown) {
    const msg = isApiClientError(err) ? err.message : getErrorMessage(err);
    setters.setError(msg);
    logger.error('Failed to apply to job', err instanceof Error ? err : new Error(String(err)));
  } finally {
    setters.setLoading(false);
  }
}

/** Extract org questions from application mode response */
function getOrgQuestions(
  appMode: { mode: string; questions?: ApplicationQuestion[] } | undefined
): ApplicationQuestion[] {
  if (appMode?.mode === 'custom' && appMode.questions?.length) {
    return appMode.questions;
  }
  return [];
}

/**
 * JobPreBoxModal - Dark-themed job detail modal with crew/ship info and join actions
 */
export const JobPreBoxModal: React.FC<JobPreBoxModalProps> = ({ job, isOpen, onClose }) => {
  const theme = useTheme();
  // ── Application state ─────────────────────────────────────────
  const [myApplication, setMyApplication] = useState<JobApplicationItem | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const currentUser = useAuthStore(selectUser);

  // Fetch org application form questions if this listing belongs to an org
  const orgId = job?.organizationId;
  const { data: appMode } = useApplicationMode(orgId ?? '', isOpen && !!orgId);
  const orgQuestions = getOrgQuestions(appMode);

  // Determine if current user can manage applications (owner or org member for org listings)
  // The backend enforces actual permission checks — this is a UI visibility hint
  const isListingOwner = checkListingOwnership(currentUser, job);

  // Reset application state when modal closes or job changes
  useEffect(() => {
    if (!isOpen || !job) {
      setMyApplication(null);
      setApplyError(null);
      setApplySuccess(null);
      setApplyMessage('');
      setVehicleName('');
      setFormResponses({});
      return;
    }
    jobApplicationService
      .getMyApplication(job.id)
      .then(setMyApplication)
      .catch(() => undefined);
  }, [isOpen, job]);

  const applySetters: ApplySetters = useMemo(
    () => ({
      setLoading: setApplyLoading,
      setError: setApplyError,
      setSuccess: setApplySuccess,
      setMyApplication,
    }),
    []
  );

  const handleApply = useCallback(
    async (
      type: JobApplicationType,
      extra?: {
        shipIndex?: number;
        roleIndex?: number;
        passengerShipIndex?: number;
        passengerRole?: string;
      }
    ) => {
      if (!job) return;
      await executeApply(
        job.id,
        type,
        { message: applyMessage, vehicleName, formResponses, extra },
        applySetters
      );
    },
    [job, applyMessage, vehicleName, formResponses, applySetters]
  );

  const handleWithdraw = useCallback(async () => {
    if (!job?.id || !myApplication?.id) return;
    await executeWithdraw(job.id, myApplication.id, applySetters);
  }, [job, myApplication, applySetters]);

  if (!job) return null;

  const {
    organizationName,
    organizationLogoUrl,
    allianceName,
    ownerType,
    title,
    description,
    jobType,
    listingCategory,
    focus,
    payType,
    payDisplay,
    experienceLevel,
    postedAt,
    expiresAt,
    contactInfo,
    timezone,
    languages,
    tags,
    crewSpotsTotal,
    crewSpotsFilled,
    requiredShips,
    shipRequirementType,
    shipCrewBreakdown,
  } = job;

  const hasBreakdown = shipCrewBreakdown && shipCrewBreakdown.length > 0;
  const aggregateTotal = hasBreakdown
    ? shipCrewBreakdown.reduce((sum, ship) => sum + ship.roles.reduce((s, r) => s + r.total, 0), 0)
    : (crewSpotsTotal ?? 0);
  const aggregateFilled = hasBreakdown
    ? shipCrewBreakdown.reduce((sum, ship) => sum + ship.roles.reduce((s, r) => s + r.filled, 0), 0)
    : (crewSpotsFilled ?? 0);
  const aggregatePct = aggregateTotal > 0 ? (aggregateFilled / aggregateTotal) * 100 : 0;

  const ownerName = getOwnerDisplayName(ownerType, organizationName, allianceName);
  const isExpired = expiresAt && new Date(expiresAt) < new Date();
  const accent = getJobTypeColor(jobType, theme);
  const crewFull = aggregateTotal > 0 && aggregateFilled >= aggregateTotal;
  /** Uncapped = no total crew defined and no breakdown → ad-hoc joining */
  const isUncapped = !crewSpotsTotal && !hasBreakdown;
  const hasShipReqs =
    shipRequirementType &&
    shipRequirementType !== 'none' &&
    requiredShips &&
    requiredShips.length > 0;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: theme.palette.background.default,
            color: theme.palette.common.white,
            border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
            borderRadius: 3,
            backgroundImage: 'none',
          },
        },
      }}
    >
      {/* Color accent bar */}
      <Box
        sx={{
          height: 4,
          background: `linear-gradient(90deg, ${accent} 0%, ${alpha(accent, 0.27)} 100%)`,
        }}
      />

      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
          {/* Logo/Icon */}
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              bgcolor: alpha(accent, 0.09),
              border: `2px solid ${alpha(accent, 0.27)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {organizationLogoUrl ? (
              <img
                src={sanitizeImageUrl(organizationLogoUrl)}
                alt={`${ownerName} logo`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Typography sx={{ fontSize: '1.6rem' }}>{getJobTypeIcon(jobType)}</Typography>
            )}
          </Box>
          <Stack direction="column" spacing={0.3} sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '1.2rem',
                color: theme.palette.common.white,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: theme.palette.text.secondary }}>
              {getOwnerIcon(ownerType)}
              {ownerName || 'Unknown'}
            </Typography>
          </Stack>
          <IconButton
            onClick={onClose}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': { color: theme.palette.common.white },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.06) }} />

      <DialogContent sx={{ py: 3 }}>
        <Stack direction="column" spacing={3}>
          {/* Status Badges */}
          <StatusBadges
            listingCategory={listingCategory}
            jobType={jobType}
            focus={focus}
            accent={accent}
            isExpired={isExpired}
            crewFull={crewFull}
          />

          {/* Description */}
          {description && (
            <Box
              sx={{
                bgcolor: theme.palette.background.paper,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                p: 2.5,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  color: theme.palette.common.white,
                  mb: 1,
                  fontSize: '0.9rem',
                }}
              >
                Description
              </Typography>
              <Typography
                sx={{
                  whiteSpace: 'pre-wrap',
                  color: theme.palette.text.primary,
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                }}
              >
                {description}
              </Typography>
            </Box>
          )}

          {/* Crew Section — aggregate bar + per-ship breakdown + unadded ship placeholders */}
          {(aggregateTotal > 0 || (hasShipReqs && requiredShips && requiredShips.length > 0)) && (
            <CrewSection
              aggregateTotal={aggregateTotal}
              aggregateFilled={aggregateFilled}
              aggregatePct={aggregatePct}
              hasBreakdown={!!hasBreakdown}
              shipCrewBreakdown={shipCrewBreakdown}
              requiredShips={requiredShips}
              shipRequirementType={shipRequirementType}
            />
          )}

          {/* Fleet Stats — Total SCU and Average QF */}
          {hasBreakdown && (job.totalScu || job.averageQuantumFuel) ? (
            <FleetStatsBar
              totalScu={job.totalScu ?? 0}
              averageQuantumFuel={job.averageQuantumFuel ?? 0}
              shipBreakdown={shipCrewBreakdown}
            />
          ) : null}

          {/* Required Ships Section */}
          {hasShipReqs && (
            <RequiredShipsSection
              shipRequirementType={shipRequirementType}
              requiredShips={requiredShips}
            />
          )}

          {/* Approved Vehicles Section */}
          {job.approvedVehicles && job.approvedVehicles.length > 0 && (
            <ApprovedVehiclesSection vehicles={job.approvedVehicles} />
          )}

          {/* Job Details + Languages + Tags */}
          <JobDetailsSection
            payDisplay={payDisplay}
            payType={payType}
            experienceLevel={experienceLevel}
            timezone={timezone}
            postedAt={postedAt}
            expiresAt={expiresAt}
            isExpired={isExpired ?? false}
            contactInfo={contactInfo}
            languages={languages}
            tags={tags}
          />

          {/* Applications Panel — visible to listing owner */}
          {isListingOwner && <JobApplicationsPanel jobId={job.id} />}
        </Stack>
      </DialogContent>

      <Divider sx={{ borderColor: alpha(theme.palette.common.white, 0.06) }} />

      {/* ── Application section ───────────────────────────────────── */}
      <Box sx={{ px: 3, pt: 2 }}>
        <ApplicationStatusBar
          applyError={applyError}
          applySuccess={applySuccess}
          myApplication={myApplication}
          applyLoading={applyLoading}
          onWithdraw={handleWithdraw}
        />

        {/* Apply controls — only show if no active application and listing isn't expired */}
        {!myApplication && !isExpired && (
          <SignInGate
            actionLabel="apply"
            description="You need to be logged in to apply for this listing. Sign in to submit your application."
          >
            <ApplyInputFields
              applyMessage={applyMessage}
              vehicleName={vehicleName}
              onMessageChange={setApplyMessage}
              onVehicleChange={setVehicleName}
              questions={orgQuestions}
              formResponses={formResponses}
              onFormResponseChange={(qId, val) =>
                setFormResponses(prev => ({ ...prev, [qId]: val }))
              }
            />
          </SignInGate>
        )}
      </Box>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            color: theme.palette.text.secondary,
            borderColor: alpha(theme.palette.common.white, 0.12),
            textTransform: 'none',
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              bgcolor: theme.palette.background.paper,
            },
          }}
        >
          Close
        </Button>

        {/* Cancel listing — only visible to listing owner */}
        {isListingOwner && !isExpired && (
          <CancelListingButton jobId={job.id} onCancelled={onClose} onError={setApplyError} />
        )}

        {/* Apply buttons — differ based on capped vs uncapped */}
        {isAuthenticated && !myApplication && !isExpired && (
          <>
            {isUncapped ? (
              <UncappedApplyButtons
                applyLoading={applyLoading}
                vehicleName={vehicleName}
                onApply={handleApply}
              />
            ) : (
              <CappedApplyButtons
                applyLoading={applyLoading}
                crewFull={crewFull}
                vehicleName={vehicleName}
                onApply={handleApply}
              />
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
