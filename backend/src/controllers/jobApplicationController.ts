import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { JobApplicationStatus, JobApplicationType } from '../models/JobApplication';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import { ListingOwnerType } from '../models/PublicJobListing';
import {
  ApplyToJobInput,
  JobApplicationService,
  ReviewApplicationInput,
} from '../services/organization/JobApplicationService';
import { OrganizationFederationService } from '../services/organization/OrganizationFederationService';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import { PublicJobListingService } from '../services/organization/PublicJobListingService';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/apiErrors';
import { requirePermission } from '../utils/permissionHelpers';

import { BaseController } from './BaseController';

/**
 * Controller for job application endpoints.
 *
 * Public users can apply; listing owners can review.
 */
export class JobApplicationController extends BaseController {
  private readonly appService = new JobApplicationService();
  private readonly jobService = new PublicJobListingService();
  private readonly permissionService = new OrganizationPermissionService();
  private readonly federationService = OrganizationFederationService.getInstance();

  // ────────────────── Helper Methods ────────────────────────────────

  /**
   * Extract and validate authenticated user ID from request
   * @throws UnauthorizedError if user is not authenticated
   */
  private getAuthenticatedUserId(req: AuthRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }
    return userId;
  }

  // ────────────────── Apply ─────────────────────────────────────

  /**
   * POST /api/jobs/:jobId/apply
   * Authenticated — any user can apply.
   */
  public applyToJob = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthenticatedUserId(req);

      const { jobId } = req.params;
      const {
        applicationType,
        message,
        shipIndex,
        roleIndex,
        passengerShipIndex,
        passengerRole,
        vehicleName,
        formResponses,
      } = req.body as {
        applicationType: string;
        message?: string;
        shipIndex?: number;
        roleIndex?: number;
        passengerShipIndex?: number;
        passengerRole?: string;
        vehicleName?: string;
        formResponses?: Record<string, string>;
      };

      // Use display name from auth token
      const displayName = req.user?.username ?? 'Unknown';

      const input: ApplyToJobInput = {
        jobListingId: jobId,
        applicantUserId: userId,
        applicantDisplayName: displayName,
        applicationType: applicationType as JobApplicationType,
        message,
        shipIndex,
        roleIndex,
        passengerShipIndex,
        passengerRole,
        vehicleName,
        formResponses,
      };

      const application = await this.appService.apply(input);

      res.status(201).json({
        success: true,
        message:
          application.status === JobApplicationStatus.WAITLISTED
            ? 'You have been added to the waitlist'
            : 'Application submitted successfully',
        data: application,
      });
    });
  };

  // ────────────────── Review (approve / reject / waitlist) ──────

  /**
   * PATCH /api/jobs/:jobId/applications/:applicationId/review
   * Authenticated — listing owner / org admin only.
   */
  public reviewApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthenticatedUserId(req);

      const { jobId, applicationId } = req.params;
      await this.requireListingAccess(userId, jobId);

      const { status, reviewNote } = req.body as {
        status: string;
        reviewNote?: string;
      };
      const input: ReviewApplicationInput = {
        status: status as ReviewApplicationInput['status'],
        reviewedBy: userId,
        reviewNote,
      };

      const updated = await this.appService.reviewApplication(applicationId, input);

      res.json({
        success: true,
        message: `Application ${status}`,
        data: updated,
      });
    });
  };

  // ────────────────── Withdraw ──────────────────────────────────

  /**
   * POST /api/jobs/:jobId/applications/:applicationId/withdraw
   * Authenticated — applicant only.
   */
  public withdrawApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthenticatedUserId(req);

      const { applicationId } = req.params;
      const updated = await this.appService.withdrawApplication(applicationId, userId);

      res.json({
        success: true,
        message: 'Application withdrawn',
        data: updated,
      });
    });
  };

  // ────────────────── List applications ─────────────────────────

  /**
   * GET /api/jobs/:jobId/applications
   * Authenticated — listing owner / org admin.
   */
  public getApplicationsForJob = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthenticatedUserId(req);

      const { jobId } = req.params;
      await this.requireListingAccess(userId, jobId);

      const statusFilter = req.query.status as string | undefined as
        | JobApplicationStatus
        | undefined;
      const applications = await this.appService.getApplicationsForJob(jobId, statusFilter);

      res.json({
        success: true,
        data: applications,
      });
    });
  };

  /**
   * GET /api/jobs/:jobId/applications/my
   * Authenticated — returns the current user's application for this listing.
   */
  public getMyApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthenticatedUserId(req);

      const { jobId } = req.params;
      const application = await this.appService.hasUserApplied(userId, jobId);

      res.json({
        success: true,
        data: application,
      });
    });
  };

  /**
   * GET /api/my/applications
   * Authenticated — returns all of the current user's applications.
   */
  public getMyApplications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthenticatedUserId(req);

      const applications = await this.appService.getApplicationsByUser(userId);

      res.json({
        success: true,
        data: applications,
      });
    });
  };

  /**
   * GET /api/jobs/:jobId/waitlist
   * Authenticated — listing owner / org admin.
   */
  public getWaitlist = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = this.getAuthenticatedUserId(req);

      const { jobId } = req.params;
      await this.requireListingAccess(userId, jobId);

      const waitlist = await this.appService.getWaitlist(jobId);

      res.json({
        success: true,
        data: waitlist,
      });
    });
  };

  // ────────────────── Helpers ───────────────────────────────────

  /**
   * Verify the authenticated user has management access to the listing.
   * Updated to:
   * 1. Use internal method to access inactive/expired listings
   * 2. Handle ALLIANCE owner type authorization properly
   */
  private async requireListingAccess(userId: string, jobId: string): Promise<void> {
    // Use internal method to bypass visibility checks for management
    const job = await this.jobService.getJobListingInternal(jobId);
    if (!job) {
      throw new NotFoundError('Job listing');
    }

    // Handle ORGANIZATION ownership
    if (job.ownerType === ListingOwnerType.ORGANIZATION && job.organizationId) {
      await requirePermission(
        this.permissionService,
        job.organizationId,
        userId,
        ResourceType.RECRUITMENT,
        PermissionAction.EDIT,
        {
          customMessage: 'Insufficient permissions to manage applications',
        }
      );
      return;
    }

    // Handle ALLIANCE ownership
    if (job.ownerType === ListingOwnerType.ALLIANCE && job.allianceId) {
      // Delegate to federation service to ensure consistent alliance manage access checks
      // This includes checking for active member status and leadership roles
      const hasAllianceManageAccess = await this.federationService.hasAllianceManageAccess(
        job.allianceId,
        userId
      );

      if (!hasAllianceManageAccess) {
        throw new ForbiddenError(
          'Only leaders of active member organizations can manage alliance job applications'
        );
      }
      return;
    }

    // Handle USER ownership (fallback to createdBy check)
    if (job.createdBy !== userId) {
      throw new ForbiddenError('Only the listing creator can manage applications');
    }
  }
}
