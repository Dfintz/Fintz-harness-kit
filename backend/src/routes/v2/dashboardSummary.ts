/**
 * Dashboard Summary Routes — Phase 6.2
 *
 * GET /api/v2/dashboard/summary — aggregated dashboard data in one call.
 */
import { Router } from 'express';

import { DashboardSummaryController } from '../../controllers/v2/dashboardSummaryController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new DashboardSummaryController();

// GET /api/v2/dashboard/summary
router.get('/summary', authenticate, controller.getSummary.bind(controller));

export { router };

