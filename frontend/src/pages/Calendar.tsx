import { ActivityCalendar } from '@/components/calendar/ActivityCalendar';
import { AvailabilityGrid } from '@/components/calendar/AvailabilityGrid';
import { BestTimesPanel } from '@/components/calendar/BestTimesPanel';
import { EventDetailPopup } from '@/components/calendar/EventDetailPopup';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import {
  useCreateEvent,
  useDeleteEvent,
  useEvents,
  useUpdateEvent,
} from '@/hooks/queries/useEventQueries';
import { apiClient } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import type { CalendarEvent } from '@/utils/calendarHelpers';
import { logger } from '@/utils/logger';
import {
  CalendarMonth as CalendarIcon,
  CalendarToday as CalendarTodayIcon,
  AccessTime as Clock,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FormatListBulleted as ListIcon,
  LocationOn as Location,
  RocketLaunch as RocketLaunchIcon,
  Schedule as ScheduleIcon,
  Groups as UserGroup,
} from '@mui/icons-material';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
interface EventAttendee {
  userId: string;
  role: string;
  status: string;
  shipName?: string;
  shipType?: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  attendees: string[];
  attendeesDetailed?: EventAttendee[];
  participantCount?: number;
  organizationId?: string;
  creatorId?: string;
  sharedWithOrgs?: string[];
  roleRequirements?: { [key: string]: number };
}

/** Extracted sx to avoid deeply nested function callbacks */
const roleRequirementBoxSx = (theme: Theme) => ({
  background: alpha(theme.palette.common.white, 0.05),
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '0.9rem',
});

const CalendarPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const orgId = user?.activeOrgId || user?.organizationId || '';

  // Date range for calendar view (3 months back, 6 months forward)
  const [calendarDateRange] = useState(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    const end = new Date();
    end.setMonth(end.getMonth() + 6);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  });

  const {
    data: events = [],
    isLoading: eventsLoading,
    error: eventsError,
  } = useEvents(calendarDateRange);
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();
  const notification = useNotification();

  // View tab: 0 = list, 1 = calendar
  const [viewTab, setViewTab] = useState(0);

  // Activities for the calendar view (fetched from v2 API)
  const [activities, setActivities] = useState<
    Array<{
      id: string;
      title: string;
      type?: string;
      scheduledStartDate?: string;
      scheduledEndDate?: string;
      location?: string;
      description?: string;
      status?: string;
      maxParticipants?: number;
      currentParticipants?: number;
      organizationId?: string;
      creatorId?: string;
    }>
  >([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Event detail popup state
  const [popupEvent, setPopupEvent] = useState<CalendarEvent | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<HTMLElement | null>(null);

  // CRUD state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    duration: '',
    recurrence: 'none' as 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly',
    recurrenceEndDate: '',
  });
  const { openDialog, closeDialog, pendingData, dialogProps } = useConfirmDialog<string>();

  useEffect(() => {
    fetchActivities();
  }, []);

  // Fetch activities for the calendar view from the v2 API
  const fetchActivities = async () => {
    setActivitiesLoading(true);
    try {
      const response = await apiClient.get('/api/v2/activities', {
        params: { limit: 200 },
      });
      const payload = response.data as Record<string, unknown> | unknown[];
      const data =
        (!Array.isArray(payload) && payload?.data) ||
        (!Array.isArray(payload) && payload?.items) ||
        payload ||
        [];
      setActivities(
        Array.isArray(data)
          ? data.map((a: Record<string, unknown>) => ({
              id: a.id as string,
              title: a.title as string,
              type: (a.activityType || a.type) as string | undefined,
              scheduledStartDate: a.scheduledStartDate as string | undefined,
              scheduledEndDate: a.scheduledEndDate as string | undefined,
              location: a.location as string | undefined,
              description: a.description as string | undefined,
              status: a.status as string | undefined,
              maxParticipants: a.maxParticipants as number | undefined,
              currentParticipants: (a.currentParticipants as number) ?? 0,
              organizationId: a.organizationId as string | undefined,
              creatorId: a.creatorId as string | undefined,
            }))
          : []
      );
    } catch (err) {
      logger.error(
        'Failed to fetch activities for calendar',
        err instanceof Error ? err : new Error(String(err))
      );
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Re-fetch activities when switching to calendar tab if not loaded
  useEffect(() => {
    if (viewTab === 1 && activities.length === 0 && !activitiesLoading) {
      fetchActivities();
    }
  }, [viewTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle calendar event click → open popup
  const handleCalendarEventClick = (event: CalendarEvent, element: HTMLElement) => {
    setPopupEvent(event);
    setPopupAnchor(element);
  };

  // Helper function to build date-time string
  const buildDateTime = (date: string, time: string): string => {
    return time ? `${date}T${time}:00` : `${date}T00:00:00`;
  };

  // Create event
  const handleCreateEvent = async () => {
    if (!formData.title || !formData.date) {
      notification.error('Title and date are required');
      return;
    }

    try {
      const dateTime = buildDateTime(formData.date, formData.time);

      await createEventMutation.mutateAsync({
        title: formData.title,
        description: formData.description || '',
        date: dateTime,
        location: formData.location,
        organizationId: orgId || undefined,
        duration: formData.duration ? Number(formData.duration) : undefined,
        recurrence: formData.recurrence === 'none' ? undefined : formData.recurrence,
        recurrenceEndDate: formData.recurrenceEndDate || undefined,
      });

      setIsCreateDialogOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Failed to create event', err instanceof Error ? err : new Error(String(err)));
      notification.error('Failed to create event');
    }
  };

  // Update event
  const handleUpdateEvent = async () => {
    if (!selectedEvent || !formData.title || !formData.date) {
      notification.error('Title and date are required');
      return;
    }

    try {
      const dateTime = buildDateTime(formData.date, formData.time);

      await updateEventMutation.mutateAsync({
        eventId: selectedEvent.id,
        data: {
          title: formData.title,
          description: formData.description,
          date: dateTime,
          location: formData.location,
          duration: formData.duration ? Number(formData.duration) : undefined,
          recurrence: formData.recurrence === 'none' ? undefined : formData.recurrence,
          recurrenceEndDate: formData.recurrenceEndDate || undefined,
        },
      });

      setIsEditDialogOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Failed to update event', err instanceof Error ? err : new Error(String(err)));
      notification.error('Failed to update event');
    }
  };

  // Delete event
  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEventMutation.mutateAsync(eventId);
    } catch (err) {
      logger.error('Failed to delete event', err instanceof Error ? err : new Error(String(err)));
      notification.error('Failed to delete event');
    }
  };

  // Open edit dialog
  const openEditDialog = (event: Event) => {
    const eventDate = new Date(event.date);
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      date: eventDate.toISOString().split('T')[0],
      time: eventDate.toTimeString().slice(0, 5),
      location: event.location || '',
      duration: '',
      recurrence: 'none',
      recurrenceEndDate: '',
    });
    setIsEditDialogOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '',
      location: '',
      duration: '',
      recurrence: 'none',
      recurrenceEndDate: '',
    });
    setSelectedEvent(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleEmoji = (role: string): string => {
    const roleMap: { [key: string]: string } = {
      pilot: 'P',
      engineer: 'E',
      gunner: 'G',
      medic: 'M',
      vehicle_operator: 'V',
      marine: 'MR',
      ground_support: 'GS',
      tank: 'T',
      dps: 'D',
      support: 'S',
      any: '*',
    };
    return roleMap[role.toLowerCase()] || '?';
  };

  const getStatusEmoji = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      accepted: 'Y',
      tentative: '?',
      declined: 'N',
    };
    return statusMap[status.toLowerCase()] || '?';
  };

  const groupEventsByDate = (events: Event[]) => {
    const grouped: { [key: string]: Event[] } = {};

    events.forEach(event => {
      const date = new Date(event.date);
      const dateKey = date.toISOString().split('T')[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    // Sort events within each day by time
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    return grouped;
  };

  if (eventsLoading && activitiesLoading) {
    return <LoadingSpinner message="Loading calendar..." />;
  }

  // Merge v1 events with v2 activities for the list view
  const activityEvents: Event[] = activities
    .filter(a => a.scheduledStartDate)
    .map(a => ({
      id: a.id,
      title: a.title,
      description: a.description || '',
      date: a.scheduledStartDate || '',
      location: a.location || '',
      attendees: [],
      participantCount: a.currentParticipants ?? 0,
      organizationId: a.organizationId,
      creatorId: a.creatorId,
    }));

  const allEvents = [...events, ...activityEvents];
  // Deduplicate by id
  const uniqueEventsMap = new Map(allEvents.map(e => [e.id, e]));
  const mergedEvents = Array.from(uniqueEventsMap.values());

  const upcomingEvents = mergedEvents
    .filter(event => new Date(event.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const groupedEvents = groupEventsByDate(upcomingEvents);

  return (
    <Stack direction="column" gap="size-300" width="100%">
      {/* Header */}
      <Stack justifyContent="space-between" alignItems="center">
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="h4"
              sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <CalendarTodayIcon /> Calendar
            </Typography>
            <HelpTooltip
              content="Schedule and manage events, operations, and social activities. Create personal events or org events. Members can RSVP and track upcoming activities."
              icon
              iconSize="sm"
              position="right"
            />
          </Stack>
          <Typography sx={{ fontSize: '1.1rem', color: 'text.secondary', marginTop: '8px' }}>
            Plan and manage upcoming operations and events
          </Typography>
        </Box>
      </Stack>

      {/* View Tabs */}
      <Tabs
        value={viewTab}
        onChange={(_e, v) => setViewTab(v as number)}
        sx={{
          '& .MuiTab-root': { color: 'text.secondary', textTransform: 'none', fontWeight: 500 },
          '& .Mui-selected': { color: 'primary.main' },
          '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
        }}
      >
        <Tab icon={<ListIcon />} iconPosition="start" label="List View" />
        <Tab icon={<CalendarIcon />} iconPosition="start" label="Calendar View" />
        <Tab icon={<ScheduleIcon />} iconPosition="start" label="Availability" />
      </Tabs>

      {eventsError && <ErrorMessage message={'Failed to fetch events'} />}

      {/* Calendar View */}
      {viewTab === 1 && (
        <Box sx={{ mt: 2 }}>
          <ActivityCalendar
            activities={activities}
            onEventClick={handleCalendarEventClick}
            isLoading={activitiesLoading}
          />
          <EventDetailPopup
            event={popupEvent}
            anchorEl={popupAnchor}
            onClose={() => {
              setPopupEvent(null);
              setPopupAnchor(null);
            }}
          />
        </Box>
      )}

      {/* Availability View */}
      {viewTab === 2 && (
        <Box sx={{ mt: 2 }}>
          <Stack spacing={3}>
            <AvailabilityGrid orgId={orgId} />
            <BestTimesPanel orgId={orgId} />
          </Stack>
        </Box>
      )}

      {/* Create Event Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        disableRestoreFocus
      >
        <DialogTitle>Create New Event</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              id="create-event-title"
              label="Event Title"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              required
              fullWidth
            />
            <TextField
              id="create-event-description"
              label="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              id="create-event-date"
              label="Date"
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              id="create-event-time"
              label="Time"
              type="time"
              value={formData.time}
              onChange={e => setFormData({ ...formData, time: e.target.value })}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              id="create-event-location"
              label="Location"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              fullWidth
            />
            <TextField
              id="create-event-duration"
              label="Duration (minutes)"
              type="number"
              value={formData.duration}
              onChange={e => setFormData({ ...formData, duration: e.target.value })}
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              id="create-event-recurrence"
              select
              label="Recurrence"
              value={formData.recurrence}
              onChange={e =>
                setFormData({
                  ...formData,
                  recurrence: e.target.value as typeof formData.recurrence,
                })
              }
              fullWidth
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="biweekly">Bi-weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </TextField>
            {formData.recurrence !== 'none' && (
              <TextField
                id="create-event-recurrence-end"
                label="Recurrence End Date"
                type="date"
                value={formData.recurrenceEndDate}
                onChange={e => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateEvent}
            disabled={createEventMutation.isPending}
          >
            {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        disableRestoreFocus
      >
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Event Title"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Date"
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Time"
              type="time"
              value={formData.time}
              onChange={e => setFormData({ ...formData, time: e.target.value })}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Location"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              fullWidth
            />
            <TextField
              label="Duration (minutes)"
              type="number"
              value={formData.duration}
              onChange={e => setFormData({ ...formData, duration: e.target.value })}
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              select
              label="Recurrence"
              value={formData.recurrence}
              onChange={e =>
                setFormData({
                  ...formData,
                  recurrence: e.target.value as typeof formData.recurrence,
                })
              }
              fullWidth
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="biweekly">Bi-weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </TextField>
            {formData.recurrence !== 'none' && (
              <TextField
                label="Recurrence End Date"
                type="date"
                value={formData.recurrenceEndDate}
                onChange={e => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateEvent}
            disabled={updateEventMutation.isPending}
          >
            {updateEventMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Events List (shown in List View tab) */}
      {viewTab === 0 && (
        <Box sx={{ marginTop: 4 }}>
          {upcomingEvents.length === 0 ? (
            <Paper variant="outlined">
              <Stack direction="column" alignItems="center" gap={2} sx={{ padding: '3rem' }}>
                <CalendarIcon sx={{ fontSize: '4rem', color: 'text.secondary' }} />
                <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                  No Upcoming Events
                </Typography>
                <Typography sx={{ color: 'text.secondary' }}>
                  There are no tactical operations scheduled at the moment.
                </Typography>
              </Stack>
            </Paper>
          ) : (
            <Stack direction="column" gap="size-400">
              {Object.keys(groupedEvents)
                .sort((a, b) => a.localeCompare(b))
                .map(dateKey => (
                  <Box key={dateKey}>
                    <Typography variant="h5" sx={{ mb: 2 }}>
                      {formatDate(groupedEvents[dateKey][0].date)}
                    </Typography>
                    <Stack direction="column" gap="size-200">
                      {groupedEvents[dateKey].map(event => (
                        <Paper
                          key={event.id}
                          variant="outlined"
                          sx={{
                            p: 2,
                            cursor: 'pointer',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            '&:hover': {
                              borderColor: 'primary.main',
                              boxShadow: (theme: Theme) =>
                                `0 2px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                            },
                          }}
                          onClick={() => navigate(`/activities/${event.id}`)}
                        >
                          <Stack direction="column" gap="size-150">
                            {/* Event Header */}
                            <Stack justifyContent="space-between" alignItems="start">
                              <Typography variant="h6" sx={{ color: 'primary.main', margin: 0 }}>
                                {event.title}
                              </Typography>
                              <Stack gap={1} alignItems="center">
                                <Box
                                  sx={theme => ({
                                    background: alpha(theme.palette.primary.main, 0.15),
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                  })}
                                >
                                  <UserGroup fontSize="small" />{' '}
                                  {event.participantCount ?? event.attendees?.length ?? 0} attending
                                </Box>
                                {(event.creatorId === user?.id ||
                                  user?.role === 'admin' ||
                                  user?.role === 'moderator') && (
                                  <>
                                    <Tooltip title="Edit event">
                                      <IconButton
                                        onClick={e => {
                                          e.stopPropagation();
                                          openEditDialog(event);
                                        }}
                                        aria-label="Edit event"
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete event">
                                      <IconButton
                                        onClick={e => {
                                          e.stopPropagation();
                                          openDialog(event.id);
                                        }}
                                        aria-label="Delete event"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Stack>
                            </Stack>

                            {/* Event Details */}
                            <Typography sx={{ color: 'text.secondary' }}>
                              {event.description}
                            </Typography>

                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                                gap: 2,
                                marginTop: '8px',
                              }}
                            >
                              <Stack gap={1} alignItems="center">
                                <Clock sx={{ color: 'primary.main', fontSize: 16 }} />
                                <Typography>{formatTime(event.date)}</Typography>
                              </Stack>
                              <Stack gap={1} alignItems="center">
                                <Location sx={{ color: 'primary.main', fontSize: 16 }} />
                                <Typography>{event.location}</Typography>
                              </Stack>
                              <Stack gap={1} alignItems="center">
                                <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                                  ID: {event.id}
                                </Typography>
                              </Stack>
                            </Box>

                            {/* Role Requirements */}
                            {event.roleRequirements &&
                              Object.keys(event.roleRequirements).length > 0 && (
                                <>
                                  <Divider />
                                  <Box>
                                    <Typography sx={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                      Role Requirements:
                                    </Typography>
                                    <Stack gap={2} sx={{ flexWrap: 'wrap' }}>
                                      {Object.entries(event.roleRequirements).map(
                                        ([role, count]) => (
                                          <Box key={role} sx={roleRequirementBoxSx}>
                                            {getRoleEmoji(role)} {role}: {count}
                                          </Box>
                                        )
                                      )}
                                    </Stack>
                                  </Box>
                                </>
                              )}

                            {/* Attendees */}
                            {event.attendeesDetailed && event.attendeesDetailed.length > 0 && (
                              <>
                                <Divider />
                                <Box>
                                  <Typography sx={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                    Participants:
                                  </Typography>
                                  <Stack direction="column" gap={1}>
                                    {event.attendeesDetailed
                                      .filter(a => a.status === 'accepted')
                                      .map(attendee => (
                                        <Stack
                                          key={`${attendee.userId}-${attendee.role}`}
                                          gap={1}
                                          alignItems="center"
                                        >
                                          <Typography sx={{ fontSize: '0.9rem' }}>
                                            {getStatusEmoji(attendee.status)}{' '}
                                            {getRoleEmoji(attendee.role)} {attendee.role}
                                            {attendee.shipName && (
                                              <>
                                                {' '}
                                                -{' '}
                                                <RocketLaunchIcon
                                                  sx={{
                                                    fontSize: '0.9rem',
                                                    verticalAlign: 'middle',
                                                    mr: 0.25,
                                                  }}
                                                />
                                                {attendee.shipName}
                                              </>
                                            )}
                                            {attendee.shipType && ` (${attendee.shipType})`}
                                          </Typography>
                                        </Stack>
                                      ))}
                                  </Stack>
                                </Box>
                              </>
                            )}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                ))}
            </Stack>
          )}
        </Box>
      )}

      <ConfirmDialog
        {...dialogProps}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
        onConfirm={async () => {
          if (pendingData) await handleDeleteEvent(pendingData);
          closeDialog();
        }}
      />
    </Stack>
  );
};

export const CalendarPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Calendar"
    fallbackMessage="Unable to load calendar events. Please try again later."
    showHomeButton={true}
  >
    <CalendarPage />
  </FeatureErrorBoundary>
);
