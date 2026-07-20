import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha, lighten, useTheme } from '@mui/material/styles';
import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  helpTooltip?: string;
  primaryAction?: {
    label: string;
    icon?: React.ElementType;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    icon?: React.ElementType;
    onPress: () => void;
  };
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  helpTooltip,
  primaryAction,
  secondaryAction,
}) => {
  const theme = useTheme();

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            variant="h1"
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${lighten(theme.palette.primary.main, 0.3)} 50%, ${theme.palette.primary.main} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              textShadow: `0 0 40px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            {title}
          </Typography>
          {helpTooltip && <HelpTooltip content={helpTooltip} icon iconSize="sm" position="right" />}
        </Stack>
        {description && (
          <Typography
            sx={{
              fontSize: '1rem',
              color: 'text.secondary',
              mt: 0.75,
              display: 'block',
            }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {(primaryAction || secondaryAction) && (
        <Stack direction="row" spacing={1.5}>
          {secondaryAction && (
            <Button
              variant="outlined"
              onClick={secondaryAction.onPress}
              startIcon={
                secondaryAction.icon ? React.createElement(secondaryAction.icon) : undefined
              }
            >
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant="contained"
              color="primary"
              onClick={primaryAction.onPress}
              startIcon={primaryAction.icon ? React.createElement(primaryAction.icon) : undefined}
            >
              {primaryAction.label}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
};
