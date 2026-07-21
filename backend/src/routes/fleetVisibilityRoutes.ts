import { Application, Router } from 'express';

import { FleetVisibilityController } from '../controllers/FleetVisibilityController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { fleetVisibilitySchemas } from '../schemas/fleetVisibilitySchemas';

const router = Router();

const authMiddleware = [authenticateToken, tenantContextMiddleware, requireTenantContext];

// Lazy initialization to avoid EntityMetadataNotFoundError
let controller: FleetVisibilityController;
const getController = () => {
  if (!controller) {
    controller = new FleetVisibilityController();
  }
  return controller;
};

export function setFleetVisibilityRoutes(app: Application) {
  // List visibility rules for a fleet
  router.get('/fleets/:id/visibility-rules', ...authMiddleware, (req, res) =>
    getController().getRules(req, res)
  );

  // Create a new visibility rule
  router.post(
    '/fleets/:id/visibility-rules',
    ...authMiddleware,
    validateSchema(fleetVisibilitySchemas.createRule, 'body'),
    (req, res) => getController().createRule(req, res)
  );

  // Update a visibility rule
  router.put(
    '/fleets/:id/visibility-rules/:ruleId',
    ...authMiddleware,
    validateSchema(fleetVisibilitySchemas.updateRule, 'body'),
    (req, res) => getController().updateRule(req, res)
  );

  // Delete a visibility rule
  router.delete('/fleets/:id/visibility-rules/:ruleId', ...authMiddleware, (req, res) =>
    getController().deleteRule(req, res)
  );

  // Check access level for a fleet
  router.post(
    '/fleets/:id/check-access',
    ...authMiddleware,
    validateSchema(fleetVisibilitySchemas.checkAccess, 'body'),
    (req, res) => getController().checkAccess(req, res)
  );

  app.use('/api/v2', router);
}
