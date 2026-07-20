import {
  AccessTime as DurationIcon,
  Event as EventIcon,
  Groups as GroupsIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  RocketLaunch as ShipIcon,
} from '@mui/icons-material';
import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import {
  getActivityStatusConfig,
  getActivityTypeConfig,
  type ActivityCardData,
} from '@sc-fleet-manager/shared-types';

import { renderActivityStatusIcon, renderActivityTypeIcon } from '@/utils/activityIcons';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx } from '@/utils/statusStyles';
import { ShipCrewSection, pluralSuffix } from './ShipCrewSection';
import './UnifiedActivityCard.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    if (absDays < 30)
      return `In ${Math.floor(absDays / 7)} week${pluralSuffix(Math.floor(absDays / 7))}`;
    return `In ${Math.floor(absDays / 30)} month${pluralSuffix(Math.floor(absDays / 30))}`;
  }
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} week${pluralSuffix(Math.floor(diffDays / 7))} ago`;
  if (diffDays < 365)
    return `${Math.floor(diffDays / 30)} month${pluralSuffix(Math.floor(diffDays / 30))} ago`;
  return `${Math.floor(diffDays / 365)} year${pluralSuffix(Math.floor(diffDays / 365))} ago`;
}

function formatDate(dateString?: string | Date): string | null {
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

// ---------------------------------------------------------------------------
// Derived data helpers (extracted to reduce cognitive complexity)
// ---------------------------------------------------------------------------

function resolveSubtitle(data: ActivityCardData, typeLabel: string): string {
  if (data.organizationName) return data.organizationName;
  if (data.creatorName) return data.creatorName;
  if (data.visibility) {
    return `${data.visibility.charAt(0).toUpperCase()}${data.visibility.slice(1)} ${typeLabel}`;
  }
  return typeLabel;
}

function resolveUnaddedShips(data: ActivityCardData): string[] {
  if (!data.shipRequirementType || data.shipRequirementType === 'none' || !data.requiredShips) {
    return [];
  }
  const breakdownNames = new Set((data.shipCrewBreakdown ?? []).map(s => s.shipName.toLowerCase()));
  return data.requiredShips.filter(name => !breakdownNames.has(name.toLowerCase()));
}

function isWithinDays(dateInput: string | Date, days: number): boolean {
  const ts = new Date(dateInput).getTime();
  return ts - Date.now() < days * 24 * 60 * 60 * 1000 && ts > Date.now();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface UnifiedActivityCardProps {
  /** Normalized card data (converted via activityCardAdapter) */
  data: ActivityCardData;
  /** Click handler — receives the item id */
  onClick?: (id: string) => void;
  /** Compact mode — hides description, tags, pay/experience details */
  compact?: boolean;
}

/**
 * UnifiedActivityCard — single card component for all activity types
 * including job listings, LFG posts, events, and operations.
 *
 * Adapts rendering based on the `type` field:
 * - job_listing/recruitment: shows ship crew breakdown, pay, experience
 * - lfg: shows participant bar
 * - event/operation/mission: shows date, location, participant bar
 *
 * Supersedes both ActivityCard and PublicJobCard.
 */
export const UnifiedActivityCard: React.FC<Readonly<UnifiedActivityCardProps>> = ({
  data,
  onClick,
  compact = false,
}) => {
  const theme = useTheme();
  const typeCfg = getActivityTypeConfig(data.type);
  const statusCfg = getActivityStatusConfig(data.status);
  const accent = typeCfg.color;

  // Date handling
  const effectiveStartDate = data.startDate;
  const duration = formatDuration(data.estimatedDuration);

  // Participants
  const currentParticipants = data.currentParticipants ?? 0;
  const maxParticipants = data.maxParticipants ?? 0;
  const openSlots = maxParticipants - currentParticipants;
  const participantsPct = maxParticipants > 0 ? (currentParticipants / maxParticipants) * 100 : 0;

  // Ship crew breakdown (from job listings / recruitment)
  const hasCrewBreakdown = data.shipCrewBreakdown && data.shipCrewBreakdown.length > 0;
  const crewTotal = data.crewSpotsTotal ?? 0;
  const crewFilled = data.crewSpotsFilled ?? 0;
  const crewOpen = crewTotal - crewFilled;
  const crewPct = crewTotal > 0 ? (crewFilled / crewTotal) * 100 : 0;

  const isStartingSoon = effectiveStartDate ? isWithinDays(effectiveStartDate, 7) : false;
  const isExpiringSoon = data.expiresAt ? isWithinDays(data.expiresAt, 7) : false;
  const subtitle = resolveSubtitle(data, typeCfg.label);
  const unaddedRequiredShips = resolveUnaddedShips(data);

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
      onClick={() => onClick?.(data.id)}
    >
      {/* Accent bar */}
      <Box
        sx={{
          height: 4,
          background: `linear-gradient(90deg, ${accent} 0%, ${alpha(accent, 0.27)} 100%)`,
          flexShrink: 0,
        }}
      />

      {/* Main content */}
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
        {/* Header: logo/icon, title, subtitle */}
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
            {data.organizationLogoUrl ? (
              <img
                src={sanitizeImageUrl(data.organizationLogoUrl)}
                alt={`${data.organizationName ?? 'Organization'} logo`}
                className="unified-card__logo-img"
              />
            ) : (
              renderActivityTypeIcon(data.type, { sx: { fontSize: '1.3rem', color: accent } })
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
                {data.title}
              </Typography>
              {isStartingSoon && (
                <Tooltip title="Starting soon">
                  <ScheduleIcon
                    sx={{ fontSize: 16, color: theme.palette.warning.main, flexShrink: 0 }}
                  />
                </Tooltip>
              )}
              {isExpiringSoon && !isStartingSoon && (
                <Tooltip title="Expires soon">
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

        {/* Type + Status badges */}
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          <Chip
            icon={renderActivityTypeIcon(data.type, { sx: { fontSize: 14 } })}
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
            icon={renderActivityStatusIcon(data.status, { sx: { fontSize: 14 } })}
            label={statusCfg.label}
            size="small"
            sx={{
              ...getStatusChipSx(data.status, theme),
              fontWeight: 600,
              fontSize: '0.72rem',
              height: 24,
            }}
          />
          {data.visibility && (
            <Chip
              label={data.visibility.charAt(0).toUpperCase() + data.visibility.slice(1)}
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
        {data.description && !compact && (
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
            {data.description}
          </Typography>
        )}

        {/* Date / Time / Duration */}
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
        {data.location && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1.5 }}>
            <LocationIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
            <Typography
              sx={{ fontSize: '0.82rem', color: theme.palette.text.primary, fontWeight: 500 }}
            >
              {data.location}
            </Typography>
          </Stack>
        )}

        {/* Pay / Experience (job_listing, recruitment) */}
        {(data.payDisplay || data.experienceLevel !== undefined) && !compact && (
          <Stack direction="row" spacing={2.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
            {data.payDisplay && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <MoneyIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    color: theme.palette.text.primary,
                    fontWeight: 500,
                  }}
                >
                  {data.payDisplay}
                </Typography>
              </Stack>
            )}
            {data.experienceLevel !== undefined && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PersonIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.primary }}>
                  {getExperienceLevelLabel(data.experienceLevel)}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}

        {/* Ship Crew Breakdown (job_listing / recruitment with crew data) */}
        {hasCrewBreakdown && !compact && (
          <ShipCrewSection breakdown={data.shipCrewBreakdown!} maxShipsShown={2} />
        )}

        {/* Aggregate crew bar (when no per-ship breakdown but crewSpotsTotal exists) */}
        {!hasCrewBreakdown && crewTotal > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <GroupsIcon
                sx={{
                  fontSize: 16,
                  color: crewOpen > 0 ? theme.palette.info.light : theme.palette.warning.main,
                }}
              />
              <Typography
                sx={{ fontSize: '0.78rem', color: theme.palette.text.primary, fontWeight: 600 }}
              >
                {crewOpen > 0 ? `${crewOpen} Open Position${pluralSuffix(crewOpen)}` : 'Crew Full'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: theme.palette.text.secondary,
                  ml: 'auto !important',
                }}
              >
                {crewFilled}/{crewTotal} filled
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(crewPct, 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.common.white, 0.06),
                '& .MuiLinearProgress-bar': {
                  bgcolor:
                    crewFilled >= crewTotal ? theme.palette.warning.main : theme.palette.info.light,
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        )}

        {/* Required ships (when no breakdown but required ships specified) */}
        {unaddedRequiredShips.length > 0 && !compact && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {unaddedRequiredShips.slice(0, 4).map(name => (
              <Chip
                key={name}
                icon={<ShipIcon sx={{ fontSize: 12 }} />}
                label={name}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.warning.main, 0.09),
                  color: theme.palette.warning.main,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.27)}`,
                  '& .MuiChip-icon': { color: theme.palette.warning.main },
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            ))}
            {unaddedRequiredShips.length > 4 && (
              <Chip
                label={`+${unaddedRequiredShips.length - 4} more`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.secondary,
                }}
              />
            )}
          </Stack>
        )}

        {/* Participants bar (activities without per-ship crew breakdown) */}
        {!hasCrewBreakdown && crewTotal === 0 && maxParticipants > 0 && (
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

        {/* Tags */}
        {data.tags && data.tags.length > 0 && !compact && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {data.tags.slice(0, 3).map(tag => (
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
            {data.tags.length > 3 && (
              <Chip
                label={`+${data.tags.length - 3}`}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  color: theme.palette.text.secondary,
                  fontSize: '0.68rem',
                  height: 20,
                }}
              />
            )}
          </Stack>
        )}

        {/* Languages */}
        {data.languages && data.languages.length > 0 && !compact && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {data.languages.slice(0, 3).map(lang => (
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

        {/* Footer */}
        <Typography
          sx={{ fontSize: '0.72rem', color: theme.palette.text.disabled, textAlign: 'center' }}
        >
          {effectiveStartDate
            ? `Starts ${formatRelativeTime(effectiveStartDate)}`
            : `Posted ${formatRelativeTime(data.postedAt)}`}
        </Typography>
      </Box>
    </Box>
  );
};
