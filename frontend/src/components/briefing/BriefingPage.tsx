import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import HandymanIcon from '@mui/icons-material/Handyman';
import MapIcon from '@mui/icons-material/Map';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SecurityIcon from '@mui/icons-material/Security';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useActivities } from '@/hooks/queries/useActivityQueries';
import {
  useAddBriefingElement,
  useBriefing,
  useBriefings,
  useCreateBriefing,
  useCreateBriefingVersion,
  useDeleteBriefing,
  useUpdateBriefing,
  useUpdateBriefingStatus,
} from '@/hooks/queries/useBriefingQueries';
import { getErrorMessage as getApiErrorMessage } from '@/services/apiClient';
import {
  BRIEFING_CLASSIFICATION_CHIP_COLORS,
  BRIEFING_CLASSIFICATION_LABELS,
  type BriefingClassification,
  type BriefingElement,
  type BriefingPageData,
} from '@/services/briefingService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';

import { BriefingListPanel } from './BriefingListPanel';
import { TacticalCanvas } from './TacticalCanvas';

// ============================================================================
// Constants
// ============================================================================

const VERSEGUIDE_URL = 'https://verseguide.com/';
const SHIP_MAPS_URL = 'https://maps.adi.sc/';

// ============================================================================
// Helpers
// ============================================================================

const getErrorMessage = (
  queryError: Error | null,
  briefingError: Error | null,
  mutationError: string
): string => {
  if (queryError) return `Failed to load briefings: ${queryError.message}`;
  if (briefingError) return `Failed to load selected briefing: ${briefingError.message}`;
  return mutationError;
};

// ============================================================================
// BriefingPage Component
// ============================================================================

export const BriefingPage: React.FC = () => {
  // Auth
  const user = useAuthStore(s => s.user);
  const organizationId = user?.organizationId || user?.activeOrgId;

  // Data hooks
  const {
    data: briefings = [],
    isLoading,
    error: queryError,
  } = useBriefings({
    enabled: !!organizationId,
  });
  const [selectedBriefingId, setSelectedBriefingId] = useState<string | null>(null);
  const { data: currentBriefing, error: briefingError } = useBriefing(
    selectedBriefingId ?? undefined
  );

  // Fetch operations for binding picker
  const { data: operationsResult } = useActivities(
    organizationId,
    { type: 'operation', limit: 100 },
    { enabled: !!organizationId }
  );
  const availableOperations = operationsResult?.items ?? [];

  // Mutations
  const createBriefing = useCreateBriefing();
  const updateBriefingMutation = useUpdateBriefing();
  const deleteBriefing = useDeleteBriefing();
  const updateStatus = useUpdateBriefingStatus();
  const addElement = useAddBriefingElement();
  const createVersion = useCreateBriefingVersion();

  // UI state
  const [mutationError, setMutationError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createClassification, setCreateClassification] =
    useState<BriefingClassification>('restricted');

  // Page navigation state
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Derive page count (minimum 1)
  const pages: BriefingPageData[] =
    currentBriefing?.pages && currentBriefing.pages.length > 0
      ? currentBriefing.pages
      : [{ backgroundImage: currentBriefing?.backgroundImage ?? null }];
  const pageCount = pages.length;

  // Reset page index when switching briefings
  const handleSelectBriefing = (id: string) => {
    setSelectedBriefingId(id);
    setCurrentPageIndex(0);
  };

  // Confirm dialogs
  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();
  const {
    openDialog: openClearConfirm,
    closeDialog: closeClearConfirm,
    dialogProps: clearDialogProps,
  } = useConfirmDialog<void>();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setMutationError('');
    try {
      const created = await createBriefing.mutateAsync({
        title: newTitle.trim(),
        classification: createClassification,
      });
      setSelectedBriefingId(created.id);
      setNewTitle('');
      setCreateClassification('restricted');
      setShowCreateForm(false);
    } catch (err) {
      logger.error(
        'Failed to create briefing',
        err instanceof Error ? err : new Error(String(err))
      );
      setMutationError(`Failed to create briefing: ${getApiErrorMessage(err)}`);
    }
  };

  const handleClassificationChange = async (classification: BriefingClassification) => {
    if (!currentBriefing) return;
    try {
      await updateBriefingMutation.mutateAsync({
        id: currentBriefing.id,
        data: { classification },
      });
    } catch (err) {
      logger.error(
        'Failed to update classification',
        err instanceof Error ? err : new Error(String(err))
      );
      setMutationError('Failed to update classification');
    }
  };

  const handleOperationIdsChange = async (operationIds: string[]) => {
    if (!currentBriefing) return;
    try {
      await updateBriefingMutation.mutateAsync({
        id: currentBriefing.id,
        data: { operationIds },
      });
    } catch (err) {
      logger.error(
        'Failed to update operations',
        err instanceof Error ? err : new Error(String(err))
      );
      setMutationError('Failed to update operations');
    }
  };

  const handleDeleteConfirm = async () => {
    const id = pendingDeleteId;
    closeDeleteConfirm();
    if (!id) return;

    try {
      await deleteBriefing.mutateAsync(id);
      if (selectedBriefingId === id) {
        setSelectedBriefingId(null);
        setCurrentPageIndex(0);
      }
    } catch (err) {
      logger.error('Failed to delete', err instanceof Error ? err : new Error(String(err)));
      setMutationError('Failed to delete briefing');
    }
  };

  const handleClearConfirm = async () => {
    closeClearConfirm();
    if (!currentBriefing) return;
    try {
      // Only remove elements on the current page
      const remainingElements = currentBriefing.elements.filter(
        el => (el.pageIndex ?? 0) !== currentPageIndex
      );
      await updateBriefingMutation.mutateAsync({
        id: currentBriefing.id,
        data: { elements: remainingElements },
      });
    } catch (err) {
      logger.error('Failed to clear', err instanceof Error ? err : new Error(String(err)));
      setMutationError('Failed to clear canvas');
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!currentBriefing) return;
    try {
      await updateStatus.mutateAsync({ id: currentBriefing.id, status });
    } catch (err) {
      logger.error('Status update failed', err instanceof Error ? err : new Error(String(err)));
      setMutationError('Failed to update status');
    }
  };

  const handleCreateVersion = async () => {
    if (!currentBriefing) return;
    try {
      await createVersion.mutateAsync(currentBriefing.id);
    } catch (err) {
      logger.error('Version creation failed', err instanceof Error ? err : new Error(String(err)));
      setMutationError('Failed to create version');
    }
  };

  const handleAddElement = async (element: BriefingElement) => {
    if (!currentBriefing) return;
    try {
      await addElement.mutateAsync({ briefingId: currentBriefing.id, element });
    } catch (err) {
      logger.error('Failed to add element', err instanceof Error ? err : new Error(String(err)));
      setMutationError('Failed to place element');
    }
  };

  // ---------------------------------------------------------------------------
  // Page management
  // ---------------------------------------------------------------------------

  const handleBackgroundImageChange = async (dataUrl: string | null) => {
    if (!currentBriefing) return;
    try {
      const updatedPages = [...pages];
      updatedPages[currentPageIndex] = {
        ...updatedPages[currentPageIndex],
        backgroundImage: dataUrl,
      };
      await updateBriefingMutation.mutateAsync({
        id: currentBriefing.id,
        data: { pages: updatedPages },
      });
    } catch (err) {
      logger.error(
        'Failed to update background image',
        err instanceof Error ? err : new Error(String(err))
      );
      setMutationError('Failed to update background image');
    }
  };

  const handleAddPage = async () => {
    if (!currentBriefing) return;
    try {
      const updatedPages: BriefingPageData[] = [...pages, { backgroundImage: null }];
      await updateBriefingMutation.mutateAsync({
        id: currentBriefing.id,
        data: { pages: updatedPages },
      });
      setCurrentPageIndex(updatedPages.length - 1);
    } catch (err) {
      logger.error('Failed to add page', err instanceof Error ? err : new Error(String(err)));
      setMutationError('Failed to add page');
    }
  };

  const handleDeletePage = async () => {
    if (!currentBriefing || pageCount <= 1) return;
    try {
      const deletedIndex = currentPageIndex;
      const updatedPages = pages.filter((_, i) => i !== deletedIndex);

      // Re-index elements: remove elements on deleted page, shift higher pages down
      const updatedElements = currentBriefing.elements
        .filter(el => (el.pageIndex ?? 0) !== deletedIndex)
        .map(el => {
          const pi = el.pageIndex ?? 0;
          return pi > deletedIndex ? { ...el, pageIndex: pi - 1 } : el;
        });

      await updateBriefingMutation.mutateAsync({
        id: currentBriefing.id,
        data: { pages: updatedPages, elements: updatedElements },
      });

      setCurrentPageIndex(Math.min(deletedIndex, updatedPages.length - 1));
    } catch (err) {
      logger.error('Failed to delete page', err instanceof Error ? err : new Error(String(err)));
      setMutationError('Failed to delete page');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 1800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Mission Briefings
        </Typography>
      </Box>

      {(queryError || briefingError || mutationError) && (
        <Alert
          severity="error"
          onClose={() => {
            setMutationError('');
            if (briefingError) setSelectedBriefingId(null);
          }}
          sx={{ mb: 2 }}
        >
          {getErrorMessage(queryError, briefingError, mutationError)}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'flex-start' },
        }}
      >
        {/* Left Sidebar: Briefing List + Tools */}
        <Box
          sx={{
            width: { xs: '100%', md: 260 },
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <BriefingListPanel
            briefings={briefings}
            selectedBriefingId={selectedBriefingId}
            showCreateForm={showCreateForm}
            newTitle={newTitle}
            createClassification={createClassification}
            onSelectBriefing={handleSelectBriefing}
            onToggleCreateForm={() => setShowCreateForm(prev => !prev)}
            onNewTitleChange={setNewTitle}
            onCreateClassificationChange={setCreateClassification}
            onCreate={handleCreate}
            onDeleteRequest={openDeleteConfirm}
          />
        </Box>

        {/* Center content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {currentBriefing ? (
            <TacticalCanvas
              briefing={currentBriefing}
              onAddElement={handleAddElement}
              onStatusChange={handleStatusChange}
              onCreateVersion={handleCreateVersion}
              onClearCanvas={() => openClearConfirm()}
              backgroundImageUrl={pages[currentPageIndex]?.backgroundImage}
              onBackgroundImageChange={handleBackgroundImageChange}
              currentPageIndex={currentPageIndex}
              pageCount={pageCount}
              onPageChange={setCurrentPageIndex}
              onAddPage={handleAddPage}
              onDeletePage={handleDeletePage}
            />
          ) : (
            <Card
              variant="outlined"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
              }}
            >
              <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                <MilitaryTechIcon sx={{ fontSize: 64, opacity: 0.3, mb: 1 }} />
                <Typography variant="h6">Select or create a briefing</Typography>
                <Typography variant="body2">
                  Use the panel on the left to pick an existing briefing or create a new one.
                </Typography>
              </Box>
            </Card>
          )}
        </Box>

        {/* Right Panel: Controls only (shown in canvas view with a briefing) */}
        {currentBriefing && (
          <Box
            sx={{
              width: { xs: '100%', md: 300 },
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {/* Classification & Operation Binding */}
            <Card variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <SecurityIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
                  Intel Classification
                </Typography>
                <Chip
                  label={
                    BRIEFING_CLASSIFICATION_LABELS[currentBriefing.classification] ??
                    currentBriefing.classification
                  }
                  size="small"
                  color={
                    BRIEFING_CLASSIFICATION_CHIP_COLORS[currentBriefing.classification] ?? 'default'
                  }
                />
              </Box>
              <TextField
                select
                size="small"
                value={currentBriefing.classification ?? 'restricted'}
                onChange={e => handleClassificationChange(e.target.value as BriefingClassification)}
                fullWidth
                sx={{ mb: 1.5 }}
              >
                {(
                  Object.entries(BRIEFING_CLASSIFICATION_LABELS) as [
                    BriefingClassification,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                Bound Operations
              </Typography>
              <Autocomplete
                multiple
                size="small"
                options={availableOperations}
                getOptionLabel={op => op.title ?? op.id}
                value={availableOperations.filter(op =>
                  (currentBriefing.operationIds ?? []).includes(op.id)
                )}
                onChange={(_e, newOps) => handleOperationIdsChange(newOps.map(op => op.id))}
                renderInput={params => (
                  <TextField {...params} placeholder="Link to operations..." />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                noOptionsText="No operations found"
              />
            </Card>

            {/* Reference Tools */}
            <Card variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <HandymanIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
                  Reference Tools
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 1.5, display: 'block' }}
              >
                Use these tools to plan your briefing, then upload a screenshot as the canvas
                background.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<MapIcon fontSize="small" />}
                  endIcon={<OpenInNewIcon />}
                  href={VERSEGUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  VerseGuide Maps
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DirectionsBoatIcon fontSize="small" />}
                  endIcon={<OpenInNewIcon />}
                  href={SHIP_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Ship Deck Maps
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<GpsFixedIcon fontSize="small" />}
                  endIcon={<OpenInNewIcon />}
                  href="/briefings/interdiction"
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Interdiction Planner
                </Button>
              </Box>
            </Card>
          </Box>
        )}
      </Box>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Briefing"
        message="Are you sure you want to delete this briefing? This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
      />
      <ConfirmDialog
        {...clearDialogProps}
        title="Clear Page"
        message="Remove all elements from this page?"
        confirmLabel="Clear Page"
        confirmColor="warning"
        onConfirm={handleClearConfirm}
      />
    </Box>
  );
};

// ============================================================================
// Error Boundary Wrapper
// ============================================================================

export const BriefingPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Mission Briefings">
    <BriefingPage />
  </FeatureErrorBoundary>
);
