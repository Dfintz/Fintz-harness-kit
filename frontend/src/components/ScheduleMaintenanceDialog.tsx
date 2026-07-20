/**
 * Schedule Maintenance Dialog
 * Allows users to schedule maintenance for a ship
 */

import { useScheduleMaintenance } from '@/hooks/queries/useShipMaintenanceQueries';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import type { CreateShipMaintenanceRequest, MaintenanceType } from '@sc-fleet-manager/shared-types';
import React, { useState } from 'react';

const MAINTENANCE_TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'repair', label: 'Repair' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'inspection', label: 'Inspection' },
];

interface ScheduleMaintenanceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const initialFormData: CreateShipMaintenanceRequest = {
  shipId: '',
  maintenanceType: 'routine',
  scheduledDate: '',
  description: '',
  cost: undefined,
  performedBy: '',
  notes: '',
};

export const ScheduleMaintenanceDialog: React.FC<Readonly<ScheduleMaintenanceDialogProps>> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CreateShipMaintenanceRequest>({ ...initialFormData });
  const scheduleMutation = useScheduleMaintenance();
  const [error, setError] = useState('');

  const handleChange = (field: keyof CreateShipMaintenanceRequest, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    if (!formData.shipId || !formData.maintenanceType || !formData.scheduledDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setError('');

      const payload: CreateShipMaintenanceRequest = {
        ...formData,
        cost: formData.cost ? Number(formData.cost) : undefined,
      };

      await scheduleMutation.mutateAsync(payload);
      onSuccess?.();
      onClose();
      setFormData({ ...initialFormData });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule maintenance';
      setError(message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Schedule Maintenance</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Ship ID"
            value={formData.shipId}
            onChange={e => handleChange('shipId', e.target.value)}
            required
            fullWidth
            helperText="Enter the ID of the ship to maintain"
          />
          <TextField
            label="Maintenance Type"
            select
            value={formData.maintenanceType}
            onChange={e => handleChange('maintenanceType', e.target.value)}
            required
            fullWidth
          >
            {MAINTENANCE_TYPES.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Scheduled Date"
            type="date"
            value={formData.scheduledDate}
            onChange={e => handleChange('scheduledDate', e.target.value)}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Description"
            value={formData.description}
            onChange={e => handleChange('description', e.target.value)}
            multiline
            rows={2}
            fullWidth
            helperText="Optional description of maintenance work"
          />
          <TextField
            label="Cost (aUEC)"
            type="number"
            value={formData.cost ?? ''}
            onChange={e => handleChange('cost', e.target.value)}
            fullWidth
            helperText="Optional estimated cost"
            slotProps={{ htmlInput: { min: 0 } }}
          />
          <TextField
            label="Performed By"
            value={formData.performedBy}
            onChange={e => handleChange('performedBy', e.target.value)}
            fullWidth
            helperText="Optional technician or service provider"
          />
          <TextField
            label="Notes"
            value={formData.notes}
            onChange={e => handleChange('notes', e.target.value)}
            multiline
            rows={2}
            fullWidth
            helperText="Optional additional notes"
          />

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
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={scheduleMutation.isPending}>
          {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
