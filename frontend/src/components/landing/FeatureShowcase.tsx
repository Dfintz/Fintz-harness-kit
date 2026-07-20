/**
 * Feature Showcase
 *
 * Grid of feature cards with icons for the landing page.
 */

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import GroupsIcon from '@mui/icons-material/Groups';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import type { SvgIconProps } from '@mui/material';
import { Box, Card, CardContent, Container, Grid, SvgIcon, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

import { scColors } from '@/components/ui/tokens';
import { DISCORD_BLUE } from '@/utils/brandColors';

const DiscordIcon: React.FC<SvgIconProps> = props => (
  <SvgIcon {...props} viewBox="0 -28.5 256 256">
    <path
      d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.825 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.015-11.805-23.015-26.18s10.148-26.2 23.015-26.2c12.866 0 23.236 11.825 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z"
      fill="currentColor"
    />
  </SvgIcon>
);

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const features: Feature[] = [
  {
    icon: <RocketLaunchIcon sx={{ fontSize: 40 }} />,
    title: 'Fleet Management',
    description:
      'Track every ship in your organization. Import from RSI, manage loadouts, assign crews, analyze fleet composition, and monitor capabilities like refuel, rearm, and repair.',
    color: scColors.cyan[500],
  },
  {
    icon: <GroupsIcon sx={{ fontSize: 40 }} />,
    title: 'Org Management',
    description:
      'Multi-tenant architecture with roles, permissions, org hierarchy, member audit, custom titles and badges, alliances, and real-time collaboration.',
    color: scColors.secondary,
  },
  {
    icon: <GpsFixedIcon sx={{ fontSize: 40 }} />,
    title: 'Bounty & Operations',
    description:
      'Full bounty lifecycle — post, hunt, claim, and verify. Plan operations with tactical briefings, ready checks, chain of command, and formation planning.',
    color: scColors.error,
  },
  {
    icon: <LocalShippingIcon sx={{ fontSize: 40 }} />,
    title: 'Trade & Logistics',
    description:
      'Plan trade routes with live commodity pricing from UEX Corp, manage price alerts, track cargo, and optimize profit across the verse.',
    color: scColors.warning,
  },
  {
    icon: <DiscordIcon sx={{ fontSize: 40 }} />,
    title: 'Discord Integration',
    description:
      '32 slash commands across 8 domains. Event RSVP, comm link relays, voice channels, LFG, moderation auto-sync, and full org management from Discord. Every command opens a visual button panel.',
    color: DISCORD_BLUE,
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 40 }} />,
    title: 'Privacy & Zero Trust',
    description:
      'AES-256 encryption, GDPR-compliant data handling, WebAuthn passkeys, TOTP 2FA, zero-trust architecture, and zero-knowledge principles.',
    color: scColors.success,
  },
  {
    icon: <CalendarMonthIcon sx={{ fontSize: 40 }} />,
    title: 'Activities & Events',
    description:
      'Schedule operations, manage attendance with ready checks, set up recurring events, use activity templates, and coordinate across time zones.',
    color: scColors.blue,
  },
  {
    icon: <LeaderboardIcon sx={{ fontSize: 40 }} />,
    title: 'Analytics & Reputation',
    description:
      'Member reputation scoring, SCStats integration, activity trends, fleet analytics, bounty hunter profiles, and org-wide performance dashboards.',
    color: scColors.pink,
  },
];

export const FeatureShowcase: React.FC = () => {
  return (
    <Box id="features" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Typography
          variant="h3"
          sx={{
            textAlign: 'center',
            fontWeight: 700,
            mb: 2,
            color: 'text.primary',
            fontSize: { xs: '1.75rem', md: '2.5rem' },
          }}
        >
          Everything Your Org Needs
        </Typography>
        <Typography
          variant="body1"
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            mb: 6,
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          From fleet tracking and bounty boards to tactical briefings and treasury management —
          everything built for Star Citizen organizations of any size.
        </Typography>

        <Grid container spacing={3}>
          {features.map(feature => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.title}>
              <Card
                sx={{
                  height: '100%',
                  background: theme => alpha(theme.palette.background.paper, 0.6),
                  backdropFilter: 'blur(12px)',
                  border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  transition: theme => theme.transitions.create('all', { duration: 300 }),
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: `${feature.color}40`,
                    boxShadow: `0 8px 32px ${feature.color}15`,
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: feature.color, mb: 2 }}>{feature.icon}</Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, mb: 1, fontSize: '1rem', color: 'text.primary' }}
                  >
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};
