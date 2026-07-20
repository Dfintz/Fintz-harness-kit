import {
  Build as BuildIcon,
  Schedule as ClockIcon,
  Groups as CrewIcon,
  FlightTakeoff as FlightTakeoffIcon,
  Handshake as HandshakeIcon,
  Inventory2 as Inventory2Icon,
  LocalOffer as LocalOfferIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  RocketLaunch as ShipIcon,
  DirectionsCar as VehicleIcon,
} from '@mui/icons-material';
import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import './PublicJobCard.css';

import { getActivityStatusConfig } from '@sc-fleet-manager/shared-types';

import type { JobType, PublicJobListItem } from '@/services/publicDirectoryService';
import {
  getExperienceLevelLabel,
  getFocusIcon,
  getFocusLabel,
  getJobTypeIcon,
  getJobTypeLabel,
} from '@/services/publicDirectoryService';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx } from '@/utils/statusStyles';

export interface PublicJobCardProps {
  /** Job listing data */
  job: PublicJobListItem;
  /** Click handler for viewing job details */
  onBoxDetails?: (jobId: string) => void;
  /** Whether to show compact view */
  compact?: boolean;
}

/** Returns 's' for plural counts, '' for singular */
function pluralSuffix(count: number): string {
  return count > 1 ? 's' : '';
}

/**
 * Get accent color for job type
 */
function getJobTypeColor(type: JobType): string {
  const colors: Record<JobType, string> = {
    crew: '#8b949e',
    pilot: '#3b82f6',
    gunner: '#ef4444',
    engineer: '#f59e0b',
    medic: '#06b6d4',
    miner: '#d97706',
    hauler: '#8b5cf6',
    scout: '#6366f1',
    security: '#10b981',
    leadership: '#ec4899',
    support: '#14b8a6',
    other: '#6b7280',
  };
  return colors[type] || '#6b7280';
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

/**
 * PublicJobCard - Dark-themed job listing card with per-ship crew breakdown
 *
 * Features per-ship progress bars with role-based crew positions.
 * Total crew bar aggregates all ships. Same fixed height for uniform grid.
 */
export const PublicJobCard: React.FC<PublicJobCardProps> = ({
  job,
  onBoxDetails,
  compact = false,
}) => {
  const theme = useTheme();
  const {
    id,
    organizationName,
    organizationLogoUrl,
    allianceName,
    ownerType,
    listingCategory,
    title,
    description,
    jobType,
    focus,
    payDisplay,
    experienceLevel,
    postedAt,
    expiresAt,
    languages,
    tags,
    isActive,
    crewSpotsTotal,
    crewSpotsFilled,
    requiredShips,
    shipRequirementType,
    shipCrewBreakdown,
    approvedVehicles,
  } = job;

  const accent = getJobTypeColor(jobType);

  // Derive display status from isActive + expiresAt
  const derivedStatus = isActive ? 'open' : 'expired';
  const statusCfg = getActivityStatusConfig(derivedStatus);

  // Resolve owner display name
  let ownerName: string | undefined;
  if (ownerType === 'organization') {
    ownerName = organizationName;
  } else if (ownerType === 'alliance') {
    ownerName = allianceName;
  } else {
    ownerName = 'Individual';
  }

  // Resolve owner prefix icon
  let ownerPrefixIcon: React.ReactNode = null;
  if (ownerType === 'alliance') {
    ownerPrefixIcon = <HandshakeIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />;
  } else if (ownerType === 'user') {
    ownerPrefixIcon = <PersonIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />;
  }

  const isExpiringSoon =
    expiresAt && new Date(expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  // Compute aggregate crew from breakdown (if available) or fall back to crewSpotsTotal/Filled
  const hasBreakdown = shipCrewBreakdown && shipCrewBreakdown.length > 0;
  const aggregateTotal = hasBreakdown
    ? shipCrewBreakdown.reduce((sum, ship) => sum + ship.roles.reduce((s, r) => s + r.total, 0), 0)
    : (crewSpotsTotal ?? 0);
  const aggregateFilled = hasBreakdown
    ? shipCrewBreakdown.reduce((sum, ship) => sum + ship.roles.reduce((s, r) => s + r.filled, 0), 0)
    : (crewSpotsFilled ?? 0);
  const aggregatePct = aggregateTotal > 0 ? (aggregateFilled / aggregateTotal) * 100 : 0;

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, 0.12),
        overflow: 'hidden',
        transition: theme.transitions.create('all', { duration: 250 }),
        cursor: onBoxDetails ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        '&:hover': {
          borderColor: alpha(accent, 0.53),
          boxShadow: `0 4px 24px ${alpha(accent, 0.13)}`,
          transform: 'translateY(-2px)',
        },
      }}
      onClick={() => onBoxDetails?.(id)}
    >
      {/* ── Color accent bar at top ── */}
      <Box
        sx={{
          height: 4,
          background: `linear-gradient(90deg, ${accent} 0%, ${alpha(accent, 0.27)} 100%)`,
          flexShrink: 0,
        }}
      />

      {/* ── Main Content ── */}
      <Box
        sx={{
          px: 2.5,
          pt: 2,
          pb: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Header: Logo, Title, Type Badge */}
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
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
                className="public-job-card__logo-img"
              />
            ) : (
              <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>
                {getJobTypeIcon(jobType)}
              </Typography>
            )}
          </Box>

          <Stack direction="column" flex={1} spacing={0.3} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: theme.palette.common.white,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </Typography>
              {isExpiringSoon && (
                <Tooltip title="Expires soon">
                  <ClockIcon
                    sx={{ fontSize: 16, color: theme.palette.warning.main, flexShrink: 0 }}
                  />
                </Tooltip>
              )}
            </Stack>
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: theme.palette.text.secondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ownerPrefixIcon}
              {ownerName || 'Unknown'}
            </Typography>
          </Stack>
        </Stack>

        {/* Type, Focus, and Category Badges */}
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          {listingCategory === 'service' && (
            <Chip
              icon={<BuildIcon sx={{ fontSize: 12 }} />}
              label="Service"
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.secondary.main, 0.15),
                color: theme.palette.secondary.light,
                fontWeight: 600,
                fontSize: '0.72rem',
                height: 24,
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
            size="small"
            sx={{
              bgcolor: alpha(accent, 0.13),
              color: accent,
              fontWeight: 600,
              fontSize: '0.72rem',
              height: 24,
              border: `1px solid ${alpha(accent, 0.27)}`,
            }}
          />
          <Chip
            label={
              <>
                {getFocusIcon(focus)} {getFocusLabel(focus)}
              </>
            }
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.common.white, 0.06),
              color: theme.palette.text.primary,
              fontSize: '0.72rem',
              height: 24,
              border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
            }}
          />
          <Chip
            label={`${statusCfg.emoji} ${statusCfg.label}`}
            size="small"
            sx={{
              ...getStatusChipSx(derivedStatus, theme),
              fontWeight: 600,
              fontSize: '0.72rem',
              height: 24,
            }}
          />
        </Stack>

        {/* Description */}
        {description && !compact && (
          <Typography
            sx={{
              color: theme.palette.text.primary,
              fontSize: '0.83rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
              mb: 1.5,
            }}
          >
            {description}
          </Typography>
        )}

        {/* Stats Row */}
        <Stack direction="row" spacing={2.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <MoneyIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
            <Typography
              sx={{ fontSize: '0.82rem', color: theme.palette.text.primary, fontWeight: 500 }}
            >
              {payDisplay}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <PersonIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
            <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.primary }}>
              {getExperienceLevelLabel(experienceLevel)}
            </Typography>
          </Stack>
        </Stack>

        {/* ── Open Positions Summary ── */}
        {aggregateTotal > 0 &&
          (() => {
            const openSlots = aggregateTotal - aggregateFilled;
            // Ships that still have open roles
            const openShips = hasBreakdown
              ? shipCrewBreakdown.filter(s => {
                  const shipFilled = s.roles.reduce((sum, r) => sum + r.filled, 0);
                  const shipTotal = s.roles.reduce((sum, r) => sum + r.total, 0);
                  return shipFilled < shipTotal;
                })
              : [];
            // Unique ship names needed
            const uniqueShipNames = [...new Set(openShips.map(s => s.shipName))];

            // Required ships not yet in the breakdown
            const addedShipNamesLower = new Set(
              (shipCrewBreakdown ?? []).map(s => s.shipName.toLowerCase())
            );
            const unaddedReqShips =
              shipRequirementType && shipRequirementType !== 'none' && requiredShips
                ? requiredShips.filter(name => !addedShipNamesLower.has(name.toLowerCase()))
                : [];

            return (
              <Box sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <CrewIcon
                    sx={{
                      fontSize: 16,
                      color: openSlots > 0 ? theme.palette.info.light : theme.palette.warning.main,
                    }}
                  />
                  <Typography
                    sx={{ fontSize: '0.78rem', color: theme.palette.text.primary, fontWeight: 600 }}
                  >
                    {openSlots > 0
                      ? `${openSlots} Open Position${pluralSuffix(openSlots)}`
                      : 'Crew Full'}
                  </Typography>
                  {hasBreakdown && openShips.length > 0 && (
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: theme.palette.text.secondary,
                        ml: 'auto !important',
                      }}
                    >
                      {openShips.length} ship{openShips.length > 1 ? 's' : ''} need crew
                    </Typography>
                  )}
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={aggregatePct}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.common.white, 0.06),
                    mb:
                      (hasBreakdown && uniqueShipNames.length > 0) || unaddedReqShips.length > 0
                        ? 1
                        : 0,
                    '& .MuiLinearProgress-bar': {
                      bgcolor:
                        aggregateFilled >= aggregateTotal
                          ? theme.palette.warning.main
                          : theme.palette.info.light,
                      borderRadius: 3,
                    },
                  }}
                />
                {/* List ships that need crew */}
                {(hasBreakdown && uniqueShipNames.length > 0) || unaddedReqShips.length > 0 ? (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {uniqueShipNames.slice(0, 4).map(name => {
                      const shipEntries = openShips.filter(s => s.shipName === name);
                      const openCount = shipEntries
                        .flatMap(s => s.roles)
                        .reduce((sum, r) => sum + (r.total - r.filled), 0);
                      const hasLoaner = shipEntries.some(s => s.isLoaner);
                      const hasTransported = shipEntries.some(s => s.isTransported);
                      const isHangar = shipEntries.some(s => s.transportType === 'hangar');
                      return (
                        <Chip
                          key={name}
                          icon={<ShipIcon sx={{ fontSize: 12 }} />}
                          label={
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={0.3}
                              component="span"
                            >
                              <span>{name}</span>
                              {hasLoaner && <LocalOfferIcon sx={{ fontSize: 10 }} />}
                              {hasTransported &&
                                (isHangar ? (
                                  <FlightTakeoffIcon sx={{ fontSize: 10 }} />
                                ) : (
                                  <Inventory2Icon sx={{ fontSize: 10 }} />
                                ))}
                              <span>{` ×${openCount}`}</span>
                            </Stack>
                          }
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: theme.palette.background.default,
                            color: theme.palette.text.secondary,
                            border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                            '& .MuiChip-icon': { color: theme.palette.info.light },
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      );
                    })}
                    {uniqueShipNames.length > 4 && (
                      <Chip
                        label={`+${uniqueShipNames.length - 4} more`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          bgcolor: alpha(theme.palette.common.white, 0.06),
                          color: theme.palette.text.secondary,
                          border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                        }}
                      />
                    )}
                    {/* Required ships not yet added — dotted chip placeholders */}
                    {unaddedReqShips.map(name => (
                      <Chip
                        key={`unadded-${name}`}
                        icon={<ShipIcon sx={{ fontSize: 12 }} />}
                        label={`${name} — Add Ship`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          bgcolor: 'transparent',
                          color: theme.palette.text.disabled,
                          border: `1px dashed ${alpha(theme.palette.common.white, 0.12)}`,
                          '& .MuiChip-icon': { color: theme.palette.text.disabled },
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    ))}
                  </Stack>
                ) : null}
              </Box>
            );
          })()}

        {/* Per-ship crew breakdown is shown in the detail modal */}

        {/* ── Approved Vehicles ── */}
        {approvedVehicles && approvedVehicles.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <VehicleIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
              <Typography
                sx={{ fontSize: '0.78rem', color: theme.palette.text.primary, fontWeight: 600 }}
              >
                {approvedVehicles.length} Vehicle{pluralSuffix(approvedVehicles.length)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {approvedVehicles.slice(0, 4).map(v => (
                <Chip
                  key={v.applicationId}
                  icon={<ShipIcon sx={{ fontSize: 12 }} />}
                  label={`${v.vehicleName} — ${v.applicantDisplayName}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.light,
                    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                    '& .MuiChip-icon': { color: theme.palette.success.light },
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              ))}
              {approvedVehicles.length > 4 && (
                <Chip
                  label={`+${approvedVehicles.length - 4} more`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: alpha(theme.palette.success.main, 0.06),
                    color: theme.palette.success.light,
                    border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                  }}
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && !compact && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {tags.slice(0, 3).map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.secondary,
                  fontSize: '0.68rem',
                  height: 20,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                }}
              />
            ))}
            {tags.length > 3 && (
              <Chip
                label={`+${tags.length - 3}`}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.secondary,
                  fontSize: '0.68rem',
                  height: 20,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                }}
              />
            )}
          </Stack>
        )}

        {/* Languages */}
        {languages && languages.length > 0 && !compact && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {languages.slice(0, 3).map(lang => (
              <Chip
                key={lang}
                label={lang.toUpperCase()}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.secondary,
                  fontSize: '0.65rem',
                  height: 18,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                }}
              />
            ))}
          </Stack>
        )}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Divider */}
        <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.common.white, 0.06)}`, mb: 1.5 }} />

        {/* Posted date */}
        <Typography
          sx={{ fontSize: '0.72rem', color: theme.palette.text.disabled, textAlign: 'center' }}
        >
          Posted {formatRelativeTime(postedAt)}
        </Typography>
      </Box>
    </Box>
  );
};
