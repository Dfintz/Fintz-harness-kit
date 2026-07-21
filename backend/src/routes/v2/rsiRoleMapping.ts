/**
 * RSI Role Mapping Routes (API v2)
 *
 * RSI rank to Discord role and permission mapping endpoints supporting:
 * - Template management
 * - Organization-scoped role mappings
 * - Mapping creation, updates, and deletion
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { RsiRoleMappingController } from '../../controllers/rsiRoleMappingController';
import { botOrUserAuth } from '../../middleware/botOrUserAuth';
import { validateSchema } from '../../middleware/schemaValidation';
import { rsiRoleMappingSchemas } from '../../schemas/rsiRoleMappingSchemas';

const router = Router();

// Apply authentication to all RSI role mapping routes
// botOrUserAuth accepts both JWT (browser) and bot-internal-token (Discord bot)
router.use(botOrUserAuth);

// Lazy initialization to avoid EntityMetadataNotFoundError
let roleMappingController: RsiRoleMappingController;
const getController = () => {
  if (!roleMappingController) {
    roleMappingController = new RsiRoleMappingController();
  }
  return roleMappingController;
};

// ==================== TEMPLATE ROUTES ====================

/**
 * GET /api/v2/rsi-role-mappings/templates
 * Get available role mapping templates
 * Returns: list of predefined mapping templates
 */
router.get('/templates', (req: Request, res: Response) => getController().getTemplates(req, res));

/**
 * GET /api/v2/rsi-role-mappings/templates/:templateName
 * Get details for a specific template
 * Requires: valid template name
 */
router.get('/templates/:templateName', (req: Request, res: Response) =>
  getController().getTemplateDetails(req, res)
);

// ==================== ORGANIZATION-SCOPED ROUTES ====================

/**
 * GET /api/v2/rsi-role-mappings/:organizationId
 * Get all role mappings for an organization
 * Query parameters: filters, sorting, pagination
 */
router.get(
  '/:organizationId',
  validateSchema(rsiRoleMappingSchemas.listMappingsQuery, 'query'),
  (req: Request, res: Response) => getController().getMappings(req, res)
);

/**
 * GET /api/v2/rsi-role-mappings/:organizationId/discovered-ranks
 * Get RSI rank names and star numbers discovered from crawled members
 * Returns: { roles: string[], ranks: number[] }
 */
router.get('/:organizationId/discovered-ranks', (req: Request, res: Response) =>
  getController().getDiscoveredRanks(req, res)
);

/**
 * GET /api/v2/rsi/role-mapping/:organizationId/preview
 * Read-only dry-run preview of applying the current role mappings.
 * Registered before /:organizationId/:id so "preview" is not matched as an id.
 * Returns: { entries, warnings, summary }
 */
router.get('/:organizationId/preview', (req: Request, res: Response) =>
  getController().getSyncPreview(req, res)
);

/**
 * GET /api/v2/rsi-role-mappings/:organizationId/summary
 * Get mapping summary for an organization
 * Returns: overview of all role mappings
 */
router.get('/:organizationId/summary', (req: Request, res: Response) =>
  getController().getSummary(req, res)
);

/**
 * GET /api/v2/rsi-role-mappings/:organizationId/:id
 * Get a specific role mapping
 * Requires: valid UUIDs for organization and mapping
 */
router.get('/:organizationId/:id', (req: Request, res: Response) =>
  getController().getMapping(req, res)
);

/**
 * POST /api/v2/rsi-role-mappings/:organizationId
 * Create a new role mapping
 * Request body: mapping configuration data
 */
router.post(
  '/:organizationId',
  validateSchema(rsiRoleMappingSchemas.createMapping, 'body'),
  (req: Request, res: Response) => getController().createMapping(req, res)
);

/**
 * PUT /api/v2/rsi-role-mappings/:organizationId/:id
 * Update an existing role mapping
 * Request body: updated mapping data
 */
router.put(
  '/:organizationId/:id',
  validateSchema(rsiRoleMappingSchemas.updateMapping, 'body'),
  (req: Request, res: Response) => getController().updateMapping(req, res)
);

/**
 * DELETE /api/v2/rsi-role-mappings/:organizationId/:id
 * Delete a role mapping
 * Requires: valid UUIDs for organization and mapping
 */
router.delete('/:organizationId/:id', (req: Request, res: Response) =>
  getController().deleteMapping(req, res)
);

export { router };
