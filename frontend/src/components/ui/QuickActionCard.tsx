/**
 * QuickActionCard Component - Interactive action card for dashboard quick actions
 *
 * This component provides a consistent, accessible card for navigation actions
 * on the dashboard, using CSS variables for theming support.
 */

import { Avatar, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import './QuickActionCard.css';

export interface QuickActionCardProps {
  /** Title of the action card */
  title: string;
  /** Description text shown below the title */
  description: string;
  /** Icon component to display (MUI or Spectrum) */
  icon: React.ComponentType<{ className?: string; sx?: Record<string, unknown> }>;
  /** Optional image URL to display instead of the icon (e.g. team emblem) */
  imageUrl?: string;
  /** Click handler for navigation */
  onClick: () => void;
}

/**
 * QuickActionCard component for dashboard quick actions.
 *
 * @example
 * <QuickActionCard
 *   title="Fleet Management"
 *   description="Manage your fleet and ships"
 *   icon={BoxList}
 *   onClick={() => navigate('/fleet')}
 * />
 */
export function QuickActionCard({
  title,
  description,
  icon: Icon,
  imageUrl,
  onClick,
}: Readonly<QuickActionCardProps>): React.ReactElement {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      className="quick-action-card"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      type="button"
      aria-label={`${title}: ${description}`}
    >
      <Paper
        elevation={1}
        sx={{
          height: '100%',
          padding: 2,
          borderRadius: 1,
          transition: theme => theme.transitions.create('box-shadow', { duration: 200 }),
          '&:hover': { boxShadow: 3 },
        }}
      >
        <Stack
          direction="column"
          spacing={1.5}
          alignItems="center"
          justifyContent="center"
          height="100%"
        >
          {imageUrl ? (
            <Avatar src={imageUrl} alt={title} variant="rounded" sx={{ width: 48, height: 48 }} />
          ) : (
            <Icon className="quick-action-card__icon" sx={{ fontSize: 48 }} />
          )}
          <Typography variant="h6" className="quick-action-card__title">
            {title}
          </Typography>
          <Typography className="quick-action-card__description">{description}</Typography>
        </Stack>
      </Paper>
    </button>
  );
}
