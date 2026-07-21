/**
 * API v2 - Ships Routes
 * Ship management endpoints with standardized responses
 */

import { Router } from 'express';

import { ShipComparisonController } from '../../controllers/v2/shipComparisonController';
import { ShipControllerV2 } from '../../controllers/v2/shipController';
import { authenticate } from '../../middleware/auth';
import { generalRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { shipComparisonSchemas, shipControllerV2QuerySchemas } from '../../schemas';

const router = Router();
const controller = new ShipControllerV2();
const comparisonController = new ShipComparisonController();

// Per-route auth middleware to avoid leaking to all v2 routes
// (this router is mounted WITHOUT a path prefix)
const orgScoped = [authenticate, tenantContextMiddleware, requireTenantContext] as const;

// Catalogue routes (authenticated but tenant-less - reference data)
router.get(
  '/ships/catalogue/manufacturers',
  authenticate,
  validateSchema(shipControllerV2QuerySchemas.catalogueQuery, 'query'),
  controller.getManufacturers.bind(controller)
);

router.get(
  '/ships/catalogue/roles',
  authenticate,
  validateSchema(shipControllerV2QuerySchemas.catalogueQuery, 'query'),
  controller.getRoles.bind(controller)
);

router.get(
  '/ships/catalogue/vehicles',
  authenticate,
  validateSchema(shipControllerV2QuerySchemas.vehiclesCatalogueQuery, 'query'),
  controller.getVehicles.bind(controller)
);

router.get(
  '/ships/catalogue/spacecraft',
  authenticate,
  validateSchema(shipControllerV2QuerySchemas.spacecraftCatalogueQuery, 'query'),
  controller.getSpacecraft.bind(controller)
);

router.get(
  '/ships/catalogue',
  authenticate,
  validateSchema(shipControllerV2QuerySchemas.catalogueQuery, 'query'),
  controller.getCatalogue.bind(controller)
);

// Organization-scoped routes (require tenant context)
// Ship CRUD operations
router.get(
  '/ships',
  ...orgScoped,
  validateSchema(shipControllerV2QuerySchemas.listQuery, 'query'),
  controller.listShips.bind(controller)
);

router.get(
  '/ships/statistics',
  ...orgScoped,
  validateSchema(shipControllerV2QuerySchemas.statisticsQuery, 'query'),
  controller.getStatistics.bind(controller)
);

router.get(
  '/ships/search',
  ...orgScoped,
  validateSchema(shipControllerV2QuerySchemas.searchQuery, 'query'),
  controller.searchShips.bind(controller)
);

router.get(
  '/ships/:id',
  ...orgScoped,
  validateSchema(shipControllerV2QuerySchemas.idParam, 'params'),
  controller.getShip.bind(controller)
);

router.post('/ships', ...orgScoped, generalRateLimiter, controller.createShip.bind(controller));

router.put(
  '/ships/:id',
  ...orgScoped,
  generalRateLimiter,
  validateSchema(shipControllerV2QuerySchemas.idParam, 'params'),
  controller.updateShip.bind(controller)
);

router.delete(
  '/ships/:id',
  ...orgScoped,
  generalRateLimiter,
  validateSchema(shipControllerV2QuerySchemas.idParam, 'params'),
  controller.deleteShip.bind(controller)
);

// Ship utilities
router.post(
  '/ships/:id/reactivate',
  ...orgScoped,
  generalRateLimiter,
  validateSchema(shipControllerV2QuerySchemas.idParam, 'params'),
  controller.reactivateShip.bind(controller)
);

// Ship sharing
router.post(
  '/ships/:id/share',
  ...orgScoped,
  generalRateLimiter,
  validateSchema(shipControllerV2QuerySchemas.idParam, 'params'),
  controller.shareShip.bind(controller)
);

router.delete(
  '/ships/:id/share/:targetOrgId',
  ...orgScoped,
  generalRateLimiter,
  validateSchema(shipControllerV2QuerySchemas.idParam, 'params'),
  controller.unshareShip.bind(controller)
);

// Ship comparison routes
router.post(
  '/ships/compare',
  ...orgScoped,
  validateSchema(shipComparisonSchemas.compareBody, 'body'),
  comparisonController.compareShips.bind(comparisonController)
);

router.post(
  '/ships/quick-compare',
  ...orgScoped,
  validateSchema(shipComparisonSchemas.quickCompareBody, 'body'),
  comparisonController.quickCompare.bind(comparisonController)
);

router.get(
  '/ships/:id/roles',
  ...orgScoped,
  validateSchema(shipComparisonSchemas.shipIdParam, 'params'),
  comparisonController.analyzeShipRoles.bind(comparisonController)
);

router.get(
  '/ships/:id/similar',
  ...orgScoped,
  validateSchema(shipComparisonSchemas.shipIdParam, 'params'),
  validateSchema(shipComparisonSchemas.similarShipsQuery, 'query'),
  comparisonController.getSimilarShips.bind(comparisonController)
);

// CSV export route (streaming)
router.get(
  '/ships/export',
  ...orgScoped,
  generalRateLimiter,
  controller.exportShipsCSV.bind(controller)
);

export { router };

