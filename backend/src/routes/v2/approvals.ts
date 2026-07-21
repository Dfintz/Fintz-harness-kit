import { Router } from 'express';

import { ApprovalController } from '../../controllers/v2/approvalController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { approvalSchemas } from '../../schemas/approvalSchemas';

const router = Router();

// ==================== APPROVALS ====================

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

let controller: ApprovalController;
function getController(): ApprovalController {
  if (!controller) {
    controller = new ApprovalController();
  }
  return controller;
}

// Static routes BEFORE parameterized routes
router.get('/pending', ...orgAuth, (req, res) => getController().getPending(req, res));

// Collection routes
router.get('/', ...orgAuth, validateSchema(approvalSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);
router.post('/', ...orgAuth, validateSchema(approvalSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

// Parameterized routes
router.get(
  '/:approvalId',
  ...orgAuth,
  validateSchema(approvalSchemas.param, 'params'),
  (req, res) => getController().getById(req, res)
);
router.post(
  '/:approvalId/approve',
  ...orgAuth,
  validateSchema(approvalSchemas.param, 'params'),
  validateSchema(approvalSchemas.approve, 'body'),
  (req, res) => getController().approve(req, res)
);
router.post(
  '/:approvalId/reject',
  ...orgAuth,
  validateSchema(approvalSchemas.param, 'params'),
  validateSchema(approvalSchemas.reject, 'body'),
  (req, res) => getController().reject(req, res)
);
router.post(
  '/:approvalId/delegate',
  ...orgAuth,
  validateSchema(approvalSchemas.param, 'params'),
  validateSchema(approvalSchemas.delegate, 'body'),
  (req, res) => getController().delegate(req, res)
);
router.get(
  '/:approvalId/history',
  ...orgAuth,
  validateSchema(approvalSchemas.param, 'params'),
  (req, res) => getController().getHistory(req, res)
);

export { router };
