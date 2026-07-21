import { Application, Router } from 'express';

import { IntelVaultController } from '../controllers/intelVaultController';
import { authenticateToken } from '../middleware/auth';
import {
    intelDeleteRateLimiter,
    intelOfficerManagementRateLimiter,
    intelOperationsRateLimiter,
    intelWriteRateLimiter,
} from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { intelSchemas } from '../schemas';

const router = Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let intelVaultController: IntelVaultController;
const getController = () => {
  if (!intelVaultController) {
    intelVaultController = new IntelVaultController();
  }
  return intelVaultController;
};

/**
 * Intel Vault Routes
 * Secure intelligence storage system with role-based access control
 *
 * Access levels:
 * - Org owner: Full access to all features
 * - Intel officers: Access based on rank and assigned permissions
 * - Regular members: No access
 */

// Auth applied PER-ROUTE (not via router.use). This router is mounted at the bare
// `/api` prefix, so a router-level `router.use(authenticateToken)` would also run on
// unmatched `/api/*` requests handled by other routers (leaking 401s). Spreading the
// stack onto each route keeps enforcement scoped to this router's own paths.
const authStack = [authenticateToken] as const;

// ==================== ACCESS CHECK ====================

// Check user's Intel vault access
router.get(
  '/organizations/:orgId/intel/access',
  ...authStack,
  validateSchema(intelSchemas.orgIdParam, 'params'),
  intelOperationsRateLimiter,
  (req, res) => getController().checkAccess(req, res)
);

// ==================== INTEL ENTRIES ====================

// Create Intel entry
router.post(
  '/organizations/:orgId/intel/entries',
  ...authStack,
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.createEntry, 'body'),
  intelWriteRateLimiter,
  (req, res) => getController().createEntry(req, res)
);

// Get Intel entries (with filtering and pagination)
router.get(
  '/organizations/:orgId/intel/entries',
  ...authStack,
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryEntries, 'query'),
  intelOperationsRateLimiter,
  (req, res) => getController().getEntries(req, res)
);

// Get single Intel entry
router.get(
  '/organizations/:orgId/intel/entries/:entryId',
  ...authStack,
  validateSchema(intelSchemas.entryIdParam, 'params'),
  intelOperationsRateLimiter,
  (req, res) => getController().getEntry(req, res)
);

// Update Intel entry
router.patch(
  '/organizations/:orgId/intel/entries/:entryId',
  ...authStack,
  validateSchema(intelSchemas.entryIdParam, 'params'),
  validateSchema(intelSchemas.updateEntry, 'body'),
  intelWriteRateLimiter,
  (req, res) => getController().updateEntry(req, res)
);

// Delete Intel entry
router.delete(
  '/organizations/:orgId/intel/entries/:entryId',
  ...authStack,
  validateSchema(intelSchemas.entryIdParam, 'params'),
  intelDeleteRateLimiter,
  (req, res) => getController().deleteEntry(req, res)
);

// ==================== INTEL OFFICERS ====================

// Appoint Intel officer (org owner only)
router.post(
  '/organizations/:orgId/intel/officers',
  ...authStack,
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.appointOfficer, 'body'),
  intelOfficerManagementRateLimiter,
  (req, res) => getController().appointOfficer(req, res)
);

// Get all Intel officers
router.get(
  '/organizations/:orgId/intel/officers',
  ...authStack,
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryOfficers, 'query'),
  intelOperationsRateLimiter,
  (req, res) => getController().getOfficers(req, res)
);

// Get single Intel officer
router.get(
  '/organizations/:orgId/intel/officers/:officerId',
  ...authStack,
  validateSchema(intelSchemas.officerIdParam, 'params'),
  intelOperationsRateLimiter,
  (req, res) => getController().getOfficer(req, res)
);

// Update Intel officer (org owner only)
router.patch(
  '/organizations/:orgId/intel/officers/:officerId',
  ...authStack,
  validateSchema(intelSchemas.officerIdParam, 'params'),
  validateSchema(intelSchemas.updateOfficer, 'body'),
  intelOfficerManagementRateLimiter,
  (req, res) => getController().updateOfficer(req, res)
);

// Remove Intel officer (org owner only)
router.delete(
  '/organizations/:orgId/intel/officers/:officerId',
  ...authStack,
  validateSchema(intelSchemas.officerIdParam, 'params'),
  validateSchema(intelSchemas.removeOfficer, 'body'),
  intelOfficerManagementRateLimiter,
  (req, res) => getController().removeOfficer(req, res)
);

// ==================== AUDIT LOGS ====================

// Get audit logs (org owner and highest ranking officer only)
router.get(
  '/organizations/:orgId/intel/audit-logs',
  ...authStack,
  validateSchema(intelSchemas.orgIdParam, 'params'),
  validateSchema(intelSchemas.queryAuditLogs, 'query'),
  intelOperationsRateLimiter,
  (req, res) => getController().getAuditLogs(req, res)
);

export function setIntelVaultRoutes(app: Application) {
  // Only mount legacy V1 routes — V2 intel routes are served by routes/v2/intel.ts
  // via v2Router.  Mounting this router on /api/v2 as well caused the unwrapped
  // (executeAndReturn) response to shadow the V2 envelope, breaking frontend parsing.
  app.use('/api', router);
}
