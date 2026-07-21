/**
 * Inventory Routes V2
 * Handles organization inventory and cargo manifest endpoints
 */

import { NextFunction, Request, Response, Router } from 'express';

import { InventoryControllerV2 } from '../../controllers/v2/inventoryController';
import { authenticate } from '../../middleware/auth';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';

const router = Router();
const controller = new InventoryControllerV2();

// ==================== USER-LEVEL INVENTORY (orgId from tenant context) ====================

/**
 * Middleware to inject orgId from tenant context for user-scoped routes.
 * The existing controller methods read orgId from req.params.orgId.
 */
const injectOrgFromContext = (req: Request, res: Response, next: NextFunction): void => {
  const orgId = req.tenantContext?.organizationId;
  if (!orgId) {
    res.status(400).json({
      error: 'No active organization selected',
      message: 'Please select an organization to continue',
      requiresOrgSelection: true,
    });
    return;
  }
  req.params.orgId = orgId;
  next();
};

/** Shared middleware stack for user-level inventory routes */
const userInventoryAuth = [
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  injectOrgFromContext,
];

/** GET /api/v2/inventory — user-level list (orgId from session) */
router.get('/inventory', ...userInventoryAuth, controller.getInventory.bind(controller));

/** GET /api/v2/inventory/statistics — user-level stats */
router.get(
  '/inventory/statistics',
  ...userInventoryAuth,
  controller.getInventoryStatistics.bind(controller)
);

/** GET /api/v2/inventory/:id — user-level item detail */
router.get('/inventory/:id', ...userInventoryAuth, controller.getInventoryItem.bind(controller));

/** POST /api/v2/inventory — user-level create */
router.post('/inventory', ...userInventoryAuth, controller.createInventoryItem.bind(controller));

/** PATCH /api/v2/inventory/:id — user-level update */
router.patch(
  '/inventory/:id',
  ...userInventoryAuth,
  controller.updateInventoryItem.bind(controller)
);

/** DELETE /api/v2/inventory/:id — user-level delete */
router.delete(
  '/inventory/:id',
  ...userInventoryAuth,
  controller.deleteInventoryItem.bind(controller)
);

// ==================== MARKET PRICES (UEX Corp) ====================

/** GET /api/v2/inventory/market-prices/:itemName — get live UEX Corp prices */
router.get(
  '/inventory/market-prices/:itemName',
  authenticate,
  controller.getMarketPrices.bind(controller)
);

// ==================== ORGANIZATION INVENTORY ====================

/**
 * GET /api/v2/organizations/:orgId/inventory
 * Get organization inventory with filtering and pagination
 */
router.get(
  '/organizations/:orgId/inventory',
  authenticate,
  controller.getInventory.bind(controller)
);

/**
 * GET /api/v2/organizations/:orgId/inventory/statistics
 * Get inventory statistics for an organization
 */
router.get(
  '/organizations/:orgId/inventory/statistics',
  authenticate,
  controller.getInventoryStatistics.bind(controller)
);

/**
 * GET /api/v2/organizations/:orgId/inventory/:id
 * Get specific inventory item
 */
router.get(
  '/organizations/:orgId/inventory/:id',
  authenticate,
  controller.getInventoryItem.bind(controller)
);

/**
 * POST /api/v2/organizations/:orgId/inventory
 * Create new inventory item
 */
router.post(
  '/organizations/:orgId/inventory',
  authenticate,
  controller.createInventoryItem.bind(controller)
);

/**
 * PATCH /api/v2/organizations/:orgId/inventory/:id
 * Update inventory item
 */
router.patch(
  '/organizations/:orgId/inventory/:id',
  authenticate,
  controller.updateInventoryItem.bind(controller)
);

/**
 * DELETE /api/v2/organizations/:orgId/inventory/:id
 * Delete inventory item
 */
router.delete(
  '/organizations/:orgId/inventory/:id',
  authenticate,
  controller.deleteInventoryItem.bind(controller)
);

// ==================== CARGO MANIFESTS ====================

/**
 * GET /api/v2/organizations/:orgId/cargo-manifests
 * List cargo manifests for an organization
 */
router.get(
  '/organizations/:orgId/cargo-manifests',
  authenticate,
  controller.getCargoManifests.bind(controller)
);

/**
 * GET /api/v2/cargo-manifests/:id
 * Get specific cargo manifest by ID
 */
router.get(
  '/cargo-manifests/:id',
  ...userInventoryAuth,
  controller.getCargoManifest.bind(controller)
);

/**
 * POST /api/v2/organizations/:orgId/cargo-manifests
 * Create new cargo manifest
 */
router.post(
  '/organizations/:orgId/cargo-manifests',
  authenticate,
  controller.createCargoManifest.bind(controller)
);

/**
 * PUT /api/v2/cargo-manifests/:id/status
 * Update cargo manifest status
 */
router.put(
  '/cargo-manifests/:id/status',
  ...userInventoryAuth,
  controller.updateCargoManifestStatus.bind(controller)
);

/**
 * POST /api/v2/cargo-manifests/:id/cargo
 * Add cargo item to manifest
 */
router.post(
  '/cargo-manifests/:id/cargo',
  ...userInventoryAuth,
  controller.addCargoItem.bind(controller)
);

/**
 * PUT /api/v2/cargo-manifests/:id/sharing
 * Update cargo manifest sharing settings
 */
router.put(
  '/cargo-manifests/:id/sharing',
  ...userInventoryAuth,
  controller.updateCargoManifestSharing.bind(controller)
);

export { router };
