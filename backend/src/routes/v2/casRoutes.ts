/**
 * CAS Routes — Composite Activity Score endpoints.
 */

import { Router } from 'express';

import { CASController } from '../../controllers/v2/CASController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { casSchemas } from '../../schemas/casSchemas';

const router = Router();
const controller = new CASController();

// Org-scoped CAS endpoints
router.get('/organizations/:orgId/cas/score', authenticate, controller.getScore.bind(controller));

router.get(
  '/organizations/:orgId/cas/history',
  authenticate,
  validateSchema(casSchemas.getHistory, 'query'),
  controller.getHistory.bind(controller)
);

router.get(
  '/organizations/:orgId/cas/breakdown',
  authenticate,
  controller.getBreakdown.bind(controller)
);

router.get(
  '/organizations/:orgId/cas/heatmap',
  authenticate,
  validateSchema(casSchemas.getHeatmap, 'query'),
  controller.getHeatmap.bind(controller)
);

// Platform-wide ranking
router.get(
  '/cas/ranking',
  authenticate,
  validateSchema(casSchemas.getRanking, 'query'),
  controller.getRanking.bind(controller)
);

export { router as casRoutes };
