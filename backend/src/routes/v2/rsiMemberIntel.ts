/**
 * RSI Member Intel Routes (API v2)
 *
 * Member intelligence endpoints for RSI Sync Enhancements (Wave 3.3).
 * Provides member listing, intel cards, enrichment, audit, and role validation.
 *
 * All routes require authentication.
 * Mounted under: /api/v2/rsi/members/:orgId/intel
 */

import { Request, Response, Router } from 'express';

import { RsiMemberIntelController } from '../../controllers/v2/rsiMemberIntelController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { rsiMemberIntelSchemas } from '../../schemas/rsiMemberIntelSchemas';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Lazy initialization
let controller: RsiMemberIntelController;
const getController = () => {
  if (!controller) {
    controller = new RsiMemberIntelController();
  }
  return controller;
};

/**
 * GET /api/v2/rsi/members/:orgId/intel
 * List all RSI members with intel summary
 */
router.get('/', (req: Request, res: Response) => getController().listMembers(req, res));

/**
 * POST /api/v2/rsi/members/:orgId/intel/enrich-all
 * Batch enrich all members (must be before /:rsiHandle to avoid conflict)
 */
router.post('/enrich-all', (req: Request, res: Response) => getController().enrichAll(req, res));

/**
 * POST /api/v2/rsi/members/:orgId/intel/clear-cache
 * Clear all cached RSI data for the organization
 */
router.post('/clear-cache', (req: Request, res: Response) => getController().clearCache(req, res));

/**
 * POST /api/v2/rsi/members/:orgId/intel/audit
 * Run member audit checks
 */
router.post(
  '/audit',
  validateSchema(rsiMemberIntelSchemas.auditBody, 'body'),
  (req: Request, res: Response) => getController().runAudit(req, res)
);

/**
 * POST /api/v2/rsi/members/:orgId/intel/validate-roles
 * Validate role mappings across all members
 */
router.post(
  '/validate-roles',
  validateSchema(rsiMemberIntelSchemas.validateRolesBody, 'body'),
  (req: Request, res: Response) => getController().validateRoles(req, res)
);

/**
 * GET /api/v2/rsi/members/:orgId/intel/link-candidates
 * Suggest platform users who can be linked to an RSI member
 */
router.get(
  '/link-candidates',
  validateSchema(rsiMemberIntelSchemas.linkCandidatesQuery, 'query'),
  (req: Request, res: Response) => getController().suggestLinkCandidates(req, res)
);

/**
 * GET /api/v2/rsi/members/:orgId/intel/:rsiHandle
 * Get full member intel card
 */
router.get('/:rsiHandle', (req: Request, res: Response) => getController().getMemberCard(req, res));

/**
 * POST /api/v2/rsi/members/:orgId/intel/:rsiHandle/enrich
 * Trigger enrichment for a single member
 */
router.post('/:rsiHandle/enrich', (req: Request, res: Response) =>
  getController().enrichMember(req, res)
);

/**
 * POST /api/v2/rsi/members/:orgId/intel/:rsiHandle/link
 * Manually link an RSI member to a platform user
 */
router.post(
  '/:rsiHandle/link',
  validateSchema(rsiMemberIntelSchemas.manualLinkBody, 'body'),
  (req: Request, res: Response) => getController().manualLink(req, res)
);

/**
 * DELETE /api/v2/rsi/members/:orgId/intel/:rsiHandle/link
 * Remove the link between an RSI member and a platform user
 */
router.delete('/:rsiHandle/link', (req: Request, res: Response) =>
  getController().unlinkMember(req, res)
);

export { router };
