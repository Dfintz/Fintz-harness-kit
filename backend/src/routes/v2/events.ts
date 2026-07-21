/**
 * API v2 - Events Routes
 * Event management endpoints with standardized responses
 * Events are implemented as Activities with type=EVENT for backward compatibility
 */

import { NextFunction, Request, Response, Router } from 'express';

import { ActivityControllerV2 } from '../../controllers/v2/activityController';
import { EventAttendanceControllerV2 } from '../../controllers/v2/eventAttendanceController';
import { EventConflictControllerV2 } from '../../controllers/v2/eventConflictController';
import { RecurringActivityControllerV2 } from '../../controllers/v2/recurringActivityController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { activitySchemas } from '../../schemas/activitySchemas';

const router = Router();
const activityController = new ActivityControllerV2();
const recurringController = new RecurringActivityControllerV2();
const attendanceController = new EventAttendanceControllerV2();
const conflictController = new EventConflictControllerV2();

// ==================== CRUD OPERATIONS ====================

/**
 * POST /api/v2/events
 * Create a new event
 */
router.post(
  '/',
  authenticate,
  (req: Request, _res: Response, next: NextFunction) => {
    // Bridge field names: events route → activity controller
    req.body.type = 'event';
    // Map "date" from the event form to "startDate" expected by the controller
    if (req.body.date && !req.body.startDate) {
      req.body.startDate = req.body.date;
    }
    // Map duration to estimatedDuration for the Activity entity
    if (req.body.duration !== undefined && req.body.duration !== null) {
      req.body.estimatedDuration = req.body.duration;
    }
    // Map recurrence fields into metadata for the Activity entity
    if (req.body.recurrence) {
      req.body.metadata = {
        ...req.body.metadata,
        recurrencePattern: req.body.recurrence,
        recurrenceEndDate: req.body.recurrenceEndDate ?? undefined,
      };
    }
    next();
  },
  validateSchema(activitySchemas.createV2),
  activityController.createActivity.bind(activityController)
);

/**
 * GET /api/v2/events
 * List all events for the current user
 */
router.get('/', authenticate, activityController.getMyActivities.bind(activityController));

/**
 * GET /api/v2/events/:id
 * Get a specific event by ID
 */
router.get('/:id', authenticate, activityController.getActivityById.bind(activityController));

/**
 * PUT /api/v2/events/:id
 * Update an event
 */
router.put(
  '/:id',
  authenticate,
  (req: Request, _res: Response, next: NextFunction) => {
    // Bridge field names: events route → activity controller
    // Map "date" from the event form to "startDate" expected by the controller
    if (req.body.date && !req.body.startDate) {
      req.body.startDate = req.body.date;
    }
    // Map duration to estimatedDuration for the Activity entity
    if (req.body.duration !== undefined && req.body.duration !== null) {
      req.body.estimatedDuration = req.body.duration;
    }
    // Map recurrence fields into metadata for the Activity entity
    if (req.body.recurrence !== undefined) {
      req.body.metadata = {
        ...req.body.metadata,
        recurrencePattern: req.body.recurrence,
        recurrenceEndDate: req.body.recurrenceEndDate ?? undefined,
      };
    }
    next();
  },
  validateSchema(activitySchemas.updateV2),
  activityController.updateActivity.bind(activityController)
);

/**
 * DELETE /api/v2/events/:id
 * Delete an event
 */
router.delete('/:id', authenticate, activityController.deleteActivity.bind(activityController));

// ==================== ATTENDANCE MANAGEMENT ====================

/**
 * POST /api/v2/events/:id/attendees
 * Join an event as an attendee (legacy endpoint)
 */
router.post(
  '/:id/attendees',
  authenticate,
  activityController.joinActivity.bind(activityController)
);

/**
 * DELETE /api/v2/events/:id/attendees
 * Leave an event as an attendee (legacy endpoint)
 */
router.delete(
  '/:id/attendees',
  authenticate,
  activityController.leaveActivity.bind(activityController)
);

/**
 * POST /api/v2/events/:id/attend
 * Record detailed attendance for an event
 */
router.post(
  '/:id/attend',
  authenticate,
  attendanceController.recordAttendance.bind(attendanceController)
);

/**
 * GET /api/v2/events/:id/attendance
 * Get all attendance records for an event
 */
router.get(
  '/:id/attendance',
  authenticate,
  attendanceController.getAttendanceRecords.bind(attendanceController)
);

/**
 * PUT /api/v2/events/:id/attendance/:userId
 * Update attendance status for a specific user
 */
router.put(
  '/:id/attendance/:userId',
  authenticate,
  attendanceController.updateAttendanceStatus.bind(attendanceController)
);

/**
 * GET /api/v2/events/:id/attendance/stats
 * Get attendance statistics for an event
 */
router.get(
  '/:id/attendance/stats',
  authenticate,
  attendanceController.getAttendanceStats.bind(attendanceController)
);

/**
 * GET /api/v2/users/:userId/attendance
 * Get attendance history for a user
 */
router.get(
  '/users/:userId/attendance',
  authenticate,
  attendanceController.getUserAttendanceHistory.bind(attendanceController)
);

// ==================== RECURRING EVENTS ====================

/**
 * POST /api/v2/events/recurring
 * Create a recurring event series
 */
router.post(
  '/recurring',
  authenticate,
  (req: Request, _res: Response, next: NextFunction) => {
    // Set activity type to EVENT for recurring event-specific handling
    req.body.activityType = 'EVENT';
    next();
  },
  recurringController.createRecurringInstances.bind(recurringController)
);

/**
 * GET /api/v2/events/recurring/:seriesId
 * Preview recurring instances
 */
router.get(
  '/recurring/:seriesId',
  authenticate,
  recurringController.previewRecurringActivity.bind(recurringController)
);

// ==================== EVENT CONFLICTS ====================

/**
 * GET /api/v2/events/conflicts/check
 * Check for scheduling conflicts
 */
router.get(
  '/conflicts/check',
  authenticate,
  conflictController.checkConflicts.bind(conflictController)
);

/**
 * GET /api/v2/events/conflicts/me
 * Get my scheduling conflicts
 */
router.get(
  '/conflicts/me',
  authenticate,
  conflictController.getMyConflicts.bind(conflictController)
);

/**
 * GET /api/v2/events/conflicts/activity/:activityId
 * Get conflicts for a specific event
 */
router.get(
  '/conflicts/activity/:activityId',
  authenticate,
  conflictController.getActivityConflicts.bind(conflictController)
);

/**
 * GET /api/v2/events/conflicts/user/:userId
 * Get conflicts for a specific user
 */
router.get(
  '/conflicts/user/:userId',
  authenticate,
  conflictController.getUserConflicts.bind(conflictController)
);

/**
 * GET /api/v2/events/conflicts/range
 * Get conflicts in a date range
 */
router.get(
  '/conflicts/range',
  authenticate,
  conflictController.getConflictsInRange.bind(conflictController)
);

// ==================== EVENT DISCOVERY ====================

/**
 * GET /api/v2/events/upcoming
 * Get upcoming events for the current user
 */
router.get(
  '/upcoming',
  authenticate,
  activityController.getUpcomingActivities.bind(activityController)
);

/**
 * GET /api/v2/events/recommended
 * Get recommended events for the current user
 */
router.get(
  '/recommended',
  authenticate,
  activityController.getRecommendedActivities.bind(activityController)
);

export { router };
