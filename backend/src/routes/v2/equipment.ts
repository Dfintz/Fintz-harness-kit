import { Router } from 'express';

import { EquipmentController } from '../../controllers/v2/equipmentController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { equipmentSchemas } from '../../schemas/equipmentSchemas';

const router = Router();

let equipmentController: EquipmentController;
const getController = () => {
  if (!equipmentController) {
    equipmentController = new EquipmentController();
  }
  return equipmentController;
};

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ==================== EQUIPMENT & GEAR ====================

/**
 * GET /api/v2/equipment/user/:userId
 * Get user equipment inventory (must be before /:equipmentId)
 */
router.get(
  '/user/:userId',
  ...orgAuth,
  validateSchema(equipmentSchemas.userParam, 'params'),
  (req, res) => getController().getUserInventory(req, res)
);

/**
 * GET /api/v2/equipment
 * Get all equipment
 * Query: type, rarity, availability
 */
router.get('/', ...orgAuth, validateSchema(equipmentSchemas.query, 'query'), (req, res) =>
  getController().list(req, res)
);

/**
 * POST /api/v2/equipment
 * Create equipment
 * Request body: equipment data
 */
router.post('/', ...orgAuth, validateSchema(equipmentSchemas.create, 'body'), (req, res) =>
  getController().create(req, res)
);

/**
 * GET /api/v2/equipment/:equipmentId
 * Get specific equipment
 */
router.get(
  '/:equipmentId',
  ...orgAuth,
  validateSchema(equipmentSchemas.param, 'params'),
  (req, res) => getController().getById(req, res)
);

/**
 * PUT /api/v2/equipment/:equipmentId
 * Update equipment
 */
router.put(
  '/:equipmentId',
  ...orgAuth,
  validateSchema(equipmentSchemas.param, 'params'),
  validateSchema(equipmentSchemas.update, 'body'),
  (req, res) => getController().update(req, res)
);

/**
 * DELETE /api/v2/equipment/:equipmentId
 * Delete equipment
 */
router.delete(
  '/:equipmentId',
  ...orgAuth,
  validateSchema(equipmentSchemas.param, 'params'),
  (req, res) => getController().delete(req, res)
);

/**
 * GET /api/v2/equipment/:equipmentId/compatibility
 * Check equipment compatibility
 * Query: shipId
 */
router.get(
  '/:equipmentId/compatibility',
  ...orgAuth,
  validateSchema(equipmentSchemas.param, 'params'),
  validateSchema(equipmentSchemas.compatibilityQuery, 'query'),
  (req, res) => getController().checkCompatibility(req, res)
);

/**
 * POST /api/v2/equipment/:equipmentId/transfer
 * Transfer equipment
 * Request body: { toUserId: string }
 */
router.post(
  '/:equipmentId/transfer',
  ...orgAuth,
  validateSchema(equipmentSchemas.param, 'params'),
  validateSchema(equipmentSchemas.transfer, 'body'),
  (req, res) => getController().transfer(req, res)
);

export { router };
