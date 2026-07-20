/**
 * BestTimesPanel — Find optimal scheduling windows
 * Wave 2.4 — Group Scheduling & Availability
 */

import { useBestTimes } from '@/hooks/queries/useAvailabilityQueries';
import { Event as EventIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import type { BestTimeWindow } from '@sc-fleet-manager/shared-types';
import { useState } from 'react';

interface BestTimesPanelProps {
  orgId: string;
  /** Called when user clicks "Create Event" for a suggested time */
  onCreateEvent?: (window: BestTimeWindow) => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' },
];

export function BestTimesPanel({ orgId, onCreateEvent }: Readonly<BestTimesPanelProps>) {
  const theme = useTheme();
  const [duration, setDuration] = useState(120);
  const [minAttendees, setMinAttendees] = useState(3);
  const [searched, setSearched] = useState(false);

  const {
    data,
    isLoading: loading,
    isFetched,
  } = useBestTimes(orgId, duration, minAttendees, {
    enabled: searched && !!orgId,
  });
  const windows = data?.windows ?? [];

  const handleSearch = () => {
    if (!orgId) return;
    setSearched(true);
  };

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        p: 2,
      }}
    >
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        <ScheduleIcon sx={{ fontSize: 20, mr: 0.5, verticalAlign: 'text-bottom' }} />
        Find Best Times
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Duration
          </Typography>
          <Select
            size="small"
            value={duration}
            onChange={e => setDuration(e.target.value as number)}
            sx={{ minWidth: 120, '& .MuiSelect-select': { py: 0.75 } }}
          >
            {DURATION_OPTIONS.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Min attendees
          </Typography>
          <TextField
            size="small"
            type="number"
            value={minAttendees}
            onChange={e => setMinAttendees(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1, max: 500 }}
            sx={{ width: 80 }}
          />
        </Box>

        <Box sx={{ pt: 2.5 }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleSearch}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <ScheduleIcon />}
            sx={{
              backgroundColor: theme.palette.primary.main,
              '&:hover': { backgroundColor: theme.palette.primary.dark },
            }}
          >
            {loading ? 'Searching...' : 'Find Times'}
          </Button>
        </Box>
      </Stack>

      {/* Results */}
      {searched && isFetched && windows.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No time windows found with the given criteria. Try lowering the minimum attendees.
        </Typography>
      )}

      {windows.length > 0 && (
        <Stack spacing={1}>
          {windows.map((w, i) => (
            <Stack
              key={`${w.dayOfWeek}-${w.startMinute}`}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.06),
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                px: 2,
                py: 1,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography
                  variant="body2"
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                    color: theme.palette.primary.main,
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  {i + 1}
                </Typography>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {w.dayName} {w.timeRange}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {w.availableCount} member{w.availableCount !== 1 ? 's' : ''} available
                  </Typography>
                </Box>
              </Stack>

              {onCreateEvent && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EventIcon />}
                  onClick={() => onCreateEvent(w)}
                  sx={{ fontSize: '0.7rem' }}
                >
                  Create Event
                </Button>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
