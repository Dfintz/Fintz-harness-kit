import { Inventory2 as BoxIcon } from '@mui/icons-material';
import { alpha, Box, Button, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: IconComponent = BoxIcon,
  actionLabel,
  onAction,
}) => {
  const theme = useTheme();
  return (
    <Stack
      direction="column"
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{
        minHeight: 400,
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.4)} 0%, ${alpha(theme.palette.background.default, 0.6)} 100%)`,
        borderRadius: '16px',
        border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
        padding: '48px 24px',
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
      >
        <IconComponent sx={{ fontSize: 48, color: theme.palette.text.secondary }} />
      </Box>
      <Typography
        sx={{
          fontSize: '1.25rem',
          color: theme.palette.text.primary,
          fontWeight: 600,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          color: theme.palette.text.secondary,
          textAlign: 'center',
          maxWidth: 400,
          lineHeight: 1.6,
        }}
      >
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" color="primary" onClick={onAction} sx={{ mt: 2 }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
};
