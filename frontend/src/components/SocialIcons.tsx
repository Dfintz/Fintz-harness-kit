/**
 * SocialIcons - Brand social media icons for directory cards
 *
 * Uses proper brand SVGs for Discord, Twitter/X, YouTube, Twitch, RSI.
 * Each icon is an SVG inline component for crisp rendering at any size.
 */
import { Box, Tooltip } from '@mui/material';
import React from 'react';

// ── Brand SVG Icons ──────────────────────────────────────────────────────────

export const DiscordIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = 'currentColor',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export const TwitterXIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = 'currentColor',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const YouTubeIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = 'currentColor',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const TwitchIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = 'currentColor',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
  </svg>
);

export const RsiIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = 'currentColor',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    {/* Star Citizen stylised star logo */}
    <path d="M12 0l3.09 6.26L22 7.27l-5 4.87L18.18 19 12 15.77 5.82 19 7 12.14l-5-4.87 6.91-1.01L12 0z" />
  </svg>
);

export const WebsiteIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

// ── Social Link Bar ──────────────────────────────────────────────────────────

interface SocialLink {
  type: 'discord' | 'twitter' | 'youtube' | 'twitch' | 'rsi' | 'website';
  url: string;
  label: string;
}

interface SocialLinksBarProps {
  rsiUrl?: string;
  discordInvite?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  websiteUrl?: string;
  size?: 'small' | 'medium';
}

const SOCIAL_CONFIG: Record<
  SocialLink['type'],
  {
    icon: React.FC<{ size?: number; color?: string }>;
    color: string;
    hoverColor: string;
    label: string;
  }
> = {
  discord: { icon: DiscordIcon, color: '#8b949e', hoverColor: '#5865F2', label: 'Discord' },
  twitter: { icon: TwitterXIcon, color: '#8b949e', hoverColor: '#ffffff', label: 'X (Twitter)' },
  youtube: { icon: YouTubeIcon, color: '#8b949e', hoverColor: '#FF0000', label: 'YouTube' },
  twitch: { icon: TwitchIcon, color: '#8b949e', hoverColor: '#9146FF', label: 'Twitch' },
  rsi: {
    icon: RsiIcon,
    color: '#8b949e',
    hoverColor: '#00bcd4',
    label: 'Star Citizen / RSI',
  },
  website: { icon: WebsiteIcon, color: '#8b949e', hoverColor: '#58a6ff', label: 'Website' },
};

export const SocialLinksBar: React.FC<SocialLinksBarProps> = ({
  rsiUrl,
  discordInvite,
  twitterUrl,
  youtubeUrl,
  twitchUrl,
  websiteUrl,
  size = 'small',
}) => {
  const links: SocialLink[] = [];

  if (discordInvite) {
    const url = discordInvite.startsWith('http')
      ? discordInvite
      : `https://discord.gg/${discordInvite}`;
    links.push({ type: 'discord', url, label: 'Discord' });
  }
  if (twitterUrl) links.push({ type: 'twitter', url: twitterUrl, label: 'X (Twitter)' });
  if (youtubeUrl) links.push({ type: 'youtube', url: youtubeUrl, label: 'YouTube' });
  if (twitchUrl) links.push({ type: 'twitch', url: twitchUrl, label: 'Twitch' });
  if (rsiUrl) links.push({ type: 'rsi', url: rsiUrl, label: 'Star Citizen / RSI' });
  if (websiteUrl) links.push({ type: 'website', url: websiteUrl, label: 'Website' });

  if (links.length === 0) return null;

  const iconSize = size === 'small' ? 18 : 22;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      {links.map(link => {
        const config = SOCIAL_CONFIG[link.type];
        const Icon = config.icon;
        return (
          <Tooltip key={link.type} title={link.label}>
            <Box
              component="a"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              sx={{
                color: config.hoverColor,
                p: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.85,
                cursor: 'pointer',
                textDecoration: 'none',
                borderRadius: 1,
                transition: 'opacity 0.2s',
                '&:hover': {
                  opacity: 1,
                },
              }}
            >
              <Icon size={iconSize} color={config.hoverColor} />
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};
