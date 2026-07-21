import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { ApprovalRequestType } from '../../models/ApprovalRequest';
import { ApprovalService } from '../../services/approval/ApprovalService';
import { ForbiddenError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

// String widening of the enum for a safe (non-enum) comparison.
const ROLE_CHANGE_TYPE: string = ApprovalRequestType.ROLE_CHANGE;

/**
 * Approval Controller (v2)
 *
 * Manages org-scoped approval workflows — generic approval requests
 * for membership changes, resource access, fleet modifications, etc.
 */
export class ApprovalController extends BaseController {
  private readonly approvalService: ApprovalService;

  constructor() {
    super();
    this.approvalService = new ApprovalService();
  }

  /**
   * Role-change approvals are managed exclusively through the dedicated
   * /api/v2/role-requests endpoints, which enforce approver authority and the
   * atomic auto-grant. Block them on the generic approval surface so a member
   * without role-management authority cannot transition them (or forge their
   * audit trail) here.
   */
  private async assertNotRoleChange(organizationId: string, approvalId: string): Promise<void> {
    const approval = await this.approvalService.getApproval(approvalId, organizationId);
    if (approval?.type === ROLE_CHANGE_TYPE) {
      throw new ForbiddenError('Role change requests must be managed via /api/v2/role-requests');
    }
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { status, type, assignedTo } = req.query as Record<string, string>;
      const { page, limit } = this.getPaginationParams(req);

      const { approvals, total } = await this.approvalService.listApprovals(organizationId, {
        status,
        type,
        assignedTo,
      });

      res.json({
        success: true,
        ...this.createPaginatedResponse(approvals, total, page, limit),
      });
    });
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const approval = await this.approvalService.createApproval(organizationId, user.id, req.body);

      res.status(201).json({ success: true, data: approval });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { approvalId } = req.params;

      const approval = await this.approvalService.getApproval(approvalId, organizationId);
      if (!approval) {
        res.status(404).json({ success: false, error: 'Approval request not found' });
        return;
      }

      res.json({ success: true, data: approval });
    });
  };

  approve = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { approvalId } = req.params;
      const { comment } = req.body as { comment?: string };

      await this.assertNotRoleChange(organizationId, approvalId);

      const approval = await this.approvalService.approve(
        approvalId,
        organizationId,
        user.id,
        comment
      );

      res.json({ success: true, data: approval });
    });
  };

  reject = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { approvalId } = req.params;
      const { reason } = req.body as { reason?: string };

      await this.assertNotRoleChange(organizationId, approvalId);

      const approval = await this.approvalService.reject(
        approvalId,
        organizationId,
        user.id,
        reason
      );

      res.json({ success: true, data: approval });
    });
  };

  delegate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { approvalId } = req.params;
      const { userId } = req.body as { userId: string };

      await this.assertNotRoleChange(organizationId, approvalId);

      const approval = await this.approvalService.delegate(
        approvalId,
        organizationId,
        user.id,
        userId
      );

      res.json({ success: true, data: approval });
    });
  };

  getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { approvalId } = req.params;

      const approval = await this.approvalService.getApproval(approvalId, organizationId);
      if (!approval) {
        res.status(404).json({ success: false, error: 'Approval request not found' });
        return;
      }

      res.json({
        success: true,
        data: { approvalId, history: approval.history ?? [] },
      });
    });
  };

  getPending = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const pending = await this.approvalService.getPending(organizationId, user.id);

      res.json({ success: true, data: pending });
    });
  };
}
