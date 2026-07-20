/**
 * EventDetailPopup — MUI Popover showing event details on calendar click
 * Wave 2.3 — Activity Calendar View
 */

import {
  ACTIVITY_TYPE_COLORS,
  buildGoogleCalendarUrl,
  type CalendarEvent,
} from '@/utils/calendarHelpers';
import {
  CalendarMonth as CalendarIcon,
  Download as DownloadIcon,
  OpenInNew as OpenIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Popover,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';

interface EventDetailPopupProps {
  event: CalendarEvent | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  /** Base URL for the app, used to build detail links */
  baseUrl?: string;
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export function EventDetailPopup({
  event,
  anchorEl,
  onClose,
  baseUrl = '',
}: Readonly<EventDetailPopupProps>) {
  const theme = useTheme();
  if (!event) return null;

  const { resource } = event;
  const typeColor = ACTIVITY_TYPE_COLORS[resource.type] || theme.palette.primary.main;
  const participantRatio =
    resource.maxParticipants && resource.maxParticipants > 0
      ? (resource.participantCount / resource.maxParticipants) * 100
      : 0;

  const handleExportICS = () => {
    // Trigger download from backend endpoint
    const url = `${baseUrl}/api/v2/activities/${event.id}/ics`;
    window.open(url, '_blank');
  };

  const handleGoogleCalendar = () => {
    const url = buildGoogleCalendarUrl({
      title: event.title,
      scheduledStartDate: event.start,
      scheduledEndDate: event.end,
      description: resource.description,
      location: resource.location,
    });
    window.open(url, '_blank', 'noopener');
  };

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            width: 340,
            p: 2,
          },
        },
      }}
    >
      {/* Header: Title + Type chip */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
          {event.title}
        </Typography>
        <Chip
          label={resource.type}
          size="small"
          sx={{
            backgroundColor: alpha(typeColor, 0.13),
            color: typeColor,
            fontWeight: 500,
            fontSize: '0.7rem',
          }}
        />
      </Stack>

      {/* Date/time */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <CalendarIcon sx={{ fontSize: 16, color: 'grey.500' }} />
        <Typography variant="body2" color="text.secondary">
          {formatDateRange(event.start, event.end)}
        </Typography>
      </Stack>

      {/* Location */}
      {resource.location && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
          <PlaceIcon sx={{ fontSize: 16, color: 'grey.500' }} />
          <Typography variant="body2" color="text.secondary">
            {resource.location}
          </Typography>
        </Stack>
      )}

      {/* Participants */}
      {resource.maxParticipants != null && resource.maxParticipants > 0 && (
        <Box sx={{ mt: 1, mb: 1 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Participants
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {resource.participantCount} / {resource.maxParticipants}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(participantRatio, 100)}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.common.white, 0.08),
              '& .MuiLinearProgress-bar': {
                backgroundColor: typeColor,
                borderRadius: 3,
              },
            }}
          />
        </Box>
      )}

      {/* Description snippet */}
      {resource.description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 1,
            mb: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {resource.description}
        </Typography>
      )}

      <Divider sx={{ my: 1, borderColor: theme.palette.divider }} />

      {/* Action buttons */}
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          size="small"
          variant="outlined"
          startIcon={<OpenIcon />}
          href={`/activities/${event.id}`}
          sx={{ fontSize: '0.75rem' }}
        >
          Details
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<CalendarIcon />}
          onClick={handleGoogleCalendar}
          sx={{ fontSize: '0.75rem' }}
        >
          Google Cal
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportICS}
          sx={{ fontSize: '0.75rem' }}
        >
          ICS
        </Button>
      </Stack>
    </Popover>
  );
}
