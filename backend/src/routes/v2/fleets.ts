/**
 * API v2 - Fleet Routes
 * Fleet management endpoints with standardized responses
 */

import { Router } from 'express';

import { FleetControllerV2 } from '../../controllers/v2/fleetController';
import { ShipComparisonController } from '../../controllers/v2/shipComparisonController';
import { authenticate, authenticateWithTenant } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissionMiddleware';
import { validateSchema } from '../../middleware/schemaValidation';
import { fleetSchemas, shipComparisonSchemas } from '../../schemas';

const router = Router();
const controller = new FleetControllerV2();
const comparisonController = new ShipComparisonController();

// Organization-scoped fleet operations
router.get(
  '/organizations/:orgId/fleets',
  authenticate,
  requirePermission('fleet', 'read'),
  controller.listOrgFleets.bind(controller)
);

router.post(
  '/organizations/:orgId/fleets',
  authenticate,
  requirePermission('fleet', 'create'),
  validateSchema(fleetSchemas.createFleet),
  (req, res, next) => controller.createFleet(req, res).catch(next)
);

router.get(
  '/organizations/:orgId/fleets/statistics',
  authenticate,
  requirePermission('fleet', 'read'),
  controller.getFleetStatistics.bind(controller)
);

// Fleet overview — single endpoint replacing N+1 per-fleet ship queries (P7/C7)
router.get(
  '/organizations/:orgId/fleet-overview',
  authenticate,
  requirePermission('fleet', 'read'),
  controller.getFleetOverview.bind(controller)
);

// Fleet hierarchy (Wave 2.2)
router.get(
  '/organizations/:orgId/fleets/tree',
  authenticate,
  requirePermission('fleet', 'read'),
  controller.getFleetTree.bind(controller)
);

router.put(
  '/fleets/:id/move',
  authenticateWithTenant,
  requirePermission('fleet', 'edit'),
  controller.moveFleet.bind(controller)
);

router.put(
  '/organizations/:orgId/fleets/reorder',
  authenticate,
  requirePermission('fleet', 'edit'),
  controller.reorderFleets.bind(controller)
);

// Individual fleet operations
// Authorization for these endpoints is performed inside the controller
// against the fleet's actual organizationId (not the caller's active org),
// so users can act on fleets in any org they're a member of.
router.get('/fleets/:id', authenticateWithTenant, controller.getFleetById.bind(controller));

router.put('/fleets/:id', authenticateWithTenant, controller.updateFleet.bind(controller));

router.delete('/fleets/:id', authenticateWithTenant, controller.deleteFleet.bind(controller));

// Fleet-specific queries
router.get('/fleets/:id/ships', authenticateWithTenant, controller.getFleetShips.bind(controller));

router.get(
  '/fleets/:id/composition',
  authenticateWithTenant,
  controller.getFleetComposition.bind(controller)
);

// Fleet health assessment (Sprint 23-A)
router.get(
  '/fleets/:id/health',
  authenticateWithTenant,
  controller.getFleetHealth.bind(controller)
);

// Fleet audit log (Sprint 26)
router.get(
  '/fleets/:id/audit',
  authenticateWithTenant,
  controller.getFleetAuditLog.bind(controller)
);

// Fleet crew position self-selection (Sprint 26)
router.get(
  '/fleets/:id/crew/positions',
  authenticateWithTenant,
  controller.getCrewPositions.bind(controller)
);

router.get(
  '/fleets/:id/crew/members',
  authenticateWithTenant,
  controller.getFleetCrewMembers.bind(controller)
);

router.post(
  '/fleets/:id/crew/select',
  authenticateWithTenant,
  controller.selectCrewPosition.bind(controller)
);

router.delete(
  '/fleets/:id/crew/select',
  authenticateWithTenant,
  controller.unselectCrewPosition.bind(controller)
);

// Fleet member management
router.get(
  '/fleets/:id/members',
  authenticateWithTenant,
  controller.getFleetMembers.bind(controller)
);

router.post(
  '/fleets/:id/members',
  authenticateWithTenant,
  requirePermission('fleet', 'manage_members'),
  controller.addFleetMember.bind(controller)
);

router.delete(
  '/fleets/:id/members/:shipId',
  authenticateWithTenant,
  requirePermission('fleet', 'manage_members'),
  controller.removeFleetMember.bind(controller)
);

router.get('/fleets/:id/roles', authenticateWithTenant, controller.getFleetRoles.bind(controller));

// Fleet analytics
router.get(
  '/fleets/:id/analytics/composition',
  authenticate,
  controller.getCompositionAnalytics.bind(controller)
);

router.post('/fleets/analytics/compare', authenticate, controller.compareFleets.bind(controller));

// Fleet bulk operations
router.post(
  '/fleets/:id/members/bulk',
  authenticateWithTenant,
  requirePermission('fleet', 'manage_members'),
  controller.bulkAddMembers.bind(controller)
);

router.patch(
  '/fleets/members/bulk',
  authenticate,
  requirePermission('fleet', 'manage_members'),
  controller.bulkUpdateMembers.bind(controller)
);

router.delete(
  '/fleets/members/bulk',
  authenticate,
  requirePermission('fleet', 'manage_members'),
  controller.bulkDeleteMembers.bind(controller)
);

// Fleet assignments
router.get(
  '/fleets/:id/assignments',
  authenticate,
  controller.getFleetAssignments.bind(controller)
);

router.post(
  '/fleets/:id/assignments',
  authenticate,
  requirePermission('fleet', 'manage_ships'),
  controller.createFleetAssignment.bind(controller)
);

router.delete(
  '/fleets/:id/assignments/:assignmentId',
  authenticate,
  requirePermission('fleet', 'manage_ships'),
  controller.deleteFleetAssignment.bind(controller)
);

// Fleet sharing settings
router.get('/fleets/:id/sharing', authenticate, controller.getFleetSharing.bind(controller));

router.patch(
  '/fleets/:id/sharing',
  authenticate,
  requirePermission('fleet', 'edit'),
  controller.updateFleetSharing.bind(controller)
);

// Fleet ship composition analysis (powered by ShipComparisonService)
router.get(
  '/fleets/:id/ship-analysis',
  authenticate,
  validateSchema(shipComparisonSchemas.fleetIdParam, 'params'),
  comparisonController.analyzeFleetShipComposition.bind(comparisonController)
);

// Aggregator endpoints
router.post(
  '/organizations/:orgId/fleets/create-full',
  authenticate,
  requirePermission('fleet', 'create'),
  validateSchema(fleetSchemas.createFleetWithAssets),
  controller.createFleetWithAssets.bind(controller)
);

router.post(
  '/fleets/:id/deploy',
  authenticate,
  requirePermission('fleet', 'edit'),
  validateSchema(fleetSchemas.deployFleet),
  controller.deployFleet.bind(controller)
);

router.post(
  '/fleets/:id/dissolve',
  authenticate,
  requirePermission('fleet', 'delete'),
  validateSchema(fleetSchemas.dissolveFleet),
  controller.dissolveFleet.bind(controller)
);

export { router };
