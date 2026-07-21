import { Application, Router } from 'express';

import { FleetViewController } from '../controllers/fleetViewController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { fleetViewSchemas } from '../schemas/fleetViewSchemas';

const router = Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let controller: FleetViewController;
const getController = () => {
  if (!controller) {
    controller = new FleetViewController();
  }
  return controller;
};

/**
 * Fleet Import/Export Routes (FleetView format)
 * Allows users and org leads to import/export ship lists in FleetView format
 * Compatible with hangar.link/fleet/canvas
 *
 * NOTE: Routes consolidated from deprecated /fleetview/ domain to /fleet/ domain
 */
export const setFleetViewRoutes = (app: Application) => {
  // Export routes
  router.get(
    '/fleet/export/user',
    authenticateToken,
    validateSchema(fleetViewSchemas.exportQuery, 'query'),
    (req, res) => getController().exportUserFleet(req, res)
  );

  router.get(
    '/fleet/export/org/:organizationId',
    authenticateToken,
    validateSchema(fleetViewSchemas.exportOrgQuery, 'query'),
    (req, res) => getController().exportOrgFleet(req, res)
  );

  // Import routes (support both JSON body and file upload)
  router.post(
    '/fleet/import/user',
    authenticateToken,
    getController().uploadMiddleware,
    validateSchema(fleetViewSchemas.importFile, 'body'),
    (req, res) => getController().importUserFleet(req, res)
  );

  router.post(
    '/fleet/import/org/:organizationId',
    authenticateToken,
    getController().uploadMiddleware,
    validateSchema(fleetViewSchemas.importFile, 'body'),
    (req, res) => getController().importOrgFleet(req, res)
  );

  // Validation route (useful for testing before import)
  router.post('/fleet/validate', authenticateToken, getController().uploadMiddleware, (req, res) =>
    getController().validateSchema(req, res)
  );

  app.use('/api', router);
  app.use('/api/v2', router);
};
