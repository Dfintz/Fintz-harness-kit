/**
 * WikiPageViewer — Read-only wiki page display with Markdown rendering.
 *
 * Shows the page title, metadata (last edited, tags), rendered Markdown
 * content, and action buttons (edit, delete).
 *
 * Uses @uiw/react-md-editor's Markdown component for rendering.
 *
 * @module wiki
 */

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import LockIcon from '@mui/icons-material/Lock';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MDEditor from '@uiw/react-md-editor';
import React from 'react';

import type { WikiPage } from '@sc-fleet-manager/shared-types';

// ─── Props ─────────────────────────────────────────────────────

export interface WikiPageViewerProps {
  /** The wiki page to display. */
  page: WikiPage;
  /** Whether the page is currently loading. */
  loading?: boolean;
  /** Error message if loading failed. */
  error?: string;
  /** Called when the user clicks "Edit". */
  onEdit?: () => void;
  /** Called when the user clicks "Delete". */
  onDelete?: () => void;
  /** Called when the user clicks "History". */
  onHistory?: () => void;
}

// ─── Component ─────────────────────────────────────────────────

export const WikiPageViewer: React.FC<Readonly<WikiPageViewerProps>> = ({
  page,
  loading,
  error,
  onEdit,
  onDelete,
  onHistory,
}) => {
  const theme = useTheme();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const lastEditedDate = page.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 3, px: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {page.title}
            </Typography>
            {page.isLocked && (
              <Tooltip title="This page is locked">
                <LockIcon color="warning" fontSize="small" />
              </Tooltip>
            )}
          </Stack>

          {/* Metadata */}
          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
            {lastEditedDate && (
              <Typography variant="caption" color="text.secondary">
                Last edited: {lastEditedDate}
              </Typography>
            )}
            {page.lastEditedBy && (
              <Typography variant="caption" color="text.secondary">
                by {page.lastEditedBy}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              v{page.version}
            </Typography>
          </Stack>
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={0.5}>
          {onHistory && (
            <Tooltip title="Revision history">
              <IconButton size="small" onClick={onHistory}>
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onEdit && (
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Tooltip title="Delete page">
              <IconButton size="small" color="error" onClick={onDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* Tags */}
      {page.tags && page.tags.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {page.tags.map(tag => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </Stack>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Markdown Content */}
      <Box
        data-color-mode={theme.palette.mode}
        sx={{
          '& .wmde-markdown': {
            backgroundColor: 'transparent',
            color: 'text.primary',
          },
        }}
      >
        <MDEditor.Markdown source={page.content || '*No content yet.*'} />
      </Box>
    </Box>
  );
};
