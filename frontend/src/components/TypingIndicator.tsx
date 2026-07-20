/**
 * TypingIndicator Component
 * Shows animated typing indicator for users who are typing
 */

import type { PresenceState } from '@/types/apiV2';
import React from 'react';

import { Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
interface TypingIndicatorProps {
  typingUsers: Map<string, { user: PresenceState; location: string }>;
  location?: string;
  maxDisplay?: number;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers,
  location,
  maxDisplay = 3,
}) => {
  const theme = useTheme();

  // Filter typing users by location if specified
  const relevantTyping = Array.from(typingUsers.entries()).filter(
    ([_, data]) => !location || data.location === location
  );

  if (relevantTyping.length === 0) {
    return null;
  }

  // Get display names
  const displayNames = relevantTyping
    .slice(0, maxDisplay)
    .map(([_, data]) => data.user.user.displayName);

  const remaining = relevantTyping.length - displayNames.length;

  // Format text
  let text = '';
  if (displayNames.length === 1) {
    text = `${displayNames[0]} is typing`;
  } else if (displayNames.length === 2) {
    text = `${displayNames[0]} and ${displayNames[1]} are typing`;
  } else if (displayNames.length === 3) {
    text = `${displayNames[0]}, ${displayNames[1]}, and ${displayNames[2]} are typing`;
  }

  if (remaining > 0) {
    text += ` and ${remaining} ${remaining === 1 ? 'other' : 'others'}`;
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes typing-dot {
            0%, 100% { opacity: 0.6; transform: none; }
          }
        }
      `}</style>

      {/* Animated dots */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main,
              animation: 'typing-dot 1.4s infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </Stack>

      {/* Text */}
      <Typography
        sx={{
          fontSize: '0.875rem',
          color: 'primary.main',
          fontStyle: 'italic',
        }}
      >
        {text}...
      </Typography>
    </Stack>
  );
};
