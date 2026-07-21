import { Application, Router } from 'express';

import { TreatyTemplateController } from '../controllers/TreatyTemplateController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { treatyTemplateSchemas } from '../schemas/treatyTemplateSchemas';

const router = Router();

const authMiddleware = [authenticateToken, tenantContextMiddleware, requireTenantContext];

// Lazy initialization to avoid EntityMetadataNotFoundError
let controller: TreatyTemplateController;
const getController = () => {
  if (!controller) {
    controller = new TreatyTemplateController();
  }
  return controller;
};

export function setTreatyTemplateRoutes(app: Application) {
  // List available templates (built-in + org-owned)
  router.get(
    '/treaty-templates',
    ...authMiddleware,
    validateSchema(treatyTemplateSchemas.listQuery, 'query'),
    (req, res) => getController().list(req, res)
  );

  // Create a new custom template
  router.post(
    '/treaty-templates',
    ...authMiddleware,
    validateSchema(treatyTemplateSchemas.create, 'body'),
    (req, res) => getController().create(req, res)
  );

  // Instantiate a treaty from a template (generates terms)
  // Must be registered before /:id routes to prevent route conflict
  router.post(
    '/treaty-templates/instantiate',
    ...authMiddleware,
    validateSchema(treatyTemplateSchemas.instantiate, 'body'),
    (req, res) => getController().instantiate(req, res)
  );

  // Get a single template by ID
  router.get(
    '/treaty-templates/:id',
    ...authMiddleware,
    validateSchema(treatyTemplateSchemas.param, 'params'),
    (req, res) => getController().getById(req, res)
  );

  // Update a custom template
  router.put(
    '/treaty-templates/:id',
    ...authMiddleware,
    validateSchema(treatyTemplateSchemas.param, 'params'),
    validateSchema(treatyTemplateSchemas.update, 'body'),
    (req, res) => getController().update(req, res)
  );

  // Delete a custom template
  router.delete(
    '/treaty-templates/:id',
    ...authMiddleware,
    validateSchema(treatyTemplateSchemas.param, 'params'),
    (req, res) => getController().delete(req, res)
  );

  app.use('/api/v2', router);
}
