import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { SharedAccountManager } from '@/components/SharedAccountManager';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Item } from '@/components/ui/Item';
import { SearchField } from '@/components/ui/SearchField';
import { Select } from '@/components/ui/Select';
import { StatusLight } from '@/components/ui/SpectrumCompat';
import {
  useCreateIntelEntry,
  useDeleteIntelEntry,
  useIntelAccess,
  useIntelEntries,
  useUpdateIntelEntry,
} from '@/hooks/queries/useIntelQueries';
import { IntelOfficerManagement } from '@/pages/IntelOfficerManagement';
import { isApiClientError } from '@/services/apiClient';
import type { IntelEntry } from '@/services/intelVaultService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import {
  Add,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ErrorOutline,
  Shield,
  Undo as UndoIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

const CLASSIFICATIONS = [
  { value: 'public', label: 'Public', color: 'success.main' },
  { value: 'restricted', label: 'Restricted', color: 'warning.main' },
  { value: 'confidential', label: 'Confidential', color: 'error.main' },
  { value: 'secret', label: 'Secret', color: 'secondary.main' },
  { value: 'top_secret', label: 'Top Secret', color: 'common.black' },
];

const CATEGORIES = [
  'strategic',
  'tactical',
  'personnel',
  'enemy',
  'alliance',
  'economic',
  'technical',
  'other',
];

function getClassificationVariant(classification: string): 'positive' | 'notice' | 'negative' {
  if (classification === 'public') return 'positive';
  if (classification === 'restricted') return 'notice';
  return 'negative';
}

export const IntelVault: React.FC = () => {
  const { user } = useAuthStore();
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Tab state
  const [selectedTab, setSelectedTab] = useState<string>('intel');

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<IntelEntry | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('view');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    classification: 'restricted',
    category: 'other',
    tags: '',
    location: '',
    eventDate: '',
  });

  const orgId = user?.activeOrgId;

  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  // React Query hooks
  const { data: accessCheck, error: accessError } = useIntelAccess(orgId);

  const entryFilters = {
    includeArchived,
    classification: filterClassification || undefined,
    category: filterCategory || undefined,
    search: searchTerm || undefined,
  };

  const {
    data: entriesData,
    isLoading: loading,
    error: entriesError,
  } = useIntelEntries(orgId, entryFilters, {
    enabled: !!orgId && !!accessCheck?.hasAccess,
  });

  const entries = entriesData?.entries ?? [];

  const createEntry = useCreateIntelEntry(orgId ?? '');
  const updateEntry = useUpdateIntelEntry(orgId ?? '');
  const deleteEntry = useDeleteIntelEntry(orgId ?? '');

  const getErrorMessage = (err: unknown, fallback: string): string => {
    if (isApiClientError(err)) return err.message;
    return fallback;
  };

  const accessErrorMsg = accessError
    ? getErrorMessage(accessError, 'Failed to check Intel vault access')
    : null;
  const entriesErrorMsg = entriesError
    ? getErrorMessage(entriesError, 'Failed to load Intel entries')
    : null;
  const noOrgMsg = orgId ? null : 'Intel Vault is only available to organization members';
  const error = mutationError || accessErrorMsg || entriesErrorMsg || noOrgMsg;

  const handleOpenDialog = (mode: 'create' | 'edit' | 'view', entry?: IntelEntry) => {
    setDialogMode(mode);
    setSelectedEntry(entry || null);

    if (mode === 'create') {
      setFormData({
        title: '',
        content: '',
        classification: 'restricted',
        category: 'other',
        tags: '',
        location: '',
        eventDate: '',
      });
    } else if (entry) {
      setFormData({
        title: entry.title,
        content: entry.content,
        classification: entry.classification,
        category: entry.category,
        tags: entry.tags?.join(', ') || '',
        location: entry.location || '',
        eventDate: entry.eventDate ? new Date(entry.eventDate).toISOString().split('T')[0] : '',
      });
    }

    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedEntry(null);
    setDialogMode('view');
  };

  const handleSubmit = async () => {
    setMutationError(null);

    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        classification: formData.classification,
        category: formData.category,
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
          : [],
        location: formData.location?.trim() || undefined,
        eventDate: formData.eventDate ? new Date(formData.eventDate).toISOString() : undefined,
      };

      if (dialogMode === 'create') {
        await createEntry.mutateAsync(payload);
      } else if (dialogMode === 'edit' && selectedEntry) {
        await updateEntry.mutateAsync({ entryId: selectedEntry.id, data: payload });
      }

      handleCloseDialog();
    } catch (err: unknown) {
      const message = isApiClientError(err) ? err.message : 'Failed to save Intel entry';
      setMutationError(message);
      logger.error(
        'Failed to save Intel entry',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleDeleteClick = (entryId: string) => {
    openDeleteConfirm(entryId);
  };

  const handleDeleteConfirm = async () => {
    const entryId = pendingDeleteId;
    closeDeleteConfirm();
    if (!entryId) return;

    setMutationError(null);

    try {
      await deleteEntry.mutateAsync(entryId);
    } catch (err: unknown) {
      const message = isApiClientError(err) ? err.message : 'Failed to delete Intel entry';
      setMutationError(message);
      logger.error(
        'Failed to delete Intel entry',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleArchive = async (entryId: string, archive: boolean) => {
    setMutationError(null);

    try {
      await updateEntry.mutateAsync({ entryId, data: { isArchived: archive } });
    } catch (err: unknown) {
      const message = isApiClientError(err) ? err.message : 'Failed to update Intel entry';
      setMutationError(message);
      logger.error(
        'Failed to update Intel entry',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const _getClassificationColor = (classification: string) => {
    return CLASSIFICATIONS.find(c => c.value === classification)?.color || 'text.secondary';
  };

  const getClassificationLabel = (classification: string) => {
    return CLASSIFICATIONS.find(c => c.value === classification)?.label || classification;
  };

  const canWrite =
    accessCheck?.isOwner ||
    ['write', 'edit', 'delete', 'admin'].includes(accessCheck?.accessLevel || '');
  const canEdit =
    accessCheck?.isOwner || ['edit', 'delete', 'admin'].includes(accessCheck?.accessLevel || '');
  const canDelete =
    accessCheck?.isOwner || ['delete', 'admin'].includes(accessCheck?.accessLevel || '');

  // Access check — org membership is enforced at the route level
  // via ProtectedRoute requireOrganization
  if (!accessCheck?.hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Box style={{ borderColor: 'error.main' }} sx={{ borderRadius: 1, p: 2 }}>
          <Stack direction="row" gap={2} alignItems="center">
            <Shield sx={{ color: 'error.main', fontSize: 32 }} />
            <Box>
              <Typography variant="h4">Access Denied</Typography>
              <Typography>{error || 'You do not have access to the Intel vault'}</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <FeatureErrorBoundary featureName="Intel Vault" showHomeButton={true}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" gap={2} alignItems="center">
              <Shield sx={{ fontSize: 32 }} />
              <Typography variant="h2">Intel Vault</Typography>
            </Stack>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              {accessCheck?.isOwner && 'Organization Owner'}
              {accessCheck?.isIntelOfficer &&
                !accessCheck?.isOwner &&
                `Intel Officer (${accessCheck.officerRank}) - ${accessCheck.accessLevel} access`}
            </Typography>
          </Box>
          {canWrite && (
            <Button variant="primary" onClick={() => handleOpenDialog('create')}>
              <Add />
              <Typography>New Intel Entry</Typography>
            </Button>
          )}
        </Stack>

        {error && (
          <Box sx={{ borderRadius: 1, p: 2, borderColor: 'error.main', marginBottom: '16px' }}>
            <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" gap={1} alignItems="center">
                <ErrorOutline sx={{ color: 'error.main' }} />
                <Typography>{error}</Typography>
              </Stack>
              <Button variant="secondary" onClick={() => setMutationError(null)}>
                <Typography>Dismiss</Typography>
              </Button>
            </Stack>
          </Box>
        )}

        {/* Tabs */}
        <Tabs
          value={selectedTab}
          onChange={(_e: React.SyntheticEvent, key: string) => setSelectedTab(key)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Intel Entries" value="intel" />
          <Tab label="Intel Officers" value="officers" />
          <Tab label="Shared Accounts" value="accounts" />
        </Tabs>

        {selectedTab === 'intel' && (
          <>
            {/* Filters */}
            <Box sx={{ borderRadius: 1, p: 2, mt: 3, mb: 3 }}>
              <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-end">
                <SearchField
                  label="Search"
                  value={searchTerm}
                  onChange={setSearchTerm}
                  width="size-3000"
                />
                <Select
                  label="Classification"
                  value={filterClassification}
                  onSelectionChange={key => setFilterClassification(key as string)}
                >
                  <Item key="">All</Item>
                  {CLASSIFICATIONS.map(c => (
                    <Item key={c.value}>{c.label}</Item>
                  ))}
                </Select>
                <Select
                  label="Category"
                  value={filterCategory}
                  onSelectionChange={key => setFilterCategory(key as string)}
                >
                  <Item key="">All</Item>
                  {CATEGORIES.map(c => (
                    <Item key={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</Item>
                  ))}
                </Select>
                <Button
                  variant={includeArchived ? 'primary' : 'secondary'}
                  onClick={() => setIncludeArchived(!includeArchived)}
                >
                  <Typography>{includeArchived ? 'Hide' : 'Show'} Archived</Typography>
                </Button>
              </Stack>
            </Box>

            {/* Entries List */}
            {loading && (
              <Stack justifyContent="center" alignItems="center" height="size-2000">
                <CircularProgress aria-label="Loading" size={40} />
              </Stack>
            )}
            {!loading && entries.length === 0 && (
              <Box sx={{ borderRadius: 1, p: 2 }}>
                <Typography>
                  No Intel entries found. {canWrite && 'Create your first entry to get started.'}
                </Typography>
              </Box>
            )}
            {!loading && entries.length > 0 && (
              <Stack direction="column" gap="size-200">
                {entries.map(entry => (
                  <Box
                    key={entry.id}
                    sx={{ borderRadius: 1, p: 2, opacity: entry.isArchived ? 0.6 : 1 }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="start">
                      <Box flex={1}>
                        <Stack
                          direction="row"
                          gap="size-100"
                          alignItems="center"
                          marginBottom="size-100"
                        >
                          <Typography variant="h4">{entry.title}</Typography>
                          <StatusLight variant={getClassificationVariant(entry.classification)}>
                            {getClassificationLabel(entry.classification)}
                          </StatusLight>
                          <StatusLight variant="neutral">{entry.category}</StatusLight>
                          {entry.isArchived && (
                            <StatusLight variant="neutral">
                              <ArchiveIcon sx={{ fontSize: 12 }} /> Archived
                            </StatusLight>
                          )}
                        </Stack>
                        <Typography
                          sx={{
                            color: 'text.secondary',
                            marginBottom: '8px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {entry.content}
                        </Typography>
                        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
                          {entry.tags?.map(tag => (
                            <StatusLight key={tag} variant="neutral">
                              {tag}
                            </StatusLight>
                          ))}
                        </Stack>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          Created {new Date(entry.createdAt).toLocaleDateString()} • Updated{' '}
                          {new Date(entry.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Stack direction="row" gap="size-100">
                        <IconButton
                          isQuiet
                          onPress={() => handleOpenDialog('view', entry)}
                          tooltip="View details"
                        >
                          <VisibilityIcon />
                        </IconButton>
                        {canEdit && !entry.isArchived && (
                          <IconButton
                            isQuiet
                            onPress={() => handleOpenDialog('edit', entry)}
                            tooltip="Edit entry"
                          >
                            <EditIcon />
                          </IconButton>
                        )}
                        {canEdit && (
                          <IconButton
                            isQuiet
                            onPress={() => handleArchive(entry.id, !entry.isArchived)}
                            tooltip={entry.isArchived ? 'Restore entry' : 'Archive entry'}
                          >
                            {entry.isArchived ? <UndoIcon /> : <ArchiveIcon />}
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton
                            isQuiet
                            onPress={() => handleDeleteClick(entry.id)}
                            tooltip="Delete entry"
                          >
                            <DeleteIcon sx={{ color: 'error.main' }} />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </>
        )}

        {selectedTab === 'officers' && (
          <Box sx={{ mt: 2 }}>
            <FeatureErrorBoundary featureName="Intel Officers">
              <IntelOfficerManagement />
            </FeatureErrorBoundary>
          </Box>
        )}

        {selectedTab === 'accounts' && (
          <Box sx={{ mt: 2 }}>
            <FeatureErrorBoundary featureName="Shared Accounts">
              <SharedAccountManager
                userId={user?.id ?? ''}
                userOrganizations={
                  orgId && user?.activeOrgName ? [{ id: orgId, name: user.activeOrgName }] : []
                }
              />
            </FeatureErrorBoundary>
          </Box>
        )}

        {/* Entry Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {dialogMode === 'create' && 'Create Intel Entry'}
            {dialogMode === 'edit' && 'Edit Intel Entry'}
            {dialogMode === 'view' && 'View Intel Entry'}
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Stack direction="column" spacing={2} sx={{ pt: 2 }}>
              <TextField
                label="Title"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                disabled={dialogMode === 'view'}
                required
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth required>
                  <InputLabel>Classification</InputLabel>
                  <MuiSelect
                    value={formData.classification}
                    label="Classification"
                    onChange={e => setFormData({ ...formData, classification: e.target.value })}
                    disabled={dialogMode === 'view'}
                  >
                    {CLASSIFICATIONS.map(c => (
                      <MenuItem key={c.value} value={c.value}>
                        {c.label}
                      </MenuItem>
                    ))}
                  </MuiSelect>
                </FormControl>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <MuiSelect
                    value={formData.category}
                    label="Category"
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    disabled={dialogMode === 'view'}
                  >
                    {CATEGORIES.map(c => (
                      <MenuItem key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </MenuItem>
                    ))}
                  </MuiSelect>
                </FormControl>
              </Stack>
              <TextField
                label="Content"
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                disabled={dialogMode === 'view'}
                required
                multiline
                rows={8}
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Location"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  disabled={dialogMode === 'view'}
                  fullWidth
                />
                <TextField
                  label="Event Date"
                  type="date"
                  value={formData.eventDate}
                  onChange={e => setFormData({ ...formData, eventDate: e.target.value })}
                  disabled={dialogMode === 'view'}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Tags (comma-separated)"
                value={formData.tags}
                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                disabled={dialogMode === 'view'}
                helperText="Enter tags separated by commas"
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outline" onClick={handleCloseDialog}>
              {dialogMode === 'view' ? 'Close' : 'Cancel'}
            </Button>
            {dialogMode !== 'view' && (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={createEntry.isPending || updateEntry.isPending}
                leftIcon={
                  createEntry.isPending || updateEntry.isPending ? (
                    <CircularProgress size={20} />
                  ) : undefined
                }
              >
                Save
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <ConfirmDialog
          {...deleteDialogProps}
          title="Delete Intel Entry"
          message="Are you sure you want to delete this Intel entry? This action cannot be undone."
          confirmLabel="Delete"
          confirmColor="error"
          onConfirm={handleDeleteConfirm}
        />
      </Box>
    </FeatureErrorBoundary>
  );
};

export const IntelVaultWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Intel Vault">
    <IntelVault />
  </FeatureErrorBoundary>
);
