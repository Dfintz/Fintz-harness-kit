import { Router } from 'express';

import { TreasuryController } from '../../controllers/treasuryController';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissionMiddleware';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { ResourceType } from '../../models/OrganizationPermission';
import { treasurySchemas } from '../../schemas/treasurySchemas';

const router = Router();

// Lazy initialization to avoid circular dependency issues
let treasuryController: TreasuryController;
const getController = (): TreasuryController => {
  if (!treasuryController) {
    treasuryController = new TreasuryController();
  }
  return treasuryController;
};

// All credit routes require authentication + org context
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== CREDIT OPERATIONS ====================

/**
 * GET /api/v2/credits/balance
 * Get credit balance for the organization
 */
router.get('/balance', ...orgAuth, requirePermission(ResourceType.TREASURY, 'read'), (req, res) =>
  getController().getBalance(req, res)
);

/**
 * GET /api/v2/credits/transactions
 * Get paginated transaction history
 */
router.get(
  '/transactions',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'read'),
  validateSchema(treasurySchemas.transactionQuery, 'query'),
  (req, res) => getController().getTransactions(req, res)
);

/**
 * GET /api/v2/credits/statistics
 * Get treasury statistics for a period
 */
router.get(
  '/statistics',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'read'),
  validateSchema(treasurySchemas.statisticsQuery, 'query'),
  (req, res) => getController().getStatistics(req, res)
);

/**
 * GET /api/v2/credits/leaderboard
 * Get top contributors leaderboard
 */
router.get(
  '/leaderboard',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'read'),
  validateSchema(treasurySchemas.leaderboardQuery, 'query'),
  (req, res) => getController().getLeaderboard(req, res)
);

/**
 * POST /api/v2/credits/earn
 * Record credit earnings
 */
router.post(
  '/earn',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'manage'),
  validateSchema(treasurySchemas.earn, 'body'),
  (req, res) => getController().earnCredits(req, res)
);

/**
 * POST /api/v2/credits/spend
 * Record credit spending
 */
router.post(
  '/spend',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'manage'),
  validateSchema(treasurySchemas.spend, 'body'),
  (req, res) => getController().spendCredits(req, res)
);

/**
 * POST /api/v2/credits/transfer
 * Transfer credits to a user
 */
router.post(
  '/transfer',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'manage'),
  validateSchema(treasurySchemas.transfer, 'body'),
  (req, res) => getController().transferCredits(req, res)
);

// ==================== DUES ====================

/**
 * GET /api/v2/credits/dues
 * List dues schedules
 */
router.get(
  '/dues',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'read'),
  validateSchema(treasurySchemas.duesQuery, 'query'),
  (req, res) => getController().listDues(req, res)
);

/**
 * POST /api/v2/credits/dues
 * Create a new dues schedule
 */
router.post(
  '/dues',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'manage'),
  validateSchema(treasurySchemas.createDues, 'body'),
  (req, res) => getController().createDues(req, res)
);

/**
 * PUT /api/v2/credits/dues/:duesId
 * Update a dues schedule
 */
router.put(
  '/dues/:duesId',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'manage'),
  validateSchema(treasurySchemas.duesParam, 'params'),
  validateSchema(treasurySchemas.updateDues, 'body'),
  (req, res) => getController().updateDues(req, res)
);

/**
 * DELETE /api/v2/credits/dues/:duesId
 * Delete a dues schedule
 */
router.delete(
  '/dues/:duesId',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'manage'),
  validateSchema(treasurySchemas.duesParam, 'params'),
  (req, res) => getController().deleteDues(req, res)
);

// ==================== COMMISSARY ====================

/**
 * GET /api/v2/credits/commissary
 * List commissary items
 */
router.get(
  '/commissary',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'read'),
  validateSchema(treasurySchemas.commissaryQuery, 'query'),
  (req, res) => getController().listCommissaryItems(req, res)
);

/**
 * GET /api/v2/credits/commissary/purchases
 * Get purchase history (before :itemId to avoid conflict)
 */
router.get(
  '/commissary/purchases',
  ...orgAuth,
  requirePermission(ResourceType.TREASURY, 'read'),
  validateSchema(treasurySchemas.purchaseQuery, 'query'),
  (req, res) => getController().getPurchaseHistory(req, res)
);

/**
 * POST /api/v2/credits/commissary
 * Create a new commissary item
 */
router.post(
  '/commissary',
  ...orgAuth,
  requirePermission(ResourceType.COMMISSARY, 'manage'),
  validateSchema(treasurySchemas.createCommissaryItem, 'body'),
  (req, res) => getController().createCommissaryItem(req, res)
);

/**
 * PUT /api/v2/credits/commissary/:itemId
 * Update a commissary item
 */
router.put(
  '/commissary/:itemId',
  ...orgAuth,
  requirePermission(ResourceType.COMMISSARY, 'manage'),
  validateSchema(treasurySchemas.itemParam, 'params'),
  validateSchema(treasurySchemas.updateCommissaryItem, 'body'),
  (req, res) => getController().updateCommissaryItem(req, res)
);

/**
 * DELETE /api/v2/credits/commissary/:itemId
 * Delete a commissary item
 */
router.delete(
  '/commissary/:itemId',
  ...orgAuth,
  requirePermission(ResourceType.COMMISSARY, 'manage'),
  validateSchema(treasurySchemas.itemParam, 'params'),
  (req, res) => getController().deleteCommissaryItem(req, res)
);

/**
 * POST /api/v2/credits/commissary/:itemId/purchase
 * Purchase a commissary item
 */
router.post(
  '/commissary/:itemId/purchase',
  ...orgAuth,
  requirePermission(ResourceType.COMMISSARY, 'purchase'),
  validateSchema(treasurySchemas.itemParam, 'params'),
  validateSchema(treasurySchemas.purchase, 'body'),
  (req, res) => getController().purchaseItem(req, res)
);

export { router };
