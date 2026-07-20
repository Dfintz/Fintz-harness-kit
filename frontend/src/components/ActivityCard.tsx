import {
  AttachMoney,
  BarChart,
  Widgets as CargoIcon,
  AccessTime as DurationIcon,
  Event as EventIcon,
  LocalGasStation as FuelIcon,
  Groups as GroupsIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  DirectionsBoat as ShipIcon,
} from '@mui/icons-material';
import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React from 'react';

import type { ShipRequirement, ShipRequirementType } from '@sc-fleet-manager/shared-types';
import { getActivityStatusConfig, getActivityTypeConfig } from '@sc-fleet-manager/shared-types';

import type { ActivityV2 } from '@/types/apiV2';
import { renderActivityStatusIcon, renderActivityTypeIcon } from '@/utils/activityIcons';
import { getStatusChipSx } from '@/utils/statusStyles';

export interface ActivityCardProps {
  /** Activity data */
  activity: ActivityV2;
  /** Click handler for viewing activity details */
  onClick?: (activityId: string) => void;
  /** Whether to show compact view */
  compact?: boolean;
}

/** Returns 's' for plural counts, '' for singular */
function pluralSuffix(count: number): string {
  return count > 1 ? 's' : '';
}

/** Get display name for a ship requirement entry */
function getShipRequirementLabel(req: ShipRequirement): string {
  return req.requirementType === 'specific' ? req.shipName : req.role;
}

/** Get unique key for a ship requirement entry */
function getShipRequirementKey(req: ShipRequirement): string {
  return `${req.requirementType}-${getShipRequirementLabel(req)}`;
}

function formatRelativeTime(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return 'Today';
    if (absDays === 1) return 'Tomorrow';
    if (absDays < 7) return `In ${absDays} days`;
    if (absDays < 30) return `In ${Math.floor(absDays / 7)} weeks`;
    return `In ${Math.floor(absDays / 30)} months`;
  }
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatDate(dateString?: string): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getExperienceLevelLabel(level?: number | string): string | null {
  if (level === undefined || level === null) return null;
  const n = Number(level);
  if (Number.isNaN(n)) return String(level);
  if (n <= 1) return 'Beginner';
  if (n <= 2) return 'Intermediate';
  if (n <= 3) return 'Advanced';
  return 'Expert';
}

/** Resolve effective duration from estimatedDuration or start/end dates. */
function resolveDuration(
  estimatedDuration?: number,
  startDate?: string,
  endDate?: string
): string | null {
  if (estimatedDuration) return formatDuration(estimatedDuration);
  if (startDate && endDate) {
    const diffMinutes = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000
    );
    return formatDuration(diffMinutes);
  }
  return null;
}

/** Resolve subtitle: org name > visibility label > default. */
function resolveSubtitle(orgName?: string, visibility?: string): string {
  if (orgName) return orgName;
  if (visibility) {
    return `${visibility.charAt(0).toUpperCase()}${visibility.slice(1)} Activity`;
  }
  return 'Activity';
}

// ── Sub-components (extracted to reduce cognitive complexity) ──

interface ShipRequirementsSectionProps {
  readonly shipReqType: ShipRequirementType;
  readonly requiredShips: ShipRequirement[];
  readonly totalShipsNeeded: number;
  readonly theme: Theme;
}

/** Renders the required/preferred ships section with chips. */
const ShipRequirementsSection: React.FC<ShipRequirementsSectionProps> = ({
  shipReqType,
  requiredShips,
  totalShipsNeeded,
  theme,
}) => (
  <Box
    sx={{
      mb: 1.5,
      p: 1,
      borderRadius: 1,
      bgcolor: alpha(theme.palette.info.main, 0.04),
      border: `1px solid ${alpha(theme.palette.info.main, 0.13)}`,
    }}
  >
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
      <ShipIcon sx={{ fontSize: 16, color: theme.palette.info.light }} />
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: theme.palette.common.white }}>
        {shipReqType === 'required' ? 'Required' : 'Preferred'} Ships
      </Typography>
      <Typography
        sx={{
          fontSize: '0.72rem',
          color: theme.palette.text.secondary,
          ml: 'auto !important',
        }}
      >
        {totalShipsNeeded} needed
      </Typography>
    </Stack>
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
      {requiredShips.slice(0, 3).map(req => (
        <Chip
          key={getShipRequirementKey(req)}
          label={`${req.count}× ${getShipRequirementLabel(req)}`}
          size="small"
          sx={{
            bgcolor: alpha(theme.palette.info.main, 0.1),
            color: theme.palette.info.light,
            fontSize: '0.68rem',
            height: 20,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}
        />
      ))}
      {requiredShips.length > 3 && (
        <Chip
          label={`+${requiredShips.length - 3}`}
          size="small"
          sx={{
            bgcolor: alpha(theme.palette.info.main, 0.06),
            color: theme.palette.text.secondary,
            fontSize: '0.68rem',
            height: 20,
          }}
        />
      )}
    </Stack>
  </Box>
);

interface FleetLogisticsSectionProps {
  readonly totalScu?: number | null;
  readonly avgQuantumFuel?: number;
  readonly hasRefuelShip: boolean;
  readonly theme: Theme;
}

/** Renders fleet logistics row: total SCU, average quantum fuel, refuel indicator. */
const FleetLogisticsSection: React.FC<FleetLogisticsSectionProps> = ({
  totalScu,
  avgQuantumFuel,
  hasRefuelShip,
  theme,
}) => (
  <Stack
    direction="row"
    spacing={1.5}
    alignItems="center"
    sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}
  >
    {totalScu != null && totalScu > 0 && (
      <Tooltip title="Total cargo capacity across all ships">
        <Stack direction="row" spacing={0.3} alignItems="center">
          <CargoIcon sx={{ fontSize: 14, color: theme.palette.warning.light }} />
          <Typography
            sx={{ fontSize: '0.76rem', color: theme.palette.warning.light, fontWeight: 500 }}
          >
            {totalScu.toLocaleString()} SCU
          </Typography>
        </Stack>
      </Tooltip>
    )}
    {avgQuantumFuel != null && (
      <Tooltip title="Average quantum fuel per ship">
        <Stack direction="row" spacing={0.3} alignItems="center">
          <FuelIcon sx={{ fontSize: 14, color: theme.palette.info.light }} />
          <Typography
            sx={{ fontSize: '0.76rem', color: theme.palette.info.light, fontWeight: 500 }}
          >
            ~{Math.round(avgQuantumFuel)} QF avg
          </Typography>
        </Stack>
      </Tooltip>
    )}
    {hasRefuelShip && (
      <Tooltip title="Fleet includes a refueling ship">
        <Chip
          icon={<FuelIcon sx={{ fontSize: 14 }} />}
          label="Refuel"
          size="small"
          sx={{
            bgcolor: alpha(theme.palette.success.main, 0.1),
            color: theme.palette.success.light,
            fontSize: '0.68rem',
            height: 20,
            fontWeight: 600,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
          }}
        />
      </Tooltip>
    )}
  </Stack>
);

/**
 * ActivityCard — dark-themed activity card matching PublicJobCard structure.
 *
 * Layout: accent bar → header (icon / title / subtitle) → badge row →
 * description → date/time → location → pay/experience → tags → participants → footer.
 *
 * Type colors, status colors, and labels are driven by the shared
 * ACTIVITY_TYPE_CONFIG / ACTIVITY_STATUS_CONFIG from @sc-fleet-manager/shared-types.
 */
export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onClick,
  compact = false,
}) => {
  const theme = useTheme();
  const typeCfg = getActivityTypeConfig(activity.type);
  const statusCfg = getActivityStatusConfig(activity.status);
  const accent = typeCfg.color;

  // Resolve date fields — backend may send scheduledStartDate or startDate
  const effectiveStartDate = activity.scheduledStartDate || activity.startDate;
  const effectiveEndDate = activity.scheduledEndDate || activity.endDate;
  const duration = resolveDuration(activity.estimatedDuration, effectiveStartDate, effectiveEndDate);

  const currentParticipants = activity.currentParticipants ?? 0;
  const maxParticipants = activity.maxParticipants ?? 0;
  const openSlots = maxParticipants - currentParticipants;
  const participantsPct = maxParticipants > 0 ? (currentParticipants / maxParticipants) * 100 : 0;

  const isStartingSoon =
    effectiveStartDate &&
    new Date(effectiveStartDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
    new Date(effectiveStartDate).getTime() > Date.now();

  const subtitle = resolveSubtitle(activity.organizationName, activity.visibility);

  type ActivityCardExtras = ActivityV2 & {
    payDisplay?: string;
    experienceLevel?: number | string;
    tags?: string[];
  };
  const activityWithExtras = activity as ActivityCardExtras;
  const payDisplay = activityWithExtras.payDisplay;
  const experienceLevel = activityWithExtras.experienceLevel;
  const tags = activityWithExtras.tags;

  // Ship requirements summary
  const requiredShips = activity.requiredShips;
  const shipReqType = activity.shipRequirementType;
  const hasShipRequirements =
    shipReqType && shipReqType !== 'none' && requiredShips && requiredShips.length > 0;
  const totalShipsNeeded = requiredShips?.reduce((sum, r) => sum + r.count, 0) ?? 0;

  // Fleet logistics
  const totalScu = activity.totalCargoCapacity;
  const totalQFuel = activity.totalQuantumFuel;
  const shipAssignments = activity.shipAssignments;
  const assignedShipCount = shipAssignments?.length ?? 0;
  const avgQuantumFuel =
    assignedShipCount > 0 && totalQFuel ? totalQFuel / assignedShipCount : undefined;
  const hasRefuelShip = activity.hasRefuelShip ?? false;
  const hasFleetLogistics = totalScu != null || avgQuantumFuel != null || hasRefuelShip;

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, 0.12),
        overflow: 'hidden',
        transition: theme.transitions.create('all', { duration: 250 }),
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        '&:hover': {
          borderColor: alpha(accent, 0.53),
          boxShadow: `0 4px 24px ${alpha(accent, 0.13)}`,
          transform: 'translateY(-2px)',
        },
      }}
      onClick={() => onClick?.(activity.id)}
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
        {/* Header: Icon, Title, Subtitle */}
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
            }}
          >
            {renderActivityTypeIcon(activity.type, { sx: { fontSize: '1.3rem', color: accent } })}
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
                {activity.title}
              </Typography>
              {isStartingSoon && (
                <Tooltip title="Starting soon">
                  <ScheduleIcon
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
              {subtitle}
            </Typography>
          </Stack>
        </Stack>

        {/* Type, Status, and Visibility Badges */}
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          <Chip
            icon={renderActivityTypeIcon(activity.type, { sx: { fontSize: 14 } })}
            label={typeCfg.label}
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
            icon={renderActivityStatusIcon(activity.status, { sx: { fontSize: 14 } })}
            label={statusCfg.label}
            size="small"
            sx={{
              ...getStatusChipSx(activity.status, theme),
              fontWeight: 600,
              fontSize: '0.72rem',
              height: 24,
            }}
          />
          {activity.visibility && (
            <Chip
              label={activity.visibility.charAt(0).toUpperCase() + activity.visibility.slice(1)}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.common.white, 0.06),
                color: theme.palette.text.primary,
                fontSize: '0.72rem',
                height: 24,
                border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
              }}
            />
          )}
        </Stack>

        {/* Description */}
        {activity.description && !compact && (
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
            {activity.description}
          </Typography>
        )}

        {/* Date / Time / Duration Row */}
        {effectiveStartDate && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              mb: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: alpha(accent, 0.04),
              border: `1px solid ${alpha(accent, 0.13)}`,
            }}
          >
            <EventIcon sx={{ fontSize: 18, color: accent }} />
            <Typography
              sx={{ fontSize: '0.84rem', color: theme.palette.common.white, fontWeight: 600 }}
            >
              {formatDate(effectiveStartDate)}
            </Typography>
            {duration && (
              <>
                <Box
                  sx={{
                    width: '1px',
                    height: 14,
                    bgcolor: alpha(theme.palette.common.white, 0.12),
                    mx: 0.5,
                  }}
                />
                <DurationIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.primary }}>
                  {duration}
                </Typography>
              </>
            )}
          </Stack>
        )}

        {/* Location */}
        {activity.location && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1.5 }}>
            <LocationIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
            <Typography
              sx={{ fontSize: '0.82rem', color: theme.palette.text.primary, fontWeight: 500 }}
            >
              {activity.location}
            </Typography>
          </Stack>
        )}

        {/* Ship Requirements */}
        {hasShipRequirements && !compact && (
          <ShipRequirementsSection
            shipReqType={shipReqType}
            requiredShips={requiredShips}
            totalShipsNeeded={totalShipsNeeded}
            theme={theme}
          />
        )}

        {/* Fleet Logistics (cargo, fuel, refueling) */}
        {hasFleetLogistics && !compact && (
          <FleetLogisticsSection
            totalScu={totalScu}
            avgQuantumFuel={avgQuantumFuel}
            hasRefuelShip={hasRefuelShip}
            theme={theme}
          />
        )}

        {/* Pay / Experience row — shown when present (e.g. job_listing, recruitment types) */}
        {(payDisplay || experienceLevel !== undefined) && !compact && (
          <Stack direction="row" spacing={2.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
            {payDisplay && (
              <Typography
                sx={{ fontSize: '0.82rem', color: theme.palette.success.light, fontWeight: 500 }}
              >
                <AttachMoney sx={{ fontSize: '0.82rem', verticalAlign: 'middle', mr: 0.3 }} />{payDisplay}
              </Typography>
            )}
            {experienceLevel !== undefined && (
              <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.primary }}>
                <BarChart sx={{ fontSize: '0.82rem', verticalAlign: 'middle', mr: 0.3 }} />{getExperienceLevelLabel(experienceLevel)}
              </Typography>
            )}
          </Stack>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && !compact && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {tags.slice(0, 3).map((tag: string) => (
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

        {/* ── Participants Section ── */}
        {maxParticipants > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <GroupsIcon
                sx={{
                  fontSize: 16,
                  color: openSlots > 0 ? theme.palette.info.light : theme.palette.warning.main,
                }}
              />
              <Typography
                sx={{ fontSize: '0.78rem', color: theme.palette.text.primary, fontWeight: 600 }}
              >
                {openSlots > 0 ? `${openSlots} Open Spot${pluralSuffix(openSlots)}` : 'Crew Full'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: theme.palette.text.secondary,
                  ml: 'auto !important',
                }}
              >
                {currentParticipants}/{maxParticipants} joined
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(participantsPct, 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.common.white, 0.06),
                '& .MuiLinearProgress-bar': {
                  bgcolor:
                    currentParticipants >= maxParticipants
                      ? theme.palette.warning.main
                      : theme.palette.info.light,
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        )}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Divider */}
        <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.common.white, 0.06)}`, mb: 1.5 }} />

        {/* Footer: centered timestamp, matching PublicJobCard */}
        <Typography
          sx={{ fontSize: '0.72rem', color: theme.palette.text.disabled, textAlign: 'center' }}
        >
          {effectiveStartDate
            ? `Starts ${formatRelativeTime(effectiveStartDate)}`
            : `Created ${formatRelativeTime(activity.createdAt)}`}
        </Typography>
      </Box>
    </Box>
  );
};
