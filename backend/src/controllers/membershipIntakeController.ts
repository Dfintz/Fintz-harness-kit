import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { MembershipIntakeService } from '../services/organization/MembershipIntakeService';

import { BaseController } from './BaseController';

/**
 * Controller for the unified membership intake inbox.
 *
 * Consolidates organization join applications, invitations, and recruitment-post
 * applicants into one surface. Visibility is least-privilege per source
 * (RECRUITMENT.APPROVE for applications/recruitment applicants, MEMBERS.MANAGE
 * for invitations) — enforced inside MembershipIntakeService.
 */
export class MembershipIntakeController extends BaseController {
  private readonly service = new MembershipIntakeService();

  /**
   * GET /api/v2/organizations/:orgId/membership/inbox
   * Returns the org's pending membership intake queue for an authorized admin.
   */
  public getInbox = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      const inbox = await this.service.getInbox(user.id, orgId);
      return { success: true, data: inbox };
    });
  };
}
