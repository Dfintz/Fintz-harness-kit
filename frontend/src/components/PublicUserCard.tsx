/**
 * PublicUserCard — Card component for displaying a user in search results and directories.
 *
 * Visually consistent with PublicOrgCard. Shows avatar, display name, username,
 * RSI verification status, bio, and optional metadata (org, ship count, join date).
 */

import { sanitizeImageUrl } from '@/utils/sanitize';
import {
  CalendarMonth as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Groups as OrgIcon,
  Public as PublicIcon,
  RocketLaunch as ShipIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { Avatar, Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Organization membership for public display */
export interface PublicUserOrgMembership {
  orgId: string;
  orgName: string;
  orgLogo?: string;
  roleName: string;
}

/** Lightweight user data for public display in cards */
export interface PublicUserInfo {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  createdAt?: string;
  rsiHandle?: string;
  rsiVerified?: boolean;
  shipCount?: number;
  organizationName?: string;
  organizations?: PublicUserOrgMembership[];
}

export interface PublicUserCardProps {
  /** User data */
  user: PublicUserInfo;
  /** Click handler to view full profile — receives the user ID */
  onViewProfile?: (userId: string) => void;
  /** Whether to show compact view */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserAccentColor(theme: Theme): string {
  return theme.palette.primary.main;
}

function getBannerGradient(theme: Theme): string {
  const accent = getUserAccentColor(theme);
  return `linear-gradient(135deg, ${accent}33 0%, ${theme.palette.background.default} 60%, ${accent}22 100%)`;
}

function getInitials(user: PublicUserInfo): string {
  const name = user.displayName || user.username;
  return name.charAt(0).toUpperCase();
}

function formatJoinDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function handleCardKeyDown(
  event: React.KeyboardEvent,
  onViewProfile: ((userId: string) => void) | undefined,
  userId: string
): void {
  if (onViewProfile && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    onViewProfile(userId);
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const RsiVerifiedBadge: React.FC<Readonly<{ theme: Theme }>> = ({ theme }) => (
  <Chip
    icon={
      <CheckCircleIcon sx={{ fontSize: 14, color: `${theme.palette.success.light} !important` }} />
    }
    label="RSI Verified"
    size="small"
    sx={{
      bgcolor: alpha(theme.palette.success.light, 0.09),
      color: theme.palette.success.light,
      fontWeight: 600,
      fontSize: '0.7rem',
      height: 24,
      border: `1px solid ${alpha(theme.palette.success.light, 0.27)}`,
    }}
  />
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const PublicUserCard: React.FC<Readonly<PublicUserCardProps>> = ({
  user,
  onViewProfile,
  compact = false,
}) => {
  const theme = useTheme();
  const accent = getUserAccentColor(theme);

  const sanitizedAvatar = user.avatar ? sanitizeImageUrl(user.avatar) : undefined;

  return (
    <Box
      role={onViewProfile ? 'button' : undefined}
      tabIndex={onViewProfile ? 0 : undefined}
      onClick={() => onViewProfile?.(user.id)}
      onKeyDown={(e: React.KeyboardEvent) => handleCardKeyDown(e, onViewProfile, user.id)}
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, 0.12),
        overflow: 'hidden',
        transition: theme.transitions.create('all', { duration: 250 }),
        cursor: onViewProfile ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        minHeight: compact ? 280 : 380,
        '&:hover': {
          borderColor: alpha(accent, 0.53),
          boxShadow: `0 4px 24px ${alpha(accent, 0.13)}`,
          transform: 'translateY(-2px)',
        },
        '&:focus-visible': {
          outline: `2px solid ${accent}`,
          outlineOffset: 2,
        },
      }}
    >
      {/* ── Banner ── */}
      <Box
        sx={{
          position: 'relative',
          height: compact ? 48 : 72,
          background: getBannerGradient(theme),
          borderBottom: `2px solid ${alpha(accent, 0.4)}`,
        }}
      >
        {/* Gradient overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, transparent 30%, ${alpha(theme.palette.background.paper, 0.93)} 100%)`,
          }}
        />
      </Box>

      {/* ── Main Content ── */}
      <Box
        sx={{
          px: 2.5,
          pb: 2,
          mt: -3,
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Avatar + Name Row */}
        <Stack direction="row" spacing={1.5} alignItems="flex-end" sx={{ mb: 1.5 }}>
          <Avatar
            src={sanitizedAvatar || undefined}
            alt={`${user.displayName || user.username} avatar`}
            sx={{
              width: 56,
              height: 56,
              bgcolor: alpha(accent, 0.2),
              border: `2px solid ${alpha(accent, 0.53)}`,
              boxShadow: `0 2px 12px ${alpha(accent, 0.2)}`,
              fontSize: '1.4rem',
              fontWeight: 700,
              color: accent,
            }}
          >
            {!sanitizedAvatar && getInitials(user)}
          </Avatar>

          {/* Name + Username */}
          <Stack sx={{ minWidth: 0, pb: 0.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  color: theme.palette.common.white,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.displayName || user.username}
              </Typography>
              {user.rsiVerified && (
                <Tooltip title="RSI Verified">
                  <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
                </Tooltip>
              )}
            </Stack>
            {user.displayName && user.displayName !== user.username && (
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: theme.palette.text.secondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                @{user.username}
              </Typography>
            )}
          </Stack>
        </Stack>

        {/* Badges Row */}
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {user.rsiVerified && <RsiVerifiedBadge theme={theme} />}
          {user.rsiHandle && (
            <Chip
              icon={
                <PublicIcon
                  sx={{ fontSize: 13, color: `${theme.palette.info.light} !important` }}
                />
              }
              label={user.rsiHandle}
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.info.main, 0.09),
                color: theme.palette.info.light,
                fontWeight: 600,
                fontSize: '0.7rem',
                height: 24,
                border: `1px solid ${alpha(theme.palette.info.light, 0.22)}`,
              }}
            />
          )}
        </Stack>

        {/* Bio */}
        {user.bio && (
          <Typography
            sx={{
              color: theme.palette.text.primary,
              fontSize: '0.82rem',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.45,
              mb: 1,
            }}
          >
            {user.bio}
          </Typography>
        )}

        {/* Organizations */}
        {user.organizations && user.organizations.length > 0 && (
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {user.organizations.slice(0, compact ? 1 : 2).map(org => (
              <Stack
                key={org.orgId}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  bgcolor: alpha(theme.palette.common.white, 0.04),
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
                }}
              >
                {org.orgLogo ? (
                  <Avatar
                    src={sanitizeImageUrl(org.orgLogo) || undefined}
                    alt={org.orgName}
                    sx={{ width: 20, height: 20, fontSize: '0.6rem' }}
                  >
                    {org.orgName.charAt(0)}
                  </Avatar>
                ) : (
                  <OrgIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                )}
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    color: theme.palette.text.primary,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {org.orgName}
                </Typography>
                <Chip
                  label={org.roleName}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    bgcolor: alpha(accent, 0.12),
                    color: accent,
                    border: `1px solid ${alpha(accent, 0.25)}`,
                    '& .MuiChip-label': { px: 0.75, py: 0 },
                  }}
                />
              </Stack>
            ))}
            {user.organizations.length > (compact ? 1 : 2) && (
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: theme.palette.text.secondary,
                  pl: 1,
                }}
              >
                +{user.organizations.length - (compact ? 1 : 2)} more
              </Typography>
            )}
          </Stack>
        )}

        {/* Stats Row */}
        <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: 'wrap' }}>
          {/* Legacy single org fallback — only if no organizations array */}
          {user.organizationName && (!user.organizations || user.organizations.length === 0) && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <OrgIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: theme.palette.text.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 140,
                }}
              >
                {user.organizationName}
              </Typography>
            </Stack>
          )}
          {user.shipCount != null && user.shipCount > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ShipIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.primary }}>
                {user.shipCount} {user.shipCount === 1 ? 'ship' : 'ships'}
              </Typography>
            </Stack>
          )}
          {user.createdAt && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <CalendarIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.primary }}>
                {formatJoinDate(user.createdAt)}
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Divider */}
        <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.common.white, 0.06)}`, mb: 1 }} />

        {/* Footer */}
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Button
            variant="contained"
            size="small"
            startIcon={<ViewIcon sx={{ fontSize: 16 }} />}
            aria-label={`View ${user.displayName || user.username}'s profile`}
            onClick={e => {
              e.stopPropagation();
              onViewProfile?.(user.id);
            }}
            sx={{
              bgcolor: accent,
              color: theme.palette.common.white,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              px: 2,
              py: 0.5,
              borderRadius: 1.5,
              '&:hover': {
                bgcolor: theme.palette.primary.dark,
              },
            }}
          >
            View Profile
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
