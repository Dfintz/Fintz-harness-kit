/**
 * Update Maintenance Status Dialog
 * Allows users to transition a maintenance record to a new status
 */

import { useUpdateMaintenanceStatus } from '@/hooks/queries/useShipMaintenanceQueries';
import { getStatusChipSx } from '@/utils/statusStyles';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import type { MaintenanceStatus, ShipMaintenance } from '@sc-fleet-manager/shared-types';
import React, { useState } from 'react';

const STATUS_OPTIONS: { value: MaintenanceStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface UpdateMaintenanceStatusDialogProps {
  open: boolean;
  record: ShipMaintenance | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UpdateMaintenanceStatusDialog: React.FC<
  Readonly<UpdateMaintenanceStatusDialogProps>
> = ({ open, record, onClose, onSuccess }) => {
  const theme = useTheme();
  const [newStatus, setNewStatus] = useState<MaintenanceStatus | ''>('');
  const updateStatusMutation = useUpdateMaintenanceStatus();
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!record || !newStatus) {
      setError('Please select a new status');
      return;
    }

    if (newStatus === record.status) {
      setError('Please select a different status');
      return;
    }

    try {
      setError('');
      await updateStatusMutation.mutateAsync({ id: record.id, status: newStatus });
      onSuccess?.();
      onClose();
      setNewStatus('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      setError(message);
    }
  };

  const handleClose = () => {
    onClose();
    setNewStatus('');
    setError('');
  };

  if (!record) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Update Maintenance Status</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Ship:
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {record.shipId}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Type:
            </Typography>
            <Typography variant="body2">{record.maintenanceType}</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Current Status:
            </Typography>
            <Chip
              label={record.status.replace('_', ' ').toUpperCase()}
              size="small"
              sx={getStatusChipSx(record.status, theme)}
            />
          </Stack>

          <TextField
            label="New Status"
            select
            value={newStatus}
            onChange={e => {
              setNewStatus(e.target.value as MaintenanceStatus);
              setError('');
            }}
            fullWidth
            required
          >
            {STATUS_OPTIONS.filter(opt => opt.value !== record.status).map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>

          {error && (
            <TextField
              error
              fullWidth
              value={error}
              slotProps={{ input: { readOnly: true } }}
              variant="outlined"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={updateStatusMutation.isPending || !newStatus}
        >
          {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
