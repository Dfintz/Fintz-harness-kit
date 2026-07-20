/**
 * Card Component - Unified card component for the SC Fleet Manager Design System
 *
 * This component provides a consistent card interface using Adobe React Spectrum's
 * Well component as the base for consistent styling.
 */

import { ErrorOutline as ErrorIcon } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import { type Theme, alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import { Divider } from './Divider';
import { Well } from './Well';

export interface CardProps {
  /** Title of the card (renders in header) */
  title?: React.ReactNode;
  /** Subtitle of the card (renders below title) */
  subtitle?: React.ReactNode;
  /** Action element (e.g., button) for the header */
  headerAction?: React.ReactNode;
  /** Content for the card footer */
  footer?: React.ReactNode;
  /** Card variant */
  variant?: 'elevated' | 'outlined' | 'filled';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Whether the card is interactive (hoverable) */
  interactive?: boolean;
  /** Card content */
  children?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Additional class name */
  className?: string;
  /** Whether the card is in an error state */
  error?: boolean;
  /** Error message to display when error is true */
  errorMessage?: string;
  /** Callback to retry the failed operation */
  onRetry?: () => void;
}

// Padding map to Spectrum size tokens
const _paddingMap: Record<string, string> = {
  none: '0',
  sm: 'size-100',
  md: 'size-200',
  lg: 'size-300',
};

/**
 * Card component with consistent styling across the application.
 *
 * @example
 * // Basic card with title
 * <Card title="Fleet OverBox">
 *   <p>Content here</p>
 * </Card>
 *
 * // Card with header action
 * <Card
 *   title="Ships"
 *   subtitle="Total: 15"
 *   headerAction={<Button size="sm">Add Ship</Button>}
 * >
 *   <ShipList />
 * </Card>
 *
 * // Interactive card
 * <Card
 *   variant="outlined"
 *   interactive
 *   onClick={() => navigate('/details')}
 * >
 *   <p>Click me!</p>
 * </Card>
 */
function CardErrorContent({
  errorMessage,
  onRetry,
}: Readonly<{
  errorMessage?: string;
  onRetry?: () => void;
}>): React.ReactElement {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 3,
        px: 2,
        textAlign: 'center',
      }}
    >
      <ErrorIcon sx={{ fontSize: 40, color: theme.palette.error.main, mb: 1 }} />
      <Typography variant="body2" sx={{ color: theme.palette.error.main, mb: onRetry ? 2 : 0 }}>
        {errorMessage || 'Something went wrong'}
      </Typography>
      {onRetry && (
        <Button variant="outlined" size="small" color="error" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Box>
  );
}

function getVariantStyles(
  variant: CardProps['variant'],
  error: boolean,
  theme: Theme
): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: theme.shape.borderRadius,
    transition: theme.transitions.create(['box-shadow', 'transform'], { duration: 200 }),
  };

  const errorOverride: React.CSSProperties = error
    ? { border: `2px solid ${theme.palette.error.main}` }
    : {};

  switch (variant) {
    case 'elevated':
      return {
        ...base,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        ...errorOverride,
      };
    case 'outlined':
      return {
        ...base,
        boxShadow: 'none',
        border: error
          ? `2px solid ${theme.palette.error.main}`
          : `1px solid ${theme.palette.divider}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.4),
      };
    case 'filled':
      return {
        ...base,
        boxShadow: 'none',
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        ...errorOverride,
      };
    default:
      return { ...base, ...errorOverride };
  }
}

function getInteractiveProps(
  interactive: boolean,
  onClick: (() => void) | undefined,
  title?: React.ReactNode
): Record<string, unknown> {
  if (!interactive) return { style: { height: '100%' } };

  const handleClick = () => {
    if (onClick) onClick();
  };

  return {
    onClick: handleClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    role: 'button',
    tabIndex: 0,
    'aria-label': typeof title === 'string' ? title : undefined,
    style: { height: '100%' },
  };
}

export function Card({
  title,
  subtitle,
  headerAction,
  footer,
  variant = 'elevated',
  padding = 'md',
  interactive = false,
  children,
  onClick,
  className,
  error = false,
  errorMessage,
  onRetry,
}: Readonly<CardProps>): React.ReactElement {
  const theme = useTheme();

  return (
    <Well
      className={className}
      sx={{
        ...getVariantStyles(variant, error, theme),
        ...(interactive ? { cursor: 'pointer' } : {}),
        padding: padding === 'none' ? '0' : undefined,
      }}
    >
      <div {...getInteractiveProps(interactive, onClick, title)}>
        {(title || headerAction) && (
          <Stack justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              {title &&
                (typeof title === 'string' ? (
                  <Typography variant="h6" sx={{ margin: 0, color: theme.palette.primary.main }}>
                    {title}
                  </Typography>
                ) : (
                  title
                ))}
              {subtitle && (
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {headerAction && <Box>{headerAction}</Box>}
          </Stack>
        )}

        {error ? (
          <CardErrorContent errorMessage={errorMessage} onRetry={onRetry} />
        ) : (
          <>
            {children && (
              <Box paddingTop={title || headerAction ? 'size-100' : undefined}>{children}</Box>
            )}

            {footer && (
              <>
                <Divider size="S" sx={{ my: 1 }} />
                <Box>{footer}</Box>
              </>
            )}
          </>
        )}
      </div>
    </Well>
  );
}

/**
 * CardHeader component for use as children of Card
 * Provides a consistent header layout within a card
 */
export interface CardHeaderProps {
  /** Card title */
  title: React.ReactNode;
  /** Card subtitle */
  subtitle?: React.ReactNode;
  /** Action element for the header */
  action?: React.ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: Readonly<CardHeaderProps>): React.ReactElement {
  const theme = useTheme();

  return (
    <Stack justifyContent="space-between" alignItems="center" mb={2}>
      <Box>
        {typeof title === 'string' ? (
          <Typography variant="h6" sx={{ margin: 0, color: theme.palette.primary.main }}>
            {title}
          </Typography>
        ) : (
          title
        )}
        {subtitle && (
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box>{action}</Box>}
    </Stack>
  );
}

/**
 * CardContent component for use as children of Card
 * Wraps the main content area of a card
 */
export interface CardContentProps {
  /** Card content */
  children: React.ReactNode;
}

export function CardContent({ children }: Readonly<CardContentProps>): React.ReactElement {
  return <Box paddingTop="size-100">{children}</Box>;
}

/**
 * CardActions component for use as children of Card
 * Provides a footer area for action buttons
 */
export interface CardActionsProps {
  /** Action elements (buttons, links, etc.) */
  children: React.ReactNode;
}

export function CardActions({ children }: Readonly<CardActionsProps>): React.ReactElement {
  return (
    <>
      <Divider size="S" sx={{ my: 1 }} />
      <Stack justifyContent="end" spacing={1}>
        {children}
      </Stack>
    </>
  );
}
