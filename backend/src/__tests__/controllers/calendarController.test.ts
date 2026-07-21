/**
 * CalendarControllerV2 — Unit Tests
 *
 * Tests for the calendar API controller (Wave 2.3).
 * Validates ICS export, calendar data retrieval, and error handling.
 */

import { Request, Response } from 'express';

import { CalendarControllerV2 } from '../../controllers/v2/calendarController';
import { ActivityType } from '../../models/Activity';

// Mock ActivityCalendarService
const mockGetCalendar = jest.fn();
const mockGenerateActivityICS = jest.fn();
const mockGenerateICS = jest.fn();
const mockGenerateUserICS = jest.fn();

jest.mock('../../services/activity/ActivityCalendarService', () => ({
  ActivityCalendarService: {
    getInstance: () => ({
      getCalendar: mockGetCalendar,
      generateActivityICS: mockGenerateActivityICS,
      generateICS: mockGenerateICS,
      generateUserICS: mockGenerateUserICS,
    }),
  },
}));

describe('CalendarControllerV2', () => {
  let controller: CalendarControllerV2;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    controller = new CalendarControllerV2();

    mockReq = {
      params: {},
      query: {},
      user: { id: 'user-123', username: 'testuser' },
    } as unknown as Partial<Request>;

    mockRes = {
      success: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
      end: jest.fn(),
    };

    jest.clearAllMocks();
  });

  describe('getEvents', () => {
    it('should return calendar events for a date range', async () => {
      const calendarData = {
        events: [{ id: '1', title: 'Mining Op', start: new Date(), end: new Date() }],
        view: 'month',
      };
      mockGetCalendar.mockResolvedValue(calendarData);

      mockReq.query = {
        orgId: 'b0000000-0000-4000-8000-000000000002',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      };

      await controller.getEvents(mockReq as Request, mockRes as Response);

      expect(mockGetCalendar).toHaveBeenCalledWith(
        'b0000000-0000-4000-8000-000000000002',
        expect.any(Date),
        expect.any(Date),
        undefined
      );
      expect(mockRes.success).toHaveBeenCalledWith(calendarData);
    });

    it('should reject request without orgId', async () => {
      mockReq.query = { startDate: '2026-02-01' };

      await expect(controller.getEvents(mockReq as Request, mockRes as Response)).rejects.toThrow(
        'orgId query parameter is required'
      );
    });

    it('should reject request without authentication', async () => {
      (mockReq as Record<string, unknown>).user = undefined;

      await expect(controller.getEvents(mockReq as Request, mockRes as Response)).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should reject invalid date format', async () => {
      mockReq.query = { orgId: 'b0000000-0000-4000-8000-000000000002', startDate: 'not-a-date' };

      await expect(controller.getEvents(mockReq as Request, mockRes as Response)).rejects.toThrow(
        'Invalid date format'
      );
    });
  });

  describe('getEventById', () => {
    it('should return event data with ICS', async () => {
      mockGenerateActivityICS.mockResolvedValue('BEGIN:VCALENDAR...');
      mockReq.params = { eventId: 'a0000000-0000-4000-8000-000000000001' };

      await controller.getEventById(mockReq as Request, mockRes as Response);

      expect(mockGenerateActivityICS).toHaveBeenCalledWith('a0000000-0000-4000-8000-000000000001');
      expect(mockRes.success).toHaveBeenCalledWith({
        id: 'a0000000-0000-4000-8000-000000000001',
        ics: 'BEGIN:VCALENDAR...',
      });
    });

    it('should throw 404 when activity not found', async () => {
      mockGenerateActivityICS.mockRejectedValue(new Error('Activity not found'));
      mockReq.params = { eventId: 'c0000000-0000-4000-8000-000000000003' };

      await expect(
        controller.getEventById(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('Activity not found');
    });
  });

  describe('downloadEventICS', () => {
    it('should return ICS file with proper headers', async () => {
      const icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
      mockGenerateActivityICS.mockResolvedValue(icsContent);
      mockReq.params = { eventId: 'a0000000-0000-4000-8000-000000000001' };

      await controller.downloadEventICS(mockReq as Request, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/calendar; charset=utf-8'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="event-a0000000-0000-4000-8000-000000000001.ics"'
      );
      expect(mockRes.end).toHaveBeenCalledWith(Buffer.from(icsContent, 'utf-8'));
    });

    it('should reject invalid eventId format', async () => {
      mockReq.params = { eventId: 'act/../evil' };

      await expect(
        controller.downloadEventICS(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('Valid eventId is required');
    });

    it('should throw 404 when activity not found', async () => {
      mockGenerateActivityICS.mockRejectedValue(new Error('not found'));
      mockReq.params = { eventId: 'c0000000-0000-4000-8000-000000000003' };

      await expect(
        controller.downloadEventICS(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('Activity not found');
    });
  });

  describe('exportOrgCalendar', () => {
    it('should export org calendar as ICS file', async () => {
      const icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
      mockGenerateICS.mockResolvedValue(icsContent);
      mockReq.params = { orgId: 'b0000000-0000-4000-8000-000000000002' };
      mockReq.query = {};

      await controller.exportOrgCalendar(mockReq as Request, mockRes as Response);

      expect(mockGenerateICS).toHaveBeenCalledWith('b0000000-0000-4000-8000-000000000002', {});
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/calendar; charset=utf-8'
      );
      expect(mockRes.end).toHaveBeenCalledWith(Buffer.from(icsContent, 'utf-8'));
    });

    it('should pass date and type filters to service', async () => {
      mockGenerateICS.mockResolvedValue('BEGIN:VCALENDAR...');
      mockReq.params = { orgId: 'b0000000-0000-4000-8000-000000000002' };
      mockReq.query = {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        types: 'mission,bounty',
      };

      await controller.exportOrgCalendar(mockReq as Request, mockRes as Response);

      expect(mockGenerateICS).toHaveBeenCalledWith('b0000000-0000-4000-8000-000000000002', {
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        activityTypes: [ActivityType.MISSION, ActivityType.BOUNTY],
      });
    });
  });

  describe('exportUserCalendar', () => {
    it('should export user calendar as ICS file', async () => {
      const icsContent = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
      mockGenerateUserICS.mockResolvedValue(icsContent);
      mockReq.query = {};

      await controller.exportUserCalendar(mockReq as Request, mockRes as Response);

      expect(mockGenerateUserICS).toHaveBeenCalledWith('user-123', {});
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="my-calendar.ics"'
      );
      expect(mockRes.end).toHaveBeenCalledWith(Buffer.from(icsContent, 'utf-8'));
    });

    it('should reject unauthenticated requests', async () => {
      (mockReq as Record<string, unknown>).user = undefined;

      await expect(
        controller.exportUserCalendar(mockReq as Request, mockRes as Response)
      ).rejects.toThrow('Authentication required');
    });
  });
});
