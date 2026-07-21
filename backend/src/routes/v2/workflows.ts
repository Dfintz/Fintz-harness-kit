import { Router } from 'express';

import { WorkflowController } from '../../controllers/v2/workflowController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { workflowSchemas } from '../../schemas/workflowSchemas';

const router = Router();

let workflowController: WorkflowController;
const getController = () => {
  if (!workflowController) {
    workflowController = new WorkflowController();
  }
  return workflowController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== WORKFLOWS & AUTOMATION ====================

/**
 * GET /api/v2/workflows
 * Get all workflows
 * Query: status, type
 */
router.get('/', ...orgAuth, validateSchema(workflowSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);

/**
 * POST /api/v2/workflows
 * Create workflow
 * Request body: workflow configuration
 */
router.post('/', ...orgAuth, validateSchema(workflowSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * GET /api/v2/workflows/:workflowId
 * Get specific workflow
 */
router.get(
  '/:workflowId',
  ...orgAuth,
  validateSchema(workflowSchemas.param, 'params'),
  (req, res) => getController().getById(req, res)
);

/**
 * PUT /api/v2/workflows/:workflowId
 * Update workflow
 */
router.put(
  '/:workflowId',
  ...orgAuth,
  validateSchema(workflowSchemas.param, 'params'),
  validateSchema(workflowSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);

/**
 * DELETE /api/v2/workflows/:workflowId
 * Delete workflow
 */
router.delete(
  '/:workflowId',
  ...orgAuth,
  validateSchema(workflowSchemas.param, 'params'),
  (req, res) => getController().delete(req, res)
);

/**
 * POST /api/v2/workflows/:workflowId/execute
 * Execute workflow
 * Request body: execution parameters
 */
router.post(
  '/:workflowId/execute',
  ...orgAuth,
  validateSchema(workflowSchemas.param, 'params'),
  validateSchema(workflowSchemas.execute, 'body'),
  (req, res) => getController().execute_(req, res)
);

/**
 * GET /api/v2/workflows/:workflowId/executions
 * Get workflow execution history
 * Query: limit, offset
 */
router.get(
  '/:workflowId/executions',
  ...orgAuth,
  validateSchema(workflowSchemas.param, 'params'),
  validateSchema(workflowSchemas.executionsQuery, 'query'),
  (req, res) => getController().getExecutions(req, res)
);

/**
 * POST /api/v2/workflows/:workflowId/enable
 * Enable workflow
 */
router.post(
  '/:workflowId/enable',
  ...orgAuth,
  validateSchema(workflowSchemas.param, 'params'),
  (req, res) => getController().enable(req, res)
);

/**
 * POST /api/v2/workflows/:workflowId/disable
 * Disable workflow
 */
router.post(
  '/:workflowId/disable',
  ...orgAuth,
  validateSchema(workflowSchemas.param, 'params'),
  (req, res) => getController().disable(req, res)
);

export { router };
