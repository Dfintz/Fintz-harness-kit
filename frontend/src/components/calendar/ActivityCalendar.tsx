/**
 * ActivityCalendar — Month/Week/Day calendar view using react-big-calendar
 * Wave 2.3 — Activity Calendar View
 */

import {
  activityToCalendarEvent,
  getEventStyle,
  type CalendarEvent,
} from '@/utils/calendarHelpers';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import React, { useCallback, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';

// Import react-big-calendar CSS (bundled via Vite)
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface ActivityCalendarProps {
  /** Activities to display on the calendar */
  activities: Array<{
    id: string;
    title: string;
    type?: string;
    scheduledStartDate?: string | Date;
    scheduledEndDate?: string | Date;
    location?: string;
    description?: string;
    status?: string;
    maxParticipants?: number;
    currentParticipants?: number;
  }>;
  /** Called when a calendar event is clicked */
  onEventClick?: (event: CalendarEvent, element: HTMLElement) => void;
  /** Current loading state */
  isLoading?: boolean;
}

export function ActivityCalendar({
  activities,
  onEventClick,
  isLoading,
}: Readonly<ActivityCalendarProps>) {
  const theme = useTheme();
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Convert activities to calendar events
  const events = useMemo(
    () =>
      activities
        .filter(a => a.scheduledStartDate) // Only show events with a scheduled date
        .map(activityToCalendarEvent),
    [activities]
  );

  // Style each event based on its activity type
  const eventPropGetter = useCallback(
    (event: CalendarEvent) => ({
      style: getEventStyle(event),
    }),
    []
  );

  // Handle event selection
  const handleSelectEvent = useCallback(
    (event: CalendarEvent, e: React.SyntheticEvent) => {
      if (onEventClick) {
        onEventClick(event, e.currentTarget as HTMLElement);
      }
    },
    [onEventClick]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <Typography color="text.secondary">Loading calendar...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: 700,
        // Dark theme overrides for react-big-calendar
        '& .rbc-calendar': {
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
          fontFamily: 'inherit',
        },
        '& .rbc-toolbar': {
          mb: 1,
          '& button': {
            color: theme.palette.text.primary,
            borderColor: theme.palette.divider,
            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
            '&.rbc-active': {
              backgroundColor: alpha(theme.palette.primary.main, 0.2),
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
            },
          },
        },
        '& .rbc-header': {
          backgroundColor: theme.palette.background.paper,
          borderColor: theme.palette.divider,
          padding: '8px 4px',
          fontWeight: 500,
        },
        '& .rbc-month-view, & .rbc-time-view': {
          borderColor: theme.palette.divider,
        },
        '& .rbc-month-row, & .rbc-day-bg': {
          borderColor: theme.palette.divider,
        },
        '& .rbc-off-range-bg': {
          backgroundColor: alpha(theme.palette.background.default, 0.5),
        },
        '& .rbc-today': {
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
        },
        '& .rbc-event': {
          borderRadius: '4px',
          border: 'none',
        },
        '& .rbc-event-label': {
          fontSize: '0.7rem',
        },
        '& .rbc-show-more': {
          color: theme.palette.primary.main,
          fontWeight: 500,
        },
        '& .rbc-time-header': {
          borderColor: theme.palette.divider,
        },
        '& .rbc-time-content': {
          borderColor: theme.palette.divider,
        },
        '& .rbc-timeslot-group': {
          borderColor: theme.palette.divider,
        },
        '& .rbc-time-slot': {
          borderColor: theme.palette.divider,
        },
        '& .rbc-current-time-indicator': {
          backgroundColor: theme.palette.primary.main,
        },
        '& .rbc-date-cell': {
          color: theme.palette.text.secondary,
          '& > a': { color: theme.palette.text.secondary },
        },
        '& .rbc-toolbar-label': {
          fontWeight: 600,
          fontSize: '1.1rem',
        },
      }}
    >
      <Calendar
        localizer={localizer}
        events={events}
        view={currentView}
        onView={setCurrentView}
        date={currentDate}
        onNavigate={setCurrentDate}
        eventPropGetter={eventPropGetter as any}
        onSelectEvent={handleSelectEvent as any}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        popup
        selectable={false}
        style={{ height: '100%' }}
      />
    </Box>
  );
}
