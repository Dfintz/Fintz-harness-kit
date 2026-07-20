import LockIcon from '@mui/icons-material/Lock';
import { Chip, Paper, Stack, Typography } from '@mui/material';
import React from 'react';

interface RedactedEntityCardProps {
  /** The type of entity being redacted */
  entityType: 'organization' | 'alliance';
  /** Display variant: 'card' (full Paper) or 'chip' (compact Chip) */
  variant?: 'card' | 'chip';
}

/**
 * RedactedEntityCard — Shared component for displaying non-public entities
 * to users who do not have access.
 *
 * RSI-style redacted display:
 * - Card variant: Gray Paper, opacity 0.5, italic "Redacted" heading
 * - Chip variant: LockIcon, italic text, dark background
 *
 * Extracted from FederationDetailsPage and PublicFederationCard inline styles.
 */
export const RedactedEntityCard: React.FC<RedactedEntityCardProps> = ({
  entityType,
  variant = 'card',
}) => {
  const label = entityType === 'organization' ? 'Private Organization' : 'Private Alliance';

  if (variant === 'chip') {
    return (
      <Chip
        icon={<LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />}
        label={label}
        size="small"
        sx={{
          bgcolor: 'background.default',
          color: 'text.disabled',
          fontSize: '0.72rem',
          height: 24,
          fontStyle: 'italic',
          borderWidth: '1px 1px 1px 3px',
          borderStyle: 'solid',
          borderColor: 'divider',
        }}
      />
    );
  }

  return (
    <Paper
      role="status"
      aria-label={`Content redacted: ${label}`}
      sx={{
        p: 2,
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        opacity: 0.5,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <LockIcon sx={{ fontSize: 24, color: 'text.disabled', filter: 'grayscale(1)' }} />
        <Stack direction="column" spacing={0.25} sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, color: 'text.disabled', fontStyle: 'italic' }}>
            Redacted
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>{label}</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
};
