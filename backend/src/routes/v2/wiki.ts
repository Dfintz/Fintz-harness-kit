/**
 * Wiki Routes (API v2)
 *
 * Org knowledge base with Markdown content, hierarchical tree,
 * full-text search (PostgreSQL tsvector), and revision history.
 *
 * All routes require authentication and tenant context.
 */

import { Request, Response, Router } from 'express';

import { WikiController } from '../../controllers/wikiController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { tenantContextMiddleware } from '../../middleware/tenantContext';
import { wikiSchemas } from '../../schemas';

const router = Router();

// Apply authentication and tenant context to all wiki routes
router.use(authenticate);
router.use(tenantContextMiddleware);

// Lazy initialization to avoid EntityMetadataNotFoundError
let wikiController: WikiController;
const getController = () => {
  if (!wikiController) {
    wikiController = new WikiController();
  }
  return wikiController;
};

// ==================== TREE & SEARCH (before :pageId) ====================

/**
 * GET /api/v2/wiki/tree
 * Get hierarchical page tree for the organization
 */
router.get('/tree', (req: Request, res: Response) => getController().getPageTree(req, res));

/**
 * GET /api/v2/wiki/search
 * Full-text search wiki pages (PostgreSQL tsvector)
 * Query: q (required), limit (optional)
 */
router.get('/search', validateSchema(wikiSchemas.search, 'query'), (req: Request, res: Response) =>
  getController().searchPages(req, res)
);

// ==================== CRUD ====================

/**
 * GET /api/v2/wiki/pages
 * List all wiki pages (flat)
 */
router.get('/pages', (req: Request, res: Response) => getController().getAllPages(req, res));

/**
 * POST /api/v2/wiki/pages
 * Create a new wiki page
 */
router.post('/pages', validateSchema(wikiSchemas.create, 'body'), (req: Request, res: Response) =>
  getController().createPage(req, res)
);

/**
 * GET /api/v2/wiki/pages/:pageId
 * Get a specific wiki page by ID or slug
 */
router.get(
  '/pages/:pageId',
  validateSchema(wikiSchemas.pageIdParam, 'params'),
  (req: Request, res: Response) => getController().getPage(req, res)
);

/**
 * PUT /api/v2/wiki/pages/:pageId
 * Update a wiki page (auto-creates revision)
 */
router.put(
  '/pages/:pageId',
  validateSchema(wikiSchemas.pageIdParam, 'params'),
  validateSchema(wikiSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updatePage(req, res)
);

/**
 * DELETE /api/v2/wiki/pages/:pageId
 * Soft-delete a wiki page
 */
router.delete(
  '/pages/:pageId',
  validateSchema(wikiSchemas.pageIdParam, 'params'),
  (req: Request, res: Response) => getController().deletePage(req, res)
);

// ==================== REVISIONS ====================

/**
 * GET /api/v2/wiki/pages/:pageId/revisions
 * Get revision history for a page
 */
router.get(
  '/pages/:pageId/revisions',
  validateSchema(wikiSchemas.pageIdParam, 'params'),
  (req: Request, res: Response) => getController().getRevisions(req, res)
);

/**
 * GET /api/v2/wiki/pages/:pageId/revisions/:revisionId
 * Get a specific revision
 */
router.get(
  '/pages/:pageId/revisions/:revisionId',
  validateSchema(wikiSchemas.revisionIdParam, 'params'),
  (req: Request, res: Response) => getController().getRevision(req, res)
);

/**
 * POST /api/v2/wiki/pages/:pageId/restore
 * Restore a specific revision as the current content
 * Body: { revisionId: string }
 */
router.post(
  '/pages/:pageId/restore',
  validateSchema(wikiSchemas.pageIdParam, 'params'),
  validateSchema(wikiSchemas.restore, 'body'),
  (req: Request, res: Response) => getController().restoreRevision(req, res)
);

// ==================== MOVE ====================

/**
 * PUT /api/v2/wiki/pages/:pageId/move
 * Move a page within the tree
 * Body: { parentPageId: string | null, sortOrder: number }
 */
router.put(
  '/pages/:pageId/move',
  validateSchema(wikiSchemas.pageIdParam, 'params'),
  validateSchema(wikiSchemas.move, 'body'),
  (req: Request, res: Response) => getController().movePage(req, res)
);

export { router };
