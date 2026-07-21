import { Application, Router } from 'express';

import { OrganizationShipController } from '../controllers/organizationShipController';
import { authenticate } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import {
    requireOrganizationRole,
    requireTenantContext,
    tenantContextMiddleware,
} from '../middleware/tenantContext';
import { organizationShipSchemas, paramSchemas } from '../schemas';

const router = Router();

let controller: OrganizationShipController;
const getController = () => {
  if (!controller) {
    controller = new OrganizationShipController();
  }
  return controller;
};

// Role constants for access control
// Note: 'founder' is the primary org-creator role; 'owner' is a legacy alias
// (see backend/src/utils/roleUtils.ts DEFAULT_ROLE_PERMISSIONS).
const SHIP_WRITE_ROLES = ['founder', 'owner', 'admin']; // Only admins+ can manage ships and crew

/**
 * Organization Ship Routes - Org fleet management
 * All routes require authentication and tenant context
 */

// Shared middleware stack applied PER-ROUTE (not via router.use). This router is
// mounted at the bare `/api` (and `/api/v2`) prefix, so a router-level `router.use(...)`
// would run auth + tenant enforcement on every unmatched request that flows through this
// router before reaching its real handler. Spreading the stack onto each route keeps
// enforcement scoped to this router's own paths.
const authStack = [authenticate, tenantContextMiddleware, requireTenantContext] as const;

// Ship CRUD operations
router.get(
  '/organizations/:orgId/ships',
  ...authStack,
  validateSchema(paramSchemas.orgId, 'params'),
  validateSchema(organizationShipSchemas.query, 'query'),
  (req, res) => getController().getOrgShips(req, res)
);
router.get(
  '/organizations/:orgId/ships/summary',
  ...authStack,
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().getFleetSummary(req, res)
);
router.get(
  '/organizations/:orgId/ships/:shipId',
  ...authStack,
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().getOrgShipById(req, res)
);
router.post(
  '/organizations/:orgId/ships',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  validateSchema(organizationShipSchemas.createOrgShip, 'body'),
  (req, res) => getController().createOrgShip(req, res)
);
router.patch(
  '/organizations/:orgId/ships/:shipId',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  validateSchema(organizationShipSchemas.updateOrgShip, 'body'),
  (req, res) => getController().updateOrgShip(req, res)
);
router.delete(
  '/organizations/:orgId/ships/:shipId',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().deleteOrgShip(req, res)
);

// Crew management
router.post(
  '/organizations/:orgId/ships/:shipId/captain',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  validateSchema(organizationShipSchemas.assignCaptain, 'body'),
  (req, res) => getController().assignCaptain(req, res)
);
router.post(
  '/organizations/:orgId/ships/:shipId/crew',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  validateSchema(organizationShipSchemas.assignCrew, 'body'),
  (req, res) => getController().assignCrew(req, res)
);
router.post(
  '/organizations/:orgId/ships/:shipId/crew/:userId',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().addCrewMember(req, res)
);
router.delete(
  '/organizations/:orgId/ships/:shipId/crew/:userId',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().removeCrewMember(req, res)
);

// Specialized queries
router.get(
  '/organizations/:orgId/ships/maintenance/due',
  ...authStack,
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().getShipsNeedingMaintenance(req, res)
);
router.get(
  '/organizations/:orgId/ships/capital',
  ...authStack,
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().getCapitalShips(req, res)
);
router.get(
  '/organizations/:orgId/ships/role/:role',
  ...authStack,
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().getShipsByRole(req, res)
);
router.get(
  '/organizations/:orgId/ships/available',
  ...authStack,
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().getAvailableShips(req, res)
);

// Loan management
router.post(
  '/organizations/:orgId/ships/:shipId/loan',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().loanOrgShip(req, res)
);
router.post(
  '/organizations/:orgId/ships/:shipId/return',
  ...authStack,
  requireOrganizationRole(SHIP_WRITE_ROLES),
  validateSchema(paramSchemas.orgId, 'params'),
  (req, res) => getController().returnOrgShipLoan(req, res)
);

export const setOrganizationShipRoutes = (app: Application) => {
  app.use('/api', router);
  app.use('/api/v2', router);
};
