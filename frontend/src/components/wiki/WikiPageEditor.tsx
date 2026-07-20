/**
 * WikiPageEditor — Markdown editor for creating and editing wiki pages.
 *
 * Uses @uiw/react-md-editor for the split-pane Markdown editing experience.
 * Supports both create (no initial page) and edit (existing page) modes.
 *
 * @module wiki
 */

import SaveIcon from '@mui/icons-material/Save';
import { Autocomplete, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MDEditor from '@uiw/react-md-editor';
import React, { useCallback, useEffect, useState } from 'react';

import type {
  CreateWikiPageRequest,
  UpdateWikiPageRequest,
  WikiPage,
} from '@sc-fleet-manager/shared-types';

// ─── Props ─────────────────────────────────────────────────────

export interface WikiPageEditorProps {
  /** Existing page to edit. When undefined, the editor is in "create" mode. */
  page?: WikiPage;
  /** Parent page id for new child pages. */
  parentPageId?: string | null;
  /** Whether the save mutation is in progress. */
  saving?: boolean;
  /** Called with the page data when the user clicks Save. */
  onSave: (data: CreateWikiPageRequest | UpdateWikiPageRequest) => void;
  /** Called when the user clicks Cancel. */
  onCancel: () => void;
}

// ─── Component ─────────────────────────────────────────────────

export const WikiPageEditor: React.FC<Readonly<WikiPageEditorProps>> = ({
  page,
  parentPageId,
  saving = false,
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(page);
  const theme = useTheme();

  const [title, setTitle] = useState(page?.title ?? '');
  const [content, setContent] = useState(page?.content ?? '');
  const [tags, setTags] = useState<string[]>(page?.tags ?? []);
  const [changeDescription, setChangeDescription] = useState('');

  // Reset form when the page prop changes (e.g. navigating to a different page)
  useEffect(() => {
    setTitle(page?.title ?? '');
    setContent(page?.content ?? '');
    setTags(page?.tags ?? []);
    setChangeDescription('');
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    if (!title.trim()) return;

    if (isEditing) {
      const updateData: UpdateWikiPageRequest = {
        title: title.trim(),
        content,
        tags,
      };
      if (changeDescription.trim()) {
        updateData.changeDescription = changeDescription.trim();
      }
      onSave(updateData);
    } else {
      const createData: CreateWikiPageRequest = {
        title: title.trim(),
        content,
        tags,
      };
      if (parentPageId) {
        createData.parentPageId = parentPageId;
      }
      onSave(createData);
    }
  }, [title, content, tags, changeDescription, isEditing, parentPageId, onSave]);

  const isSaveDisabled = saving || !title.trim();

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 3, px: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {isEditing ? 'Edit Page' : 'New Page'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="text" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isSaveDisabled}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Box>

      {/* Title */}
      <TextField
        label="Page Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        fullWidth
        required
        error={title.length > 0 && !title.trim()}
        helperText={title.length > 0 && !title.trim() ? 'Title cannot be blank' : undefined}
        sx={{ mb: 2 }}
      />

      {/* Tags */}
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={tags}
        onChange={(_event, newValue) => setTags(newValue as string[])}
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- no slots.tag replacement in MUI v7
        renderTags={(value: string[], getTagProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return <Chip key={key} label={option} size="small" variant="outlined" {...tagProps} />;
          })
        }
        renderInput={params => (
          <TextField
            {...params}
            label="Tags"
            placeholder="Type and press Enter to add tags"
            size="small"
          />
        )}
        sx={{ mb: 2 }}
      />

      {/* Markdown Editor */}
      <Box
        data-color-mode={theme.palette.mode}
        sx={{
          mb: 2,
          minHeight: 400,
          '& .w-md-editor': {
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          },
          '& .w-md-editor-toolbar': {
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
          },
          '& .w-md-editor-toolbar li > button': {
            color: 'text.primary',
          },
          '& .w-md-editor-content': {
            bgcolor: 'background.paper',
          },
          '& .w-md-editor-text-pre, & .w-md-editor-text-input, & .w-md-editor-text': {
            color: 'text.primary !important',
          },
          '& .wmde-markdown': {
            bgcolor: 'background.paper',
            color: 'text.primary',
          },
        }}
      >
        <MDEditor
          value={content}
          onChange={val => setContent(val ?? '')}
          height={500}
          preview="live"
        />
      </Box>

      {/* Change description (edit mode only) */}
      {isEditing && (
        <TextField
          label="Change description (optional)"
          value={changeDescription}
          onChange={e => setChangeDescription(e.target.value)}
          fullWidth
          size="small"
          placeholder="Briefly describe what you changed"
          sx={{ mb: 2 }}
        />
      )}
    </Box>
  );
};
