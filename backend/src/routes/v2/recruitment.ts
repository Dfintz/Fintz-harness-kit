/**
 * Recruitment Routes (API v2)
 *
 * Comprehensive recruitment management endpoints supporting:
 * - Recruitment activity CRUD operations
 * - Recruitment status management
 * - Application submission and review
 * - Discord integration for applications
 * - Invite binding management
 *
 * Authentication requirements vary by endpoint:
 * - Discord apply, my applications: Requires authentication (user must be linked)
 * - Authenticated routes: Requires authentication and tenant context
 */

import { Request, Response, Router } from 'express';

import { RecruitmentController } from '../../controllers/recruitmentController';
import { botOrUserAuth } from '../../middleware/botOrUserAuth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { paramSchemas, recruitmentSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let recruitmentController: RecruitmentController;
const getController = (): RecruitmentController => {
  if (!recruitmentController) {
    recruitmentController = new RecruitmentController();
  }
  return recruitmentController;
};

// ==================== PUBLIC ROUTES ====================

// ==================== DISCORD INTEGRATION ROUTES ====================
// These routes support both authenticated users and Discord header-based identification

/**
 * GET /api/v2/recruitments/my-applications
 * Get user's recruitment applications
 * Requires authentication
 */
router.get('/my-applications', botOrUserAuth, (req: Request, res: Response) =>
  getController().getMyApplications(req, res)
);

/**
 * POST /api/v2/recruitments/:id/discord-apply
 * Submit application via Discord
 * Requires authentication (Discord users must be linked to a platform account)
 */
router.post('/:id/discord-apply', botOrUserAuth, (req: Request, res: Response) =>
  getController().discordApply(req, res)
);

/**
 * POST /api/v2/recruitment/:id/apply
 * Submit an application for a recruitment activity.
 *
 * Requires authentication only — applicants are by definition not yet members of
 * the target organization, so we must NOT enforce `requireTenantContext` here.
 * Tenant context is attached opportunistically for audit logging if the user
 * happens to have an active org context.
 */
router.post(
  '/:id/apply',
  botOrUserAuth,
  tenantContextMiddleware,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.apply, 'body'),
  (req: Request, res: Response) => getController().submitApplication(req, res)
);

// ==================== INVITE BINDING ====================

/**
 * POST /api/v2/recruitments/:id/invite-binding
 * Create invite binding for recruitment
 * Requires authentication and tenant context
 */
router.post(
  '/:id/invite-binding',
  botOrUserAuth,
  tenantContextMiddleware,
  (req: Request, res: Response) => getController().createInviteBinding(req, res)
);

// ==================== AUTHENTICATED ROUTES ====================
// All remaining routes require authentication and tenant context

router.use(botOrUserAuth);
router.use(tenantContextMiddleware);
router.use(requireTenantContext);

// ==================== CRUD OPERATIONS ====================

/**
 * GET /api/v2/recruitments
 * List all recruitment activities
 * Query parameters: pagination, filtering, sorting options
 * Requires schema validation for query parameters
 */
router.get('/', validateSchema(recruitmentSchemas.query, 'query'), (req: Request, res: Response) =>
  getController().listRecruitments(req, res)
);

/**
 * POST /api/v2/recruitments
 * Create a new recruitment activity
 * Request body: recruitment creation data
 * Requires schema validation
 */
router.post('/', validateSchema(recruitmentSchemas.create, 'body'), (req: Request, res: Response) =>
  getController().createRecruitment(req, res)
);

/**
 * GET /api/v2/recruitments/:id
 * Get a specific recruitment activity by ID
 * Requires: valid UUID format for recruitment ID
 */
router.get('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().getRecruitment(req, res)
);

/**
 * PUT /api/v2/recruitments/:id
 * Update a recruitment activity
 * Request body: updated recruitment data
 * Requires: valid UUID and update data validation
 */
router.put(
  '/:id',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateRecruitment(req, res)
);

/**
 * DELETE /api/v2/recruitments/:id
 * Delete a recruitment activity
 * Requires: valid UUID format
 */
router.delete('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().deleteRecruitment(req, res)
);

// ==================== STATUS MANAGEMENT ====================

/**
 * PUT /api/v2/recruitments/:id/status
 * Update recruitment status
 * Request body: { status: string, reason?: string }
 * Requires: valid UUID and status update validation
 */
router.put(
  '/:id/status',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.updateStatus, 'body'),
  (req: Request, res: Response) => getController().updateStatus(req, res)
);

// ==================== APPLICATION MANAGEMENT ====================

// NOTE: POST /:id/apply is registered above the tenant-context guard so users
// who are not yet members of an organization can still apply.

/**
 * GET /api/v2/recruitments/:id/applications
 * List applications for a recruitment activity
 * Query parameters: filtering, sorting, pagination
 * Requires: valid UUID and query validation
 */
router.get(
  '/:id/applications',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.applicationQuery, 'query'),
  (req: Request, res: Response) => getController().listApplications(req, res)
);

/**
 * PUT /api/v2/recruitments/:id/applications/:applicationId
 * Review application (accept/reject/pending)
 * Request body: review decision and notes
 * Requires: valid UUIDs for both recruitment and application
 */
router.put(
  '/:id/applications/:applicationId',
  validateSchema(recruitmentSchemas.applicationParams, 'params'),
  validateSchema(recruitmentSchemas.reviewApplication, 'body'),
  (req: Request, res: Response) => getController().reviewApplication(req, res)
);

export { router };
