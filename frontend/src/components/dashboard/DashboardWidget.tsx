/**
 * DashboardWidget — Generic reusable widget container for the dashboard.
 *
 * Provides a consistent card frame with collapsible content, optional
 * hide/show toggle, and drag-handle placeholder for future reorder.
 *
 * Widgets register via a `widgetId` so user preferences can persist
 * which widgets are visible and in what order.
 */

import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import React, { Component, useState } from 'react';

export interface DashboardWidgetProps {
  /** Unique identifier for persistence */
  widgetId: string;
  /** Display title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Widget content */
  children: React.ReactNode;
  /** Whether the widget can be collapsed */
  collapsible?: boolean;
  /** Whether the widget can be hidden by the user */
  hideable?: boolean;
  /** Callback when user hides this widget */
  onHide?: (widgetId: string) => void;
  /** Start collapsed */
  defaultCollapsed?: boolean;
  /** Optional icon to show next to the title */
  icon?: React.ReactNode;
  /** Optional action buttons in the header */
  headerActions?: React.ReactNode;
  /** Compact mode — less padding */
  compact?: boolean;
  /** Whether to show the drag indicator for reordering (future) */
  draggable?: boolean;
  /** Custom sx for the outer card */
  sx?: SxProps<Theme>;
  /** Show skeleton loading state inside the widget */
  loading?: boolean;
}

/**
 * Widget-level error isolation — prevents one widget crashing from taking down the dashboard.
 */
class WidgetErrorBoundary extends Component<
  { widgetId: string; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Alert severity="warning" sx={{ m: 1 }}>
          This widget encountered an error and has been disabled.
        </Alert>
      );
    }
    return this.props.children;
  }
}

/** Skeleton placeholder for loading widget content */
const WidgetSkeleton: React.FC = () => (
  <Stack gap={1} sx={{ p: 1 }}>
    <Skeleton variant="rounded" height={32} />
    <Skeleton variant="rounded" height={80} />
    <Skeleton variant="text" width="60%" />
  </Stack>
);

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  widgetId,
  title,
  subtitle,
  children,
  collapsible = true,
  hideable = true,
  onHide,
  defaultCollapsed = false,
  icon,
  headerActions,
  compact = false,
  draggable = false,
  sx,
  loading = false,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <Card
      data-widget-id={widgetId}
      sx={[
        theme => ({
          bgcolor: alpha(theme.palette.common.white, 0.05),
          border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
          borderRadius: 2,
          overflow: 'visible',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }),
        ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
      ]}
    >
      {/* Widget Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={theme => ({
          px: compact ? 1.5 : 2,
          py: compact ? 1 : 1.5,
          borderBottom: collapsed ? 'none' : `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
          cursor: collapsible ? 'pointer' : 'default',
          '&:hover': collapsible ? { bgcolor: alpha(theme.palette.primary.main, 0.04) } : undefined,
        })}
        onClick={() => collapsible && setCollapsed(prev => !prev)}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          {draggable && (
            <DragIndicatorIcon
              fontSize="small"
              sx={theme => ({ color: theme.palette.text.secondary, cursor: 'grab' })}
            />
          )}
          {icon}
          <Box>
            <Typography
              variant={compact ? 'subtitle1' : 'h6'}
              sx={{ fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" gap={0.5} onClick={e => e.stopPropagation()}>
          {headerActions}
          {hideable && onHide && (
            <Tooltip title="Hide this widget">
              <IconButton size="small" onClick={() => onHide(widgetId)}>
                <VisibilityOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {collapsible && (
            <IconButton
              size="small"
              onClick={() => setCollapsed(prev => !prev)}
              aria-label={collapsed ? 'Expand widget' : 'Collapse widget'}
            >
              {collapsed ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ExpandLessIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Stack>
      </Stack>

      {/* Widget Content */}
      <Collapse in={!collapsed} sx={{ flex: collapsed ? 0 : 1, '& .MuiCollapse-wrapperInner': { display: 'flex', flexDirection: 'column', flex: 1 } }}>
        <CardContent
          sx={{
            px: compact ? 1.5 : 2,
            py: compact ? 1 : 2,
            '&:last-child': { pb: compact ? 1 : 2 },
            flex: 1,
          }}
        >
          <WidgetErrorBoundary widgetId={widgetId}>
            {loading ? <WidgetSkeleton /> : children}
          </WidgetErrorBoundary>
        </CardContent>
      </Collapse>
    </Card>
  );
};
