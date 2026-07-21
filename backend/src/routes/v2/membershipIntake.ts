/**
 * Membership Intake Routes (API v2)
 *
 * Unified "membership inbox" — one surface for the three member-acquisition
 * queues: organization join applications, invitations, and recruitment-post
 * applicants.
 *
 * All routes require authentication; per-source visibility (RECRUITMENT.APPROVE
 * and/or MEMBERS.MANAGE) is enforced inside MembershipIntakeService.
 */

import { Request, Response, Router } from 'express';

import { MembershipIntakeController } from '../../controllers/membershipIntakeController';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let membershipIntakeController: MembershipIntakeController;
const getController = (): MembershipIntakeController => {
  if (!membershipIntakeController) {
    membershipIntakeController = new MembershipIntakeController();
  }
  return membershipIntakeController;
};

/**
 * GET /api/v2/organizations/:orgId/membership/inbox
 * Unified pending membership intake for org admins.
 */
router.get('/organizations/:orgId/membership/inbox', authenticate, (req: Request, res: Response) =>
  getController().getInbox(req, res)
);

export { router };
