/**
 * Discord Bot Preview
 *
 * Showcase of key bot commands with "Add to Server" CTA.
 */

import TerminalIcon from '@mui/icons-material/Terminal';
import type { SvgIconProps } from '@mui/material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  SvgIcon,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import { getBackendUrl } from '@/config/env';
import { DISCORD_BLUE, DISCORD_BLUE_HOVER } from '@/utils/brandColors';

const DiscordIcon: React.FC<SvgIconProps> = props => (
  <SvgIcon {...props} viewBox="0 -28.5 256 256">
    <path
      d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.825 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.015-11.805-23.015-26.18s10.148-26.2 23.015-26.2c12.866 0 23.236 11.825 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z"
      fill="currentColor"
    />
  </SvgIcon>
);

interface BotCommand {
  command: string;
  description: string;
}

const commands: BotCommand[] = [
  { command: '/events', description: 'Create, manage, and join events with full RSVP' },
  { command: '/lfg', description: 'Quick group formation for any activity' },
  { command: '/bounty', description: 'Create, claim, and track org bounties' },
  { command: '/verify', description: 'Link & verify your RSI account' },
  { command: '/commlink', description: 'Cross-server chat bridges between orgs' },
  { command: '/community', description: 'Giveaways, polls, announcements & more' },
];

const BOT_PERMISSIONS = '1419813317751';

/**
 * Build the Discord bot invite URL.
 *
 * When orgId and userId are provided (from org settings), the URL routes
 * through the backend which adds redirect_uri and state parameters.
 * After the user authorizes the bot, Discord redirects back to the backend
 * callback which auto-creates the guild-org mapping — no manual guild ID step needed.
 *
 * Without orgId (public/landing page), opens Discord directly with no callback.
 */
export function buildBotInviteUrl(orgId?: string, userId?: string): string {
  const explicit = import.meta.env.VITE_DISCORD_BOT_INVITE_URL as string | undefined;

  // If org context is provided, always route through backend for auto-connect
  if (orgId && userId) {
    const backendUrl = getBackendUrl();
    return `${backendUrl}/api/v2/auth/bot-invite?orgId=${encodeURIComponent(orgId)}&userId=${encodeURIComponent(userId)}`;
  }

  if (explicit) return explicit;

  // Bot application ID is separate from the OAuth client ID used for user login
  const botClientId = import.meta.env.VITE_DISCORD_BOT_CLIENT_ID;
  if (botClientId) {
    return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(botClientId)}&scope=bot+applications.commands&permissions=${BOT_PERMISSIONS}`;
  }

  // Fallback: redirect through backend (which has DISCORD_BOT_CLIENT_ID)
  const backendUrl = getBackendUrl();
  return `${backendUrl}/api/v2/auth/bot-invite`;
}

export const DiscordBotPreview: React.FC = () => {
  const theme = useTheme();
  const botInviteUrl = buildBotInviteUrl();

  return (
    <Box sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          {/* Left — description */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <DiscordIcon sx={{ fontSize: 32, color: DISCORD_BLUE }} />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: { xs: '1.5rem', md: '2rem' },
                  }}
                >
                  Discord Bot
                </Typography>
              </Stack>
              <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                32 slash commands across 8 domains — events, bounties, LFG, RSI sync, moderation,
                recruitment, diplomacy, community tools, and more. Every command opens a visual
                button panel — just click the action you want.
              </Typography>
              <Button
                variant="contained"
                size="large"
                component="a"
                href={botInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  alignSelf: 'flex-start',
                  px: 4,
                  py: 1.5,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderRadius: 2,
                  background: DISCORD_BLUE,
                  '&:hover': { background: DISCORD_BLUE_HOVER },
                }}
              >
                Add to Server
              </Button>
            </Stack>
          </Grid>

          {/* Right — command cards */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card
              sx={{
                background: alpha(theme.palette.background.default, 0.6),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(DISCORD_BLUE, 0.2)}`,
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: 0 }}>
                {/* Terminal header */}
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: `1px solid ${alpha(DISCORD_BLUE, 0.15)}`,
                  }}
                >
                  <TerminalIcon sx={{ fontSize: 16, color: DISCORD_BLUE }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    fringe-core-bot
                  </Typography>
                </Stack>

                {/* Commands list */}
                <Box sx={{ p: 2 }}>
                  {commands.map(cmd => (
                    <Stack
                      key={cmd.command}
                      direction="row"
                      spacing={2}
                      alignItems="baseline"
                      sx={{ py: 0.75 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: 'primary.main',
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                          minWidth: 160,
                        }}
                      >
                        {cmd.command}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {cmd.description}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
