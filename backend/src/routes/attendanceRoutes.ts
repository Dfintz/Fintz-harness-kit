import { Router } from 'express';

import { AppDataSource } from '../config/database';
import { AttendanceController } from '../controllers/attendanceController';
import { authenticate } from '../middleware/auth';
import { validateCrossTenantAccess } from '../middleware/crossTenantAccess';
import { validateSchema } from '../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { EventAttendanceConfirmation } from '../models/EventAttendanceConfirmation';
import { attendanceSchemas, paramSchemas } from '../schemas';

const router = Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let attendanceController: AttendanceController;
const getController = () => {
  if (!attendanceController) {
    attendanceController = new AttendanceController();
  }
  return attendanceController;
};

// Shared middleware stack for all attendance routes
const authStack = [authenticate, tenantContextMiddleware, requireTenantContext] as const;

/**
 * Attendance confirmation routes
 * All routes work with Activity system (type: EVENT)
 * Multi-tenancy: All confirmations scoped to organization
 */

// Initialize attendance tracking for an activity
router.post(
  '/activities/:activityId/attendance/initialize',
  ...authStack,
  validateSchema(attendanceSchemas.initialize, 'body'),
  (req, res) => getController().initializeAttendance(req, res)
);

// Confirm user attended
router.post(
  '/activities/:activityId/attendance/confirm',
  ...authStack,
  validateSchema(attendanceSchemas.confirm, 'body'),
  (req, res) => getController().confirmAttendance(req, res)
);

// Record detailed attendance
router.post(
  '/activities/:activityId/attendance/record',
  ...authStack,
  validateSchema(attendanceSchemas.record, 'body'),
  (req, res) => getController().recordAttendance(req, res)
);

// Mark user as no-show
router.post(
  '/activities/:activityId/attendance/no-show',
  ...authStack,
  validateSchema(attendanceSchemas.noShow, 'body'),
  (req, res) => getController().markNoShow(req, res)
);

// Send confirmation requests
router.post('/activities/:activityId/attendance/send-requests', ...authStack, (req, res) =>
  getController().sendConfirmationRequests(req, res)
);

// Get attendance stats for activity
router.get('/activities/:activityId/attendance/stats', ...authStack, (req, res) =>
  getController().getAttendanceStats(req, res)
);

// Get attendance report for activity
router.get('/activities/:activityId/attendance/report', ...authStack, (req, res) =>
  getController().getAttendanceReport(req, res)
);

// Get user's attendance history
router.get(
  '/users/:userId/attendance/history',
  ...authStack,
  validateSchema(paramSchemas.userId, 'params'),
  validateSchema(attendanceSchemas.historyQuery, 'query'),
  (req, res) => getController().getUserHistory(req, res)
);

// Get organization attendance leaderboard
router.get('/organizations/:organizationId/attendance/leaderboard', ...authStack, (req, res) =>
  getController().getLeaderboard(req, res)
);

// Add performance rating to confirmation (requires ownership)
router.post(
  '/attendance/:confirmationId/rating',
  ...authStack,
  validateSchema(attendanceSchemas.rating, 'body'),
  validateCrossTenantAccess({
    resourceType: 'attendance_confirmation',
    action: 'write',
    getResourceOrgId: async req => {
      const confirmationRepo = AppDataSource.getRepository(EventAttendanceConfirmation);
      const confirmation = await confirmationRepo.findOne({
        where: { id: req.params.confirmationId },
      });
      return confirmation?.organizationId || null;
    },
    requireSharing: false,
    allowSameOrg: true,
  }),
  (req, res) => getController().addRating(req, res)
);

export function setAttendanceRoutes(app: Router): void {
  app.use('/api', router);
}
