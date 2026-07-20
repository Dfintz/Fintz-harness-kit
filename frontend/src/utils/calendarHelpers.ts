/**
 * Calendar Helpers — Activity type colors, event mapping, Google Calendar URL
 * Wave 2.3 — Activity Calendar View
 */

import { scColors } from '@/components/ui/tokens';

/**
 * Color mapping for activity types (dark theme palette)
 */
export const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  EVENT: scColors.info,
  MISSION: '#ff6b35',
  CONTRACT: scColors.gold,
  BOUNTY: scColors.error,
  OPERATION: '#7b68ee',
  JOB_LISTING: '#ff69b4',
  LFG: '#87ceeb',
};

/**
 * Calendar event shape compatible with react-big-calendar
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    type: string;
    color: string;
    location?: string;
    participantCount: number;
    maxParticipants?: number;
    description?: string;
    status?: string;
  };
}

/**
 * Convert an activity object to a react-big-calendar event
 */
export function activityToCalendarEvent(activity: {
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
}): CalendarEvent {
  const type = activity.type || 'EVENT';
  const start = activity.scheduledStartDate ? new Date(activity.scheduledStartDate) : new Date();
  const end = activity.scheduledEndDate
    ? new Date(activity.scheduledEndDate)
    : new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour

  return {
    id: activity.id,
    title: activity.title,
    start,
    end,
    resource: {
      type,
      color: ACTIVITY_TYPE_COLORS[type] || scColors.info,
      location: activity.location,
      participantCount: activity.currentParticipants ?? 0,
      maxParticipants: activity.maxParticipants,
      description: activity.description,
      status: activity.status,
    },
  };
}

/**
 * Build a Google Calendar "Add Event" URL
 */
export function buildGoogleCalendarUrl(activity: {
  title: string;
  scheduledStartDate?: string | Date;
  scheduledEndDate?: string | Date;
  description?: string;
  location?: string;
}): string {
  const start = activity.scheduledStartDate ? new Date(activity.scheduledStartDate) : new Date();
  const end = activity.scheduledEndDate
    ? new Date(activity.scheduledEndDate)
    : new Date(start.getTime() + 60 * 60 * 1000);

  const formatGCal = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: activity.title,
    dates: `${formatGCal(start)}/${formatGCal(end)}`,
    details: activity.description || '',
    location: activity.location || '',
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

/**
 * Get CSS style object for an event based on its activity type
 */
export function getEventStyle(event: CalendarEvent): React.CSSProperties {
  const color = event.resource.color;
  return {
    backgroundColor: color,
    borderLeft: `3px solid ${color}`,
    borderRadius: '4px',
    opacity: 0.9,
    color: scColors.text.primary,
    fontSize: '0.8rem',
    padding: '2px 4px',
  };
}
