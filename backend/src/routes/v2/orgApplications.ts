/**
 * Organization Application Routes (API v2)
 *
 * Endpoints for the organization join-application workflow:
 * - Submit application (any authenticated user)
 * - List applications (admin with RECRUITMENT.APPROVE)
 * - Review application (admin with RECRUITMENT.APPROVE)
 * - Withdraw application (applicant)
 * - Check active application status
 * - Get user's own applications
 *
 * All routes require authentication.
 */

import { Request, Response, Router } from 'express';

import { OrgApplicationController } from '../../controllers/orgApplicationController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { orgApplicationSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let orgApplicationController: OrgApplicationController;
const getController = (): OrgApplicationController => {
  if (!orgApplicationController) {
    orgApplicationController = new OrgApplicationController();
  }
  return orgApplicationController;
};

// ==================== USER'S OWN APPLICATIONS ====================

/**
 * GET /api/v2/users/me/org-applications
 * Get current user's org applications
 */
router.get('/users/me/org-applications', authenticate, (req: Request, res: Response) =>
  getController().getMyApplications(req, res)
);

// ==================== APPLICATION MODE ====================

/**
 * GET /api/v2/organizations/:orgId/application-mode
 * Get the application mode for an organization (simple/custom/discord)
 */
router.get('/organizations/:orgId/application-mode', (req: Request, res: Response) =>
  getController().getApplicationMode(req, res)
);

// ==================== ORG APPLICATION CRUD ====================

/**
 * POST /api/v2/organizations/:orgId/applications
 * Submit an application to join an organization
 */
router.post(
  '/organizations/:orgId/applications',
  authenticate,
  validateSchema(orgApplicationSchemas.submit, 'body'),
  (req: Request, res: Response) => getController().submitApplication(req, res)
);

/**
 * GET /api/v2/organizations/:orgId/applications
 * List applications for an organization (admin)
 */
router.get(
  '/organizations/:orgId/applications',
  authenticate,
  validateSchema(orgApplicationSchemas.listQuery, 'query'),
  (req: Request, res: Response) => getController().getApplications(req, res)
);

/**
 * GET /api/v2/organizations/:orgId/applications/check
 * Check if user has an active application for the org
 */
router.get(
  '/organizations/:orgId/applications/check',
  authenticate,
  (req: Request, res: Response) => getController().checkActiveApplication(req, res)
);

/**
 * PATCH /api/v2/organizations/:orgId/applications/:id/review
 * Review (approve/reject) a pending application (admin)
 */
router.patch(
  '/organizations/:orgId/applications/:id/review',
  authenticate,
  validateSchema(orgApplicationSchemas.review, 'body'),
  (req: Request, res: Response) => getController().reviewApplication(req, res)
);

/**
 * POST /api/v2/organizations/:orgId/applications/:id/withdraw
 * Withdraw own pending application
 */
router.post(
  '/organizations/:orgId/applications/:id/withdraw',
  authenticate,
  (req: Request, res: Response) => getController().withdrawApplication(req, res)
);

export { router };
