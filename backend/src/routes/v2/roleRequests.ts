import { Router } from 'express';

import { RoleRequestController } from '../../controllers/v2/roleRequestController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { roleRequestSchemas } from '../../schemas/roleRequestSchemas';

const router = Router();

// ==================== ROLE REQUESTS ====================
// Organization role-change request loop (request → approve/reject → auto-grant).
// Authorization for approve/reject is enforced in RoleRequestService against the
// actor's *current* org role (owner/founder/admin), not a stored assignee.

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

let controller: RoleRequestController;
function getController(): RoleRequestController {
  if (!controller) {
    controller = new RoleRequestController();
  }
  return controller;
}

// Static routes BEFORE parameterized routes
router.get('/pending', ...orgAuth, (req, res) => getController().listPending(req, res));

router.post('/', ...orgAuth, validateSchema(roleRequestSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

router.post(
  '/:approvalId/approve',
  ...orgAuth,
  validateSchema(roleRequestSchemas.param, 'params'),
  validateSchema(roleRequestSchemas.approve, 'body'),
  (req, res) => getController().approve(req, res)
);

router.post(
  '/:approvalId/reject',
  ...orgAuth,
  validateSchema(roleRequestSchemas.param, 'params'),
  validateSchema(roleRequestSchemas.reject, 'body'),
  (req, res) => getController().reject(req, res)
);

export { router };
