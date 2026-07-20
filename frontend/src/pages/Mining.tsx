import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreateMiningOperation,
  useDeleteMiningOperation,
  useMiningOperations,
  useRegolithSummary,
  useUpdateMiningOperation,
  useUpdateMiningStatus,
} from '@/hooks/queries/useMiningQueries';
import type {
  CreateMiningOperationDTO,
  MiningOperation,
  UpdateMiningOperationDTO,
} from '@/services/miningService';
import { MiningOperationStatus } from '@/services/miningService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
  Add,
  CheckCircle,
  Delete,
  Edit,
  Group,
  Pause,
  PlayArrow,
  Stop,
  Terrain,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useState } from 'react';

export const Mining: React.FC = () => {
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const organizationId = user?.organizationId || '';

  const { data: operations, isLoading, error } = useMiningOperations();
  const createOperation = useCreateMiningOperation();
  const updateStatus = useUpdateMiningStatus();
  const updateOperation = useUpdateMiningOperation();
  const deleteOperation = useDeleteMiningOperation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOperation, setNewOperation] = useState<CreateMiningOperationDTO>({
    title: '',
    description: '',
    location: '',
    systemLocation: '',
    organizationId,
  });

  // Edit dialog state
  const [editingOperation, setEditingOperation] = useState<MiningOperation | null>(null);
  const [editData, setEditData] = useState<UpdateMiningOperationDTO>({});

  // Regolith panel state
  const [regolithLocation, setRegolithLocation] = useState<string | undefined>(undefined);
  const {
    data: regolithData,
    isLoading: regolithLoading,
    error: regolithError,
  } = useRegolithSummary(regolithLocation);

  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<{
    operationId: string;
    status: MiningOperationStatus;
  }>();

  const {
    openDialog: openDeleteDialog,
    closeDialog: closeDeleteDialog,
    pendingData: deleteTarget,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();

  const handleCreate = async () => {
    try {
      await createOperation.mutateAsync({
        ...newOperation,
        organizationId: organizationId || undefined,
      });
      setShowCreateDialog(false);
      setNewOperation({
        title: '',
        description: '',
        location: '',
        systemLocation: '',
        organizationId,
      });
    } catch (err) {
      logger.error(
        'Failed to create mining operation',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleStatusChange = async () => {
    if (!pendingData) return;
    try {
      await updateStatus.mutateAsync({
        operationId: pendingData.operationId,
        data: { status: pendingData.status },
      });
      closeDialog();
    } catch (err) {
      logger.error('Failed to update status', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleEdit = (op: MiningOperation) => {
    setEditingOperation(op);
    setEditData({
      location: op.location || '',
      description: op.description || '',
      notes: '',
    });
  };

  const handleEditSave = async () => {
    if (!editingOperation) return;
    try {
      await updateOperation.mutateAsync({
        operationId: editingOperation.id,
        data: editData,
      });
      setEditingOperation(null);
      setEditData({});
    } catch (err) {
      logger.error(
        'Failed to update mining operation',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOperation.mutateAsync(deleteTarget);
      closeDeleteDialog();
    } catch (err) {
      logger.error(
        'Failed to delete mining operation',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const getNextStatusAction = (
    status: MiningOperationStatus
  ): { label: string; nextStatus: MiningOperationStatus; icon: React.ReactNode } | null => {
    switch (status) {
      case MiningOperationStatus.PLANNING:
        return { label: 'Start', nextStatus: MiningOperationStatus.ACTIVE, icon: <PlayArrow /> };
      case MiningOperationStatus.ACTIVE:
        return { label: 'Pause', nextStatus: MiningOperationStatus.PAUSED, icon: <Pause /> };
      case MiningOperationStatus.PAUSED:
        return { label: 'Resume', nextStatus: MiningOperationStatus.ACTIVE, icon: <PlayArrow /> };
      default:
        return null;
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load mining operations" />;

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader title="Mining Operations" description="Manage mining ops, crews, and resources" />

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setShowCreateDialog(true)}>
          New Operation
        </Button>
      </Stack>

      {operations?.length ? (
        <Stack spacing={2}>
          {operations.map((op: MiningOperation) => {
            const nextAction = getNextStatusAction(op.status);
            return (
              <React.Fragment key={op.id}>
                <Box sx={{ borderRadius: 1, p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h6">{op.title}</Typography>
                      {op.description && (
                        <Typography variant="body2" color="text.secondary">
                          {op.description}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip
                          label={op.status}
                          sx={getStatusChipSx(op.status, theme)}
                          size="small"
                        />
                        {op.location && (
                          <Chip label={op.location} variant="outlined" size="small" />
                        )}
                        {op.crewMembers?.length > 0 && (
                          <Chip
                            icon={<Group />}
                            label={`${op.crewMembers.length} crew`}
                            variant="outlined"
                            size="small"
                          />
                        )}
                        {op.resources?.length > 0 && (
                          <Chip
                            label={`${op.resources.length} resource types`}
                            variant="outlined"
                            size="small"
                          />
                        )}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {nextAction && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={nextAction.icon}
                          onClick={() =>
                            openDialog({
                              operationId: op.id,
                              status: nextAction.nextStatus,
                            })
                          }
                        >
                          {nextAction.label}
                        </Button>
                      )}
                      {op.status !== MiningOperationStatus.COMPLETED &&
                        op.status !== MiningOperationStatus.CANCELLED && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Edit />}
                            onClick={() => handleEdit(op)}
                          >
                            Edit
                          </Button>
                        )}
                      {op.location && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Terrain />}
                          onClick={() =>
                            setRegolithLocation(
                              regolithLocation === op.location ? undefined : op.location
                            )
                          }
                          color={regolithLocation === op.location ? 'secondary' : 'inherit'}
                        >
                          Regolith
                        </Button>
                      )}
                      {op.status !== MiningOperationStatus.COMPLETED &&
                        op.status !== MiningOperationStatus.CANCELLED && (
                          <Button
                            variant="outlined"
                            size="small"
                            color="success"
                            startIcon={<CheckCircle />}
                            onClick={() =>
                              openDialog({
                                operationId: op.id,
                                status: MiningOperationStatus.COMPLETED,
                              })
                            }
                          >
                            Complete
                          </Button>
                        )}
                      {op.status !== MiningOperationStatus.COMPLETED &&
                        op.status !== MiningOperationStatus.CANCELLED && (
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<Stop />}
                            onClick={() =>
                              openDialog({
                                operationId: op.id,
                                status: MiningOperationStatus.CANCELLED,
                              })
                            }
                          >
                            Cancel
                          </Button>
                        )}
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => openDeleteDialog(op.id)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
                {/* Regolith Data Panel */}
                {regolithLocation === op.location && op.location && (
                  <Box sx={{ borderRadius: 1, p: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      <Terrain sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                      Regolith Data — {op.location}
                    </Typography>
                    {regolithLoading && <CircularProgress size={24} />}
                    {regolithError && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Regolith data unavailable for this location
                      </Alert>
                    )}
                    {regolithData && (
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          System: {regolithData.system} | Accessibility:{' '}
                          {regolithData.accessibility}
                        </Typography>
                        {regolithData.estimatedProfitPerHour != null && (
                          <Typography variant="body2">
                            Est. Profit: {regolithData.estimatedProfitPerHour.toLocaleString()}{' '}
                            aUEC/hr
                          </Typography>
                        )}
                        {regolithData.topResources.length > 0 && (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Top Resources:
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                              {regolithData.topResources.map(r => (
                                <Chip
                                  key={r.symbol}
                                  label={`${r.name} (${r.symbol}) — ${r.percentage.toFixed(1)}%`}
                                  variant="outlined"
                                  size="small"
                                />
                              ))}
                            </Stack>
                          </Box>
                        )}
                        {regolithData.recommendedShips.length > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Recommended Ships: {regolithData.recommendedShips.join(', ')}
                          </Typography>
                        )}
                        {regolithData.notes && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontStyle: 'italic' }}
                          >
                            {regolithData.notes}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </Box>
                )}
              </React.Fragment>
            );
          })}
        </Stack>
      ) : (
        <Box sx={{ borderRadius: 1, p: 2 }}>
          <Typography color="text.secondary">
            No mining operations yet. Create one to get started.
          </Typography>
        </Box>
      )}

      {/* Create Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>New Mining Operation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={newOperation.title}
              onChange={e => setNewOperation(prev => ({ ...prev, title: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={newOperation.description}
              onChange={e => setNewOperation(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Location"
              value={newOperation.location}
              onChange={e => setNewOperation(prev => ({ ...prev, location: e.target.value }))}
              fullWidth
            />
            <TextField
              label="System Location"
              value={newOperation.systemLocation}
              onChange={e => setNewOperation(prev => ({ ...prev, systemLocation: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newOperation.title || createOperation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Confirmation */}
      <ConfirmDialog
        {...dialogProps}
        title="Change Operation Status"
        message={`Are you sure you want to change the status to "${pendingData?.status}"?`}
        onConfirm={handleStatusChange}
      />

      {/* Edit Dialog */}
      <Dialog
        open={!!editingOperation}
        onClose={() => setEditingOperation(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Mining Operation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Description"
              value={editData.description || ''}
              onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Location"
              value={editData.location || ''}
              onChange={e => setEditData(prev => ({ ...prev, location: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Notes"
              value={editData.notes || ''}
              onChange={e => setEditData(prev => ({ ...prev, notes: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingOperation(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={updateOperation.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Mining Operation"
        message="This will permanently delete this mining operation. This action cannot be undone."
        onConfirm={handleDelete}
      />
    </Box>
  );
};

export const MiningWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Mining Operations">
    <Mining />
  </FeatureErrorBoundary>
);
