/**
 * API v2 — Availability Routes (Wave 2.4)
 * Group scheduling & availability endpoints
 */

import { Router } from 'express';

import { AvailabilityControllerV2 } from '../../controllers/v2/availabilityController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new AvailabilityControllerV2();

// Set my availability (bulk replace)
router.put(
  '/organizations/:orgId/availability',
  authenticate,
  controller.setMyAvailability.bind(controller)
);

// Get my own availability
router.get(
  '/organizations/:orgId/availability/me',
  authenticate,
  controller.getMyAvailability.bind(controller)
);

// Get group heatmap
router.get(
  '/organizations/:orgId/availability/heatmap',
  authenticate,
  controller.getGroupHeatmap.bind(controller)
);

// Find best times
router.get(
  '/organizations/:orgId/availability/best-times',
  authenticate,
  controller.getBestTimes.bind(controller)
);

export { router };
