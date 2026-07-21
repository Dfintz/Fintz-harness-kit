import { Application, Router } from 'express';

import { SquadronController } from '../controllers/squadronController';
import { authenticate } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { squadronQuerySchemas, squadronSchemas } from '../schemas';

const router = Router();

let controller: SquadronController;
const getController = () => {
  if (!controller) {
    controller = new SquadronController();
  }
  return controller;
};

/**
 * Squadron Routes - User group/squadron management
 * All routes require authentication and tenant context
 */

// Shared middleware stack applied PER-ROUTE (not via router.use). This router is
// mounted at the bare `/api` prefix, so a router-level `router.use(...)` would run
// auth + tenant enforcement on every unmatched `/api/*` request that flows through
// this router before reaching its real handler. Spreading the stack onto each route
// keeps enforcement scoped to this router's own paths.
const authStack = [authenticate, tenantContextMiddleware, requireTenantContext] as const;

// Squadron roster queries
router.get(
  '/squadrons/:squadronId/members',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.membersQuery, 'query'),
  (req, res) => getController().getSquadronMembers(req, res)
);
router.get(
  '/squadrons/:squadronId/roster',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.rosterQuery, 'query'),
  (req, res) => getController().getSquadronRoster(req, res)
);
router.get(
  '/squadrons/:squadronId/members/:memberId',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.memberIdParam, 'params'),
  (req, res) => getController().getSquadronMemberById(req, res)
);
router.get(
  '/users/:userId/squadrons',
  ...authStack,
  validateSchema(squadronQuerySchemas.userIdParam, 'params'),
  (req, res) => getController().getUserSquadrons(req, res)
);
router.get(
  '/squadrons/:squadronId/members/:userId/check',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  (req, res) => getController().checkMembership(req, res)
);
router.get(
  '/squadrons/:squadronId/members/:userId',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  (req, res) => getController().getMembership(req, res)
);

// Membership management
router.post(
  '/squadrons/:squadronId/members',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.addMemberBody, 'body'),
  (req, res) => getController().addMember(req, res)
);
router.post(
  '/squadrons/:squadronId/members/bulk',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronSchemas.bulkAddMembers, 'body'),
  (req, res) => getController().bulkAddMembers(req, res)
);
router.patch(
  '/squadrons/members/bulk',
  ...authStack,
  validateSchema(squadronSchemas.bulkUpdateMembers, 'body'),
  (req, res) => getController().bulkUpdateMembers(req, res)
);
router.delete(
  '/squadrons/members/bulk',
  ...authStack,
  validateSchema(squadronSchemas.bulkDeleteMembers, 'body'),
  (req, res) => getController().bulkDeleteMembers(req, res)
);
router.patch(
  '/squadrons/members/bulk/status',
  ...authStack,
  validateSchema(squadronSchemas.bulkUpdateStatus, 'body'),
  (req, res) => getController().bulkUpdateStatus(req, res)
);
router.patch(
  '/squadrons/:squadronId/members/:userId/role',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.updateRoleBody, 'body'),
  (req, res) => getController().updateRole(req, res)
);
router.delete(
  '/squadrons/:squadronId/members/:userId',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  (req, res) => getController().removeMember(req, res)
);

// Analytics
router.get(
  '/squadrons/:squadronId/count',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.countQuery, 'query'),
  (req, res) => getController().getSquadronMemberCount(req, res)
);
router.get(
  '/squadrons/:squadronId/count/active',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.activeCountQuery, 'query'),
  (req, res) => getController().getActiveCount(req, res)
);
router.get(
  '/squadrons/:squadronId/stats/roles',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.roleStatsQuery, 'query'),
  (req, res) => getController().getMembersByRole(req, res)
);
router.get(
  '/squadrons/:squadronId/stats/ships',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.shipStatsQuery, 'query'),
  (req, res) => getController().getMembersByShipType(req, res)
);
router.get(
  '/squadrons/:squadronId/stats',
  ...authStack,
  validateSchema(squadronQuerySchemas.squadronIdParam, 'params'),
  validateSchema(squadronQuerySchemas.statsQuery, 'query'),
  (req, res) => getController().getSquadronStatistics(req, res)
);
router.get(
  '/users/:userId/squadrons/count',
  ...authStack,
  validateSchema(squadronQuerySchemas.userIdParam, 'params'),
  validateSchema(squadronQuerySchemas.userSquadronCountQuery, 'query'),
  (req, res) => getController().getUserSquadronCount(req, res)
);

export const setSquadronRoutes = (app: Application) => {
  app.use('/api', router);
};
