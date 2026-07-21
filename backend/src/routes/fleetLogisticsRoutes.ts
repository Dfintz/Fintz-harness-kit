import { Application, Router } from 'express';

import { FleetLogisticsController } from '../controllers/fleetLogisticsController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { logisticsStatusSchema } from '../schemas/statusSchemas';

const router = Router();

// Auth applied PER-ROUTE (not via router.use). This router is mounted at the bare
// `/api` prefix, so a router-level `router.use(authenticateToken)` would also run on
// unmatched `/api/*` requests handled by other routers (leaking 401s). Spreading the
// stack onto each route keeps enforcement scoped to this router's own paths.
const authStack = [authenticateToken] as const;

// Lazy initialization to avoid EntityMetadataNotFoundError
let fleetLogisticsController: FleetLogisticsController;
const getController = () => {
  if (!fleetLogisticsController) {
    fleetLogisticsController = new FleetLogisticsController();
  }
  return fleetLogisticsController;
};

export function setFleetLogisticsRoutes(app: Application) {
  router.post('/fleet-logistics', ...authStack, (req, res) => getController().createLogistics(req, res));
  router.get('/fleet-logistics', ...authStack, (req, res) => getController().getLogistics(req, res));
  router.get('/fleet-logistics/:id', ...authStack, (req, res) => getController().getLogisticsById(req, res));
  router.put('/fleet-logistics/:id', ...authStack, (req, res) => getController().updateLogistics(req, res));
  router.put(
    '/fleet-logistics/:id/status',
    ...authStack,
    validateSchema(logisticsStatusSchema, 'body'),
    (req, res) => getController().updateStatus(req, res)
  );
  router.get('/fleet-logistics/:id/fuel-requirements', ...authStack, (req, res) =>
    getController().calculateFuelRequirements(req, res)
  );
  router.get('/fleet-logistics/:id/cargo-capacity', ...authStack, (req, res) =>
    getController().calculateCargoCapacity(req, res)
  );
  router.get('/fleet-logistics/:id/jump-range', ...authStack, (req, res) =>
    getController().calculateJumpRange(req, res)
  );
  router.delete('/fleet-logistics/:id', ...authStack, (req, res) => getController().deleteLogistics(req, res));

  app.use('/api', router);
}
