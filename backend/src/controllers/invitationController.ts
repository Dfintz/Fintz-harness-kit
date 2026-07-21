import { Response } from 'express';

import { AppDataSource } from '../data-source';
import { AuthRequest } from '../middleware/auth';
import { InvitationStatus } from '../models/Invitation';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import { InvitationService } from '../services/invitation/InvitationService';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import { requirePermission } from '../utils/permissionHelpers';
import { getRoleName } from '../utils/roleUtils';

import { BaseController } from './BaseController';

/**
 * Controller for organization invitation endpoints.
 *
 * Officers/admins can send invitations directly (auto-approved).
 * Members can send invitations that require admin approval.
 */
export class InvitationController extends BaseController {
  private readonly service = new InvitationService();
  private readonly permissionService = new OrganizationPermissionService();

  // ────────────────── Helper Methods ────────────────────────────────

  /**
   * Verify the authenticated user has MEMBERS.MANAGE permission for the org.
   */
  private async verifyInvitePermission(userId: string, orgId: string): Promise<void> {
    await requirePermission(
      this.permissionService,
      orgId,
      userId,
      ResourceType.MEMBERS,
      PermissionAction.MANAGE,
      {
        customMessage: 'Insufficient permissions to manage invitations',
      }
    );
  }

  /**
   * Determine the inviter's actual membership role in the organization.
   * Reads OrganizationMembership.role directly (owner/admin/officer/member).
   */
  private async getInviterRole(userId: string, orgId: string): Promise<string> {
    const membership = await AppDataSource.getRepository(OrganizationMembership).findOne({
      where: { organizationId: orgId, userId, isActive: true },
    });
    return getRoleName(membership?.role) || 'member';
  }

  // ────────────────── Send Invitation ───────────────────────────

  /**
   * POST /api/v2/organizations/:orgId/invitations
   * Authenticated — any org member can send invitations.
   */
  public sendInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const user = this.getAuthUser(req);
        const { orgId } = req.params;
        const { inviteeUserId, message } = req.body as {
          inviteeUserId: string;
          message?: string;
        };

        const inviterRole = await this.getInviterRole(user.id, orgId);
        const invitation = await this.service.invite(
          orgId,
          inviteeUserId,
          user.id,
          inviterRole,
          message
        );

        // Strip token from response — token is secret, only for invitee via accept/decline
        const { token: _token, ...safeInvitation } = invitation as unknown as Record<
          string,
          unknown
        >;

        return { success: true, data: safeInvitation };
      },
      201
    );
  };

  // ────────────────── List (admin) ──────────────────────────────

  /**
   * GET /api/v2/organizations/:orgId/invitations
   * Authenticated — org admins with MEMBERS.MANAGE permission.
   */
  public getInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      await this.verifyInvitePermission(user.id, orgId);

      // M-09: Runtime validation for status query param (defense-in-depth beyond Joi)
      const rawStatus = req.query.status as string | undefined;
      const status =
        rawStatus && Object.values(InvitationStatus).includes(rawStatus as InvitationStatus)
          ? (rawStatus as InvitationStatus)
          : undefined;
      const page = Number.parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 20, 200);

      const result = await this.service.getInvitationsForOrg(orgId, {
        status,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    });
  };

  // ────────────────── My Invitations ────────────────────────────

  /**
   * GET /api/v2/users/me/invitations
   * Authenticated — returns invitations sent to the current user.
   */
  public getMyInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const invitations = await this.service.getMyInvitations(user.id);

      res.json({
        success: true,
        data: invitations,
      });
    });
  };

  // ────────────────── Admin: Approve / Reject ───────────────────

  /**
   * PATCH /api/v2/organizations/:orgId/invitations/:id/approve
   * Authenticated — org admins (approves a member-sent invitation).
   */
  public approveInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, id } = req.params;
      await this.verifyInvitePermission(user.id, orgId);

      const updated = await this.service.approveInvitation(id, orgId, user.id);

      // Strip token from admin response — token is secret, only for invitee
      const { token: _token, ...safeData } = updated as unknown as Record<string, unknown>;

      res.json({
        success: true,
        message: 'Invitation approved',
        data: safeData,
      });
    });
  };

  /**
   * PATCH /api/v2/organizations/:orgId/invitations/:id/reject
   * Authenticated — org admins (rejects a member-sent invitation).
   */
  public rejectInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, id } = req.params;
      await this.verifyInvitePermission(user.id, orgId);

      const updated = await this.service.rejectInvitation(id, orgId, user.id);

      // Strip token from admin response — token is secret, only for invitee
      const { token: _token, ...safeData } = updated as unknown as Record<string, unknown>;

      res.json({
        success: true,
        message: 'Invitation rejected',
        data: safeData,
      });
    });
  };

  // ────────────────── Invitee: Accept / Decline ─────────────────

  /**
   * POST /api/v2/invitations/:token/accept
   * Authenticated — invitee accepts invitation.
   */
  public acceptInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { token } = req.params;

      const updated = await this.service.acceptByToken(token, user.id);

      // Strip token from response — not needed after acceptance
      const { token: _token, ...safeData } = updated as unknown as Record<string, unknown>;

      res.json({
        success: true,
        message: 'Invitation accepted — you have been added as a member',
        data: safeData,
      });
    });
  };

  /**
   * POST /api/v2/invitations/code/:code/accept
   * Authenticated — invitee accepts invitation via short invite code.
   */
  public acceptInvitationByCode = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { code } = req.params;

      const updated = await this.service.acceptByCode(code, user.id);

      // Strip token from response — not needed after acceptance
      const { token: _token, ...safeData } = updated as unknown as Record<string, unknown>;

      res.json({
        success: true,
        message: 'Invitation accepted — you have been added as a member',
        data: safeData,
      });
    });
  };

  /**
   * POST /api/v2/invitations/:token/decline
   * Authenticated — invitee declines invitation.
   */
  public declineInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { token } = req.params;

      const updated = await this.service.declineByToken(token, user.id);

      // Strip token from response — not needed after decline
      const { token: _token, ...safeData } = updated as unknown as Record<string, unknown>;

      res.json({
        success: true,
        message: 'Invitation declined',
        data: safeData,
      });
    });
  };

  /**
   * POST /api/v2/invitations/code/:code/decline
   * Authenticated — invitee declines invitation via short invite code.
   */
  public declineInvitationByCode = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { code } = req.params;

      const updated = await this.service.declineByCode(code, user.id);

      // Strip token from response — not needed after decline
      const { token: _token, ...safeData } = updated as unknown as Record<string, unknown>;

      res.json({
        success: true,
        message: 'Invitation declined',
        data: safeData,
      });
    });
  };
}
