/**
 * RSI Sync Routes (API v2)
 *
 * RSI synchronization endpoints supporting:
 * - Schedule creation and management
 * - Schedule enable/disable
 * - Audit logging of sync operations
 * - Member management (list, assign, verify, remove, bulk ops)
 * - Manual sync trigger
 * - Review queue (list, resolve, stats, flag)
 *
 * All routes require authentication
 */

import { NextFunction, Request, Response, Router } from 'express';

import { RsiSyncScheduleController } from '../../controllers/rsiSyncScheduleController';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { requireOrgMembership } from '../../middleware/orgMembership';
import { validateSchema } from '../../middleware/schemaValidation';
import { rsiSyncScheduleSchemas } from '../../schemas/rsiSyncScheduleSchemas';

const router = Router();

// Apply authentication to all RSI sync routes
router.use(authenticate);

// Validate org membership when :orgId param is matched by a route.
// router.use(requireOrgMembership) can't access route params at middleware level,
// so we use router.param() which fires after Express matches the route pattern.
router.param('orgId', (req: Request, res: Response, next: NextFunction) => {
  requireOrgMembership(req as AuthRequest, res, next).catch(next);
});

// Lazy initialization to avoid EntityMetadataNotFoundError
let syncController: RsiSyncScheduleController;
const getController = (): RsiSyncScheduleController => {
  if (!syncController) {
    syncController = new RsiSyncScheduleController();
  }
  return syncController;
};

/** Route helper — casts to AuthRequest since authenticate middleware guarantees user */
const auth =
  (handler: (req: AuthRequest, res: Response) => Promise<void>) => (req: Request, res: Response) =>
    handler(req as AuthRequest, res);

// ==================== SCHEDULE MANAGEMENT ====================

router.get(
  '/schedule/:orgId',
  auth((...args) => getController().getSchedule(...args))
);

router.post(
  '/schedule/:orgId',
  validateSchema(rsiSyncScheduleSchemas.upsertSchedule, 'body'),
  auth((...args) => getController().upsertSchedule(...args))
);

router.post(
  '/schedule/:orgId/enable',
  auth((...args) => getController().enableSchedule(...args))
);

router.post(
  '/schedule/:orgId/disable',
  auth((...args) => getController().disableSchedule(...args))
);

router.delete(
  '/schedule/:orgId',
  auth((...args) => getController().deleteSchedule(...args))
);

// ==================== AUDIT LOGGING ====================

router.get(
  '/audit/:orgId',
  auth((...args) => getController().getAuditLogs(...args))
);

router.get(
  '/audit/:orgId/stats',
  auth((...args) => getController().getAuditStats(...args))
);

router.get(
  '/audit/:orgId/:logId',
  auth((...args) => getController().getAuditLogById(...args))
);

// ==================== MANUAL SYNC ====================

router.post(
  '/trigger/:orgId',
  auth((...args) => getController().triggerManualSync(...args))
);

// ==================== MEMBER MANAGEMENT ====================

router.get(
  '/members/:orgId',
  auth((...args) => getController().listMembers(...args))
);

router.post(
  '/manual-assign/:orgId',
  validateSchema(rsiSyncScheduleSchemas.manualAssign, 'body'),
  auth((...args) => getController().manualAssign(...args))
);

router.post(
  '/members/:orgId/:linkId/verify',
  auth((...args) => getController().manualVerify(...args))
);

router.delete(
  '/members/:orgId/:linkId',
  auth((...args) => getController().removeMember(...args))
);

router.post(
  '/bulk-verify/:orgId',
  validateSchema(rsiSyncScheduleSchemas.bulkVerify, 'body'),
  auth((...args) => getController().bulkVerify(...args))
);

router.post(
  '/bulk-assign/:orgId',
  validateSchema(rsiSyncScheduleSchemas.bulkAssign, 'body'),
  auth((...args) => getController().bulkAssign(...args))
);

// ==================== REVIEW QUEUE ====================

router.get(
  '/review/:orgId',
  auth((...args) => getController().getReviewQueue(...args))
);

router.post(
  '/review/:orgId/resolve',
  validateSchema(rsiSyncScheduleSchemas.resolveReview, 'body'),
  auth((...args) => getController().resolveReviewItem(...args))
);

router.get(
  '/review/:orgId/stats',
  auth((...args) => getController().getReviewStats(...args))
);

router.post(
  '/review/:orgId/flag',
  validateSchema(rsiSyncScheduleSchemas.flagForReview, 'body'),
  auth((...args) => getController().flagForReview(...args))
);

export { router };
