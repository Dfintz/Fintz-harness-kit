/**
 * MemberProfileDrawer
 *
 * Full-page right-side drawer showing a member's aggregated intel profile.
 * Sections: RSI presence, Discord, platform memberships, watchlist hits,
 * active flags, flag stats / moderation summary.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase F1)
 */
import { glassMorphism } from '@/components/ui/tokens';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import FlagIcon from '@mui/icons-material/Flag';
import GavelIcon from '@mui/icons-material/Gavel';
import GroupIcon from '@mui/icons-material/Group';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';

import type {
  MemberFlagSummary,
  MemberIntelProfile,
  WatchlistCrossReferenceResult,
} from '@sc-fleet-manager/shared-types';

import { EffectivePermissionsView } from '@/components/members/EffectivePermissionsView';
import { useMemberProfile } from '@/hooks/queries';
import { getStatusChipSx } from '@/utils/statusStyles';

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                           */
/* ────────────────────────────────────────────────────────────────── */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ────────────────────────────────────────────────────────────────── */
/*  Sub-sections                                                      */
/* ────────────────────────────────────────────────────────────────── */

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, children }) => (
  <Box sx={{ mb: 3 }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      {icon}
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
    </Stack>
    {children}
  </Box>
);

/* RSI Presence ──────────────────────────────────────────────────── */

const RsiSection: React.FC<{ profile: MemberIntelProfile }> = ({ profile }) => {
  const rsi = profile.rsi;
  if (!rsi) {
    return (
      <Section title="RSI Presence" icon={<PersonIcon fontSize="small" />}>
        <Typography variant="body2" color="text.secondary">
          No RSI data available
        </Typography>
      </Section>
    );
  }

  return (
    <Section title="RSI Presence" icon={<PersonIcon fontSize="small" />}>
      <List dense disablePadding>
        <ListItem disableGutters>
          <ListItemText primary="Handle" secondary={rsi.rsiHandle} />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText
            primary="Verification"
            secondary={
              <Chip
                label={rsi.verificationStatus}
                size="small"
                color={rsi.verificationStatus === 'verified' ? 'success' : 'default'}
                variant="outlined"
              />
            }
          />
        </ListItem>
        {rsi.isFoundInOrg === false && (
          <ListItem disableGutters>
            <ListItemText
              primary="Org Membership"
              secondary={
                <Chip
                  label="Not found in RSI org"
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<WarningAmberIcon />}
                />
              }
            />
          </ListItem>
        )}
        <ListItem disableGutters>
          <ListItemText primary="Rank" secondary={rsi.rank ?? '—'} />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText
            primary="Primary Org"
            secondary={(() => {
              if (rsi.isPrimaryOrg) {
                // This org is the primary — get name from platform memberships
                const currentOrg = profile.platformMemberships.find(
                  m => m.organizationId === profile.organizationId
                );
                return currentOrg?.organizationName ?? 'This org';
              }
              // Find the primary org from otherRsiOrgs
              const primaryOrg = rsi.otherRsiOrgs.find(o => o.isPrimary);
              return primaryOrg?.rsiOrgName ?? primaryOrg?.rsiOrgSid ?? '—';
            })()}
          />
        </ListItem>
        {rsi.isHidden && (
          <ListItem disableGutters>
            <ListItemText
              primary="Visibility"
              secondary={
                <Chip
                  label="Redacted"
                  size="small"
                  color="error"
                  variant="outlined"
                  icon={<LockIcon />}
                />
              }
            />
          </ListItem>
        )}
        <ListItem disableGutters>
          <ListItemText primary="Last Synced" secondary={formatDate(rsi.lastSyncedAt)} />
        </ListItem>
      </List>

      {(() => {
        const affiliateOrgs = rsi.otherRsiOrgs.filter(o => !o.isPrimary);
        if (affiliateOrgs.length === 0) return null;
        return (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
              Affiliate Orgs ({affiliateOrgs.length})
            </Typography>
            <Stack spacing={0.5}>
              {affiliateOrgs.map(org => (
                <Stack
                  key={org.rsiOrgSid}
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  {org.isHidden ? (
                    <Chip
                      label={org.rsiOrgName ?? org.rsiOrgSid}
                      size="small"
                      color="error"
                      variant="outlined"
                      icon={<LockIcon />}
                    />
                  ) : (
                    <Chip label={org.rsiOrgName ?? org.rsiOrgSid} size="small" variant="outlined" />
                  )}
                  {org.rank && org.rank !== '—' && (
                    <Typography variant="caption" color="text.secondary">
                      {org.rank}
                    </Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>
        );
      })()}
    </Section>
  );
};

/* Discord Presence ─────────────────────────────────────────────── */

const DiscordSection: React.FC<{ profile: MemberIntelProfile }> = ({ profile }) => {
  const discord = profile.discord;

  const renderGuildChip = (isInGuild: boolean | undefined) => {
    if (isInGuild === true) {
      return (
        <Chip
          label="Yes"
          size="small"
          color="success"
          variant="outlined"
          icon={<CheckCircleIcon />}
        />
      );
    }
    if (isInGuild === false) {
      return (
        <Chip
          label="Not in guild"
          size="small"
          color="warning"
          variant="outlined"
          icon={<WarningAmberIcon />}
        />
      );
    }
    return (
      <Chip
        label="Unknown"
        size="small"
        color="default"
        variant="outlined"
        icon={<HelpOutlineIcon />}
      />
    );
  };

  return (
    <Section title="Discord" icon={<GroupIcon fontSize="small" />}>
      {discord ? (
        <List dense disablePadding>
          <ListItem disableGutters>
            <ListItemText primary="Display Name" secondary={discord.displayName ?? '—'} />
          </ListItem>
          {discord.guildName && (
            <ListItem disableGutters>
              <ListItemText primary="Server" secondary={discord.guildName} />
            </ListItem>
          )}
          {discord.guildId && (
            <ListItem disableGutters>
              <ListItemText primary="In Guild" secondary={renderGuildChip(discord.isInGuild)} />
            </ListItem>
          )}
          <ListItem disableGutters>
            <ListItemText primary="Joined" secondary={formatDate(discord.joinedAt)} />
          </ListItem>
          {discord.roleNames.length > 0 && (
            <ListItem disableGutters>
              <ListItemText
                primary="Roles"
                secondary={
                  <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                    {discord.roleNames.map(r => (
                      <Chip key={r} label={r} size="small" variant="outlined" />
                    ))}
                  </Stack>
                }
              />
            </ListItem>
          )}
        </List>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No Discord data linked
        </Typography>
      )}
    </Section>
  );
};

/* Platform Memberships ─────────────────────────────────────────── */

const MembershipsSection: React.FC<{ profile: MemberIntelProfile }> = ({ profile }) => {
  const memberships = profile.platformMemberships ?? [];
  return (
    <Section title="Platform Memberships" icon={<GroupIcon fontSize="small" />}>
      {memberships.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No platform memberships
        </Typography>
      ) : (
        <List dense disablePadding>
          {memberships.map(m => (
            <ListItem key={m.organizationId} disableGutters>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="body2">
                      {m.organizationName ?? m.organizationId}
                    </Typography>
                    {m.isPrimary && (
                      <Chip label="Primary" size="small" color="success" variant="filled" />
                    )}
                  </Stack>
                }
                secondary={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip label={m.role} size="small" variant="outlined" />
                    {!m.isActive && <Chip label="Inactive" size="small" color="default" />}
                    <Typography variant="caption" color="text.secondary">
                      Joined {formatDate(m.joinedAt)}
                    </Typography>
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Section>
  );
};

/* Watchlist Hits ────────────────────────────────────────────────── */

const WatchlistSection: React.FC<{ profile: MemberIntelProfile }> = ({ profile }) => {
  const theme = useTheme();

  return (
    <Section title="Watchlist Hits" icon={<SecurityIcon fontSize="small" />}>
      {(profile.watchlistHits ?? []).length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No watchlist matches
        </Typography>
      ) : (
        <Stack spacing={1}>
          {(profile.watchlistHits ?? []).map((hit: WatchlistCrossReferenceResult) => (
            <Alert key={hit.rsiHandle} severity="warning" variant="outlined" sx={{ py: 0.5 }}>
              <Typography variant="body2" fontWeight={500}>
                {hit.entry.citizenName ?? hit.rsiHandle}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                <Chip label={hit.entry.reason} size="small" color="warning" variant="outlined" />
                <Chip
                  label={hit.entry.threatLevel}
                  size="small"
                  sx={getStatusChipSx(hit.entry.threatLevel, theme)}
                  variant="filled"
                />
              </Stack>
            </Alert>
          ))}
        </Stack>
      )}
    </Section>
  );
};

/* Active Flags ──────────────────────────────────────────────────── */

const FlagsSection: React.FC<{ profile: MemberIntelProfile }> = ({ profile }) => {
  const theme = useTheme();
  const flags = profile.activeFlags ?? [];

  return (
    <Section title="Active Flags" icon={<FlagIcon fontSize="small" />}>
      {flags.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No active flags
        </Typography>
      ) : (
        <Stack spacing={1}>
          {flags.map((flag: MemberFlagSummary) => (
            <Box
              key={flag.id}
              sx={{
                p: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                <Chip
                  label={flag.severity}
                  size="small"
                  sx={getStatusChipSx(flag.severity, theme)}
                  variant="filled"
                />
                <Chip label={flag.flagType} size="small" variant="outlined" />
                {flag.isAutoGenerated && (
                  <Tooltip title="Auto-generated">
                    <Chip label="Auto" size="small" />
                  </Tooltip>
                )}
              </Stack>
              <Typography variant="body2">{flag.description}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(flag.createdAt)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {/* Flag stats summary */}
      {profile.flagStats && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
            Flag Statistics
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Typography variant="caption">
              Total: <strong>{profile.flagStats.totalFlags}</strong>
            </Typography>
            <Typography variant="caption">
              Open: <strong>{profile.flagStats.openFlags}</strong>
            </Typography>
            <Typography variant="caption">
              Resolved: <strong>{profile.flagStats.resolvedFlags}</strong>
            </Typography>
            <Typography variant="caption">
              Escalated: <strong>{profile.flagStats.escalatedFlags}</strong>
            </Typography>
            {profile.flagStats.highestSeverity && (
              <Chip
                label={`Highest: ${profile.flagStats.highestSeverity}`}
                size="small"
                sx={getStatusChipSx(profile.flagStats.highestSeverity, theme)}
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
      )}
    </Section>
  );
};

/* Role Alignment ───────────────────────────────────────────────── */

const RoleAlignmentSection: React.FC<{ profile: MemberIntelProfile }> = ({ profile }) => {
  const alignment = profile.roleAlignment;

  return (
    <Section title="Role Alignment" icon={<SwapHorizIcon fontSize="small" />}>
      {alignment ? (
        <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <List dense disablePadding>
            <ListItem disableGutters>
              <ListItemText primary="RSI Rank" secondary={alignment.rsiRank ?? '—'} />
            </ListItem>
            {alignment.mappedDiscordRole && (
              <ListItem disableGutters>
                <ListItemText
                  primary="Expected Discord Role"
                  secondary={alignment.mappedDiscordRole}
                />
              </ListItem>
            )}
            <ListItem disableGutters>
              <ListItemText
                primary="Actual Discord Roles"
                secondary={
                  alignment.actualDiscordRoles.length > 0 ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                      {alignment.actualDiscordRoles.map(r => (
                        <Chip key={r} label={r} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  ) : (
                    '—'
                  )
                }
              />
            </ListItem>
            {alignment.mappedWebRole && (
              <ListItem disableGutters>
                <ListItemText primary="Expected Web Role" secondary={alignment.mappedWebRole} />
              </ListItem>
            )}
            <ListItem disableGutters>
              <ListItemText primary="Actual Web Role" secondary={alignment.actualWebRole} />
            </ListItem>
          </List>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            {alignment.isAligned ? (
              <Chip
                label="Aligned"
                size="small"
                color="success"
                variant="filled"
                icon={<CheckCircleIcon />}
              />
            ) : (
              <Chip
                label="Mismatched"
                size="small"
                color="warning"
                variant="filled"
                icon={<WarningAmberIcon />}
              />
            )}
          </Stack>
          {alignment.mismatches.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {alignment.mismatches.map(m => (
                <Typography key={m} variant="caption" color="warning.main" display="block">
                  {m}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No role mapping configured for this member
        </Typography>
      )}
    </Section>
  );
};

/* Moderation ────────────────────────────────────────────────────── */

const ModerationSection: React.FC<{ profile: MemberIntelProfile }> = ({ profile }) => {
  const mod = profile.moderation;

  return (
    <Section title="Moderation Summary" icon={<GavelIcon fontSize="small" />}>
      {mod ? (
        <List dense disablePadding>
          <ListItem disableGutters>
            <ListItemText primary="Total Incidents" secondary={mod.totalIncidents} />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText primary="Active" secondary={mod.activeIncidents} />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText primary="Shared" secondary={mod.sharedIncidents} />
          </ListItem>
          {mod.highestSeverity && (
            <ListItem disableGutters>
              <ListItemText primary="Highest Severity" secondary={mod.highestSeverity} />
            </ListItem>
          )}
          <ListItem disableGutters>
            <ListItemText primary="Last Incident" secondary={formatDate(mod.lastIncidentAt)} />
          </ListItem>
        </List>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No moderation data
        </Typography>
      )}
    </Section>
  );
};

/* Permissions ───────────────────────────────────────────────────── */

const PermissionsSection: React.FC<{ orgId: string; userId: string }> = ({ orgId, userId }) => {
  return (
    <Section title="Permissions" icon={<VpnKeyIcon fontSize="small" />}>
      <EffectivePermissionsView organizationId={orgId} userId={userId} compact />
    </Section>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Main Drawer                                                       */
/* ────────────────────────────────────────────────────────────────── */

export interface MemberProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  orgId: string | undefined;
  userId: string | undefined;
  /** Optional display name shown in header while profile loads */
  displayName?: string;
}

export const MemberProfileDrawer: React.FC<MemberProfileDrawerProps> = ({
  open,
  onClose,
  orgId,
  userId,
  displayName,
}) => {
  const { data: profile, isLoading, isError, error } = useMemberProfile(orgId, userId);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 420 },
            background: glassMorphism.panel.background,
            backdropFilter: glassMorphism.panel.backdropFilter,
            borderLeft: glassMorphism.panel.border,
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <WarningAmberIcon color="primary" />
          <Typography variant="h6" noWrap>
            {profile?.username ??
              profile?.rsi?.rsiHandle ??
              profile?.discord?.displayName ??
              displayName ??
              'Member Profile'}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label="Close profile drawer">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        {isLoading && <ProfileSkeleton />}

        {isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load profile{error instanceof Error ? `: ${error.message}` : ''}
          </Alert>
        )}

        {profile && (
          <>
            {/* Generation timestamp */}
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Generated {formatDate(profile.generatedAt)}
            </Typography>

            {/* Watchlist hits shown prominently first if any */}
            {(profile.watchlistHits ?? []).length > 0 && (
              <>
                <WatchlistSection profile={profile} />
                <Divider sx={{ my: 1 }} />
              </>
            )}

            <RsiSection profile={profile} />
            <Divider sx={{ my: 1 }} />
            <DiscordSection profile={profile} />
            <Divider sx={{ my: 1 }} />
            <MembershipsSection profile={profile} />
            <Divider sx={{ my: 1 }} />
            <RoleAlignmentSection profile={profile} />
            <Divider sx={{ my: 1 }} />
            <FlagsSection profile={profile} />
            <Divider sx={{ my: 1 }} />
            <ModerationSection profile={profile} />
            {orgId && userId && (
              <>
                <Divider sx={{ my: 1 }} />
                <PermissionsSection orgId={orgId} userId={userId} />
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
};

/* Loading skeleton */
const ProfileSkeleton: React.FC = () => (
  <Stack spacing={2}>
    <Skeleton variant="text" width="60%" height={24} />
    <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
    <Skeleton variant="text" width="40%" height={24} />
    <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
    <Skeleton variant="text" width="50%" height={24} />
    <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
  </Stack>
);
