/**
 * RecurrenceSection — Collapsible recurrence configuration for activities/events.
 *
 * Shows a "Repeat this activity" checkbox that expands into frequency,
 * interval, day-of-week toggles, end-condition, and a date preview list.
 */
import { recurringActivityService } from '@/services/recurringActivityService';
import { logger } from '@/utils/logger';
import { Repeat as RepeatIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type {
  DayOfWeekOption,
  FrequencyOption,
  RecurrenceFrequency,
  RecurrenceOccurrence,
  RecurrenceRule,
} from '@sc-fleet-manager/shared-types';
import React, { useCallback, useEffect, useState } from 'react';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RecurrenceSectionProps {
  isRecurring: boolean;
  onIsRecurringChange: (value: boolean) => void;
  recurrenceRule: RecurrenceRule;
  onRuleChange: (rule: RecurrenceRule) => void;
  /** ISO start time (used for preview) */
  startTime?: string;
}

// ─── End condition type ──────────────────────────────────────────────────────

type EndCondition = 'never' | 'afterCount' | 'onDate';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FREQUENCY_UNITS: Record<string, string> = {
  daily: 'day(s)',
  weekly: 'week(s)',
  monthly: 'month(s)',
  yearly: 'year(s)',
};

function frequencyUnitLabel(freq: RecurrenceFrequency | undefined): string {
  return (freq && FREQUENCY_UNITS[freq]) ?? 'period(s)';
}

function formatEndDate(endDate: Date | string | undefined): string {
  if (!endDate) return '';
  if (typeof endDate === 'string') return endDate.slice(0, 10);
  return new Date(endDate).toISOString().slice(0, 10);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const RecurrenceSection: React.FC<RecurrenceSectionProps> = ({
  isRecurring,
  onIsRecurringChange,
  recurrenceRule,
  onRuleChange,
  startTime,
}) => {
  const theme = useTheme();

  // ── Metadata from backend ──
  const [frequencies, setFrequencies] = useState<FrequencyOption[]>([]);
  const [dayOptions, setDayOptions] = useState<DayOfWeekOption[]>([]);

  // ── End condition UI state ──
  const [endCondition, setEndCondition] = useState<EndCondition>(() => {
    if (recurrenceRule.maxOccurrences) return 'afterCount';
    if (recurrenceRule.endDate) return 'onDate';
    return 'never';
  });

  // ── Preview ──
  const [previewDates, setPreviewDates] = useState<RecurrenceOccurrence[]>([]);
  const [previewDescription, setPreviewDescription] = useState('');
  const [previewError, setPreviewError] = useState('');

  // ── Fetch frequency metadata ──
  useEffect(() => {
    if (!isRecurring) return;
    recurringActivityService
      .getFrequencies()
      .then(res => {
        setFrequencies(res.frequencies);
        setDayOptions(res.daysOfWeek);
      })
      .catch(err => logger.warn('Failed to load frequencies', err));
  }, [isRecurring]);

  // ── Fetch preview when rule + startTime changes ──
  const fetchPreview = useCallback(async () => {
    if (!isRecurring || !startTime || !recurrenceRule.frequency) {
      setPreviewDates([]);
      setPreviewDescription('');
      return;
    }
    try {
      setPreviewError('');
      const res = await recurringActivityService.preview({
        rule: recurrenceRule,
        startTime,
        count: 5,
      });
      setPreviewDates(res.occurrences);
      setPreviewDescription(res.recurrenceDescription);
    } catch {
      setPreviewError('Could not generate preview');
      setPreviewDates([]);
    }
  }, [isRecurring, startTime, recurrenceRule]);

  useEffect(() => {
    const timer = setTimeout(fetchPreview, 400);
    return () => clearTimeout(timer);
  }, [fetchPreview]);

  // ── Helpers ──
  const updateRule = (partial: Partial<RecurrenceRule>) => {
    onRuleChange({ ...recurrenceRule, ...partial });
  };

  const handleFrequencyChange = (frequency: RecurrenceFrequency) => {
    const updated: Partial<RecurrenceRule> = { frequency };
    // Clear day-specific fields when switching frequency
    if (frequency !== 'weekly' && frequency !== 'biweekly') {
      updated.daysOfWeek = undefined;
    }
    if (frequency !== 'monthly') {
      updated.dayOfMonth = undefined;
    }
    if (frequency !== 'yearly') {
      updated.monthOfYear = undefined;
    }
    updateRule(updated);
  };

  const handleEndConditionChange = (condition: EndCondition) => {
    setEndCondition(condition);
    switch (condition) {
      case 'never':
        updateRule({ endDate: undefined, maxOccurrences: undefined });
        break;
      case 'afterCount':
        updateRule({ endDate: undefined, maxOccurrences: recurrenceRule.maxOccurrences || 10 });
        break;
      case 'onDate':
        updateRule({ maxOccurrences: undefined, endDate: recurrenceRule.endDate || '' });
        break;
    }
  };

  const handleDayToggle = (_: React.MouseEvent<HTMLElement>, newDays: number[]) => {
    updateRule({ daysOfWeek: newDays.length > 0 ? newDays : undefined });
  };

  const showDayPicker =
    recurrenceRule.frequency === 'weekly' || recurrenceRule.frequency === 'biweekly';

  return (
    <Box sx={{ pt: 1 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={isRecurring}
            onChange={e => onIsRecurringChange(e.target.checked)}
            size="small"
          />
        }
        label={
          <Stack direction="row" spacing={0.5} alignItems="center">
            <RepeatIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
            <Typography variant="body2">Repeat this activity</Typography>
          </Stack>
        }
      />

      <Collapse in={isRecurring} timeout="auto">
        <Stack spacing={2} sx={{ mt: 1.5, pl: 1 }}>
          {/* ── Frequency + Interval ── */}
          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={recurrenceRule.frequency}
                label="Frequency"
                onChange={e => handleFrequencyChange(e.target.value as RecurrenceFrequency)}
              >
                {frequencies.map(f => (
                  <MenuItem key={f.value} value={f.value}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Every N"
              type="number"
              size="small"
              fullWidth
              value={recurrenceRule.interval ?? 1}
              onChange={e => {
                const val = Number.parseInt(e.target.value, 10);
                updateRule({ interval: val > 0 ? val : 1 });
              }}
              slotProps={{ htmlInput: { min: 1, max: 365 } }}
              helperText={`Every ${recurrenceRule.interval ?? 1} ${frequencyUnitLabel(recurrenceRule.frequency)}`}
            />
          </Stack>

          {/* ── Day-of-week toggles (weekly / biweekly) ── */}
          {showDayPicker && dayOptions.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: 'block' }}
              >
                Days of the week
              </Typography>
              <ToggleButtonGroup
                value={recurrenceRule.daysOfWeek ?? []}
                onChange={handleDayToggle}
                size="small"
                sx={{
                  flexWrap: 'wrap',
                  '& .MuiToggleButton-root': {
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.8rem',
                    borderRadius: 1,
                  },
                }}
              >
                {dayOptions.map(d => (
                  <ToggleButton key={d.value} value={d.value}>
                    {d.short}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          {/* ── End condition ── */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Ends
            </Typography>
            <RadioGroup
              row
              value={endCondition}
              onChange={e => handleEndConditionChange(e.target.value as EndCondition)}
            >
              <FormControlLabel value="never" control={<Radio size="small" />} label="Never" />
              <FormControlLabel value="afterCount" control={<Radio size="small" />} label="After" />
              <FormControlLabel value="onDate" control={<Radio size="small" />} label="On date" />
            </RadioGroup>

            {endCondition === 'afterCount' && (
              <TextField
                label="Number of occurrences"
                type="number"
                size="small"
                value={recurrenceRule.maxOccurrences ?? 10}
                onChange={e => {
                  const val = Number.parseInt(e.target.value, 10);
                  updateRule({ maxOccurrences: val > 0 ? val : 1 });
                }}
                slotProps={{ htmlInput: { min: 1, max: 365 } }}
                sx={{ mt: 1, maxWidth: 220 }}
              />
            )}

            {endCondition === 'onDate' && (
              <TextField
                label="End date"
                type="date"
                size="small"
                value={formatEndDate(recurrenceRule.endDate)}
                onChange={e => updateRule({ endDate: e.target.value || undefined })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ mt: 1, maxWidth: 220 }}
              />
            )}
          </Box>

          {/* ── Preview ── */}
          {previewDescription && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: `${theme.palette.info.main}0A`,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
                {previewDescription}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {previewDates.map(o => (
                  <Chip
                    key={o.index}
                    label={new Date(o.startTime).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {previewError && (
            <Alert severity="warning" variant="outlined" sx={{ py: 0 }}>
              {previewError}
            </Alert>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
};
