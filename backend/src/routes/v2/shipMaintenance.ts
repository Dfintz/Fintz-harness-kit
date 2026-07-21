/**
 * API v2 - Ship Maintenance Routes
 * Ship maintenance scheduling and tracking endpoints with standardized responses
 */

import { Router } from 'express';

import { ShipMaintenanceControllerV2 } from '../../controllers/v2/shipMaintenanceController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ShipMaintenanceControllerV2();

// Maintenance CRUD
router.post('/ship-maintenance', authenticate, controller.scheduleMaintenance.bind(controller));

router.get('/ship-maintenance', authenticate, controller.getMaintenanceSchedules.bind(controller));

router.get(
  '/ship-maintenance/upcoming',
  authenticate,
  controller.getUpcomingMaintenance.bind(controller)
);

router.get(
  '/ship-maintenance/overdue',
  authenticate,
  controller.getOverdueMaintenance.bind(controller)
);

router.get('/ship-maintenance/:id', authenticate, controller.getMaintenanceById.bind(controller));

router.put(
  '/ship-maintenance/:id/status',
  authenticate,
  controller.updateMaintenanceStatus.bind(controller)
);

export { router };
