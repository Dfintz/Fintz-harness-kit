import { ContactFormModal } from '@/components/ContactFormModal';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { SEOHead } from '@/components/SEOHead';
import { RedactedEntityCard } from '@/components/shared';
import { SocialLinksBar } from '@/components/SocialIcons';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { federationManagementService } from '@/services/federationManagementService';
import {
  FederationRole,
  getFederationRoleIcon,
  getFederationRoleLabel,
  PublicFederationListItem,
  publicFederationService,
} from '@/services/publicDirectoryService';
import { useAuthStore } from '@/store/authStore';
import { getFederationRoleColor, getResourceTypeLabel } from '@/utils/federationColorUtils';
import { logger } from '@/utils/logger';
import { slugify } from '@/utils/slugify';
import {
  ArrowBack as ArrowLeft,
  CalendarToday as Calendar,
  CheckCircle as CheckCircleIcon,
  Description as Document,
  Forum as ForumIcon,
  Group,
  Handshake as HandshakeIcon,
  HowToReg as HowToRegIcon,
  Construction as InfrastructureIcon,
  Inventory as InventoryIcon,
  Link,
  Map as MapIcon,
  RocketLaunch as RocketIcon,
  Search as SearchIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { Box, Button, Chip, Grid, Paper, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * Type guard to check if a string is a valid FederationRole
 */
function isFederationRole(role: string): role is FederationRole {
  return ['founder', 'leader', 'council', 'member', 'observer'].includes(role);
}

/**
 * Get icon for shared resource type
 */
function getResourceTypeIconElement(type: string): React.ReactElement {
  const sx = { fontSize: 'inherit' };
  const icons: Record<string, React.ReactElement> = {
    fleet: <RocketIcon sx={sx} />,
    intel: <SearchIcon sx={sx} />,
    routes: <MapIcon sx={sx} />,
    discord: <ForumIcon sx={sx} />,
    infrastructure: <InfrastructureIcon sx={sx} />,
    other: <InventoryIcon sx={sx} />,
  };
  return icons[type] || <InventoryIcon sx={sx} />;
}

/**
 * Renders a single federation member organization card.
 * Private orgs show a redacted placeholder; public orgs are clickable.
 */
const MemberOrgCard: React.FC<{
  member: PublicFederationListItem['memberOrganizations'][number];
  onNavigate: (orgId: string) => void;
}> = ({ member, onNavigate }) => {
  const theme = useTheme();
  const roleColor = (role: string) => getFederationRoleColor(role, theme);
  const isPublic = member.isPublic !== false;

  if (!isPublic) {
    return <RedactedEntityCard entityType="organization" />;
  }

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        cursor: 'pointer',
        transition: theme.transitions.create('all', { duration: 200 }),
        '&:hover': {
          borderColor: alpha(theme.palette.info.main, 0.267),
          transform: 'translateY(-1px)',
        },
      }}
      onClick={() => onNavigate(`/directory/${slugify(member.organizationName)}`)}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography sx={{ fontSize: '1.5rem' }}>{getFederationRoleIcon(member.role)}</Typography>
        <Stack direction="column" spacing={0.25} sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>
            {member.organizationName}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {getFederationRoleLabel(member.role)}
          </Typography>
        </Stack>
        <Chip
          label={member.role}
          size="small"
          sx={{
            textTransform: 'capitalize',
            bgcolor: alpha(roleColor(member.role), 0.094),
            color: roleColor(member.role),
            fontWeight: 600,
            fontSize: '0.72rem',
            border: `1px solid ${alpha(roleColor(member.role), 0.267)}`,
          }}
        />
      </Stack>
    </Paper>
  );
};

/**
 * FederationDetailsPage - Detailed Box of a federation/alliance
 *
 * Shows complete federation information including member organizations,
 * shared resources, treaties, and statistics.
 */
const FederationDetailsPage: React.FC = () => {
  const { federationSlug } = useParams<{ federationSlug: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const theme = useTheme();
  const roleColor = (role: string) => getFederationRoleColor(role, theme);

  // State
  const [federation, setFederation] = useState<PublicFederationListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  // Fetch federation details
  const fetchFederation = useCallback(async () => {
    if (!federationSlug) {
      setError('Federation not found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try public endpoint first
      let federationData = await publicFederationService.getFederation(federationSlug);

      // If found and user is authenticated, enrich with authenticated data so
      // private member orgs are not redacted (enables the Manage button).
      // Also handles the case where the public endpoint returned null
      // (private federations visible only to members).
      if (user && isAuthenticated) {
        try {
          // Use the federation UUID when available (the authenticated API
          // validates that the id param is a UUID and rejects slugs).
          const lookupId = federationData?.id ?? federationSlug;
          const managed = await federationManagementService.getFederation(lookupId);
          if (managed) {
            const activeMembers = (managed.members ?? []).filter(m => m.status === 'active');
            // The backend FederationConfig includes sharedResources & treaties
            // even though ManagedFederation type omits them
            const raw = managed as unknown as Record<string, unknown>;
            const sharedResources = Array.isArray(raw.sharedResources)
              ? (raw.sharedResources as Array<{ type: string }>)
              : [];
            const treaties = Array.isArray(raw.treaties)
              ? (raw.treaties as Array<{ status: string }>)
              : [];
            federationData = {
              id: managed.id,
              name: managed.name,
              description: managed.description,
              memberCount: activeMembers.length,
              memberOrganizations: activeMembers.map(m => ({
                organizationId: m.organizationId,
                organizationName: m.organizationName,
                role: m.role as FederationRole,
                isPublic: true,
              })),
              tags: managed.tags ?? [],
              createdAt: managed.createdAt,
              sharedResourceTypes: [...new Set(sharedResources.map(r => r.type))],
              treatyCount: treaties.filter(t => t.status === 'active').length,
              logoUrl: managed.logoUrl,
              bannerUrl: managed.bannerUrl,
              discordUrl: managed.discordUrl,
              websiteUrl: managed.websiteUrl,
            };
          }
        } catch {
          // User doesn't have access — keep the public data (if any)
        }
      }

      if (!federationData) {
        setError('Federation not found or not publicly visible');
        setLoading(false);
        return;
      }

      setFederation(federationData);
    } catch (err: unknown) {
      logger.error(
        'Error fetching federation details:',
        err,
        new Error('Error fetching federation details:', { cause: err })
      );
      setError('Failed to load federation details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [federationSlug, user, isAuthenticated]);

  // Initial load
  useEffect(() => {
    fetchFederation();
  }, [fetchFederation]);

  const formattedDate = federation ? new Date(federation.createdAt).toLocaleDateString() : '';

  // Loading state
  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <SkeletonCard count={1} variant="profile" />
        <Box sx={{ mt: 3 }}>
          <SkeletonCard count={4} variant="directory" />
        </Box>
      </Box>
    );
  }

  // Error state
  if (error || !federation) {
    return (
      <Box sx={{ p: 4 }}>
        <Stack direction="column" spacing={4}>
          <Button
            variant="text"
            onClick={() => navigate('/directory?tab=alliances')}
            sx={{ alignSelf: 'flex-start' }}
            startIcon={<ArrowLeft />}
          >
            Back
          </Button>

          <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.error.main, 0.133), borderRadius: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography>{error || 'Federation not found'}</Typography>
              <Button variant="outlined" onClick={fetchFederation}>
                Retry
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    );
  }

  // Check if the current user's org is a member of this federation
  const userOrgId = user?.activeOrgId ?? user?.organizationId;
  const isMember =
    !!userOrgId && federation.memberOrganizations.some(m => m.organizationId === userOrgId);

  // Calculate role distribution for stats with type validation
  const roleStats = federation.memberOrganizations.reduce(
    (acc, member) => {
      // Only count valid FederationRole values
      if (isFederationRole(member.role)) {
        acc[member.role] = (acc[member.role] || 0) + 1;
      }
      return acc;
    },
    {} as Record<FederationRole, number>
  );

  return (
    <Box sx={{ p: 4 }}>
      {federation && (
        <SEOHead
          title={`${federation.name} — Federation`}
          description={
            federation.description ||
            `${federation.name} is a Star Citizen federation with ${federation.memberOrganizations.length} member organizations.`
          }
          canonical={`https://fringecore.space/federation/${federationSlug}`}
          ogType="profile"
          keywords={['federation', 'alliance', federation.name, 'Star Citizen org alliance']}
        />
      )}
      <Stack direction="column" spacing={4}>
        {/* Back Button */}
        <Button
          variant="text"
          onClick={() => navigate('/directory?tab=alliances')}
          sx={{ alignSelf: 'flex-start' }}
          startIcon={<ArrowLeft />}
        >
          Back
        </Button>

        {/* Header Section */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: federation.isVerified
              ? alpha(theme.palette.success.main, 0.4)
              : theme.palette.divider,
            overflow: 'hidden',
            p: 3,
            ...(federation.isVerified && {
              boxShadow: `0 0 16px ${alpha(theme.palette.success.main, 0.082)}`,
            }),
          }}
        >
          <Stack direction="column" spacing={3}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              flexWrap="wrap"
            >
              <Stack direction="column" spacing={1} flex={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HandshakeIcon sx={{ fontSize: '2rem' }} />
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {federation.name}
                  </Typography>
                  {federation.isVerified && (
                    <Chip
                      icon={
                        <CheckCircleIcon
                          sx={{ fontSize: 14, color: `${theme.palette.success.main} !important` }}
                        />
                      }
                      label="Verified"
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.success.main, 0.094),
                        color: 'success.main',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        height: 24,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.267)}`,
                      }}
                    />
                  )}
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                  sx={{ gap: 0.5 }}
                >
                  <Chip
                    icon={<Group sx={{ color: `${theme.palette.info.main} !important` }} />}
                    label={`${federation.memberCount} Organizations`}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.info.main, 0.133),
                      color: 'info.main',
                      fontWeight: 600,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.267)}`,
                    }}
                  />
                  <Chip
                    icon={<Calendar sx={{ color: 'text.secondary' }} />}
                    label={`Formed ${formattedDate}`}
                    size="small"
                    sx={{
                      bgcolor: 'background.default',
                      color: 'text.secondary',
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  />
                  {federation.treatyCount > 0 && (
                    <Chip
                      icon={
                        <Document sx={{ color: `${theme.palette.success.light} !important` }} />
                      }
                      label={`${federation.treatyCount} Treaties`}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.success.main, 0.133),
                        color: 'success.light',
                        fontWeight: 600,
                        border: `1px solid ${alpha(theme.palette.success.main, 0.267)}`,
                      }}
                    />
                  )}
                </Stack>
              </Stack>

              {/* Apply & Contact Buttons */}
              <Stack direction="row" spacing={1} alignItems="flex-start">
                {isMember && (
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() =>
                      navigate(`/directories/federations/${slugify(federation?.name ?? '')}/manage`)
                    }
                    sx={{
                      borderColor: alpha(theme.palette.info.main, 0.267),
                      color: 'info.main',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: 'info.main',
                        bgcolor: alpha(theme.palette.info.main, 0.067),
                      },
                      textTransform: 'none',
                    }}
                  >
                    Manage
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<HowToRegIcon />}
                  onClick={() => setApplyModalOpen(true)}
                  sx={{
                    bgcolor: 'success.dark',
                    color: 'common.white',
                    fontWeight: 600,
                    '&:hover': { bgcolor: 'success.main' },
                    textTransform: 'none',
                  }}
                >
                  Apply to Join
                </Button>
                <ContactFormModal
                  targetType="alliance"
                  allianceId={federation.id}
                  targetName={federation.name}
                  hideTrigger
                  open={applyModalOpen}
                  onClose={() => setApplyModalOpen(false)}
                  defaultContactType="recruitment"
                />
                <ContactFormModal
                  targetType="alliance"
                  allianceId={federation.id}
                  targetName={federation.name}
                />
              </Stack>
            </Stack>

            {/* Description */}
            {federation.description && (
              <Typography sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                {federation.description}
              </Typography>
            )}

            {/* Tags */}
            {federation.tags.length > 0 && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {federation.tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      bgcolor: 'background.default',
                      color: 'text.primary',
                      border: `1px solid ${theme.palette.divider}`,
                      fontSize: '0.75rem',
                    }}
                  />
                ))}
              </Stack>
            )}

            {/* Divider + Social Links */}
            <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, pt: 2 }}>
              <SocialLinksBar
                rsiUrl={federation.rsiUrl}
                discordInvite={federation.discordUrl}
                twitterUrl={federation.twitterUrl}
                youtubeUrl={federation.youtubeUrl}
                twitchUrl={federation.twitchUrl}
                websiteUrl={federation.websiteUrl}
                size="medium"
              />
            </Box>
          </Stack>
        </Box>

        {/* ── Quick Stats ── */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              sx={{
                p: 2.5,
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              <Stack direction="column" alignItems="center" spacing={1}>
                <Group sx={{ fontSize: 28, color: 'info.main' }} />
                <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'text.primary' }}>
                  {federation.memberCount}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  Member Organizations
                </Typography>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              sx={{
                p: 2.5,
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              <Stack direction="column" alignItems="center" spacing={1}>
                <Link sx={{ fontSize: 28, color: 'secondary.main' }} />
                <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'text.primary' }}>
                  {federation.sharedResourceTypes.length}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  Shared Resources
                </Typography>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              sx={{
                p: 2.5,
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}
            >
              <Stack direction="column" alignItems="center" spacing={1}>
                <Document sx={{ fontSize: 28, color: 'success.light' }} />
                <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: 'text.primary' }}>
                  {federation.treatyCount}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  Active Treaties
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* ── Member Organizations ── */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
            Member Organizations
          </Typography>

          {federation.memberOrganizations.length === 0 ? (
            <Typography sx={{ color: 'text.secondary' }}>No member organizations</Typography>
          ) : (
            <Grid container spacing={2}>
              {federation.memberOrganizations.map(member => (
                <Grid key={member.organizationId} size={{ xs: 12, md: 6, lg: 4 }}>
                  <MemberOrgCard member={member} onNavigate={navigate} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* ── Shared Resources & Treaties ── */}
        {(federation.sharedResourceTypes.length > 0 || federation.treatyCount > 0) && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
              Shared Resources & Treaties
            </Typography>

            {federation.sharedResourceTypes.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {federation.sharedResourceTypes.map(type => (
                  <Chip
                    key={type}
                    icon={getResourceTypeIconElement(type)}
                    label={getResourceTypeLabel(type)}
                    sx={{
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      border: `1px solid ${theme.palette.divider}`,
                      height: 32,
                    }}
                  />
                ))}
              </Stack>
            )}

            {federation.treatyCount > 0 && (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Document sx={{ color: 'success.light' }} />
                  <Stack direction="column" spacing={0.25}>
                    <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {federation.treatyCount} Active{' '}
                      {federation.treatyCount === 1 ? 'Treaty' : 'Treaties'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                      Governing agreements between member organizations
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Box>
        )}

        {/* ── Role Distribution ── */}
        {Object.keys(roleStats).length > 0 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
              Role Distribution
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(roleStats).map(([role, count]) => (
                <Paper
                  key={role}
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    bgcolor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    minWidth: 100,
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '1.2rem', mb: 0.25 }}>
                    {getFederationRoleIcon(role as FederationRole)}
                  </Typography>
                  <Typography
                    sx={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'text.primary' }}
                  >
                    {count}
                  </Typography>
                  <Typography
                    sx={{
                      textTransform: 'capitalize',
                      fontSize: '0.75rem',
                      color: roleColor(role),
                    }}
                  >
                    {getFederationRoleLabel(role as FederationRole)}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export const FederationDetailsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Federation Details"
    fallbackMessage="Unable to load federation details. Please try again later."
    showHomeButton={true}
  >
    <FederationDetailsPage />
  </FeatureErrorBoundary>
);
