/**
 * ReminderSection — Configurable reminders for activities and events.
 *
 * Shows an "Add reminder" button that lets users add one or more reminders
 * with a type (1 day before, 1 hour before, 30 minutes before) and channel
 * (Discord, Email, Both). Reminders are displayed as removable chips/rows.
 */
import { Delete as DeleteIcon, NotificationsActive as ReminderIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReminderChannel, ReminderType } from '@sc-fleet-manager/shared-types';
import React from 'react';

// ─── Local config type (no activityId needed in form state) ─────────────────

export interface ReminderConfig {
  reminderType: ReminderType;
  channel: ReminderChannel;
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ReminderSectionProps {
  reminders: ReminderConfig[];
  onRemindersChange: (reminders: ReminderConfig[]) => void;
}

// ─── Option maps ────────────────────────────────────────────────────────────

const REMINDER_TYPE_OPTIONS: { value: ReminderType; label: string }[] = [
  { value: '1_day_before', label: '1 Day Before' },
  { value: '1_hour_before', label: '1 Hour Before' },
  { value: '30_min_before', label: '30 Minutes Before' },
];

const CHANNEL_OPTIONS: { value: ReminderChannel; label: string }[] = [
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'Both' },
];

const REMINDER_LABELS: Record<ReminderType, string> = {
  '1_day_before': '1 Day Before',
  '1_hour_before': '1 Hour Before',
  '30_min_before': '30 Min Before',
  custom: 'Custom',
};

const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  discord: 'Discord',
  email: 'Email',
  both: 'Both',
};

// ─── Component ──────────────────────────────────────────────────────────────

export const ReminderSection: React.FC<Readonly<ReminderSectionProps>> = ({
  reminders,
  onRemindersChange,
}) => {
  const theme = useTheme();

  const handleAdd = () => {
    onRemindersChange([...reminders, { reminderType: '1_hour_before', channel: 'discord' }]);
  };

  const handleRemove = (index: number) => {
    onRemindersChange(reminders.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof ReminderConfig, value: string) => {
    const updated = reminders.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    onRemindersChange(updated);
  };

  return (
    <Box sx={{ pt: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ReminderIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
        <Typography variant="subtitle2" sx={{ color: theme.palette.warning.light }}>
          Reminders
        </Typography>
      </Stack>

      {reminders.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          No reminders configured. Add one to notify participants before the activity starts.
        </Typography>
      )}

      <Stack spacing={1.5}>
        {reminders.map((reminder, index) => (
          <Stack
            key={`reminder-${reminder.reminderType}-${reminder.channel}-${index}`}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: `${theme.palette.background.default}80`,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <FormControl size="small" sx={{ minWidth: 160, flex: 1 }}>
              <InputLabel>When</InputLabel>
              <Select
                value={reminder.reminderType}
                label="When"
                onChange={e => handleChange(index, 'reminderType', e.target.value)}
              >
                {REMINDER_TYPE_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
              <InputLabel>Channel</InputLabel>
              <Select
                value={reminder.channel}
                label="Channel"
                onChange={e => handleChange(index, 'channel', e.target.value)}
              >
                {CHANNEL_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Chip
              label={`${REMINDER_LABELS[reminder.reminderType]} · ${CHANNEL_LABELS[reminder.channel]}`}
              size="small"
              sx={{
                bgcolor: `${theme.palette.warning.main}1A`,
                color: theme.palette.warning.light,
                display: { xs: 'none', sm: 'flex' },
              }}
            />

            <IconButton
              size="small"
              onClick={() => handleRemove(index)}
              sx={{ color: theme.palette.error.main }}
              aria-label={`Remove reminder ${index + 1}`}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Button
        size="small"
        startIcon={<ReminderIcon />}
        onClick={handleAdd}
        disabled={reminders.length >= 5}
        sx={{
          mt: 1,
          color: theme.palette.warning.main,
          textTransform: 'none',
          '&:hover': { bgcolor: `${theme.palette.warning.main}14` },
        }}
      >
        {reminders.length === 0 ? 'Add Reminder' : 'Add Another Reminder'}
      </Button>
    </Box>
  );
};
