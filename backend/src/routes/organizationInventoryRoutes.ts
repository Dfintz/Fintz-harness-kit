import { Application, Request, Router } from 'express';

import { OrganizationInventoryController } from '../controllers/organizationInventoryController';
import { authenticateToken } from '../middleware/auth';
import { generalRateLimiter } from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import {
  requireOrganizationRole,
  requireTenantContext,
  tenantContextMiddleware,
} from '../middleware/tenantContext';
import { paramSchemas } from '../schemas';
import { organizationInventorySchemas } from '../schemas/organizationInventorySchemas';

const router = Router();

let organizationInventoryController: OrganizationInventoryController;
const getController = () => {
  if (!organizationInventoryController) {
    organizationInventoryController = new OrganizationInventoryController();
  }
  return organizationInventoryController;
};

// Role constants for access control
// Note: 'founder' is the primary org-creator role; 'owner' is a legacy alias
// (see backend/src/utils/roleUtils.ts DEFAULT_ROLE_PERMISSIONS).
const INVENTORY_CREATE_ROLES = ['founder', 'owner', 'admin', 'member']; // Members can add items
const INVENTORY_MODIFY_ROLES = ['founder', 'owner', 'admin']; // Only admins+ can modify/delete

/**
 * Organization Inventory Routes
 * All routes are authenticated and scoped to organization
 */

// Shared middleware stack applied PER-ROUTE (not via router.use). This router is mounted
// at the shared `/api/organizations` prefix, so a router-level `router.use(...)` would run
// auth + tenant enforcement on every `/api/organizations/*` request flowing through this
// router before reaching its real handler — including unmatched paths destined for other
// org routers. Spreading the stack onto each route keeps enforcement scoped to this
// router's own paths.
// Order: authenticateToken (sets req.user) → tenantContextMiddleware (org context from
// activeOrgId) → requireTenantContext (ensures org context present).
const authStack = [authenticateToken, tenantContextMiddleware, requireTenantContext] as const;

// Get inventory statistics
router.get(
  '/:orgId/inventory/statistics',
  ...authStack,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getController().getInventoryStatistics(req, res)
);

// Get all inventory items
router.get(
  '/:orgId/inventory',
  ...authStack,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationInventorySchemas.query, 'query'),
  generalRateLimiter,
  (req, res) => getController().getInventory(req, res)
);

// Create inventory item
router.post(
  '/:orgId/inventory',
  ...authStack,
  requireOrganizationRole(INVENTORY_CREATE_ROLES),
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationInventorySchemas.create, 'body'),
  generalRateLimiter,
  (req, res) => getController().createInventoryItem(req, res)
);

// Get specific inventory item
router.get(
  '/:orgId/inventory/:id',
  ...authStack,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getController().getInventoryItem(req, res)
);

// Update inventory item
router.patch(
  '/:orgId/inventory/:id',
  ...authStack,
  requireOrganizationRole(INVENTORY_MODIFY_ROLES),
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(organizationInventorySchemas.update, 'body'),
  generalRateLimiter,
  (req, res) => getController().updateInventoryItem(req, res)
);

// Delete inventory item
router.delete(
  '/:orgId/inventory/:id',
  ...authStack,
  requireOrganizationRole(INVENTORY_MODIFY_ROLES),
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getController().deleteInventoryItem(req, res)
);

export function setOrganizationInventoryRoutes(app: Application): void {
  app.use('/api/organizations', router);

  // Legacy v1 endpoint fallback: /api/inventory
  // Returns empty array if no active organization
  app.get('/api/inventory', authenticateToken, (req: Request, res) => {
    const user = (req as unknown as { user?: { activeOrgId?: string } }).user;
    if (!user?.activeOrgId) {
      // User has no organization - return empty inventory
      return res.json({
        inventory: [],
        total: 0,
        message: 'No active organization. Join or create an organization to manage inventory.',
      });
    }

    // Redirect to organization-scoped endpoint
    req.params.orgId = user.activeOrgId;
    return getController().getInventory(req, res);
  });
}
