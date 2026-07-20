import type {
  ActivityLevel,
  OrgPrimaryFocus,
  PublicOrgListItem,
} from '@/services/publicDirectoryService';
import {
  getActivityLevelLabel,
  getFocusIcon,
  getFocusLabel,
} from '@/services/publicDirectoryService';
import {
  CheckCircle as CheckCircleIcon,
  GpsFixed as GpsFixedIcon,
  HowToReg as HowToRegIcon,
  Lock as LockIcon,
  Mail as MailIcon,
  Person as PersonIcon,
  Public as PublicIcon,
  TheaterComedy as TheaterComedyIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

import { OrgApplicationModal } from '@/components/organization/OrgApplicationModal';
import { RecruitmentApplyDialog } from '@/components/recruitment/RecruitmentApplyDialog';
import { useMyOrganizations } from '@/hooks/queries/useOrganizationQueries';
import { useRecruitments } from '@/hooks/queries/useRecruitmentQueries';
import { useAuthStore } from '@/store/authStore';
import { sanitizeImageUrl } from '@/utils/sanitize';
import { SocialLinksBar } from './SocialIcons';

export interface PublicOrgCardProps {
  /** Organization data */
  organization: PublicOrgListItem;
  /** Click handler for viewing full profile — receives the URL slug */
  onViewProfile?: (slug: string) => void;
  /** Whether to show compact view */
  compact?: boolean;
  /** Number of active job listings for this organization */
  jobsCount?: number;
  /** Click handler for viewing jobs */
  onViewJobs?: (orgId: string) => void;
  /** Whether to show contact button */
  showContact?: boolean;
  /** Whether the current user is already a member of this organization */
  isMember?: boolean;
}

interface OptionalSectionProps {
  compact: boolean;
  theme: Theme;
}

interface SocialLinksProps {
  rsiUrl?: string;
  discordInvite?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  websiteUrl?: string;
}

function getBannerBackground(
  bannerUrl: string | undefined,
  primaryFocus: OrgPrimaryFocus,
  theme: Theme
): string {
  if (bannerUrl) {
    return `url(${sanitizeImageUrl(bannerUrl)}) center/cover no-repeat`;
  }
  return getDefaultBannerGradient(primaryFocus, theme);
}

function handleProfileKeyDown(
  event: React.KeyboardEvent,
  onViewProfile: ((slug: string) => void) | undefined,
  slug: string
): void {
  if (onViewProfile && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    onViewProfile(slug);
  }
}

function renderSocialLinks(socials: SocialLinksProps): React.ReactNode {
  if (
    !(
      socials.rsiUrl ||
      socials.discordInvite ||
      socials.twitterUrl ||
      socials.youtubeUrl ||
      socials.twitchUrl ||
      socials.websiteUrl
    )
  ) {
    return null;
  }
  return (
    <SocialLinksBar
      rsiUrl={socials.rsiUrl}
      discordInvite={socials.discordInvite}
      twitterUrl={socials.twitterUrl}
      youtubeUrl={socials.youtubeUrl}
      twitchUrl={socials.twitchUrl}
      websiteUrl={socials.websiteUrl}
    />
  );
}

function renderJobsBadge(
  jobsCount: number | undefined,
  theme: Theme,
  organizationId: string,
  onViewJobs?: (orgId: string) => void
): React.ReactNode {
  if (!jobsCount || jobsCount <= 0) return null;
  return (
    <Chip
      icon={<WorkIcon sx={{ fontSize: 14, color: `${theme.palette.info.light} !important` }} />}
      label={`${jobsCount} ${jobsCount === 1 ? 'Job' : 'Jobs'}`}
      size="small"
      onClick={e => {
        e.stopPropagation();
        onViewJobs?.(organizationId);
      }}
      sx={{
        bgcolor: alpha(theme.palette.info.main, 0.13),
        color: theme.palette.info.light,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
        border: `1px solid ${alpha(theme.palette.info.main, 0.27)}`,
        cursor: 'pointer',
      }}
    />
  );
}

function getCardColors(
  theme: Theme,
  isVerified: boolean,
  focusAccent: string
): {
  hoverBorderColor: string;
  hoverShadowColor: string;
  borderColor: string;
  focusOutlineColor: string;
} {
  if (isVerified) {
    return {
      hoverBorderColor: alpha(theme.palette.success.light, 0.53),
      hoverShadowColor: alpha(theme.palette.success.light, 0.13),
      borderColor: alpha(theme.palette.success.light, 0.4),
      focusOutlineColor: theme.palette.success.light,
    };
  }

  return {
    hoverBorderColor: alpha(focusAccent, 0.53),
    hoverShadowColor: alpha(focusAccent, 0.13),
    borderColor: alpha(theme.palette.common.white, 0.12),
    focusOutlineColor: focusAccent,
  };
}

/** Activity level indicator colors */
function getActivityLevelColor(level: ActivityLevel, theme: Theme): string {
  const colors: Record<ActivityLevel, string> = {
    inactive: theme.palette.text.disabled,
    low: theme.palette.warning.main,
    moderate: theme.palette.success.main,
    high: theme.palette.info.main,
    very_high: theme.palette.primary.main,
  };
  return colors[level] || theme.palette.text.disabled;
}

/** Focus area accent colors */
function getFocusColor(focus: OrgPrimaryFocus, theme: Theme): string {
  const colors: Record<OrgPrimaryFocus, string> = {
    combat: theme.palette.error.main,
    mining: theme.palette.warning.main,
    trading: theme.palette.success.main,
    exploration: theme.palette.primary.main,
    bounty_hunting: theme.palette.secondary.main,
    medical: theme.palette.info.main,
    transport: theme.palette.primary.dark,
    salvage: theme.palette.warning.dark,
    security: theme.palette.info.dark,
    social: theme.palette.success.light,
    piracy: theme.palette.error.dark,
    racing: theme.palette.warning.light,
    mixed: theme.palette.text.secondary,
  };
  return colors[focus] || theme.palette.text.secondary;
}

// ── Default banner gradient based on primary focus ──────────────────────────
function getDefaultBannerGradient(focus: OrgPrimaryFocus, theme: Theme): string {
  const color = getFocusColor(focus, theme);
  return `linear-gradient(135deg, ${color}33 0%, ${theme.palette.background.default} 60%, ${color}22 100%)`;
}

function renderTagline(tagline: string | undefined, props: OptionalSectionProps): React.ReactNode {
  if (!tagline || props.compact) return null;
  return (
    <Typography
      sx={{
        fontStyle: 'italic',
        color: props.theme.palette.text.secondary,
        fontSize: '0.85rem',
        mb: 1,
        lineHeight: 1.4,
      }}
    >
      "{tagline}"
    </Typography>
  );
}

function renderDescription(
  organizationDescription: string | undefined,
  props: OptionalSectionProps
): React.ReactNode {
  if (!organizationDescription) return null;
  return (
    <Typography
      sx={{
        color: props.theme.palette.text.primary,
        fontSize: '0.85rem',
        display: '-webkit-box',
        WebkitLineClamp: props.compact ? 1 : 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 1.5,
        mb: 1.5,
      }}
    >
      {organizationDescription}
    </Typography>
  );
}

function renderSecondaryFocus(
  secondaryFocus: OrgPrimaryFocus[] | undefined,
  props: OptionalSectionProps
): React.ReactNode {
  if (!secondaryFocus || secondaryFocus.length === 0 || props.compact) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
      {secondaryFocus.slice(0, 3).map(focus => (
        <Chip
          key={focus}
          label={getFocusLabel(focus)}
          size="small"
          sx={{
            bgcolor: alpha(props.theme.palette.common.white, 0.06),
            color: props.theme.palette.text.secondary,
            fontSize: '0.7rem',
            height: 22,
            border: `1px solid ${alpha(props.theme.palette.common.white, 0.12)}`,
          }}
        />
      ))}
      {secondaryFocus.length > 3 && (
        <Chip
          label={`+${secondaryFocus.length - 3}`}
          size="small"
          sx={{
            bgcolor: alpha(props.theme.palette.common.white, 0.06),
            color: props.theme.palette.text.secondary,
            fontSize: '0.7rem',
            height: 22,
            border: `1px solid ${alpha(props.theme.palette.common.white, 0.12)}`,
          }}
        />
      )}
    </Stack>
  );
}

function renderLanguages(
  languages: string[] | undefined,
  props: OptionalSectionProps
): React.ReactNode {
  if (!languages || languages.length === 0 || props.compact) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
      {languages.slice(0, 4).map(lang => (
        <Chip
          key={lang}
          label={lang.toUpperCase()}
          size="small"
          sx={{
            bgcolor: alpha(props.theme.palette.common.white, 0.06),
            color: props.theme.palette.text.secondary,
            fontSize: '0.68rem',
            height: 20,
            border: `1px solid ${alpha(props.theme.palette.common.white, 0.12)}`,
          }}
        />
      ))}
      {languages.length > 4 && (
        <Chip
          label={`+${languages.length - 4}`}
          size="small"
          sx={{
            bgcolor: alpha(props.theme.palette.common.white, 0.06),
            color: props.theme.palette.text.secondary,
            fontSize: '0.68rem',
            height: 20,
            border: `1px solid ${alpha(props.theme.palette.common.white, 0.12)}`,
          }}
        />
      )}
    </Stack>
  );
}

/** RSI metadata tags (commitment, roleplay, exclusive) */
function renderRsiTags(
  rsiCommitment: string | undefined,
  rsiRolePlay: boolean | undefined,
  rsiExclusive: boolean | undefined,
  props: OptionalSectionProps
): React.ReactNode {
  if (props.compact) return null;
  const tags: Array<{ label: string; icon: React.ReactNode }> = [];
  if (rsiCommitment)
    tags.push({ label: rsiCommitment, icon: <GpsFixedIcon sx={{ fontSize: 12 }} /> });
  if (rsiRolePlay === true)
    tags.push({ label: 'Role Play', icon: <TheaterComedyIcon sx={{ fontSize: 12 }} /> });
  if (rsiExclusive === true)
    tags.push({ label: 'Exclusive', icon: <LockIcon sx={{ fontSize: 12 }} /> });
  if (rsiExclusive === false)
    tags.push({ label: 'Open', icon: <PublicIcon sx={{ fontSize: 12 }} /> });
  if (tags.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
      {tags.map(tag => (
        <Chip
          key={tag.label}
          icon={tag.icon as React.ReactElement}
          label={tag.label}
          size="small"
          sx={{
            bgcolor: alpha(props.theme.palette.common.white, 0.06),
            color: props.theme.palette.text.secondary,
            fontSize: '0.68rem',
            height: 20,
            border: `1px solid ${alpha(props.theme.palette.common.white, 0.12)}`,
          }}
        />
      ))}
    </Stack>
  );
}

/**
 * RecruitingBadge - Shows "Recruiting" or "Closed" chip
 */
const RecruitingBadge: React.FC<{ isRecruiting: boolean; theme: Theme }> = ({
  isRecruiting,
  theme,
}) =>
  isRecruiting ? (
    <Chip
      label="Recruiting"
      size="small"
      sx={{
        bgcolor: alpha(theme.palette.success.main, 0.13),
        color: theme.palette.success.light,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 24,
        border: `1px solid ${alpha(theme.palette.success.main, 0.27)}`,
      }}
    />
  ) : (
    <Chip
      label="Closed"
      size="small"
      sx={{
        bgcolor: alpha(theme.palette.text.disabled, 0.13),
        color: theme.palette.text.secondary,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 24,
        border: `1px solid ${alpha(theme.palette.text.disabled, 0.27)}`,
      }}
    />
  );

// ── Apply button helpers ────────────────────────────────────────────────

function getApplyButtonLabel(isMember: boolean, isRecruiting: boolean): string {
  if (isMember) return 'Member';
  return isRecruiting ? 'Apply' : 'Closed';
}

function getApplyButtonAriaLabel(isMember: boolean, isRecruiting: boolean): string {
  if (isMember) return 'Already a member';
  return isRecruiting ? 'Apply to join organization' : 'Organization not recruiting';
}

function getApplyButtonBgColor(isMember: boolean, isRecruiting: boolean, theme: Theme): string {
  if (isMember) return alpha(theme.palette.info.main, 0.13);
  return isRecruiting ? theme.palette.success.main : alpha(theme.palette.common.white, 0.06);
}

function getApplyButtonTextColor(isMember: boolean, isRecruiting: boolean, theme: Theme): string {
  if (isMember) return theme.palette.info.light;
  return isRecruiting ? theme.palette.common.white : theme.palette.text.disabled;
}

/**
 * PublicOrgCard - Modern dark-themed organization card
 *
 * Features: banner image, org logo, social links bar, focus badges.
 * Used in the public organization directory grid.
 */
export const PublicOrgCard: React.FC<PublicOrgCardProps> = ({
  organization,
  onViewProfile,
  compact = false,
  jobsCount,
  onViewJobs,
  showContact = true,
  isMember: isMemberProp = false,
}) => {
  const theme = useTheme();
  const { user } = useAuthStore();
  // Check membership via cached user organizations list (single API call shared across all cards).
  // The hook is user-scoped and disabled when there is no authenticated user, so myOrgs is
  // guaranteed to belong to the current user (no cross-user cache leakage).
  const { data: myOrgs } = useMyOrganizations({ enabled: !!user });
  const isMember =
    isMemberProp ||
    (!!user && Array.isArray(myOrgs) && myOrgs.some(org => org.id === organization.organizationId));
  const optionalSectionProps: OptionalSectionProps = { compact, theme };
  const {
    organizationId,
    organizationName,
    slug,
    organizationDescription,
    organizationLogoUrl,
    tagline,
    primaryFocus,
    secondaryFocus,
    memberCount,
    activityLevel,
    rsiUrl,
    discordInvite,
    twitterUrl,
    youtubeUrl,
    twitchUrl,
    websiteUrl,
    bannerUrl,
    languages,
    isVerified,
    isRecruiting,
  } = organization;

  const { rsiArchetype, rsiCommitment, rsiRolePlay, rsiExclusive } = organization;

  const focusAccent = getFocusColor(primaryFocus, theme);

  const { hoverBorderColor, hoverShadowColor, borderColor, focusOutlineColor } = getCardColors(
    theme,
    isVerified,
    focusAccent
  );

  const profileIdentifier = slug || organizationId;
  const [applyOpen, setApplyOpen] = useState(false);

  // Fetch active recruitment posts for this org when it's recruiting (requires auth)
  const { data: orgRecruitments } = useRecruitments(
    { organizationId, status: 'open' },
    { enabled: isRecruiting && !!user }
  );
  const activeRecruitment = orgRecruitments?.[0];

  return (
    <>
      <Box
        role={onViewProfile ? 'button' : undefined}
        tabIndex={onViewProfile ? 0 : undefined}
        onClick={() => onViewProfile?.(profileIdentifier)}
        onKeyDown={(e: React.KeyboardEvent) =>
          handleProfileKeyDown(e, onViewProfile, profileIdentifier)
        }
        sx={{
          bgcolor: theme.palette.background.paper,
          borderRadius: 2,
          border: '1px solid',
          borderColor,
          overflow: 'hidden',
          transition: theme.transitions.create('all', { duration: 250 }),
          cursor: onViewProfile ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: compact ? 320 : 480,
          ...(isVerified && {
            boxShadow: `0 0 12px ${alpha(theme.palette.success.light, 0.08)}`,
          }),
          '&:hover': {
            borderColor: hoverBorderColor,
            boxShadow: `0 4px 24px ${hoverShadowColor}`,
            transform: 'translateY(-2px)',
          },
          '&:focus-visible': {
            outline: `2px solid ${focusOutlineColor}`,
            outlineOffset: 2,
          },
        }}
      >
        {/* ── Banner ── */}
        <Box
          sx={{
            position: 'relative',
            height: compact ? 64 : 100,
            background: getBannerBackground(bannerUrl, primaryFocus, theme),
            borderBottom: `2px solid ${alpha(focusAccent, 0.4)}`,
          }}
        >
          {/* Gradient overlay for readability */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to bottom, transparent 30%, ${alpha(theme.palette.background.paper, 0.93)} 100%)`,
            }}
          />

          {/* Jobs count badge on banner */}
          <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8 }}>
            {renderJobsBadge(jobsCount, theme, organizationId, onViewJobs)}
          </Stack>
        </Box>

        {/* ── Main Content ── */}
        <Box
          sx={{
            px: 2.5,
            pb: 2,
            mt: -3.5,
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {/* Logo + Name row */}
          <Stack direction="row" spacing={1.5} alignItems="flex-end" sx={{ mb: 1.5 }}>
            {/* Org Logo */}
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '12px',
                bgcolor: theme.palette.background.default,
                border: `2px solid ${alpha(focusAccent, 0.53)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                boxShadow: `0 2px 12px ${alpha(focusAccent, 0.2)}`,
              }}
            >
              {organizationLogoUrl ? (
                <Box
                  component="img"
                  src={sanitizeImageUrl(organizationLogoUrl)}
                  alt={`${organizationName} logo`}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Typography sx={{ fontSize: '1.6rem', lineHeight: 1 }}>
                  {getFocusIcon(primaryFocus)}
                </Typography>
              )}
            </Box>

            {/* Name + Verified */}
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, pb: 0.5 }}>
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
                {organizationName}
              </Typography>
              {isVerified && (
                <Tooltip title="Verified Organization">
                  <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.light }} />
                </Tooltip>
              )}
            </Stack>
          </Stack>

          {/* Status Badges Row: Focus + Recruiting/Closed + Verified */}
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            <Chip
              icon={getFocusIcon(primaryFocus) as React.ReactElement}
              label={getFocusLabel(primaryFocus)}
              size="small"
              sx={{
                bgcolor: alpha(focusAccent, 0.13),
                color: focusAccent,
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 24,
                border: `1px solid ${alpha(focusAccent, 0.27)}`,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
            <RecruitingBadge isRecruiting={isRecruiting} theme={theme} />
            {rsiArchetype && (
              <Chip
                label={rsiArchetype}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.info.main, 0.09),
                  color: theme.palette.info.light,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 24,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                }}
              />
            )}
            {isVerified && (
              <Chip
                icon={
                  <CheckCircleIcon
                    sx={{ fontSize: 14, color: `${theme.palette.success.light} !important` }}
                  />
                }
                label="Verified"
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
            )}
          </Stack>

          {/* Tagline */}
          {renderTagline(tagline, optionalSectionProps)}

          {/* Description */}
          {renderDescription(organizationDescription, optionalSectionProps)}

          {/* Stats Row */}
          <Stack direction="row" spacing={2.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <PersonIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.primary }}>
                {memberCount.toLocaleString()}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: getActivityLevelColor(activityLevel, theme),
                  boxShadow: `0 0 6px ${getActivityLevelColor(activityLevel, theme)}88`,
                }}
              />
              <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.primary }}>
                {getActivityLevelLabel(activityLevel)}
              </Typography>
            </Stack>
          </Stack>

          {/* Secondary Focus Areas */}
          {renderSecondaryFocus(secondaryFocus, optionalSectionProps)}

          {/* Active Recruitment Post */}
          {activeRecruitment && !compact && (
            <Box
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.success.main, 0.08),
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
              }}
              onClick={e => e.stopPropagation()}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.success.light,
                  display: 'block',
                  mb: 0.5,
                }}
              >
                Recruiting
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeRecruitment.title}
              </Typography>
              {activeRecruitment.rolesNeeded && activeRecruitment.rolesNeeded.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                  {activeRecruitment.rolesNeeded.slice(0, 3).map(role => (
                    <Chip
                      key={role}
                      label={role}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: theme.palette.info.light,
                        border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                      }}
                    />
                  ))}
                  {activeRecruitment.rolesNeeded.length > 3 && (
                    <Chip
                      label={`+${activeRecruitment.rolesNeeded.length - 3}`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        bgcolor: alpha(theme.palette.common.white, 0.06),
                        color: theme.palette.text.secondary,
                      }}
                    />
                  )}
                </Stack>
              )}
              {activeRecruitment.maxPositions != null && (
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.secondary, mt: 0.5, display: 'block' }}
                >
                  {activeRecruitment.currentApplicants ?? 0} / {activeRecruitment.maxPositions}{' '}
                  positions filled
                </Typography>
              )}
            </Box>
          )}

          {/* Languages */}
          {renderLanguages(languages, optionalSectionProps)}

          {/* RSI Tags (Commitment, Role Play, Exclusive) */}
          {renderRsiTags(rsiCommitment, rsiRolePlay, rsiExclusive, optionalSectionProps)}

          {/* Spacer to push footer down */}
          <Box sx={{ flex: 1 }} />

          {/* Divider */}
          <Box
            sx={{ borderTop: `1px solid ${alpha(theme.palette.common.white, 0.06)}`, mb: 1.5 }}
          />

          {/* Footer: Action Buttons + Social Links */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ flexWrap: 'wrap', gap: 1 }}
          >
            <Stack direction="row" spacing={1}>
              {showContact && (
                <Tooltip title="Contact Organization">
                  <IconButton
                    size="small"
                    aria-label="Contact organization"
                    onClick={e => {
                      e.stopPropagation();
                      onViewProfile?.(profileIdentifier);
                    }}
                    sx={{
                      color: theme.palette.info.light,
                      border: `1px solid ${alpha(theme.palette.info.light, 0.27)}`,
                      borderRadius: 1.5,
                      width: 32,
                      height: 32,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.info.light, 0.07),
                        borderColor: theme.palette.info.light,
                      },
                    }}
                  >
                    <MailIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Button
                variant="contained"
                size="small"
                startIcon={<HowToRegIcon sx={{ fontSize: 16 }} />}
                aria-label={getApplyButtonAriaLabel(isMember, isRecruiting)}
                disabled={!isRecruiting || isMember}
                onClick={e => {
                  e.stopPropagation();
                  setApplyOpen(true);
                }}
                sx={{
                  bgcolor: getApplyButtonBgColor(isMember, isRecruiting, theme),
                  color: getApplyButtonTextColor(isMember, isRecruiting, theme),
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  px: 2,
                  py: 0.5,
                  borderRadius: 1.5,
                  '&:hover':
                    isRecruiting && !isMember
                      ? {
                          bgcolor: theme.palette.success.dark,
                        }
                      : {},
                  '&.Mui-disabled': {
                    bgcolor: isMember
                      ? alpha(theme.palette.info.main, 0.13)
                      : alpha(theme.palette.common.white, 0.06),
                    color: isMember ? theme.palette.info.light : theme.palette.text.disabled,
                  },
                }}
              >
                {getApplyButtonLabel(isMember, isRecruiting)}
              </Button>
            </Stack>

            {/* Social Links */}
            {renderSocialLinks({
              rsiUrl,
              discordInvite,
              twitterUrl,
              youtubeUrl,
              twitchUrl,
              websiteUrl,
            })}
          </Stack>
        </Box>
      </Box>
      {activeRecruitment ? (
        <RecruitmentApplyDialog
          open={applyOpen}
          onClose={() => setApplyOpen(false)}
          recruitment={activeRecruitment}
        />
      ) : (
        <OrgApplicationModal
          open={applyOpen}
          onClose={() => setApplyOpen(false)}
          organizationId={organizationId}
          organizationName={organizationName}
        />
      )}
    </>
  );
};
