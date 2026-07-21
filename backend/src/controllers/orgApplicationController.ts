import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import { OrgApplicationStatus } from '../models/OrgApplication';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import { OrgApplicationService } from '../services/organization/OrgApplicationService';
import { ForbiddenError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Controller for organization join-application endpoints.
 *
 * Any authenticated user can apply; org admins with RECRUITMENT.APPROVE can review.
 */
export class OrgApplicationController extends BaseController {
  private readonly service = new OrgApplicationService();
  private readonly permissionService = new OrganizationPermissionService();

  // ────────────────── Helper Methods ────────────────────────────────

  /**
   * Verify the authenticated user has RECRUITMENT.APPROVE permission for the org.
   */
  private async verifyReviewPermission(userId: string, orgId: string): Promise<void> {
    const result = await this.permissionService.checkPermission(
      userId,
      orgId,
      ResourceType.RECRUITMENT,
      PermissionAction.APPROVE
    );
    if (!result.allowed) {
      throw new ForbiddenError('Insufficient permissions to manage applications');
    }
  }

  // ────────────────── Application Mode ──────────────────────────

  /**
   * GET /api/v2/organizations/:orgId/application-mode
   * Public (no auth required) — returns application mode and questions (if custom form).
   */
  public getApplicationMode = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      const modeInfo = await this.service.getApplicationMode(orgId);
      return { success: true, data: modeInfo };
    });
  };

  // ────────────────── Submit ────────────────────────────────────

  /**
   * POST /api/v2/organizations/:orgId/applications
   * Authenticated — any user can apply.
   */
  public submitApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const user = this.getAuthUser(req);
        const { orgId } = req.params;
        const { message, formResponses, source } = req.body as {
          message?: string;
          formResponses?: Record<string, string>;
          source?: 'web' | 'discord' | 'api';
        };

        const application = await this.service.apply(
          orgId,
          user.id,
          message,
          formResponses,
          source
        );
        return { success: true, data: application };
      },
      201
    );
  };

  // ────────────────── List (admin) ──────────────────────────────

  /**
   * GET /api/v2/organizations/:orgId/applications
   * Authenticated — org admins with RECRUITMENT.APPROVE permission.
   */
  public getApplications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      await this.verifyReviewPermission(user.id, orgId);

      // M-09: Runtime validation for status query param (defense-in-depth beyond Joi)
      const rawStatus = req.query.status as string | undefined;
      const status =
        rawStatus && Object.values(OrgApplicationStatus).includes(rawStatus as OrgApplicationStatus)
          ? (rawStatus as OrgApplicationStatus)
          : undefined;
      const page = Number.parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 20, 200);

      const result = await this.service.getApplicationsForOrg(orgId, {
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

  // ────────────────── My Applications ───────────────────────────

  /**
   * GET /api/v2/users/me/org-applications
   * Authenticated — returns all of the current user's org applications.
   */
  public getMyApplications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const applications = await this.service.getMyApplications(user.id);

      res.json({
        success: true,
        data: applications,
      });
    });
  };

  // ────────────────── Review ────────────────────────────────────

  /**
   * PATCH /api/v2/organizations/:orgId/applications/:id/review
   * Authenticated — org admins with RECRUITMENT.APPROVE permission.
   */
  public reviewApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, id } = req.params;
      await this.verifyReviewPermission(user.id, orgId);

      const { decision, note } = req.body as { decision: 'approved' | 'rejected'; note?: string };

      const updated = await this.service.reviewApplication(id, orgId, user.id, decision, note);

      res.json({
        success: true,
        message: `Application ${decision}`,
        data: updated,
      });
    });
  };

  // ────────────────── Withdraw ──────────────────────────────────

  /**
   * POST /api/v2/organizations/:orgId/applications/:id/withdraw
   * Authenticated — applicant only.
   */
  public withdrawApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { id } = req.params;

      const updated = await this.service.withdrawApplication(id, user.id);

      res.json({
        success: true,
        message: 'Application withdrawn',
        data: updated,
      });
    });
  };

  // ────────────────── Check Active ──────────────────────────────

  /**
   * GET /api/v2/organizations/:orgId/applications/check
   * Authenticated — checks if current user has an active application.
   */
  public checkActiveApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;

      const [hasActive, isMember] = await Promise.all([
        this.service.hasActiveApplication(orgId, user.id),
        this.service.isMember(orgId, user.id),
      ]);

      res.json({
        success: true,
        data: { hasActiveApplication: hasActive, isMember },
      });
    });
  };
}
