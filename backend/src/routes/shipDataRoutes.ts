import { Application, Router } from 'express';

import { ShipController } from '../controllers/shipDataController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { shipDataSchemas } from '../schemas';

const router = Router();

// Auth applied PER-ROUTE (not via router.use). This router is mounted at the bare
// `/api` prefix, so a router-level `router.use(authenticateToken)` would also run on
// unmatched `/api/*` requests handled by other routers (leaking 401s). Spreading the
// stack onto each route keeps enforcement scoped to this router's own paths.
const authStack = [authenticateToken] as const;

// Lazy initialization to avoid EntityMetadataNotFoundError
let shipController: ShipController;
const getController = () => {
  if (!shipController) {
    shipController = new ShipController();
  }
  return shipController;
};

export const setShipDataRoutes = (app: Application) => {
  // Get ship statistics (reference data - authenticated but no org context)
  router.get('/ships/stats', ...authStack, (req, res) => getController().getStats(req, res));

  // Get manufacturers and roles (reference data)
  router.get('/ships/manufacturers', ...authStack, (req, res) =>
    getController().getManufacturers(req, res)
  );
  router.get('/ships/roles', ...authStack, (req, res) => getController().getRoles(req, res));

  // Get vehicles and spacecraft (reference data)
  router.get('/ships/vehicles', ...authStack, validateSchema(shipDataSchemas.vehicleQuery, 'query'), (req, res) =>
    getController().getVehicles(req, res)
  );
  router.get(
    '/ships/spacecraft',
    ...authStack,
    validateSchema(shipDataSchemas.spacecraftQuery, 'query'),
    (req, res) => getController().getSpacecraft(req, res)
  );

  // CRUD operations (require authentication and org context in controller)
  router.get('/ships/:id', ...authStack, validateSchema(shipDataSchemas.idParam, 'params'), (req, res) =>
    getController().getShipById(req, res)
  );
  router.get('/ships', ...authStack, validateSchema(shipDataSchemas.listQuery, 'query'), (req, res) =>
    getController().getAllShips(req, res)
  );
  router.post('/ships', ...authStack, validateSchema(shipDataSchemas.createShip), (req, res) =>
    getController().createShip(req, res)
  );
  router.put(
    '/ships/:id',
    ...authStack,
    validateSchema(shipDataSchemas.idParam, 'params'),
    validateSchema(shipDataSchemas.updateShip),
    (req, res) => getController().updateShip(req, res)
  );
  router.delete('/ships/:id', ...authStack, validateSchema(shipDataSchemas.idParam, 'params'), (req, res) =>
    getController().deleteShip(req, res)
  );

  app.use('/api', router);
};
