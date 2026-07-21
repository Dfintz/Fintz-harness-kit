/**
 * API v2 — Calendar Routes (Wave 2.3)
 * Calendar events, ICS export, and scheduling endpoints
 *
 * Replaces the original stub routes with controller delegation
 * to ActivityCalendarService.
 */

import { Router } from 'express';

import { CalendarControllerV2 } from '../../controllers/v2/calendarController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new CalendarControllerV2();

// ==================== CALENDAR EVENTS ====================

/**
 * GET /api/v2/calendar/events
 * Get calendar events for a date range
 * Query: orgId (required), startDate, endDate, view
 */
router.get(
  '/events',
  authenticate,
  controller.getEvents.bind(controller)
);

/**
 * GET /api/v2/calendar/events/:eventId
 * Get a specific event (returns event data + ICS)
 */
router.get(
  '/events/:eventId',
  authenticate,
  controller.getEventById.bind(controller)
);

/**
 * GET /api/v2/calendar/events/:eventId/ics
 * Download ICS file for a specific activity
 */
router.get(
  '/events/:eventId/ics',
  authenticate,
  controller.downloadEventICS.bind(controller)
);

// ==================== CALENDAR EXPORT ====================

/**
 * GET /api/v2/calendar/export/org/:orgId
 * Export full organization calendar as ICS file
 * Query: startDate, endDate, types (comma-separated)
 */
router.get(
  '/export/org/:orgId',
  authenticate,
  controller.exportOrgCalendar.bind(controller)
);

/**
 * GET /api/v2/calendar/export/user
 * Export current user's personal calendar as ICS file
 * Query: startDate, endDate
 */
router.get(
  '/export/user',
  authenticate,
  controller.exportUserCalendar.bind(controller)
);

export { router };
