import { sanitizeImageUrl } from '@/utils/sanitize';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
  Groups as ActivityIcon,
  AdminPanelSettings as AdminIcon,
  Circle as CircleIcon,
  Forum as LfgIcon,
  Shield as ShieldIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import type {
  ParticipantInfo,
  ParticipantLifecycleStatus,
  SystemRole,
  TrustScoreSnapshot,
} from '@sc-fleet-manager/shared-types';
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SystemType = 'teams' | 'activity' | 'social' | 'jobs';

type CardSize = 'small' | 'medium' | 'large';

export interface ParticipantCardProps {
  /** Participant data (from shared-types ParticipantInfo) */
  participant: ParticipantInfo;
  /** Which systems the participant is active in */
  systems?: SystemType[];
  /** Whether to show the trust score badge */
  showTrustScore?: boolean;
  /** Whether to show the role chip */
  showRole?: boolean;
  /** Card size variant */
  size?: CardSize;
  /** Click handler */
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYSTEM_CONFIG: Record<
  SystemType,
  { label: string; icon: React.ReactElement; color: string }
> = {
  teams: { label: 'Teams', icon: <ShieldIcon fontSize="inherit" />, color: 'primary' },
  activity: { label: 'Activities', icon: <ActivityIcon fontSize="inherit" />, color: 'success' },
  social: { label: 'Social/LFG', icon: <LfgIcon fontSize="inherit" />, color: 'info' },
  jobs: { label: 'Jobs', icon: <WorkIcon fontSize="inherit" />, color: 'warning' },
};

/** Human-readable role labels */
function getRoleLabel(role: SystemRole): string {
  const labels: Record<string, string> = {
    ORG_LEADER: 'Leader',
    ORG_OFFICER: 'Officer',
    ORG_MEMBER: 'Member',
    ACTIVITY_HOST: 'Host',
    ACTIVITY_PARTICIPANT: 'Participant',
    LFG_INITIATOR: 'Initiator',
    LFG_MEMBER: 'Member',
    JOB_PROVIDER: 'Provider',
    JOB_APPLICANT: 'Applicant',
    ADMIN: 'Admin',
    MODERATOR: 'Moderator',
  };
  return labels[role] ?? role;
}

/** Pick the best display role (highest rank) */
function getPrimaryRoleLabel(participant: ParticipantInfo): string {
  if (participant.primaryRole) return participant.primaryRole;
  if (participant.roles.length === 0) return 'Member';
  // Return first role (typically highest priority)
  return getRoleLabel(participant.roles[0]);
}

function getStatusIndicatorColor(
  status: ParticipantLifecycleStatus | undefined,
  theme: Theme
): string {
  switch (status) {
    case 'active':
      return theme.palette.success.main;
    case 'pending':
    case 'invited':
      return theme.palette.info.main;
    case 'waitlisted':
      return theme.palette.warning.main;
    case 'inactive':
    case 'completed':
      return theme.palette.text.disabled;
    case 'removed':
      return theme.palette.error.main;
    default:
      return theme.palette.text.disabled;
  }
}

function getTrustScoreColor(score: number, theme: Theme): string {
  if (score >= 75) return theme.palette.success.main;
  if (score >= 50) return theme.palette.info.main;
  if (score >= 25) return theme.palette.warning.main;
  return theme.palette.error.main;
}

function getAvatarSize(size: CardSize): number {
  switch (size) {
    case 'small':
      return 28;
    case 'large':
      return 48;
    default:
      return 36;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TrustScoreBadge({
  score,
  snapshot,
  theme,
  size,
}: Readonly<{
  score: number;
  snapshot?: TrustScoreSnapshot;
  theme: Theme;
  size: CardSize;
}>) {
  const color = getTrustScoreColor(score, theme);
  const tooltipContent = snapshot
    ? `Trust Score: ${score}/100\nLFG: ${snapshot.lfg ?? '—'} | Trading: ${snapshot.trading ?? '—'} | Activity: ${snapshot.activity ?? '—'} | Jobs: ${snapshot.jobs ?? '—'}`
    : `Trust Score: ${score}/100`;

  return (
    <Tooltip title={tooltipContent} arrow>
      <Chip
        label={size === 'small' ? score : `${score}/100`}
        size="small"
        sx={{
          bgcolor: alpha(color, 0.12),
          color,
          fontWeight: 600,
          fontSize: size === 'small' ? '0.65rem' : '0.7rem',
          height: size === 'small' ? 18 : 22,
          '& .MuiChip-label': {
            px: size === 'small' ? 0.5 : 1,
          },
        }}
      />
    </Tooltip>
  );
}

function SystemBadges({
  systems,
  theme,
  size,
}: Readonly<{
  systems: SystemType[];
  theme: Theme;
  size: CardSize;
}>) {
  if (systems.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.25}>
      {systems.map(sys => {
        const config = SYSTEM_CONFIG[sys];
        const paletteColor = theme.palette[config.color as keyof typeof theme.palette];
        const mainColor =
          typeof paletteColor === 'object' && paletteColor !== null && 'main' in paletteColor
            ? (paletteColor as { main: string }).main
            : theme.palette.primary.main;

        return (
          <Tooltip key={sys} title={config.label} arrow>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size === 'small' ? 16 : 20,
                height: size === 'small' ? 16 : 20,
                borderRadius: '50%',
                bgcolor: alpha(mainColor, 0.12),
                color: mainColor,
                fontSize: size === 'small' ? 10 : 12,
              }}
            >
              {config.icon}
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ParticipantCard: React.FC<Readonly<ParticipantCardProps>> = ({
  participant,
  systems = [],
  showTrustScore = false,
  showRole = true,
  size = 'medium',
  onClick,
}) => {
  const theme = useTheme();
  const avatarSize = getAvatarSize(size);
  const statusColor = getStatusIndicatorColor(participant.status, theme);

  const pad = size === 'small' ? 1 : 1.5;
  const padLg = size === 'large' ? 2 : pad;

  const cardContent = (
    <CardContent
      sx={{
        p: padLg,
        '&:last-child': { pb: padLg },
      }}
    >
      <Stack direction="row" spacing={size === 'small' ? 1 : 1.5} alignItems="center">
        {/* Avatar with status indicator */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={sanitizeImageUrl(participant.avatar) || undefined}
            alt={participant.displayName ?? participant.username}
            sx={{ width: avatarSize, height: avatarSize }}
          >
            {(participant.displayName ?? participant.username).charAt(0).toUpperCase()}
          </Avatar>
          {participant.status && (
            <Tooltip title={participant.status}>
              <CircleIcon
                sx={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  fontSize: size === 'small' ? 8 : 10,
                  color: statusColor,
                  bgcolor: theme.palette.background.paper,
                  borderRadius: '50%',
                }}
              />
            </Tooltip>
          )}
        </Box>

        {/* Name + role */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant={size === 'large' ? 'subtitle1' : 'body2'}
            sx={{ fontWeight: 600, lineHeight: 1.3 }}
            noWrap
          >
            {participant.displayName ?? participant.username}
          </Typography>

          {size !== 'small' && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
              {showRole && (
                <Chip
                  label={getPrimaryRoleLabel(participant)}
                  size="small"
                  sx={{
                    ...getStatusChipSx(participant.status ?? 'active', theme),
                    height: 18,
                    fontSize: '0.65rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
              {participant.roles.includes('ADMIN' as SystemRole) && (
                <Tooltip title="Admin">
                  <AdminIcon
                    sx={{
                      fontSize: 14,
                      color: theme.palette.warning.main,
                    }}
                  />
                </Tooltip>
              )}
            </Stack>
          )}
        </Box>

        {/* Right side: trust score + system badges */}
        <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
          {showTrustScore && participant.trustScore != null && (
            <TrustScoreBadge
              score={participant.trustScore}
              snapshot={participant.trustSnapshot}
              theme={theme}
              size={size}
            />
          )}
          {systems.length > 0 && <SystemBadges systems={systems} theme={theme} size={size} />}
        </Stack>
      </Stack>

      {/* Large variant: extra detail row */}
      {size === 'large' && (
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} alignItems="center">
          {participant.source && (
            <Chip
              label={participant.source.replace('_', ' ')}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
          {participant.roles.length > 1 &&
            participant.roles
              .slice(1)
              .map(role => (
                <Chip
                  key={role}
                  label={getRoleLabel(role)}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              ))}
        </Stack>
      )}
    </CardContent>
  );

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: alpha(theme.palette.divider, 0.12),
        '&:hover': onClick ? { borderColor: theme.palette.primary.main, boxShadow: 1 } : undefined,
      }}
    >
      {onClick ? <CardActionArea onClick={onClick}>{cardContent}</CardActionArea> : cardContent}
    </Card>
  );
};
