import { Request, Response } from 'express';

import { AppDataSource } from '../data-source';
import { AuthRequest } from '../middleware/auth';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import { JobType, ListingCategory, ListingOwnerType, PayType } from '../models/PublicJobListing';
import { OrgPrimaryFocus } from '../models/PublicOrgProfile';
import { OrganizationFederationService } from '../services/organization/OrganizationFederationService';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import {
  CreateJobListingInput,
  JobListingFilterOptions,
  PublicJobListingService,
  UpdateJobListingInput,
} from '../services/organization/PublicJobListingService';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/apiErrors';
import { parsePaginationParams, parseSearchTerm } from '../utils/controllerHelpers';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { BaseController } from './BaseController';

/**
 * Parse a comma-separated query parameter into a string array.
 */
function parseCommaSeparated(value: unknown): string[] {
  if (!value) {
    return [];
  }
  return typeof value === 'string' ? value.split(',').map(v => v.trim()) : (value as string[]);
}

/**
 * Parse query parameters into JobListingFilterOptions
 * Extracted to reduce cognitive complexity of the controller method
 */
function parseJobListingFilters(query: Request['query']): JobListingFilterOptions {
  const filters: JobListingFilterOptions = {};

  if (query.organizationId) {
    filters.organizationId = query.organizationId as string;
  }
  if (query.allianceId) {
    filters.allianceId = query.allianceId as string;
  }
  if (query.ownerType) {
    filters.ownerType = query.ownerType as ListingOwnerType;
  }

  // Multi-select filters
  if (query.jobTypes) {
    filters.jobTypes = parseCommaSeparated(query.jobTypes) as JobType[];
  }
  if (query.focuses) {
    filters.focuses = parseCommaSeparated(query.focuses) as OrgPrimaryFocus[];
  }
  if (query.payTypes) {
    filters.payTypes = parseCommaSeparated(query.payTypes) as PayType[];
  }

  if (query.minPay) {
    filters.minPay = Number.parseInt(query.minPay as string, 10);
  }
  if (query.maxPay) {
    filters.maxPay = Number.parseInt(query.maxPay as string, 10);
  }
  if (query.maxExperienceLevel) {
    filters.maxExperienceLevel = Number.parseInt(query.maxExperienceLevel as string, 10);
  }

  const searchTerm = parseSearchTerm(query);
  if (searchTerm) {
    filters.searchTerm = searchTerm;
  }

  if (query.isActive !== undefined) {
    filters.isActive = query.isActive === 'true';
  }
  if (query.includeExpired !== undefined) {
    filters.includeExpired = query.includeExpired === 'true';
  }

  if (query.listingCategory) {
    filters.listingCategory = query.listingCategory as ListingCategory;
  }

  return filters;
}

/** Allowed fields for job listing creation/update to prevent prototype pollution */
const JOB_LISTING_ALLOWED_FIELDS: string[] = [
  'title',
  'description',
  'jobType',
  'focus',
  'payType',
  'payMin',
  'payMax',
  'experienceLevel',
  'expiresAt',
  'contactInfo',
  'timezone',
  'languages',
  'tags',
  'listingCategory',
  'shipRequirementType',
  'requiredShips',
  'crewSpotsTotal',
];

/**
 * Controller for public job listings
 *
 * Provides public endpoints for browsing job listings
 * and authenticated endpoints for managing job postings.
 * Phase 3: Public Job Listings feature
 */
export class PublicJobListingController extends BaseController {
  private readonly jobService = new PublicJobListingService();
  private readonly federationService = OrganizationFederationService.getInstance();
  private readonly permissionService = new OrganizationPermissionService();

  /**
   * Helper method to verify permission for a job listing
   * @throws UnauthorizedError if user is not authenticated
   * @throws ForbiddenError if user lacks permission
   */
  private async verifyJobPermission(
    userId: string | undefined,
    organizationId: string,
    action: PermissionAction,
    errorMessage: string
  ): Promise<void> {
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const hasPermission = await this.permissionService.checkPermission(
      userId,
      organizationId,
      ResourceType.RECRUITMENT,
      action
    );

    if (!hasPermission.allowed) {
      throw new ForbiddenError(errorMessage);
    }
  }

  /**
   * Helper method to get a job listing and verify user has permission
   * @throws UnauthorizedError if user is not authenticated
   * @throws NotFoundError if job listing not found
   * @throws ForbiddenError if user lacks permission
   */
  private async getJobAndVerifyPermission(
    jobId: string,
    userId: string | undefined,
    action: PermissionAction,
    errorMessage: string
  ): Promise<NonNullable<Awaited<ReturnType<typeof this.jobService.getJobListing>>>> {
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const existingJob = await this.jobService.getJobListing(jobId);
    if (!existingJob) {
      throw new NotFoundError('Job listing');
    }

    // Check permissions based on owner type
    if (existingJob.ownerType === ListingOwnerType.ORGANIZATION && existingJob.organizationId) {
      await this.verifyJobPermission(userId, existingJob.organizationId, action, errorMessage);
    }

    return existingJob;
  }

  // ==================== PUBLIC ENDPOINTS (NO AUTH) ====================

  /**
   * Get public job listings
   * GET /api/directory/jobs
   * No authentication required
   */
  public getJobListings = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const filters = parseJobListingFilters(req.query);
      const pagination = parsePaginationParams(req.query);

      const result = await this.jobService.getPublicJobListings(filters, pagination);

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Get a specific job listing
   * GET /api/directory/jobs/:jobId
   * No authentication required
   */
  public getJobListing = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;

      const job = await this.jobService.getJobListing(jobId);

      if (!job) {
        throw new NotFoundError('Job listing');
      }

      res.json({
        success: true,
        data: job,
      });
    });
  };

  /**
   * Get job listing statistics
   * GET /api/directory/jobs/stats
   * No authentication required
   */
  public getJobStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const stats = await this.jobService.getJobListingStats();

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  /**
   * Get available filter options for jobs
   * GET /api/directory/jobs/options
   * No authentication required
   */
  public getFilterOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      res.json({
        success: true,
        data: {
          jobTypeOptions: this.jobService.getJobTypeOptions(),
          payTypeOptions: this.jobService.getPayTypeOptions(),
          focusOptions: Object.values(OrgPrimaryFocus),
          ownerTypeOptions: Object.values(ListingOwnerType),
        },
      });
    });
  };

  /**
   * Get job count for an organization
   * GET /api/directory/:organizationId/jobs/count
   * No authentication required
   */
  public getOrganizationJobCount = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { organizationId } = req.params;

      const count = await this.jobService.getOrganizationJobCount(organizationId);

      res.json({
        success: true,
        data: { organizationId, count },
      });
    });
  };

  /**
   * Get job count for an alliance
   * GET /api/directory/federations/:federationId/jobs/count
   * No authentication required
   */
  public getAllianceJobCount = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { federationId } = req.params;

      const count = await this.jobService.getAllianceJobCount(federationId);

      res.json({
        success: true,
        data: { allianceId: federationId, count },
      });
    });
  };

  // ==================== AUTHENTICATED ENDPOINTS ====================

  /**
   * Create a job listing for an organization
   * POST /api/organizations/:id/jobs
   * Requires authentication and organization permissions
   */
  public createOrganizationJob = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId } = req.params;
      const userId = req.user?.id;

      // Check if user has permission to manage recruitment
      await this.verifyJobPermission(
        userId,
        organizationId,
        PermissionAction.EDIT,
        'Insufficient permissions to create job listings'
      );

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(req.body, JOB_LISTING_ALLOWED_FIELDS);

      const input = {
        ...safeBody,
        organizationId,
        ownerType: ListingOwnerType.ORGANIZATION,
        createdBy: userId,
      } as CreateJobListingInput;

      const job = await this.jobService.createJobListing(input);

      res.status(201).json({
        success: true,
        message: 'Job listing created successfully',
        data: job,
      });
    });
  };

  /**
   * Create a job listing for an alliance
   * POST /api/federations/:id/jobs
   * Requires authentication and alliance leadership
   */
  public createAllianceJob = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: allianceId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if alliance exists
      const alliance = await this.federationService.getFederation(allianceId);
      if (!alliance) {
        throw new NotFoundError('Alliance');
      }

      // Get user's organizations to verify membership via OrganizationMembership
      const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
      const userMemberships = await membershipRepo.find({
        where: { userId, isActive: true },
        select: ['organizationId'],
      });
      const userOrgIds = new Set(userMemberships.map(m => m.organizationId));

      // Find alliance members that are leadership (founder, leader, council)
      // and check if user belongs to any of them
      const leaderMembers = alliance.members.filter(m =>
        ['founder', 'leader', 'council'].includes(m.role)
      );

      const userIsLeader = leaderMembers.some(member => userOrgIds.has(member.organizationId));

      if (!userIsLeader) {
        throw new ForbiddenError(
          'Only leaders of member organizations can create alliance job listings'
        );
      }

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(req.body, JOB_LISTING_ALLOWED_FIELDS);

      const input = {
        ...safeBody,
        allianceId,
        ownerType: ListingOwnerType.ALLIANCE,
        createdBy: userId,
      } as CreateJobListingInput;

      const job = await this.jobService.createJobListing(input);

      res.status(201).json({
        success: true,
        message: 'Alliance job listing created successfully',
        data: job,
      });
    });
  };

  /**
   * Create a job listing for an individual user (no organization required)
   * POST /api/jobs
   * Requires authentication only — no org permission check
   */
  public createUserJob = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(req.body, JOB_LISTING_ALLOWED_FIELDS);

      const input = {
        ...safeBody,
        ownerType: ListingOwnerType.USER,
        createdBy: userId,
      } as CreateJobListingInput;

      const job = await this.jobService.createJobListing(input);

      res.status(201).json({
        success: true,
        message: 'Job listing created successfully',
        data: job,
      });
    });
  };

  /**
   * Get organization's job listings (for management)
   * GET /api/organizations/:id/jobs
   * Requires authentication
   */
  public getOrganizationJobs = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId } = req.params;
      const { includeInactive } = req.query;
      const userId = req.user?.id;

      // Check if user has permission to view recruitment
      await this.verifyJobPermission(
        userId,
        organizationId,
        PermissionAction.VIEW,
        'Insufficient permissions to view job listings'
      );

      const jobs = await this.jobService.getOrganizationListings(
        organizationId,
        includeInactive === 'true'
      );

      res.json({
        success: true,
        data: jobs,
      });
    });
  };

  /**
   * Update a job listing
   * PATCH /api/jobs/:jobId
   * Requires authentication and ownership
   */
  public updateJobListing = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const userId = req.user?.id;

      // Verify permissions
      await this.getJobAndVerifyPermission(
        jobId,
        userId,
        PermissionAction.EDIT,
        'Insufficient permissions to update job listing'
      );

      const input: UpdateJobListingInput = sanitizeObject(req.body, JOB_LISTING_ALLOWED_FIELDS);
      const job = await this.jobService.updateJobListing(jobId, input);

      res.json({
        success: true,
        message: 'Job listing updated successfully',
        data: job,
      });
    });
  };

  /**
   * Delete a job listing
   * DELETE /api/jobs/:jobId
   * Requires authentication and ownership
   */
  public deleteJobListing = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const userId = req.user?.id;

      // Verify permissions
      await this.getJobAndVerifyPermission(
        jobId,
        userId,
        PermissionAction.DELETE,
        'Insufficient permissions to delete job listing'
      );

      await this.jobService.deleteJobListing(jobId);

      res.json({
        success: true,
        message: 'Job listing deleted successfully',
      });
    });
  };

  /**
   * Assign a user to a crew role on a ship
   * POST /api/jobs/:jobId/crew/assign
   * Body: { shipIndex, roleIndex, userId, userName }
   */
  public assignCrewRole = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const authUserId = req.user?.id;

      // Verify permissions
      await this.getJobAndVerifyPermission(
        jobId,
        authUserId,
        PermissionAction.EDIT,
        'Insufficient permissions to assign crew'
      );

      const { shipIndex, roleIndex, userId, userName } = req.body;

      if (shipIndex === undefined || roleIndex === undefined || !userId || !userName) {
        throw new Error('shipIndex, roleIndex, userId, and userName are required');
      }

      const updated = await this.jobService.assignCrewRole(
        jobId,
        shipIndex,
        roleIndex,
        userId,
        userName
      );

      res.json({
        success: true,
        message: 'Crew role assigned successfully',
        data: updated,
      });
    });
  };

  /**
   * Unassign a user from a crew role on a ship
   * POST /api/jobs/:jobId/crew/unassign
   * Body: { shipIndex, roleIndex }
   */
  public unassignCrewRole = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const authUserId = req.user?.id;

      // Verify permissions
      await this.getJobAndVerifyPermission(
        jobId,
        authUserId,
        PermissionAction.EDIT,
        'Insufficient permissions to unassign crew'
      );

      const { shipIndex, roleIndex } = req.body;

      if (shipIndex === undefined || roleIndex === undefined) {
        throw new Error('shipIndex and roleIndex are required');
      }

      const updated = await this.jobService.unassignCrewRole(jobId, shipIndex, roleIndex);

      res.json({
        success: true,
        message: 'Crew role unassigned successfully',
        data: updated,
      });
    });
  };

  /**
   * Cancel (deactivate) a job listing
   * POST /api/jobs/:jobId/cancel
   * Requires authentication and ownership/org permission
   */
  public cancelJobListing = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { jobId } = req.params;
      const userId = req.user?.id;

      // Verify permissions
      await this.getJobAndVerifyPermission(
        jobId,
        userId,
        PermissionAction.EDIT,
        'Insufficient permissions to cancel job listing'
      );

      await this.jobService.deactivateJobListing(jobId);

      res.json({
        success: true,
        message: 'Job listing cancelled successfully',
      });
    });
  };
}
