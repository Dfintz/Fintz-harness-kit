/**
 * Calendar Controller V2 — Wave 2.3 Activity Calendar View
 *
 * Wires calendar routes to ActivityCalendarService for ICS export,
 * calendar data retrieval, and Google Calendar integration.
 */

import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { ActivityType } from '../../models/Activity';
import { ActivityCalendarService } from '../../services/activity/ActivityCalendarService';
import { ApiErrorCode } from '../../types/api';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toActivityType(rawType: string): ActivityType | null {
  switch (rawType) {
    case 'mission':
      return ActivityType.MISSION;
    case 'contract':
      return ActivityType.CONTRACT;
    case 'bounty':
      return ActivityType.BOUNTY;
    case 'event':
      return ActivityType.EVENT;
    case 'lfg':
      return ActivityType.LFG;
    case 'operation':
      return ActivityType.OPERATION;
    case 'recruitment':
      return ActivityType.RECRUITMENT;
    case 'job_listing':
      return ActivityType.JOB_LISTING;
    default:
      return null;
  }
}

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

export class CalendarControllerV2 {
  private readonly service = ActivityCalendarService.getInstance();

  /**
   * GET /api/v2/calendar/events
   * Get calendar events for a date range
   * Query: startDate, endDate, orgId, type
   */
  async getEvents(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const orgId = req.query.orgId as string | undefined;
    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;

    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    const endDate = endDateStr
      ? new Date(endDateStr)
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Default: 30 days

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid date format. Use ISO 8601.', 400);
    }

    if (!orgId) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'orgId query parameter is required', 400);
    }

    const calendar = await this.service.getCalendar(
      orgId,
      startDate,
      endDate,
      req.query.view as string
    );

    res.success(calendar);
  }

  /**
   * GET /api/v2/calendar/events/:eventId
   * Get ICS export for a specific event (activity)
   */
  async getEventById(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { eventId } = req.params;
    if (!eventId || !UUID_RE.test(eventId)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Valid eventId is required', 400);
    }

    try {
      const ics = await this.service.generateActivityICS(eventId);
      res.success({ id: eventId, ics });
    } catch {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
  }

  /**
   * GET /api/v2/calendar/events/:eventId/ics
   * Download ICS file for a specific activity
   */
  async downloadEventICS(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { eventId } = req.params;
    if (!eventId || !UUID_RE.test(eventId)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Valid eventId is required', 400);
    }

    try {
      const ics = await this.service.generateActivityICS(eventId);
      const safeId = eventId.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
      // CWE-79: XSS-safe — Content-Type is text/calendar (not text/html), ICS body
      // is generated server-side by CalendarService, and nosniff prevents MIME sniffing.
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `attachment; filename="event-${safeId}.ics"`);
      res.end(Buffer.from(ics, 'utf-8'));
    } catch {
      throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
  }

  /**
   * GET /api/v2/calendar/export/org/:orgId
   * Export full organization calendar as ICS
   * Query: startDate, endDate, types
   */
  async exportOrgCalendar(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const { orgId } = req.params;
    if (!orgId || !UUID_RE.test(orgId)) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Valid orgId is required', 400);
    }

    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;
    const typesStr = req.query.types as string | undefined;

    const options: {
      startDate?: Date;
      endDate?: Date;
      activityTypes?: string[];
    } = {};

    if (startDateStr) {
      options.startDate = new Date(startDateStr);
      if (Number.isNaN(options.startDate.getTime())) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid startDate format', 400);
      }
    }

    if (endDateStr) {
      options.endDate = new Date(endDateStr);
      if (Number.isNaN(options.endDate.getTime())) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid endDate format', 400);
      }
    }

    if (typesStr) {
      const canonicalActivityTypes: ActivityType[] = [];

      for (const rawType of typesStr.split(',')) {
        const type = toActivityType(rawType.trim().toLowerCase());
        if (type) {
          canonicalActivityTypes.push(type);
        }
      }

      if (canonicalActivityTypes.length > 0) {
        options.activityTypes = canonicalActivityTypes;
      }
    }

    const ics = await this.service.generateICS(orgId, options);
    const safeOrgId = orgId.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
    // CWE-79: XSS-safe — Content-Type is text/calendar (not text/html), ICS body
    // is generated server-side by CalendarService, and nosniff prevents MIME sniffing.
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="org-${safeOrgId}-calendar.ics"`);
    // deepcode ignore XSS: response Content-Type is text/calendar with X-Content-Type-Options:
    // nosniff. ICS body is server-generated, never rendered as HTML by browsers.
    res.end(Buffer.from(ics, 'utf-8'));
  }

  /**
   * GET /api/v2/calendar/export/user
   * Export current user's personal calendar as ICS
   * Query: startDate, endDate
   */
  async exportUserCalendar(req: Request, res: Response): Promise<void> {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;

    const options: { startDate?: Date; endDate?: Date } = {};

    if (startDateStr) {
      options.startDate = new Date(startDateStr);
      if (Number.isNaN(options.startDate.getTime())) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid startDate format', 400);
      }
    }

    if (endDateStr) {
      options.endDate = new Date(endDateStr);
      if (Number.isNaN(options.endDate.getTime())) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Invalid endDate format', 400);
      }
    }

    const ics = await this.service.generateUserICS(userId, options);
    // CWE-79: XSS-safe — Content-Type is text/calendar (not text/html), ICS body
    // is generated server-side by CalendarService, and nosniff prevents MIME sniffing.
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment; filename="my-calendar.ics"');
    res.end(Buffer.from(ics, 'utf-8'));
  }
}
