import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { RoleRequestService } from '../../services/organization/RoleRequestService';
import { BaseController } from '../BaseController';

/**
 * Role Request Controller (v2)
 *
 * HTTP surface for the organization role-change request loop: members request a
 * role, authorized approvers (owner/founder/admin) approve or reject, and an
 * approval auto-grants the role. All authorization and orchestration live in
 * {@link RoleRequestService}; this controller only handles request/response.
 */
export class RoleRequestController extends BaseController {
  private readonly roleRequestService: RoleRequestService;

  constructor() {
    super();
    this.roleRequestService = new RoleRequestService();
  }

  /** GET /api/v2/role-requests/pending — pending requests for an approver. */
  listPending = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const approvals = await this.roleRequestService.listPendingForApprover(
        organizationId,
        user.id
      );

      res.json({ success: true, data: approvals });
    });
  };

  /** POST /api/v2/role-requests — request a role change. */
  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { roleId, reason } = req.body as { roleId: string; reason?: string };

      const approval = await this.roleRequestService.requestRoleChange(
        organizationId,
        user.id,
        roleId,
        reason
      );

      res.status(201).json({ success: true, data: approval });
    });
  };

  /** POST /api/v2/role-requests/:approvalId/approve — approve + auto-grant. */
  approve = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { approvalId } = req.params;
      const { comment } = req.body as { comment?: string };

      const approval = await this.roleRequestService.approveRoleChange(
        organizationId,
        approvalId,
        user.id,
        comment
      );

      res.json({ success: true, data: approval });
    });
  };

  /** POST /api/v2/role-requests/:approvalId/reject — reject the request. */
  reject = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { approvalId } = req.params;
      const { reason } = req.body as { reason: string };

      const approval = await this.roleRequestService.rejectRoleChange(
        organizationId,
        approvalId,
        user.id,
        reason
      );

      res.json({ success: true, data: approval });
    });
  };
}
