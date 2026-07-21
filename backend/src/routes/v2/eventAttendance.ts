/**
 * API v2 - Event Attendance Routes
 * Event attendance tracking and confirmation endpoints with standardized responses
 */

import { Router } from 'express';

import { EventAttendanceControllerV2 } from '../../controllers/v2/eventAttendanceController';
import { authenticate } from '../../middleware/auth';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';

const router = Router();
const controller = new EventAttendanceControllerV2();

// All event attendance routes require authentication and organization context
const orgScoped = [authenticate, tenantContextMiddleware, requireTenantContext] as const;

// Attendance management
router.post('/activities/:id/attend', [...orgScoped], controller.recordAttendance.bind(controller));

router.get(
  '/activities/:id/attendance',
  [...orgScoped],
  controller.getAttendanceRecords.bind(controller)
);

router.put(
  '/activities/:id/attendance/:userId',
  [...orgScoped],
  controller.updateAttendanceStatus.bind(controller)
);

router.get(
  '/activities/:id/attendance/stats',
  [...orgScoped],
  controller.getAttendanceStats.bind(controller)
);

router.get(
  '/activities/:id/attendance/correlation',
  [...orgScoped],
  controller.getAttendanceCorrelationSummary.bind(controller)
);

router.get(
  '/users/:userId/attendance',
  [...orgScoped],
  controller.getUserAttendanceHistory.bind(controller)
);

export { router };
