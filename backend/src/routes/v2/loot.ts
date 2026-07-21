import { Response, Router } from 'express';

import { LootController } from '../../controllers/lootController';
import { AuthRequest, authenticate } from '../../middleware/auth';
import { handleFileUploadError, imageUploadConfig } from '../../middleware/fileValidation';
import { requirePermission } from '../../middleware/permissionMiddleware';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { ResourceType } from '../../models/OrganizationPermission';
import { lootSchemas } from '../../schemas/lootSchemas';

const router = Router();

// Lazy initialization to avoid circular dependency issues
let lootController: LootController;
const getController = (): LootController => {
  if (!lootController) {
    lootController = new LootController();
  }
  return lootController;
};

// All loot routes require authentication + org context.
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];
// Creating a pool still requires LOOT:manage permission.
// Pool-scoped actions are authorized in the service layer for leader/creator/assistants.
const manage = requirePermission(ResourceType.LOOT, 'manage');

// ==================== POOLS ====================

router.get('/pools', ...orgAuth, validateSchema(lootSchemas.listQuery, 'query'), (req, res) =>
  getController().listPools(req, res)
);

router.post(
  '/pools',
  ...orgAuth,
  manage,
  validateSchema(lootSchemas.createPool, 'body'),
  (req, res) => getController().createPool(req, res)
);

router.get(
  '/pools/:poolId',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  (req, res) => getController().getPool(req, res)
);

router.get(
  '/pools/:poolId/participants',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  (req, res) => getController().getEligibleParticipants(req, res)
);

router.patch(
  '/pools/:poolId',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  validateSchema(lootSchemas.updatePool, 'body'),
  (req, res) => getController().updatePool(req, res)
);

router.post(
  '/pools/:poolId/lock',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  (req, res) => getController().lockPool(req, res)
);

router.post(
  '/pools/:poolId/cancel',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  (req, res) => getController().cancelPool(req, res)
);

router.post(
  '/pools/:poolId/distribute',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  (req, res) => getController().distributePool(req, res)
);

router.post(
  '/pools/:poolId/retry-distribution',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  (req, res) => getController().retryDistribution(req, res)
);

// ==================== ITEMS ====================

router.post(
  '/pools/:poolId/items',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  validateSchema(lootSchemas.addItem, 'body'),
  (req, res) => getController().addItem(req, res)
);

router.post(
  '/pools/:poolId/items/bulk',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  validateSchema(lootSchemas.addItemsBulk, 'body'),
  (req, res) => getController().addItemsBulk(req, res)
);

router.patch(
  '/pools/:poolId/items/:itemId',
  ...orgAuth,
  validateSchema(lootSchemas.itemParam, 'params'),
  validateSchema(lootSchemas.updateItem, 'body'),
  (req, res) => getController().updateItem(req, res)
);

router.delete(
  '/pools/:poolId/items/:itemId',
  ...orgAuth,
  validateSchema(lootSchemas.itemParam, 'params'),
  (req, res) => getController().removeItem(req, res)
);

router.post(
  '/pools/:poolId/items/:itemId/assign',
  ...orgAuth,
  validateSchema(lootSchemas.itemParam, 'params'),
  validateSchema(lootSchemas.assignItem, 'body'),
  (req, res) => getController().assignItem(req, res)
);

// ==================== CLAIMS (participant actions) ====================
// Claiming/bidding only requires being an authenticated member; the service
// enforces that the user was an active participant of the mission.

router.post(
  '/pools/:poolId/items/:itemId/claim',
  ...orgAuth,
  validateSchema(lootSchemas.itemParam, 'params'),
  validateSchema(lootSchemas.claim, 'body'),
  (req, res) => getController().claimItem(req, res)
);

router.delete(
  '/pools/:poolId/items/:itemId/claim',
  ...orgAuth,
  validateSchema(lootSchemas.itemParam, 'params'),
  (req, res) => getController().withdrawClaim(req, res)
);

// ==================== OCR ====================

router.post(
  '/pools/:poolId/ocr/scan',
  ...orgAuth,
  validateSchema(lootSchemas.poolParam, 'params'),
  imageUploadConfig.single('image'),
  handleFileUploadError,
  (req: AuthRequest, res: Response) => getController().scanImageForPool(req, res)
);

router.post(
  '/ocr/scan',
  ...orgAuth,
  manage,
  imageUploadConfig.single('image'),
  handleFileUploadError,
  (req: AuthRequest, res: Response) => getController().scanImage(req, res)
);

export { router };
