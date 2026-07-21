/**
 * Invitation Routes (API v2)
 *
 * Endpoints for the push-based invitation workflow:
 * - Send invitation (org members with MEMBERS.INVITE)
 * - List invitations (admin with MEMBERS.MANAGE)
 * - Approve/reject invitation (admin)
 * - Accept/decline invitation (invitee, via token)
 * - Get user's received invitations
 *
 * All routes require authentication.
 */

import { Request, Response, Router } from 'express';

import { InvitationController } from '../../controllers/invitationController';
import { authenticate } from '../../middleware/auth';
import { botOrUserAuth } from '../../middleware/botOrUserAuth';
import { organizationInvitationRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { invitationSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let invitationController: InvitationController;
const getController = (): InvitationController => {
  if (!invitationController) {
    invitationController = new InvitationController();
  }
  return invitationController;
};

// ==================== USER'S RECEIVED INVITATIONS ====================

/**
 * GET /api/v2/users/me/invitations
 * Get current user's received invitations
 */
router.get('/users/me/invitations', botOrUserAuth, (req: Request, res: Response) =>
  getController().getMyInvitations(req, res)
);

// ==================== INVITEE ACTIONS (by token) ====================

/**
 * POST /api/v2/invitations/:token/accept
 * Accept an invitation
 */
router.post('/invitations/:token/accept', authenticate, (req: Request, res: Response) =>
  getController().acceptInvitation(req, res)
);

/**
 * POST /api/v2/invitations/:token/decline
 * Decline an invitation
 */
router.post('/invitations/:token/decline', authenticate, (req: Request, res: Response) =>
  getController().declineInvitation(req, res)
);

/**
 * POST /api/v2/invitations/code/:code/accept
 * Accept an invitation by short invite code
 */
router.post('/invitations/code/:code/accept', botOrUserAuth, (req: Request, res: Response) =>
  getController().acceptInvitationByCode(req, res)
);

/**
 * POST /api/v2/invitations/code/:code/decline
 * Decline an invitation by short invite code
 */
router.post('/invitations/code/:code/decline', botOrUserAuth, (req: Request, res: Response) =>
  getController().declineInvitationByCode(req, res)
);

// ==================== ORG INVITATION MANAGEMENT ====================

/**
 * POST /api/v2/organizations/:orgId/invitations
 * Send an invitation to join an organization
 */
router.post(
  '/organizations/:orgId/invitations',
  authenticate,
  organizationInvitationRateLimiter,
  validateSchema(invitationSchemas.send, 'body'),
  (req: Request, res: Response) => getController().sendInvitation(req, res)
);

/**
 * GET /api/v2/organizations/:orgId/invitations
 * List invitations for an organization (admin)
 */
router.get(
  '/organizations/:orgId/invitations',
  authenticate,
  validateSchema(invitationSchemas.listQuery, 'query'),
  (req: Request, res: Response) => getController().getInvitations(req, res)
);

/**
 * PATCH /api/v2/organizations/:orgId/invitations/:id/approve
 * Approve a member-sent invitation (admin)
 */
router.patch(
  '/organizations/:orgId/invitations/:id/approve',
  authenticate,
  (req: Request, res: Response) => getController().approveInvitation(req, res)
);

/**
 * PATCH /api/v2/organizations/:orgId/invitations/:id/reject
 * Reject a member-sent invitation (admin)
 */
router.patch(
  '/organizations/:orgId/invitations/:id/reject',
  authenticate,
  (req: Request, res: Response) => getController().rejectInvitation(req, res)
);

export { router };
