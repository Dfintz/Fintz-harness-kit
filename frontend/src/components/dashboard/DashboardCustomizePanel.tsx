/**
 * DashboardCustomizePanel — Slide-out panel to toggle widget visibility and reorder.
 *
 * Shows a list of all registered widgets with switches to show/hide each one,
 * move up/down buttons for reordering, drag-and-drop support,
 * and a "Reset" button to restore defaults.
 */

import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useRef, useState } from 'react';

export interface WidgetDefinition {
  widgetId: string;
  label: string;
  description?: string;
}

export interface DashboardCustomizePanelProps {
  open: boolean;
  onClose: () => void;
  widgets: WidgetDefinition[];
  hiddenWidgetIds: string[];
  onToggle: (widgetId: string, visible: boolean) => void;
  onReorder?: (widgetId: string, newIndex: number) => void;
  onReset: () => void;
}

export const DashboardCustomizePanel: React.FC<DashboardCustomizePanelProps> = ({
  open,
  onClose,
  widgets,
  hiddenWidgetIds,
  onToggle,
  onReorder,
  onReset,
}) => {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const handleDragStart = useCallback((widgetId: string) => {
    dragItemRef.current = widgetId;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      if (dragItemRef.current && onReorder) {
        onReorder(dragItemRef.current, targetIdx);
      }
      dragItemRef.current = null;
    },
    [onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    dragItemRef.current = null;
  }, []);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 360, p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Customize Dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
          Drag to reorder, toggle visibility, or use the arrow buttons.
        </Typography>

        <List disablePadding>
          {widgets.map((w, idx) => {
            const isVisible = !hiddenWidgetIds.includes(w.widgetId);
            const isDragTarget = dragOverIndex === idx;
            return (
              <ListItem
                key={w.widgetId}
                draggable={!!onReorder}
                onDragStart={() => handleDragStart(w.widgetId)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                sx={theme => ({
                  py: 0.5,
                  pr: 1,
                  borderTop: isDragTarget
                    ? `2px solid ${theme.palette.primary.main}`
                    : '2px solid transparent',
                  bgcolor: isDragTarget ? alpha(theme.palette.primary.main, 0.04) : undefined,
                  cursor: onReorder ? 'grab' : 'default',
                  transition: 'border-color 150ms, background-color 150ms',
                  '&:active': onReorder ? { cursor: 'grabbing' } : undefined,
                })}
                secondaryAction={
                  <Stack direction="row" alignItems="center" spacing={0}>
                    {onReorder && (
                      <>
                        <IconButton
                          size="small"
                          disabled={idx === 0}
                          onClick={() => onReorder(w.widgetId, idx - 1)}
                          aria-label={`Move ${w.label} up`}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={idx === widgets.length - 1}
                          onClick={() => onReorder(w.widgetId, idx + 1)}
                          aria-label={`Move ${w.label} down`}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    <Switch
                      edge="end"
                      checked={isVisible}
                      onChange={() => onToggle(w.widgetId, !isVisible)}
                      slotProps={{ input: { 'aria-label': `Toggle ${w.label}` } }}
                    />
                  </Stack>
                }
              >
                {onReorder && (
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <DragIndicatorIcon
                      fontSize="small"
                      sx={{ color: 'text.secondary', cursor: 'grab' }}
                    />
                  </ListItemIcon>
                )}
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <IconButton size="small" disabled>
                    {isVisible ? (
                      <VisibilityIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    ) : (
                      <VisibilityOffIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    )}
                  </IconButton>
                </ListItemIcon>
                <ListItemText
                  primary={w.label}
                  secondary={w.description}
                  slotProps={{ secondary: { sx: { color: 'var(--text-secondary)' } } }}
                />
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            startIcon={<RestoreIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              onReset();
              onClose();
            }}
          >
            Reset to Defaults
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};
