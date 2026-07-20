/**
 * ActivityTemplatesPage
 * Browse, create, and manage activity templates.
 *
 * Sprint 19-D — Activity Templates Frontend
 */

import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import type { SelectChangeEvent } from '@mui/material/Select';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useActivityTemplates,
  useCloneActivityTemplate,
  useDeleteActivityTemplate,
} from '@/hooks/queries/useActivityTemplateQueries';
import {
  ActivityTemplateCategory,
  type ActivityTemplate,
  type ActivityTemplateQueryFilters,
} from '@/types/apiV2';
import { logger } from '@/utils/logger';

import { ApplyActivityTemplateDialog } from './ApplyActivityTemplateDialog';
import { CreateActivityTemplateDialog } from './CreateActivityTemplateDialog';

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_OPTIONS: { value: ActivityTemplateCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: ActivityTemplateCategory.COMBAT, label: 'Combat' },
  { value: ActivityTemplateCategory.MINING, label: 'Mining' },
  { value: ActivityTemplateCategory.TRADING, label: 'Trading' },
  { value: ActivityTemplateCategory.EXPLORATION, label: 'Exploration' },
  { value: ActivityTemplateCategory.LOGISTICS, label: 'Logistics' },
  { value: ActivityTemplateCategory.SOCIAL, label: 'Social' },
  { value: ActivityTemplateCategory.TRAINING, label: 'Training' },
  { value: ActivityTemplateCategory.CUSTOM, label: 'Custom' },
];

const PAGE_SIZE = 12;

// ============================================================================
// Component
// ============================================================================

const ActivityTemplatesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ActivityTemplateCategory | ''>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [applyTemplate, setApplyTemplate] = useState<ActivityTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<ActivityTemplate | null>(null);

  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  const filters: ActivityTemplateQueryFilters = {
    ...(search && { search }),
    ...(category && { category }),
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, error } = useActivityTemplates(filters);
  const deleteTemplate = useDeleteActivityTemplate();
  const cloneTemplate = useCloneActivityTemplate();

  const handleCategoryChange = useCallback((e: SelectChangeEvent) => {
    setCategory(e.target.value as ActivityTemplateCategory | '');
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!pendingData) return;
    try {
      await deleteTemplate.mutateAsync(pendingData);
      closeDialog();
    } catch (err) {
      logger.error(
        'Failed to delete template',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [pendingData, deleteTemplate, closeDialog]);

  const handleClone = useCallback(
    async (templateId: string) => {
      try {
        await cloneTemplate.mutateAsync(templateId);
      } catch (err) {
        logger.error(
          'Failed to clone template',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    },
    [cloneTemplate]
  );

  const templates = data?.templates ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Activity Templates</Typography>
          <Typography variant="body2" color="text.secondary">
            Create reusable templates for common activities
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Create Template
        </Button>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search templates…"
          value={search}
          onChange={handleSearchChange}
          sx={{ minWidth: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Category</InputLabel>
          <Select value={category} label="Category" onChange={handleCategoryChange}>
            {CATEGORY_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* Loading / Error */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load templates
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !error && templates.length === 0 && (
        <Alert severity="info">
          No templates found. Create your first template to get started!
        </Alert>
      )}

      {/* Template grid */}
      {!isLoading && templates.length > 0 && (
        <>
          <Grid container spacing={2}>
            {templates.map(template => (
              <Grid key={template.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ mb: 1 }}
                    >
                      <Typography variant="h6" noWrap sx={{ maxWidth: '70%' }}>
                        {template.name}
                      </Typography>
                      {template.category && (
                        <Chip label={template.category} size="small" variant="outlined" />
                      )}
                    </Stack>
                    {template.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {template.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {template.activityType && (
                        <Chip
                          label={template.activityType}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {template.isPublic && (
                        <Chip label="Public" size="small" color="success" variant="outlined" />
                      )}
                      <Chip
                        label={`Used ${template.usageCount ?? 0}x`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Tooltip title="Use this template">
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label="Apply template"
                        onClick={() => setApplyTemplate(template)}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Clone">
                      <IconButton
                        size="small"
                        aria-label="Clone"
                        onClick={() => handleClone(template.id)}
                        disabled={cloneTemplate.isPending}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        aria-label="Edit"
                        onClick={() => setEditTemplate(template)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete"
                        onClick={() => openDialog(template.id)}
                        disabled={deleteTemplate.isPending}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} />
            </Box>
          )}
        </>
      )}

      {/* Dialogs */}
      <CreateActivityTemplateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editTemplate && (
        <CreateActivityTemplateDialog
          open
          onClose={() => setEditTemplate(null)}
          template={editTemplate}
        />
      )}
      {applyTemplate && (
        <ApplyActivityTemplateDialog
          open
          onClose={() => setApplyTemplate(null)}
          template={applyTemplate}
        />
      )}
      <ConfirmDialog
        {...dialogProps}
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        onConfirm={handleDelete}
      />
    </Box>
  );
};

export const ActivityTemplatesPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Activity Templates">
    <ActivityTemplatesPage />
  </FeatureErrorBoundary>
);

export { ActivityTemplatesPage };
