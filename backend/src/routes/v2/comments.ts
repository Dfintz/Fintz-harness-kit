import { Router } from 'express';

import { CommentController } from '../../controllers/v2/commentController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { commentSchemas } from '../../schemas/commentSchemas';

const router = Router();

let commentController: CommentController;
const getController = () => {
  if (!commentController) {
    commentController = new CommentController();
  }
  return commentController;
};

// ==================== COMMENTS ====================

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

/**
 * GET /api/v2/comments
 * Get comments for a resource
 */
router.get('/', ...orgAuth, validateSchema(commentSchemas.query, 'query'), (req, res) =>
  getController().listComments(req, res)
);

/**
 * POST /api/v2/comments
 * Create a comment
 */
router.post('/', ...orgAuth, validateSchema(commentSchemas.create, 'body'), (req, res) =>
  getController().createComment(req, res)
);

/**
 * GET /api/v2/comments/:commentId
 * Get a specific comment
 */
router.get('/:commentId', ...orgAuth, validateSchema(commentSchemas.param, 'params'), (req, res) =>
  getController().getComment(req, res)
);

/**
 * PUT /api/v2/comments/:commentId
 * Update a comment
 */
router.put(
  '/:commentId',
  ...orgAuth,
  validateSchema(commentSchemas.param, 'params'),
  validateSchema(commentSchemas.update, 'body'),
  (req, res) => getController().updateComment(req, res)
);

/**
 * DELETE /api/v2/comments/:commentId
 * Delete a comment (soft delete)
 */
router.delete(
  '/:commentId',
  ...orgAuth,
  validateSchema(commentSchemas.param, 'params'),
  (req, res) => getController().deleteComment(req, res)
);

/**
 * POST /api/v2/comments/:commentId/reply
 * Reply to a comment
 */
router.post(
  '/:commentId/reply',
  ...orgAuth,
  validateSchema(commentSchemas.param, 'params'),
  validateSchema(commentSchemas.reply, 'body'),
  (req, res) => getController().replyToComment(req, res)
);

/**
 * POST /api/v2/comments/:commentId/like
 * Like a comment
 */
router.post(
  '/:commentId/like',
  ...orgAuth,
  validateSchema(commentSchemas.param, 'params'),
  (req, res) => getController().likeComment(req, res)
);

/**
 * DELETE /api/v2/comments/:commentId/like
 * Unlike a comment
 */
router.delete(
  '/:commentId/like',
  ...orgAuth,
  validateSchema(commentSchemas.param, 'params'),
  (req, res) => getController().unlikeComment(req, res)
);

/**
 * GET /api/v2/comments/:commentId/replies
 * Get replies to a comment
 */
router.get(
  '/:commentId/replies',
  ...orgAuth,
  validateSchema(commentSchemas.param, 'params'),
  (req, res) => getController().getReplies(req, res)
);

export { router };
