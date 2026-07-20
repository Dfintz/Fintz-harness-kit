/**
 * Calendar Helpers — Unit tests
 * Wave 2.3 — Activity Calendar View
 */

import {
  ACTIVITY_TYPE_COLORS,
  activityToCalendarEvent,
  buildGoogleCalendarUrl,
  getEventStyle,
} from '@/utils/calendarHelpers';

describe('calendarHelpers', () => {
  describe('ACTIVITY_TYPE_COLORS', () => {
    it('has colors for all expected activity types', () => {
      expect(ACTIVITY_TYPE_COLORS.EVENT).toBeDefined();
      expect(ACTIVITY_TYPE_COLORS.MISSION).toBeDefined();
      expect(ACTIVITY_TYPE_COLORS.CONTRACT).toBeDefined();
      expect(ACTIVITY_TYPE_COLORS.BOUNTY).toBeDefined();
      expect(ACTIVITY_TYPE_COLORS.OPERATION).toBeDefined();
      expect(ACTIVITY_TYPE_COLORS.JOB_LISTING).toBeDefined();
      expect(ACTIVITY_TYPE_COLORS.LFG).toBeDefined();
    });
  });

  describe('activityToCalendarEvent', () => {
    it('converts a full activity to a calendar event', () => {
      const activity = {
        id: 'act-1',
        title: 'Mining Run',
        type: 'MISSION',
        scheduledStartDate: '2026-03-01T14:00:00Z',
        scheduledEndDate: '2026-03-01T16:00:00Z',
        location: 'Yela Belt',
        description: 'Group mining op',
        status: 'open',
        maxParticipants: 10,
        currentParticipants: 4,
      };

      const result = activityToCalendarEvent(activity);

      expect(result.id).toBe('act-1');
      expect(result.title).toBe('Mining Run');
      expect(result.start).toEqual(new Date('2026-03-01T14:00:00Z'));
      expect(result.end).toEqual(new Date('2026-03-01T16:00:00Z'));
      expect(result.resource.type).toBe('MISSION');
      expect(result.resource.color).toBe(ACTIVITY_TYPE_COLORS.MISSION);
      expect(result.resource.location).toBe('Yela Belt');
      expect(result.resource.participantCount).toBe(4);
      expect(result.resource.maxParticipants).toBe(10);
      expect(result.resource.description).toBe('Group mining op');
      expect(result.resource.status).toBe('open');
    });

    it('defaults to EVENT type when type is missing', () => {
      const result = activityToCalendarEvent({
        id: 'act-2',
        title: 'Untitled',
        scheduledStartDate: '2026-04-01T12:00:00Z',
      });

      expect(result.resource.type).toBe('EVENT');
      expect(result.resource.color).toBe(ACTIVITY_TYPE_COLORS.EVENT);
    });

    it('defaults end to 1 hour after start when endDate is missing', () => {
      const result = activityToCalendarEvent({
        id: 'act-3',
        title: 'Short Event',
        scheduledStartDate: '2026-04-01T12:00:00Z',
      });

      const expectedEnd = new Date('2026-04-01T13:00:00Z');
      expect(result.end).toEqual(expectedEnd);
    });

    it('defaults participantCount to 0 when currentParticipants is undefined', () => {
      const result = activityToCalendarEvent({
        id: 'act-4',
        title: 'Empty',
        scheduledStartDate: '2026-04-01T12:00:00Z',
      });

      expect(result.resource.participantCount).toBe(0);
    });
  });

  describe('buildGoogleCalendarUrl', () => {
    it('builds a valid Google Calendar URL', () => {
      const url = buildGoogleCalendarUrl({
        title: 'Test Event',
        scheduledStartDate: '2026-05-01T10:00:00Z',
        scheduledEndDate: '2026-05-01T12:00:00Z',
        description: 'A test',
        location: 'Port Olisar',
      });

      expect(url).toContain('https://www.google.com/calendar/render');
      expect(url).toContain('text=Test+Event');
      expect(url).toContain('location=Port+Olisar');
      expect(url).toContain('details=A+test');
      expect(url).toContain('action=TEMPLATE');
    });

    it('handles missing optional fields', () => {
      const url = buildGoogleCalendarUrl({
        title: 'Minimal Event',
      });

      expect(url).toContain('text=Minimal+Event');
      expect(url).toContain('details=');
      expect(url).toContain('location=');
    });
  });

  describe('getEventStyle', () => {
    it('returns a style object with the event color', () => {
      const event = activityToCalendarEvent({
        id: 'e-1',
        title: 'Bounty Hunt',
        type: 'BOUNTY',
        scheduledStartDate: '2026-06-01T08:00:00Z',
      });

      const style = getEventStyle(event);

      expect(style.backgroundColor).toBe(ACTIVITY_TYPE_COLORS.BOUNTY);
      expect(style.color).toBe('#ffffff');
      expect(style.borderRadius).toBeDefined();
    });
  });
});
