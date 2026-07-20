/**
 * ApplyActivityTemplateDialog
 * Dialog for applying a template to create a new activity.
 *
 * Sprint 19-D — Activity Templates Frontend
 */

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

import { useApplyActivityTemplate } from '@/hooks/queries/useActivityTemplateQueries';
import { useNotification } from '@/store/uiStore';
import type { ActivityTemplate, ApplyActivityTemplateInput } from '@/types/apiV2';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ApplyActivityTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  template: ActivityTemplate | null;
}

// ============================================================================
// Constants
// ============================================================================

const EMPTY_FORM: ApplyActivityTemplateInput = {
  title: '',
  scheduledStartTime: '',
  estimatedDuration: undefined,
  maxParticipants: undefined,
};

// ============================================================================
// Component
// ============================================================================

export const ApplyActivityTemplateDialog: React.FC<Readonly<ApplyActivityTemplateDialogProps>> = ({
  open,
  onClose,
  template,
}) => {
  const applyTemplate = useApplyActivityTemplate();
  const notification = useNotification();
  const [form, setForm] = useState<ApplyActivityTemplateInput>({ ...EMPTY_FORM });

  // Reset form when dialog opens with a new template
  useEffect(() => {
    if (template) {
      setForm({
        ...EMPTY_FORM,
        estimatedDuration: template.templateData?.estimatedDuration,
        maxParticipants: template.templateData?.maxParticipants,
      });
    }
  }, [template]);

  const handleTextChange = useCallback(
    (field: keyof ApplyActivityTemplateInput) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleNumberChange = useCallback(
    (field: keyof ApplyActivityTemplateInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value === '' ? undefined : Number(e.target.value);
      setForm(prev => ({ ...prev, [field]: val }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!template || !form.title.trim() || !form.scheduledStartTime) return;
    try {
      await applyTemplate.mutateAsync({ templateId: template.id, data: form });
      setForm({ ...EMPTY_FORM });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply template';
      notification.error(message);
      logger.error('Failed to apply template', err instanceof Error ? err : new Error(String(err)));
    }
  }, [form, template, applyTemplate, onClose]);

  const handleClose = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    onClose();
  }, [onClose]);

  if (!template) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Apply Template</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Create a new activity from <strong>{template.name}</strong>
          </Typography>

          <TextField
            label="Activity Title"
            value={form.title}
            onChange={handleTextChange('title')}
            required
            fullWidth
            autoFocus
            placeholder="e.g., Friday Night Mining Run — Jan 31"
          />

          <TextField
            label="Scheduled Start Time"
            type="datetime-local"
            value={form.scheduledStartTime}
            onChange={handleTextChange('scheduledStartTime')}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Estimated Duration (min)"
              type="number"
              value={form.estimatedDuration ?? ''}
              onChange={handleNumberChange('estimatedDuration')}
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />

            <TextField
              label="Max Participants"
              type="number"
              value={form.maxParticipants ?? ''}
              onChange={handleNumberChange('maxParticipants')}
              fullWidth
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!form.title.trim() || !form.scheduledStartTime || applyTemplate.isPending}
        >
          {applyTemplate.isPending ? 'Creating Activity…' : 'Create Activity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
