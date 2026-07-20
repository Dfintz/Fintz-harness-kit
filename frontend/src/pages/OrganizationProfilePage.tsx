import { ContactFormModal } from '@/components/ContactFormModal';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { OrgApplicationModal } from '@/components/organization/OrgApplicationModal';
import { OrgTrustBadge } from '@/components/organization/OrgTrustBadge';
import { SCStatsOrgDashboard } from '@/components/profile/SCStatsOrgDashboard';
import { RecruitmentApplyDialog } from '@/components/recruitment/RecruitmentApplyDialog';
import { RecruitmentPostPreviewDialog } from '@/components/recruitment/RecruitmentPostPreviewDialog';
import { SEOHead } from '@/components/SEOHead';
import { SocialLinksBar } from '@/components/SocialIcons';
import { useRecruitments } from '@/hooks/queries/useRecruitmentQueries';
import { orgApplicationService } from '@/services/orgApplicationService';
import {
  getActivityLevelLabel,
  getFocusIcon,
  getFocusLabel,
  type OrgFederationMembership,
  publicDirectoryService,
  PublicOrgProfile,
} from '@/services/publicDirectoryService';
import { type Recruitment } from '@/services/recruitmentService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HandshakeIcon from '@mui/icons-material/Handshake';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './OrganizationProfilePage.css';

import { DISCORD_BLUE, DISCORD_BLUE_HOVER } from '@/utils/brandColors';

/**
 * Get color for activity level (theme-aware)
 */
function getActivityLevelColor(level: string, theme: Theme): string {
  const colors: Record<string, string> = {
    inactive: theme.palette.text.disabled,
    low: theme.palette.warning.main,
    moderate: theme.palette.success.main,
    high: theme.palette.info.main,
    very_high: theme.palette.secondary.main,
  };
  return colors[level] || theme.palette.text.disabled;
}

/**
 * Get color for focus area
 */
function getFocusColor(focus: string): string {
  const colors: Record<string, string> = {
    combat: '#ef4444',
    mining: '#f59e0b',
    trading: '#22c55e',
    exploration: '#6366f1',
    bounty_hunting: '#ec4899',
    medical: '#06b6d4',
    transport: '#8b5cf6',
    salvage: '#d97706',
    security: '#3b82f6',
    social: '#14b8a6',
    piracy: '#dc2626',
    racing: '#f97316',
    mixed: '#6b7280',
  };
  return colors[focus] || '#6b7280';
}

/**
 * Default banner gradient based on primary focus (matches directory cards)
 */
function getDefaultBannerGradient(focus: string, theme: Theme): string {
  const color = getFocusColor(focus);
  return `linear-gradient(135deg, ${alpha(color, 0.2)} 0%, ${theme.palette.background.default} 60%, ${alpha(color, 0.13)} 100%)`;
}

/**
 * Build SEO description from profile data (avoids nested template literals).
 */
function buildSeoDescription(profile: PublicOrgProfile): string {
  let desc = `${profile.organizationName} is a Star Citizen organization on Fringe Core.`;
  if (profile.primaryFocus) {
    desc += ` Focus: ${getFocusLabel(profile.primaryFocus)}.`;
  }
  if (profile.isRecruiting) {
    desc += ' Currently recruiting.';
  }
  return desc;
}

/**
 * Build a full Discord invite URL from a raw handle/URL fragment.
 */
function buildDiscordInviteUrl(discordInvite: string): string {
  const raw = discordInvite.trim();
  if (raw.startsWith('http')) return raw;
  const code = raw.replace(/^discord\.gg\//, '');
  return `https://discord.gg/${code}`;
}

/**
 * Strip markdown syntax for plain-text preview display.
 */
function stripMarkdownPreview(text: string): string {
  const bounded = text.length > 600 ? text.slice(0, 600) : text;
  return bounded
    .replaceAll(/#{1,6}\s/g, '')
    .replaceAll(/\*\*|__/g, '')
    .replaceAll(/[*_]/g, '')
    .replaceAll(/\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, '')
    .replaceAll(/```[^`]*```/g, '')
    .replaceAll(/`([^`]+)`/g, '$1')
    .replaceAll(/>\s/g, '')
    .replaceAll(/[-*+]\s/g, '')
    .trim();
}

/**
 * Resolves the Discord invite URL from recruitment-level or org-level settings.
 */
function getDiscordInviteUrl(
  activeRecruitment: Recruitment | undefined,
  profile: PublicOrgProfile
): string | null {
  // Recruitment-level Discord takes priority
  if (activeRecruitment?.discordRecruitmentEnabled && activeRecruitment.discordInviteUrl) {
    return buildDiscordInviteUrl(activeRecruitment.discordInviteUrl);
  }
  // Fall back to org-level Discord setting
  if (profile.useDiscordForApplications && profile.discordInvite) {
    return buildDiscordInviteUrl(profile.discordInvite);
  }
  return null;
}

/**
 * Action button for the recruitment card — extracted to reduce cognitive complexity.
 */
const OrgRecruitmentActionButton: React.FC<
  Readonly<{
    isMember: boolean;
    hasApplied: boolean;
    activeRecruitment?: Recruitment;
    profile: PublicOrgProfile;
    onApplyClick: () => void;
  }>
> = ({ isMember, hasApplied, activeRecruitment, profile, onApplyClick }) => {
  const theme = useTheme();

  if (isMember) {
    return (
      <Box>
        <Chip
          icon={<HowToRegIcon />}
          label="You are a member"
          color="info"
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      </Box>
    );
  }

  const discordUrl = getDiscordInviteUrl(activeRecruitment, profile);
  if (discordUrl) {
    return (
      <Box>
        <Button
          variant="contained"
          startIcon={<HowToRegIcon />}
          href={discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: DISCORD_BLUE,
            color: theme.palette.common.white,
            '&:hover': { bgcolor: DISCORD_BLUE_HOVER },
          }}
        >
          Apply via Discord
        </Button>
      </Box>
    );
  }

  if (hasApplied) {
    return (
      <Box>
        <Chip
          icon={<HourglassEmptyIcon />}
          label="Application Pending"
          color="warning"
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<HowToRegIcon />}
        onClick={onApplyClick}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Apply to Join
      </Button>
    </Box>
  );
};

interface OrgRecruitmentSectionProps {
  profile: PublicOrgProfile;
  hasApplied: boolean;
  isMember: boolean;
  onApplyClick: () => void;
  activeRecruitment?: Recruitment;
  onViewFullPost?: () => void;
}

/**
 * Recruitment card showing org recruiting status and application actions.
 * Extracted to reduce cognitive complexity of the parent component.
 */
const OrgRecruitmentSection: React.FC<Readonly<OrgRecruitmentSectionProps>> = ({
  profile,
  hasApplied,
  isMember,
  onApplyClick,
  activeRecruitment,
  onViewFullPost,
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: '1px solid',
        borderColor: profile.isRecruiting
          ? alpha(theme.palette.success.main, 0.27)
          : theme.palette.divider,
        p: 3,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <HowToRegIcon
          sx={{
            color: profile.isRecruiting ? theme.palette.success.light : theme.palette.text.disabled,
            fontSize: 22,
          }}
        />
        <Typography variant="h6">Recruitment</Typography>
        <Chip
          label={profile.isRecruiting ? 'Open' : 'Closed'}
          size="small"
          sx={{
            bgcolor: profile.isRecruiting
              ? alpha(theme.palette.success.main, 0.13)
              : alpha(theme.palette.text.disabled, 0.13),
            color: profile.isRecruiting ? theme.palette.success.light : theme.palette.text.disabled,
            fontWeight: 600,
            fontSize: '0.75rem',
            height: 24,
            border: `1px solid ${profile.isRecruiting ? alpha(theme.palette.success.main, 0.27) : alpha(theme.palette.text.disabled, 0.27)}`,
          }}
        />
      </Stack>
      <Divider sx={{ my: 1.5 }} />

      {profile.isRecruiting ? (
        <Stack spacing={2}>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
            This organization is actively looking for new members.
          </Typography>

          {activeRecruitment && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, color: theme.palette.primary.light, mb: 0.5 }}
              >
                Active Recruitment Post
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  mb: activeRecruitment.description ? 0.5 : 0,
                }}
              >
                {activeRecruitment.title}
              </Typography>
              {activeRecruitment.description && (
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    mb: activeRecruitment.rolesNeeded?.length ? 1 : 0,
                  }}
                >
                  {stripMarkdownPreview(activeRecruitment.description)}
                </Typography>
              )}
              {activeRecruitment.rolesNeeded && activeRecruitment.rolesNeeded.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {activeRecruitment.rolesNeeded.slice(0, 5).map(role => (
                    <Chip
                      key={role}
                      label={role}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.72rem',
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: theme.palette.info.light,
                        border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                      }}
                    />
                  ))}
                  {activeRecruitment.rolesNeeded.length > 5 && (
                    <Chip
                      label={`+${activeRecruitment.rolesNeeded.length - 5}`}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.72rem',
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
              {onViewFullPost && (
                <Button
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={onViewFullPost}
                  sx={{ mt: 1, textTransform: 'none', fontWeight: 600 }}
                >
                  View Full Post
                </Button>
              )}
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Focus Areas
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
              <Chip
                label={getFocusLabel(profile.primaryFocus)}
                size="small"
                sx={{
                  bgcolor: alpha(getFocusColor(profile.primaryFocus), 0.13),
                  color: getFocusColor(profile.primaryFocus),
                  fontWeight: 600,
                  border: `1px solid ${alpha(getFocusColor(profile.primaryFocus), 0.27)}`,
                }}
              />
              {profile.secondaryFocus?.map(focus => (
                <Chip
                  key={focus}
                  label={getFocusLabel(focus)}
                  size="small"
                  sx={{
                    bgcolor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
              ))}
            </Stack>
          </Box>

          <OrgRecruitmentActionButton
            isMember={isMember}
            hasApplied={hasApplied}
            activeRecruitment={activeRecruitment}
            profile={profile}
            onApplyClick={onApplyClick}
          />
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          This organization is not currently recruiting new members.
        </Typography>
      )}
    </Box>
  );
};

/**
 * OrganizationProfilePage - Display public organization profile
 *
 * Shows detailed organization information from the public directory.
 * This is the page users land on when clicking "Box Profile" from the directory.
 */
const OrganizationProfilePage: React.FC = () => {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  // State
  const [profile, setProfile] = useState<PublicOrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [recruitmentPreviewOpen, setRecruitmentPreviewOpen] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [federations, setFederations] = useState<OrgFederationMembership[]>([]);

  const { user: authUser } = useAuthStore();

  // Fetch active recruitment posts for this org. Public endpoint — anonymous
  // visitors on /directory/:slug see the same recruitment post as logged-in users.
  const { data: orgRecruitments } = useRecruitments(
    { organizationId: profile?.organizationId, status: 'open' },
    { enabled: !!profile?.organizationId && !!profile?.isRecruiting }
  );
  const activeRecruitment = orgRecruitments?.[0];

  const fetchProfile = useCallback(async () => {
    if (!organizationSlug) {
      setError('Organization not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const profileData = await publicDirectoryService.getPublicProfile(organizationSlug);
      if (!profileData) {
        setError('This organization has not published a public profile.');
      }
      setProfile(profileData);

      // Fetch federations the org belongs to
      if (profileData?.organizationId) {
        publicDirectoryService
          .getOrgFederations(profileData.organizationId)
          .then(setFederations)
          .catch(() => {
            // Non-critical — silently fail
          });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load organization profile';
      logger.error('Error fetching organization profile:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [organizationSlug]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Check if user has already applied to this org (only when authenticated)
  useEffect(() => {
    if (!profile?.organizationId || !authUser) return;
    orgApplicationService
      .checkActiveApplication(profile.organizationId)
      .then(result => {
        setHasApplied(result.hasActiveApplication);
        setIsMember(result.isMember);
      })
      .catch(() => {
        // Silently fail — user may not be authenticated
      });
  }, [profile?.organizationId, authUser]);

  // Handle back navigation
  const handleBack = () => {
    navigate('/directory');
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{ minHeight: '400px' }}
        >
          <CircularProgress aria-label="Loading profile..." size={40} />
          <Typography sx={{ mt: 2 }}>Loading organization profile...</Typography>
        </Stack>
      </Box>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack direction="column" spacing={2}>
          <Button variant="outlined" onClick={handleBack}>
            <ArrowBackIcon sx={{ mr: 1 }} />
            Back to Directory
          </Button>
          <Box sx={{ bgcolor: 'error.main', p: 2, borderRadius: 1 }}>
            <Stack direction="column" spacing={2} alignItems="center">
              <Typography>{error || 'Failed to load organization profile'}</Typography>
              <Button variant="outlined" onClick={fetchProfile}>
                Retry
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
    );
  }

  // CWE-79: Pre-sanitize all user-supplied image URLs to prevent XSS via crafted src attributes.
  // sanitizeImageUrl returns null/empty for invalid URLs (javascript:, data:, etc.)
  const safeBannerUrl = profile.bannerUrl ? sanitizeImageUrl(profile.bannerUrl) : null;
  const safeLogoUrl = profile.organizationLogoUrl
    ? sanitizeImageUrl(profile.organizationLogoUrl)
    : null;

  return (
    <Box sx={{ p: 3 }}>
      <SEOHead
        title={`${profile.organizationName} — Organization`}
        description={profile.tagline || buildSeoDescription(profile)}
        canonical={`https://fringecore.space/directory/${organizationSlug}`}
        ogType="profile"
        ogImage={safeLogoUrl || undefined}
        keywords={[
          'organization',
          profile.organizationName,
          'Star Citizen org',
          ...(profile.primaryFocus ? [getFocusLabel(profile.primaryFocus)] : []),
        ]}
      />
      <Stack direction="column" spacing={3}>
        {/* Back button */}
        <Button variant="outlined" onClick={handleBack} sx={{ alignSelf: 'start' }}>
          <ArrowBackIcon sx={{ mr: 1 }} />
          Back to Directory
        </Button>

        {/* Organization Header */}
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: 2,
            border: '1px solid',
            borderColor: profile.isVerified
              ? alpha(theme.palette.success.main, 0.4)
              : theme.palette.divider,
            overflow: 'hidden',
            ...(profile.isVerified && {
              boxShadow: `0 0 16px ${alpha(theme.palette.success.main, 0.08)}`,
            }),
          }}
        >
          {/* Banner */}
          <Box
            sx={{
              position: 'relative',
              height: 180,
              background: safeBannerUrl
                ? `url(${safeBannerUrl}) center/cover no-repeat`
                : getDefaultBannerGradient(profile.primaryFocus, theme),
              borderBottom: `2px solid ${alpha(getFocusColor(profile.primaryFocus), 0.4)}`,
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
          </Box>

          {/* Content below banner */}
          <Box sx={{ px: 3, pb: 3, mt: -5, position: 'relative' }}>
            {/* Logo + Name row */}
            <Stack direction="row" spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
              {/* Org Logo */}
              <Box
                sx={{
                  width: 88,
                  height: 88,
                  borderRadius: '16px',
                  bgcolor: theme.palette.background.default,
                  border: `3px solid ${alpha(getFocusColor(profile.primaryFocus), 0.53)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow: `0 4px 20px ${alpha(getFocusColor(profile.primaryFocus), 0.2)}`,
                }}
              >
                {/* CWE-79 mitigation: safeLogoUrl is pre-sanitised by sanitizeImageUrl
                 which rejects javascript:, data: (non-image), protocol-relative, and
                 non-HTTPS URLs in production.  Only https/relative/data:image pass. */}
                {safeLogoUrl && /^(?:https:\/\/|data:image\/|\/(?!\/))/.test(safeLogoUrl) ? (
                  <img
                    src={safeLogoUrl}
                    alt={`${(profile.organizationName || 'Organization').replaceAll(/[<>"']/g, '')} logo`}
                    onError={e => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="org-logo-image"
                  />
                ) : (
                  <Typography sx={{ fontSize: '2.5rem' }}>
                    {getFocusIcon(profile.primaryFocus)}
                  </Typography>
                )}
              </Box>

              {/* Name + Verified */}
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{ pb: 0.5, minWidth: 0 }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: theme.palette.text.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {profile.organizationName}
                </Typography>
                {profile.isVerified && (
                  <Tooltip title="Verified Organization">
                    <CheckCircleIcon sx={{ fontSize: 24, color: theme.palette.success.main }} />
                  </Tooltip>
                )}
              </Stack>
            </Stack>

            {/* Focus Badge + Status Badges */}
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5, gap: 0.5 }}>
              <Chip
                label={getFocusLabel(profile.primaryFocus)}
                size="small"
                sx={{
                  bgcolor: alpha(getFocusColor(profile.primaryFocus), 0.13),
                  color: getFocusColor(profile.primaryFocus),
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  height: 26,
                  border: `1px solid ${alpha(getFocusColor(profile.primaryFocus), 0.27)}`,
                }}
              />
              {profile.isRecruiting ? (
                <Chip
                  label="Recruiting"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.13),
                    color: theme.palette.success.light,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 26,
                    border: `1px solid ${alpha(theme.palette.success.main, 0.27)}`,
                  }}
                />
              ) : (
                <Chip
                  label="Closed"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.text.disabled, 0.13),
                    color: theme.palette.text.disabled,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 26,
                    border: `1px solid ${alpha(theme.palette.text.disabled, 0.27)}`,
                  }}
                />
              )}
              {profile.isVerified && (
                <Chip
                  icon={
                    <CheckCircleIcon
                      sx={{ fontSize: 14, color: `${theme.palette.success.main} !important` }}
                    />
                  }
                  label="Verified"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.09),
                    color: theme.palette.success.main,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 26,
                    border: `1px solid ${alpha(theme.palette.success.main, 0.27)}`,
                  }}
                />
              )}
              {profile.organizationId && (
                <OrgTrustBadge organizationId={profile.organizationId} variant="full" />
              )}
            </Stack>

            {/* Tagline */}
            {profile.tagline && (
              <Typography
                sx={{
                  fontStyle: 'italic',
                  color: theme.palette.text.secondary,
                  fontSize: '1.05rem',
                  mb: 1.5,
                  lineHeight: 1.4,
                }}
              >
                "{profile.tagline}"
              </Typography>
            )}

            {/* Stats Row */}
            <Stack direction="row" spacing={3} sx={{ mb: 2, flexWrap: 'wrap' }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PersonIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                <Typography sx={{ fontSize: '0.9rem', color: theme.palette.text.primary }}>
                  {profile.memberCount.toLocaleString()} members
                </Typography>
              </Stack>

              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: getActivityLevelColor(profile.activityLevel, theme),
                    boxShadow: `0 0 6px ${alpha(getActivityLevelColor(profile.activityLevel, theme), 0.53)}`,
                  }}
                />
                <Typography sx={{ fontSize: '0.9rem', color: theme.palette.text.primary }}>
                  {getActivityLevelLabel(profile.activityLevel)}
                </Typography>
              </Stack>
            </Stack>

            {/* Divider */}
            <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, mb: 2 }} />

            {/* Footer: Apply + Contact + Social Links */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ flexWrap: 'wrap', gap: 1.5 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                {/* Contact button */}
                <Button
                  variant="contained"
                  startIcon={<MailOutlineIcon />}
                  onClick={() => setContactModalOpen(true)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    bgcolor: theme.palette.info.main,
                    color: theme.palette.common.white,
                    '&:hover': { bgcolor: theme.palette.info.light },
                  }}
                >
                  Contact
                </Button>

                {/* Contact form modal */}
                <ContactFormModal
                  targetType="organization"
                  organizationId={profile.organizationId}
                  targetName={profile.organizationName}
                  open={contactModalOpen}
                  onClose={() => setContactModalOpen(false)}
                  hideTrigger={true}
                />
              </Stack>

              {/* Social Links */}
              <SocialLinksBar
                rsiUrl={profile.rsiUrl}
                discordInvite={profile.discordInvite}
                twitterUrl={profile.twitterUrl}
                youtubeUrl={profile.youtubeUrl}
                twitchUrl={profile.twitchUrl}
                websiteUrl={profile.websiteUrl}
                size="medium"
              />
            </Stack>
          </Box>
        </Box>

        {/* Description */}
        {profile.organizationDescription && (
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              p: 3,
            }}
          >
            <Typography variant="h6">About</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography>{profile.organizationDescription}</Typography>
          </Box>
        )}

        {/* Recruitment Card */}
        <OrgRecruitmentSection
          profile={profile}
          hasApplied={hasApplied}
          isMember={isMember}
          onApplyClick={() => setApplicationModalOpen(true)}
          activeRecruitment={activeRecruitment}
          onViewFullPost={activeRecruitment ? () => setRecruitmentPreviewOpen(true) : undefined}
        />

        {/* Alliance Memberships */}
        {federations.length > 0 && (
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              p: 3,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <HandshakeIcon sx={{ color: theme.palette.primary.main }} />
              <Typography variant="h6">Alliance Memberships</Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              {federations.map(fed => (
                <Box
                  key={fed.id}
                  onClick={() => navigate(`/directory/federations/${fed.id}`)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 1.5,
                    border: `1px solid ${theme.palette.divider}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      borderColor: theme.palette.primary.main,
                    },
                  }}
                >
                  {fed.logoUrl ? (
                    <Box
                      component="img"
                      src={sanitizeImageUrl(fed.logoUrl)}
                      alt=""
                      onError={e => {
                        e.currentTarget.style.display = 'none';
                      }}
                      sx={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        borderRadius: 1,
                        objectFit: 'cover',
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <HandshakeIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                    </Box>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {fed.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {fed.memberCount} member{fed.memberCount === 1 ? '' : 's'}
                      {' · '}
                      {fed.role.charAt(0).toUpperCase() + fed.role.slice(1)}
                    </Typography>
                  </Box>
                  {fed.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                      {fed.tags.slice(0, 2).map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* SCStats Organization Analytics */}
        {profile.organizationId && (
          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              p: 3,
            }}
          >
            <FeatureErrorBoundary
              featureName="SCStats Analytics"
              fallbackMessage="Unable to load SCStats analytics."
            >
              <SCStatsOrgDashboard
                organizationId={profile.organizationId}
                isPublicView
                visibility={profile.scstatsVisibility}
              />
            </FeatureErrorBoundary>
          </Box>
        )}

        {/* Additional Info */}
        <Grid container spacing={2}>
          {/* Secondary Focus */}
          {profile.secondaryFocus && profile.secondaryFocus.length > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  bgcolor: theme.palette.background.paper,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  p: 3,
                }}
              >
                <Typography variant="h6">Additional Focus Areas</Typography>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {profile.secondaryFocus.map(focus => (
                    <Chip
                      key={focus}
                      label={getFocusLabel(focus)}
                      size="small"
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        color: theme.palette.text.primary,
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Grid>
          )}

          {/* Languages */}
          {profile.languages && profile.languages.length > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  bgcolor: theme.palette.background.paper,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  p: 3,
                }}
              >
                <Typography variant="h6">Languages</Typography>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {profile.languages.map(lang => (
                    <Chip
                      key={lang}
                      label={lang.toUpperCase()}
                      size="small"
                      sx={{
                        bgcolor: theme.palette.action.hover,
                        color: theme.palette.text.primary,
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Grid>
          )}

          {/* Timezone */}
          {profile.timezone && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  bgcolor: theme.palette.background.paper,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  p: 3,
                }}
              >
                <Typography variant="h6">Timezone</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography>{profile.timezone}</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Stack>

      {/* Application Modal — uses recruitment dialog when an active post exists */}
      {profile?.organizationId && activeRecruitment && (
        <RecruitmentApplyDialog
          open={applicationModalOpen}
          onClose={() => setApplicationModalOpen(false)}
          // Force the recruiting org's identity from the profile we are on,
          // protecting against stale/incorrect organizationName stored on the
          // recruitment activity (older rows may have the creator's org name).
          recruitment={{
            ...activeRecruitment,
            organizationId: profile.organizationId,
            organizationName: profile.organizationName ?? activeRecruitment.organizationName,
          }}
          onSuccess={() => {
            setHasApplied(true);
            setApplicationModalOpen(false);
          }}
        />
      )}
      {profile?.organizationId && !activeRecruitment && (
        <OrgApplicationModal
          open={applicationModalOpen}
          onClose={() => setApplicationModalOpen(false)}
          organizationId={profile.organizationId}
          organizationName={profile.organizationName}
          onSuccess={() => {
            setHasApplied(true);
            setApplicationModalOpen(false);
          }}
        />
      )}

      {/* Recruitment Post Preview Modal */}
      {activeRecruitment && (
        <RecruitmentPostPreviewDialog
          open={recruitmentPreviewOpen}
          onClose={() => setRecruitmentPreviewOpen(false)}
          recruitment={{
            ...activeRecruitment,
            organizationId: profile?.organizationId ?? activeRecruitment.organizationId,
            organizationName: profile?.organizationName ?? activeRecruitment.organizationName,
            organizationLogoUrl:
              profile?.organizationLogoUrl ?? activeRecruitment.organizationLogoUrl,
          }}
        />
      )}
    </Box>
  );
};

export const OrganizationProfilePageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Organization Profile"
    fallbackMessage="Unable to load organization profile. Please try again later."
    showHomeButton={true}
  >
    <OrganizationProfilePage />
  </FeatureErrorBoundary>
);
