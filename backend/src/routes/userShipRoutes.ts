import { Application, Router } from 'express';

import { UserShipController } from '../controllers/userShipController';
import { authenticate } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { paramSchemas, userShipQuerySchemas, userShipSchemas } from '../schemas';

const router = Router();

let controller: UserShipController;
const getController = () => {
  if (!controller) {
    controller = new UserShipController();
  }
  return controller;
};

/**
 * User Ship Routes - Personal ship inventory management
 * Personal hangar routes require authentication only (no org required)
 * Organization-scoped routes require tenant context
 */

// ==================== PERSONAL HANGAR ROUTES (NO ORG REQUIRED) ====================
// These routes allow users to manage their personal ship collection without joining an org

// Ship CRUD operations for personal hangar
router.get(
  '/users/:userId/ships',
  authenticate,
  validateSchema(userShipQuerySchemas.userIdParam, 'params'),
  validateSchema(userShipQuerySchemas.listQuery, 'query'),
  (req, res) => getController().getUserShips(req, res)
);
router.get(
  '/users/:userId/ships/summary',
  authenticate,
  validateSchema(paramSchemas.userId, 'params'),
  (req, res) => getController().getUserShipSummary(req, res)
);
router.get(
  '/users/:userId/ships/:shipId',
  authenticate,
  validateSchema(userShipQuerySchemas.userShipParam, 'params'),
  (req, res) => getController().getUserShipById(req, res)
);
router.post(
  '/users/:userId/ships',
  authenticate,
  validateSchema(userShipQuerySchemas.userIdParam, 'params'),
  validateSchema(userShipQuerySchemas.createShip, 'body'),
  (req, res) => getController().createUserShip(req, res)
);
// Bulk import ships (single request, avoids per-ship rate limiting)
router.post(
  '/users/:userId/ships/import',
  authenticate,
  validateSchema(userShipQuerySchemas.userIdParam, 'params'),
  (req, res) => getController().bulkImportUserShips(req, res)
);
router.patch(
  '/users/:userId/ships/:shipId',
  authenticate,
  validateSchema(userShipQuerySchemas.userShipParam, 'params'),
  validateSchema(userShipQuerySchemas.updateShip, 'body'),
  (req, res) => getController().updateUserShip(req, res)
);
router.delete(
  '/users/:userId/ships/:shipId',
  authenticate,
  validateSchema(userShipQuerySchemas.userShipParam, 'params'),
  (req, res) => getController().deleteUserShip(req, res)
);
// Clear all ships in personal hangar (hard delete)
router.delete(
  '/users/:userId/ships',
  authenticate,
  validateSchema(userShipQuerySchemas.userIdParam, 'params'),
  (req, res) => getController().clearAllUserShips(req, res)
);

// Insurance tracking (personal)
router.get(
  '/users/:userId/ships/insurance/expiring',
  authenticate,
  validateSchema(paramSchemas.userId, 'params'),
  (req, res) => getController().getShipsNeedingInsurance(req, res)
);

// ==================== ORGANIZATION-SCOPED ROUTES (REQUIRE ORG) ====================
// These routes require active organization context for loans and org-level operations

// Loan management (requires org context)
router.post(
  '/users/:userId/ships/:shipId/loan',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(paramSchemas.userId, 'params'),
  validateSchema(userShipSchemas.loanShip, 'body'),
  (req, res) => getController().loanShip(req, res)
);
router.post(
  '/users/:userId/ships/:shipId/return',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(paramSchemas.userId, 'params'),
  (req, res) => getController().returnLoanedShip(req, res)
);

// Org-available ships (requires org context)
router.get(
  '/organizations/:orgId/available-user-ships',
  authenticate,
  tenantContextMiddleware,
  requireTenantContext,
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().getOrgAvailableShips(req, res)
);

export const setUserShipRoutes = (app: Application) => {
  app.use('/api', router);
  app.use('/api/v2', router);
};
