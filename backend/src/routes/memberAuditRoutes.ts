/**
 * Member Audit & Intel Routes
 *
 * Endpoints for:
 *   • Audit flags  — create (manual), list, get, resolve, stats
 *   • Org watchlist — CRUD for external RSI organization watch entries
 *   • Member profile — aggregated intel profile per user
 *
 * All routes sit under /organizations/:orgId/intel/…
 *
 * Wave 2.1 — Membership Audit & Intel (Phase E)
 */
import { Application, Router } from 'express';

import { MemberAuditController } from '../controllers/intel/MemberAuditController';
import { MemberProfileController } from '../controllers/intel/MemberProfileController';
import { OrgWatchlistController } from '../controllers/intel/OrgWatchlistController';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/permissionMiddleware';
import {
  intelDeleteRateLimiter,
  intelOperationsRateLimiter,
  intelWriteRateLimiter,
} from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { memberAuditSchemas } from '../schemas';

const router = Router();

// ─── Lazy controller initialisation ─────────────────────────────────
let auditCtrl: MemberAuditController;
const getAuditCtrl = () => {
  if (!auditCtrl) {
    auditCtrl = new MemberAuditController();
  }
  return auditCtrl;
};

let watchlistCtrl: OrgWatchlistController;
const getWatchlistCtrl = () => {
  if (!watchlistCtrl) {
    watchlistCtrl = new OrgWatchlistController();
  }
  return watchlistCtrl;
};

let profileCtrl: MemberProfileController;
const getProfileCtrl = () => {
  if (!profileCtrl) {
    profileCtrl = new MemberProfileController();
  }
  return profileCtrl;
};

// All routes require authentication
router.use('/organizations/:orgId/intel', authenticateToken);

// ==================== AUDIT FLAGS ====================

// List audit flags for organisation
router.get(
  '/organizations/:orgId/intel/audit/flags',
  requirePermission('intel', 'audit:view'),
  validateSchema(memberAuditSchemas.orgIdParam, 'params'),
  validateSchema(memberAuditSchemas.listFlagsQuery, 'query'),
  intelOperationsRateLimiter,
  (req, res) => getAuditCtrl().listFlags(req, res)
);

// Get single audit flag
router.get(
  '/organizations/:orgId/intel/audit/flags/:flagId',
  requirePermission('intel', 'audit:view'),
  validateSchema(memberAuditSchemas.flagIdParam, 'params'),
  intelOperationsRateLimiter,
  (req, res) => getAuditCtrl().getFlagById(req, res)
);

// Create manual audit flag
router.post(
  '/organizations/:orgId/intel/audit/flags',
  requirePermission('intel', 'audit:create'),
  validateSchema(memberAuditSchemas.orgIdParam, 'params'),
  validateSchema(memberAuditSchemas.createManualFlag, 'body'),
  intelWriteRateLimiter,
  (req, res) => getAuditCtrl().createManualFlag(req, res)
);

// Resolve / dismiss / escalate an audit flag
router.patch(
  '/organizations/:orgId/intel/audit/flags/:flagId/resolve',
  requirePermission('intel', 'audit:resolve'),
  validateSchema(memberAuditSchemas.flagIdParam, 'params'),
  validateSchema(memberAuditSchemas.resolveFlag, 'body'),
  intelWriteRateLimiter,
  (req, res) => getAuditCtrl().resolveFlag(req, res)
);

// Per-user flag statistics
router.get(
  '/organizations/:orgId/intel/audit/users/:userId/stats',
  requirePermission('intel', 'audit:view'),
  validateSchema(memberAuditSchemas.userIdParam, 'params'),
  intelOperationsRateLimiter,
  (req, res) => getAuditCtrl().getUserFlagStats(req, res)
);

// ==================== ORG WATCHLIST ====================

// List watchlist entries
router.get(
  '/organizations/:orgId/intel/watchlist',
  requirePermission('intel', 'watchlist:view'),
  validateSchema(memberAuditSchemas.orgIdParam, 'params'),
  validateSchema(memberAuditSchemas.listWatchlistQuery, 'query'),
  intelOperationsRateLimiter,
  (req, res) => getWatchlistCtrl().listEntries(req, res)
);

// Get single watchlist entry
router.get(
  '/organizations/:orgId/intel/watchlist/:entryId',
  requirePermission('intel', 'watchlist:view'),
  validateSchema(memberAuditSchemas.entryIdParam, 'params'),
  intelOperationsRateLimiter,
  (req, res) => getWatchlistCtrl().getEntryById(req, res)
);

// Create watchlist entry
router.post(
  '/organizations/:orgId/intel/watchlist',
  requirePermission('intel', 'watchlist:manage'),
  validateSchema(memberAuditSchemas.orgIdParam, 'params'),
  validateSchema(memberAuditSchemas.createWatchlistEntry, 'body'),
  intelWriteRateLimiter,
  (req, res) => getWatchlistCtrl().createEntry(req, res)
);

// Update watchlist entry
router.patch(
  '/organizations/:orgId/intel/watchlist/:entryId',
  requirePermission('intel', 'watchlist:manage'),
  validateSchema(memberAuditSchemas.entryIdParam, 'params'),
  validateSchema(memberAuditSchemas.updateWatchlistEntry, 'body'),
  intelWriteRateLimiter,
  (req, res) => getWatchlistCtrl().updateEntry(req, res)
);

// Delete watchlist entry
router.delete(
  '/organizations/:orgId/intel/watchlist/:entryId',
  requirePermission('intel', 'watchlist:manage'),
  validateSchema(memberAuditSchemas.entryIdParam, 'params'),
  intelDeleteRateLimiter,
  (req, res) => getWatchlistCtrl().deleteEntry(req, res)
);

// ==================== MEMBER PROFILE ====================

// Get aggregated member intel profile
router.get(
  '/organizations/:orgId/intel/members/:userId/profile',
  requirePermission('intel', 'audit:view'),
  validateSchema(memberAuditSchemas.userIdParam, 'params'),
  intelOperationsRateLimiter,
  (req, res) => getProfileCtrl().getProfile(req, res)
);

// ─── Mount helper ───────────────────────────────────────────────────

export { router as memberAuditRouter };

export function setMemberAuditRoutes(app: Application) {
  app.use('/api', router);
  app.use('/api/v2', router);
}
