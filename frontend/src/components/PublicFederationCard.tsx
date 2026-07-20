import {
  Work as BriefcaseIcon,
  Description as DocumentIcon,
  Groups as GroupsIcon,
  HowToReg as HowToRegIcon,
  Link as LinkIcon,
  Mail as MailIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import { RedactedEntityCard } from '@/components/shared';
import { sanitizeImageUrl } from '@/utils/sanitize';

import type { PublicFederationListItem } from '@/services/publicDirectoryService';
import { getFederationRoleIcon, getFederationRoleLabel } from '@/services/publicDirectoryService';
import { getFederationRoleColor, getResourceTypeLabel } from '@/utils/federationColorUtils';
import { slugify } from '@/utils/slugify';
import { SocialLinksBar } from './SocialIcons';

export interface PublicFederationCardProps {
  /** Federation data */
  federation: PublicFederationListItem;
  /** Click handler for viewing full federation details — receives URL slug */
  onViewDetails?: (slug: string) => void;
  /** Whether to show compact view */
  compact?: boolean;
  /** Number of active job listings for this alliance */
  jobsCount?: number;
  /** Click handler for viewing jobs */
  onViewJobs?: (federationId: string) => void;
  /** Whether to show contact button */
  showContact?: boolean;
}

/**
 * Default banner gradient for federations — uses theme primary color
 */
function getDefaultAllianceBanner(theme: Theme): string {
  return `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${theme.palette.background.default} 50%, ${alpha(theme.palette.secondary.main, 0.13)} 100%)`;
}

/**
 * PublicFederationCard - Modern dark-themed alliance/federation card
 *
 * Features: banner image, alliance logo, social links bar, member org list.
 * Used in the public federation directory grid.
 */
export const PublicFederationCard: React.FC<PublicFederationCardProps> = ({
  federation,
  onViewDetails,
  compact = false,
  jobsCount,
  onViewJobs,
  showContact = true,
}) => {
  const theme = useTheme();
  const {
    id,
    name,
    description,
    memberCount,
    memberOrganizations,
    tags,
    createdAt,
    sharedResourceTypes,
    treatyCount,
    logoUrl,
    bannerUrl,
    discordUrl,
    websiteUrl,
  } = federation;

  const formattedDate = new Date(createdAt).toLocaleDateString();
  const hasSocials = !!(discordUrl || websiteUrl);
  const federationSlug = slugify(name);

  return (
    <Box
      role={onViewDetails ? 'button' : undefined}
      tabIndex={onViewDetails ? 0 : undefined}
      onClick={() => onViewDetails?.(federationSlug)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (onViewDetails && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onViewDetails(federationSlug);
        }
      }}
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, 0.12),
        overflow: 'hidden',
        transition: theme.transitions.create('all', { duration: 250 }),
        cursor: onViewDetails ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: compact ? 320 : 480,
        '&:hover': {
          borderColor: alpha(theme.palette.secondary.dark, 0.53),
          boxShadow: `0 4px 24px ${alpha(theme.palette.secondary.dark, 0.13)}`,
          transform: 'translateY(-2px)',
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.secondary.dark}`,
          outlineOffset: 2,
        },
      }}
    >
      {/* ── Banner ── */}
      <Box
        sx={{
          position: 'relative',
          height: compact ? 56 : 88,
          background: bannerUrl
            ? `url(${sanitizeImageUrl(bannerUrl)}) center/cover no-repeat`
            : getDefaultAllianceBanner(theme),
          borderBottom: `2px solid ${alpha(theme.palette.secondary.dark, 0.4)}`,
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

        {/* Status badges */}
        <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8 }}>
          {jobsCount !== undefined && jobsCount > 0 && (
            <Chip
              icon={
                <BriefcaseIcon
                  sx={{ fontSize: 14, color: `${theme.palette.info.light} !important` }}
                />
              }
              label={`${jobsCount} ${jobsCount === 1 ? 'Job' : 'Jobs'}`}
              size="small"
              onClick={e => {
                e.stopPropagation();
                onViewJobs?.(id);
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
          )}
        </Stack>
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
        {/* Logo + Name row */}
        <Stack direction="row" spacing={1.5} alignItems="flex-end" sx={{ mb: 1.5 }}>
          {/* Alliance Logo */}
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              bgcolor: theme.palette.background.default,
              border: `2px solid ${alpha(theme.palette.secondary.dark, 0.53)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              boxShadow: `0 2px 12px ${alpha(theme.palette.secondary.dark, 0.2)}`,
            }}
          >
            {logoUrl ? (
              <img
                src={sanitizeImageUrl(logoUrl)}
                alt={`${name} logo`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ShieldIcon sx={{ fontSize: 28, color: theme.palette.secondary.dark }} />
            )}
          </Box>

          {/* Name + Org count */}
          <Stack sx={{ minWidth: 0, pb: 0.5 }}>
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
              {name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <GroupsIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
              <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                {memberCount} {memberCount === 1 ? 'org' : 'orgs'}
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        {/* Tags */}
        {tags.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {tags.slice(0, 3).map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.secondary.dark, 0.09),
                  color: theme.palette.secondary.light,
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  height: 22,
                  border: `1px solid ${alpha(theme.palette.secondary.dark, 0.2)}`,
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
                  fontSize: '0.7rem',
                  height: 22,
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                }}
              />
            )}
          </Stack>
        )}

        {/* Description */}
        {description && !compact && (
          <Typography
            sx={{
              color: theme.palette.text.primary,
              fontSize: '0.85rem',
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

        {/* Member Organizations */}
        {memberOrganizations.length > 0 && !compact && (
          <Box sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: theme.palette.text.secondary,
                mb: 0.5,
                fontWeight: 500,
              }}
            >
              Member Organizations
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {memberOrganizations.slice(0, 4).map(member => {
                const isPrivate = member.isPublic === false;
                const roleLabel = isPrivate
                  ? 'Private Organization'
                  : getFederationRoleLabel(member.role);
                return (
                  <Tooltip key={member.organizationId} title={roleLabel}>
                    <span>
                      {isPrivate ? (
                        <RedactedEntityCard entityType="organization" variant="chip" />
                      ) : (
                        <Chip
                          label={
                            <>
                              {getFederationRoleIcon(member.role)} {member.organizationName}
                            </>
                          }
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.common.white, 0.06),
                            color: theme.palette.text.primary,
                            fontSize: '0.72rem',
                            height: 24,
                            borderLeft: `3px solid ${getFederationRoleColor(member.role, theme)}`,
                            border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                            borderLeftColor: getFederationRoleColor(member.role, theme),
                            borderLeftWidth: 3,
                          }}
                        />
                      )}
                    </span>
                  </Tooltip>
                );
              })}
              {memberOrganizations.length > 4 && (
                <Chip
                  label={`+${memberOrganizations.length - 4} more`}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.common.white, 0.06),
                    color: theme.palette.text.secondary,
                    fontSize: '0.7rem',
                    height: 24,
                    border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                  }}
                />
              )}
            </Stack>
          </Box>
        )}

        {/* Stats Row */}
        <Stack direction="row" spacing={2.5} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
          {/* Shared Resources */}
          {sharedResourceTypes.length > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LinkIcon sx={{ fontSize: 15, color: theme.palette.text.secondary }} />
              <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.primary }}>
                {sharedResourceTypes.length} shared
              </Typography>
              <Stack direction="row" spacing={0.3} sx={{ ml: 0.3 }}>
                {sharedResourceTypes.slice(0, 3).map(type => (
                  <Chip
                    key={type}
                    label={getResourceTypeLabel(type)}
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
            </Stack>
          )}

          {/* Treaties */}
          {treatyCount > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <DocumentIcon sx={{ fontSize: 15, color: theme.palette.text.secondary }} />
              <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.primary }}>
                {treatyCount} {treatyCount === 1 ? 'treaty' : 'treaties'}
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* Spacer to push footer down */}
        <Box sx={{ flex: 1 }} />

        {/* Divider */}
        <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.common.white, 0.06)}`, mb: 1.5 }} />

        {/* Footer */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ flexWrap: 'wrap', gap: 1 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {showContact && (
              <Tooltip title="Contact Alliance">
                <IconButton
                  size="small"
                  aria-label="Contact alliance"
                  onClick={e => {
                    e.stopPropagation();
                    onViewDetails?.(federationSlug);
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
              aria-label="Apply to join alliance"
              onClick={e => {
                e.stopPropagation();
                onViewDetails?.(federationSlug);
              }}
              sx={{
                bgcolor: theme.palette.secondary.dark,
                color: theme.palette.common.white,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                px: 2,
                py: 0.5,
                borderRadius: 1.5,
                '&:hover': {
                  bgcolor: theme.palette.secondary.dark,
                  filter: 'brightness(1.2)',
                },
              }}
            >
              Apply
            </Button>
            <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.disabled }}>
              Est. {formattedDate}
            </Typography>
          </Stack>

          {/* Social Links */}
          {hasSocials && <SocialLinksBar discordInvite={discordUrl} websiteUrl={websiteUrl} />}
        </Stack>
      </Box>
    </Box>
  );
};
