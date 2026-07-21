import { Router } from 'express';

import { TagController } from '../../controllers/v2/tagController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { tagSchemas } from '../../schemas/tagSchemas';

const router = Router();

let tagController: TagController;
const getController = () => {
  if (!tagController) {
    tagController = new TagController();
  }
  return tagController;
};

// ==================== TAGS & LABELS ====================

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

/**
 * GET /api/v2/tags/popular
 * Get popular tags (must be before :tagId)
 */
router.get('/popular', ...orgAuth, validateSchema(tagSchemas.query, 'query'), (req, res) =>
  getController().getPopularTags(req, res)
);

/**
 * GET /api/v2/tags
 * List all tags for the organization
 */
router.get('/', ...orgAuth, validateSchema(tagSchemas.query, 'query'), (req, res) =>
  getController().listTags(req, res)
);

/**
 * POST /api/v2/tags
 * Create a new tag
 */
router.post('/', ...orgAuth, validateSchema(tagSchemas.create, 'body'), (req, res) =>
  getController().createTag(req, res)
);

/**
 * GET /api/v2/tags/:tagId
 * Get a specific tag
 */
router.get('/:tagId', ...orgAuth, validateSchema(tagSchemas.param, 'params'), (req, res) =>
  getController().getTag(req, res)
);

/**
 * PUT /api/v2/tags/:tagId
 * Update a tag
 */
router.put(
  '/:tagId',
  ...orgAuth,
  validateSchema(tagSchemas.param, 'params'),
  validateSchema(tagSchemas.update, 'body'),
  (req, res) => getController().updateTag(req, res)
);

/**
 * DELETE /api/v2/tags/:tagId
 * Delete a tag
 */
router.delete('/:tagId', ...orgAuth, validateSchema(tagSchemas.param, 'params'), (req, res) =>
  getController().deleteTag(req, res)
);

/**
 * POST /api/v2/tags/:tagId/apply
 * Apply tag to a resource
 */
router.post(
  '/:tagId/apply',
  ...orgAuth,
  validateSchema(tagSchemas.param, 'params'),
  validateSchema(tagSchemas.apply, 'body'),
  (req, res) => getController().applyTag(req, res)
);

/**
 * DELETE /api/v2/tags/:tagId/remove
 * Remove tag from a resource
 */
router.delete(
  '/:tagId/remove',
  ...orgAuth,
  validateSchema(tagSchemas.param, 'params'),
  validateSchema(tagSchemas.remove, 'body'),
  (req, res) => getController().removeTag(req, res)
);

export { router };
