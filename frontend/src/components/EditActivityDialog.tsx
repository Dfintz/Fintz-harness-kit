/**
 * Edit Activity Dialog — allows the activity creator to update key fields.
 *
 * Uses the existing `useUpdateActivity` mutation hook and matches the backend's
 * allowed update fields: title, description, location, visibility,
 * maxParticipants, startDate, endDate.
 */
import { useUpdateActivity } from '@/hooks/queries';
import { useNotification } from '@/store/uiStore';
import type { ActivityVisibility } from '@/types/activity';
import type { ActivityV2 } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import EditIcon from '@mui/icons-material/Edit';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EditActivityDialogProps {
  open: boolean;
  onClose: () => void;
  activity: ActivityV2;
}

const VISIBILITY_OPTIONS: { value: ActivityVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'organization', label: 'Organization Only' },
  { value: 'alliance', label: 'Alliance' },
  { value: 'private', label: 'Private' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract date portion from an ISO string for a date input, or datetime-local if time exists */
function toDateTimeLocal(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const EditActivityDialog: React.FC<Readonly<EditActivityDialogProps>> = ({
  open,
  onClose,
  activity,
}) => {
  const theme = useTheme();
  const notification = useNotification();
  const updateMutation = useUpdateActivity();

  // ── Form state — pre-populated from existing activity ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<ActivityVisibility>('organization');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Populate form when activity changes or dialog opens
  useEffect(() => {
    if (open && activity) {
      setTitle(activity.title || '');
      setDescription(activity.description || '');
      setLocation(activity.location || '');
      setVisibility((activity.visibility as ActivityVisibility) || 'organization');
      setMaxParticipants(
        activity.maxParticipants === null || activity.maxParticipants === undefined
          ? ''
          : String(activity.maxParticipants)
      );
      setStartDate(toDateTimeLocal(activity.startDate));
      setEndDate(toDateTimeLocal(activity.endDate));
    }
  }, [open, activity]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      notification.error('Title is required');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        activityId: activity.id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          visibility,
          maxParticipants: maxParticipants ? Number.parseInt(maxParticipants, 10) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      notification.success('Activity updated');
      onClose();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      logger.error('Failed to update activity', error);
      notification.error(`Failed to update: ${error.message}`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          },
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <EditIcon sx={{ color: theme.palette.info.main }} />
          <Typography variant="h6">Edit Activity</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: '16px !important' }}>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            fullWidth
            required
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />

          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
          />

          <TextField
            label="Location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Visibility</InputLabel>
            <Select
              value={visibility}
              label="Visibility"
              onChange={e => setVisibility(e.target.value as ActivityVisibility)}
            >
              {VISIBILITY_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Max Participants"
            type="number"
            value={maxParticipants}
            onChange={e => setMaxParticipants(e.target.value)}
            fullWidth
            helperText="Leave empty for unlimited"
            slotProps={{ htmlInput: { min: 1, max: 100 } }}
          />

          <TextField
            label="Start Date & Time"
            type="datetime-local"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <TextField
            label="End Date & Time"
            type="datetime-local"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={updateMutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={updateMutation.isPending || !title.trim()}
          startIcon={updateMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
