import { Response } from 'express';
import { In } from 'typeorm';

import { AppDataSource } from '../data-source';
import { AuthRequest } from '../middleware/auth';
import {
  Activity,
  ActivityApplication,
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ApplicationStatus,
} from '../models/Activity';
import { DiscordGuildSettings, type RecruitmentSettings } from '../models/DiscordGuildSettings';
import { Organization } from '../models/Organization';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import { Ship } from '../models/Ship';
import { UserShip } from '../models/UserShip';
import { UserSkill } from '../models/UserSkill';
import { ActivityService, CreateActivityDTO } from '../services/activity';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import { OrgApplicationService } from '../services/organization/OrgApplicationService';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/**
 * Discord invite binding stored in activity metadata
 */
interface InviteBinding {
  bindingCode: string;
  guildId: string;
  guildName: string;
  requireApplication: boolean;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

/**
 * Extended recruitment metadata with invite bindings
 */
interface RecruitmentMetadata {
  inviteBindings?: InviteBinding[];
  [key: string]: unknown;
}

/**
 * User application with recruitment context
 */
interface UserApplicationWithContext extends ActivityApplication {
  recruitmentId: string;
  recruitmentTitle: string;
  organizationName?: string;
}

/**
 * Recruitment Controller
 *
 * Provides dedicated /api/recruitments endpoints that wrap the unified Activity API
 * for recruitment-specific operations. This allows the frontend to use a cleaner,
 * recruitment-focused API while leveraging the full Activity system backend.
 */
export class RecruitmentController extends BaseController {
  private readonly activityService: ActivityService;
  private readonly orgApplicationService: OrgApplicationService;
  private readonly permissionService: OrganizationPermissionService;

  constructor() {
    super();
    this.activityService = new ActivityService();
    this.orgApplicationService = new OrgApplicationService();
    this.permissionService = new OrganizationPermissionService();
  }

  /**
   * Authorize access to a recruitment post's applicants.
   * Allows the post creator OR an org admin with RECRUITMENT.APPROVE permission
   * (the same permission that gates organization join-application review).
   * Personal posts (no organization) remain creator-only.
   */
  private async requireApplicationReviewAccess(userId: string, activity: Activity): Promise<void> {
    if (activity.creatorId === userId) {
      return;
    }
    if (activity.organizationId) {
      const result = await this.permissionService.checkPermission(
        userId,
        activity.organizationId,
        ResourceType.RECRUITMENT,
        PermissionAction.APPROVE
      );
      if (result.allowed) {
        return;
      }
    }
    throw new ForbiddenError(
      'You do not have permission to review applications for this recruitment'
    );
  }

  /**
   * Map frontend status to Activity status
   */
  private mapToActivityStatus(status: string): ActivityStatus {
    switch (status) {
      case 'open':
        return ActivityStatus.RECRUITING;
      case 'closed':
        return ActivityStatus.COMPLETED;
      case 'paused':
        return ActivityStatus.DRAFT;
      default:
        return ActivityStatus.RECRUITING;
    }
  }

  /**
   * Map Activity status to frontend status
   */
  private mapToFrontendStatus(status: ActivityStatus): 'open' | 'closed' | 'paused' {
    switch (status) {
      case ActivityStatus.OPEN:
      case ActivityStatus.RECRUITING:
        return 'open';
      case ActivityStatus.COMPLETED:
      case ActivityStatus.CANCELLED:
      case ActivityStatus.EXPIRED:
        return 'closed';
      case ActivityStatus.DRAFT:
      case ActivityStatus.PLANNING:
        return 'paused';
      default:
        return 'closed';
    }
  }

  /**
   * Transform Activity to Recruitment format for frontend
   */
  private transformToRecruitment(
    activity: Record<string, unknown>,
    organizationLogoUrl?: string,
    currentUserId?: string,
    discordRecruitment?: RecruitmentSettings | null
  ): Record<string, unknown> {
    const applications = (activity.applications ?? []) as ActivityApplication[];

    let hasApplied = false;
    if (currentUserId) {
      hasApplied = applications.some(
        app => app.applicantId === currentUserId || app.userId === currentUserId
      );
    }

    const pendingApplicants = applications.filter(
      app => app.status === ApplicationStatus.PENDING
    ).length;

    return {
      id: activity.id,
      organizationId: activity.organizationId,
      organizationName: activity.organizationName,
      organizationLogoUrl: organizationLogoUrl ?? undefined,
      title: activity.title,
      description: activity.description,
      rolesNeeded: activity.rolesNeeded ?? [],
      currentApplicants: activity.currentApplicants ?? 0,
      pendingApplicants,
      maxPositions: activity.maxApplicants ?? activity.maxParticipants,
      status: this.mapToFrontendStatus(activity.status as ActivityStatus),
      requirements: activity.requirements,
      expiresAt: activity.expiresAt,
      bannerImageUrl: activity.bannerImageUrl ?? undefined,
      visibility: activity.visibility,
      tags: activity.tags ?? [],
      screeningEnabled: activity.screeningEnabled,
      autoAcceptQualified: activity.autoAcceptQualified,
      contractorRequirements: activity.contractorRequirements,
      applicationQuestions: activity.applicationQuestions ?? [],
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      creatorId: activity.creatorId,
      creatorName: activity.creatorName,
      hasApplied,
      // Discord recruitment integration
      discordRecruitmentEnabled: discordRecruitment?.enabled ?? false,
      discordInviteUrl: discordRecruitment?.enabled
        ? (discordRecruitment.discordInviteUrl ?? undefined)
        : undefined,
      discordInviteFormEnabled: discordRecruitment?.enabled
        ? (discordRecruitment.inviteFormEnabled ?? false)
        : false,
    };
  }

  /**
   * Fetch Discord recruitment settings for an organization
   */
  private async getDiscordRecruitmentSettings(
    organizationId: string
  ): Promise<RecruitmentSettings | null> {
    try {
      const guildSettingsRepo = AppDataSource.getRepository(DiscordGuildSettings);
      const guildSettings = await guildSettingsRepo.findOne({
        where: { organizationId },
      });
      return guildSettings?.recruitmentSettings ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Look up the Organization's logoUrl by ID
   */
  private async getOrgLogoUrl(
    organizationId: string | null | undefined
  ): Promise<string | undefined> {
    if (!organizationId) {
      return undefined;
    }
    try {
      const orgRepo = AppDataSource.getRepository(Organization);
      const org = await orgRepo.findOne({
        where: { id: organizationId },
        select: ['id', 'logoUrl'],
      });
      return org?.logoUrl ?? undefined;
    } catch (err: unknown) {
      logger.warn('Failed to fetch org logo URL', {
        organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  /**
   * Batch-fetch org logo URLs for a list of organization IDs
   */
  private async getOrgLogoUrls(
    organizationIds: string[]
  ): Promise<Map<string, string | undefined>> {
    const map = new Map<string, string | undefined>();
    const uniqueIds = [...new Set(organizationIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return map;
    }

    try {
      const orgRepo = AppDataSource.getRepository(Organization);
      const orgs = await orgRepo
        .createQueryBuilder('org')
        .select(['org.id', 'org.logoUrl'])
        .where('org.id IN (:...ids)', { ids: uniqueIds })
        .getMany();

      for (const org of orgs) {
        map.set(org.id, org.logoUrl ?? undefined);
      }
    } catch (err: unknown) {
      logger.warn('Failed to batch-fetch org logo URLs', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return map;
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * GET /api/recruitments
   * List all recruitment activities
   */
  listRecruitments = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Math.min(Number.parseInt(req.query.limit as string) || 20, 200);

      const filters: Record<string, unknown> = {
        activityType: ActivityType.RECRUITMENT,
      };

      // Map frontend status filter to activity status
      if (req.query.status) {
        const status = req.query.status as string;
        if (status === 'open') {
          filters.status = [ActivityStatus.OPEN, ActivityStatus.RECRUITING];
        } else if (status === 'closed') {
          filters.status = [
            ActivityStatus.COMPLETED,
            ActivityStatus.CANCELLED,
            ActivityStatus.EXPIRED,
          ];
        } else if (status === 'paused') {
          filters.status = [ActivityStatus.DRAFT, ActivityStatus.PLANNING];
        }
      }

      // Use explicit query param, or fall back to the caller's tenant context
      // (bot requests resolve the guild → org in botOrUserAuth middleware).
      const orgId =
        (req.query.organizationId as string | undefined) ??
        (req as unknown as { tenantContext?: { organizationId: string } }).tenantContext
          ?.organizationId ??
        req.user?.currentOrganizationId;
      if (orgId) {
        filters.organizationId = orgId;
      }

      if (req.query.searchTerm) {
        filters.searchTerm = req.query.searchTerm;
      }

      if (req.query.hasOpenSlots) {
        filters.hasOpenSlots = parseBooleanQuery(req.query.hasOpenSlots);
      }

      if (req.query.tags) {
        const tagsParam = req.query.tags;
        filters.tags = Array.isArray(tagsParam) ? tagsParam : [tagsParam as string];
      }

      const result = await this.activityService.searchActivities(filters, page, limit);

      // Batch-fetch org logos for all recruitments
      const orgIds = result.activities
        .map((a: Activity) => a.organizationId)
        .filter((id): id is string => !!id);
      const logoMap = await this.getOrgLogoUrls(orgIds);

      // Batch-fetch Discord recruitment settings per org
      const discordSettingsMap = new Map<string, RecruitmentSettings | null>();
      for (const orgId of new Set(orgIds)) {
        discordSettingsMap.set(orgId, await this.getDiscordRecruitmentSettings(orgId));
      }

      // Transform activities to recruitment format
      const userId = req.user?.id;
      const recruitments = result.activities.map((activity: Activity) => {
        const actRecord = activity as unknown as Record<string, unknown>;
        const logoUrl = logoMap.get(activity.organizationId ?? '');
        const discordSettings = discordSettingsMap.get(activity.organizationId ?? '') ?? null;
        return this.transformToRecruitment(actRecord, logoUrl, userId, discordSettings);
      });

      res.json({
        data: recruitments,
        total: result.total,
        page: result.page,
        limit,
        totalPages: result.totalPages,
      });
    });
  };

  /**
   * POST /api/recruitments
   * Create a new recruitment
   */
  createRecruitment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;
      const userName = req.user?.username;
      const organizationId = req.body.organizationId || req.user?.currentOrganizationId;

      if (!userId || !userName) {
        throw new UnauthorizedError('Unauthorized');
      }

      if (!organizationId) {
        throw new ValidationError('Organization ID is required');
      }

      // Resolve the recruiting organization itself — never trust the creator's
      // currentOrganizationName, which may belong to a different org if the user
      // has switched context or is creating on behalf of another tenant.
      const orgRepo = AppDataSource.getRepository(Organization);
      const org = await orgRepo.findOne({ where: { id: organizationId } });
      if (!org) {
        throw new ValidationError('Organization not found');
      }
      const organizationName = org.name;
      const snapshotQuestions = org.settings?.applicationQuestions ?? [];

      const dto: CreateActivityDTO = {
        title: req.body.title,
        description: req.body.description,
        activityType: ActivityType.RECRUITMENT,
        creatorId: userId,
        creatorName: userName,
        organizationId,
        organizationName,
        visibility: this.mapVisibility(req.body.visibility),
        maxParticipants: req.body.maxPositions,
        tags: req.body.tags ?? [],
      };

      // Create the activity
      const activity = await this.activityService.createActivity(organizationId, dto);

      const updateFields: Record<string, unknown> = {
        rolesNeeded: req.body.rolesNeeded ?? [],
        requirements: req.body.requirements,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        maxApplicants: req.body.maxPositions,
        screeningEnabled: req.body.screeningEnabled ?? false,
        autoAcceptQualified: req.body.autoAcceptQualified ?? false,
        contractorRequirements: req.body.contractorRequirements,
        bannerImageUrl: req.body.bannerImageUrl || undefined,
        applicationQuestions: snapshotQuestions,
        status: ActivityStatus.RECRUITING,
      };

      const updated = await this.activityService.updateActivity(activity.id, updateFields);
      const logoUrl = await this.getOrgLogoUrl(organizationId);

      res
        .status(201)
        .json(this.transformToRecruitment(updated as unknown as Record<string, unknown>, logoUrl));
    });
  };

  /**
   * GET /api/recruitments/:id
   * Get a specific recruitment
   */
  getRecruitment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const activity = await this.activityService.getActivityById(id);

      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      const logoUrl = await this.getOrgLogoUrl(activity.organizationId);
      const discordSettings = activity.organizationId
        ? await this.getDiscordRecruitmentSettings(activity.organizationId)
        : null;
      const userId = req.user?.id;
      res.json(
        this.transformToRecruitment(
          activity as unknown as Record<string, unknown>,
          logoUrl,
          userId,
          discordSettings
        )
      );
    });
  };

  /**
   * PUT /api/recruitments/:id
   * Update a recruitment
   */
  updateRecruitment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.creatorId !== userId) {
        throw new ForbiddenError('Only creator can update recruitment');
      }

      const updateFields = this.extractUpdateFields(req.body);

      const updated = await this.activityService.updateActivity(id, updateFields);
      const logoUrl = await this.getOrgLogoUrl(activity.organizationId);
      res.json(this.transformToRecruitment(updated as unknown as Record<string, unknown>, logoUrl));
    });
  };

  /**
   * DELETE /api/recruitments/:id
   * Delete a recruitment
   */
  deleteRecruitment = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      // Only the creator can delete their recruitment
      if (activity.creatorId !== userId) {
        throw new ForbiddenError('Only the recruitment creator can delete this posting');
      }

      await this.activityService.deleteActivity(id, userId);
      res.status(204).send();
    });
  };

  // ==================== STATUS MANAGEMENT ====================

  /**
   * PUT /api/recruitments/:id/status
   * Update recruitment status
   */
  updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.creatorId !== userId) {
        throw new ForbiddenError('Only creator can update status');
      }

      const newStatus = this.mapToActivityStatus(status);
      const updated = await this.activityService.updateActivity(id, { status: newStatus });
      const logoUrl = await this.getOrgLogoUrl(activity.organizationId);

      res.json(this.transformToRecruitment(updated as unknown as Record<string, unknown>, logoUrl));
    });
  };

  // ==================== APPLICATION MANAGEMENT ====================

  /**
   * POST /api/recruitments/:id/apply
   * Submit an application to a recruitment
   */
  submitApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      const userName = req.user?.username;
      const discordId =
        (req.body.discordId as string | undefined) ??
        (req.body.discordUserId as string | undefined) ??
        req.user?.discordId;

      if (!userId || !userName) {
        throw new UnauthorizedError('Unauthorized');
      }

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      // Check org watchlist — block applicants whose RSI handle is flagged
      if (activity.organizationId) {
        await this.orgApplicationService.checkWatchlist(activity.organizationId, userId);
      }

      const applicantName =
        (req.body.applicantName as string | undefined) ??
        (req.body.discordUsername as string | undefined) ??
        userName;

      const applicationData = {
        applicantId: userId,
        applicantName,
        message: req.body.message,
        rsiHandle: req.body.rsiHandle,
        discordId,
        answers: req.body.answers,
        timezone: req.body.timezone,
        availablePlaytimes: req.body.availablePlaytimes,
        preferredRoles: req.body.preferredRoles,
      };

      const application = await this.activityService.submitApplication(id, applicationData);

      res.status(201).json(application);
    });
  };

  /**
   * GET /api/recruitments/:id/applications
   * List applications for a recruitment
   */
  listApplications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      // Creator or org admins with RECRUITMENT.APPROVE may view applications
      await this.requireApplicationReviewAccess(userId, activity);

      const filters: Record<string, unknown> = {};
      if (req.query.status) {
        filters.status = this.mapApplicationStatus(req.query.status as string);
      }

      const applications = await this.activityService.getApplications(id, filters);

      // Enrich applications with skills and career-based flight hours
      const enriched = activity.organizationId
        ? await this.enrichApplicationsWithProfile(applications, activity.organizationId)
        : applications;

      res.json({
        data: enriched,
        total: enriched.length,
      });
    });
  };

  /**
   * Enrich applications with applicant skills and career-based flight hours
   */
  private async enrichApplicationsWithProfile(
    applications: ActivityApplication[],
    organizationId: string
  ): Promise<
    Array<
      ActivityApplication & {
        skills?: Array<{ name: string; category: string; level: string }>;
        careerHours?: Array<{ career: string; hours: number; shipCount: number }>;
      }
    >
  > {
    const applicantIds = [...new Set(applications.map(a => a.applicantId).filter(Boolean))];
    if (applicantIds.length === 0) {
      return applications;
    }

    try {
      // Batch-fetch user skills
      const userSkillRepo = AppDataSource.getRepository(UserSkill);
      const allUserSkills = await userSkillRepo.find({
        where: { organizationId, userId: In(applicantIds) },
        relations: ['skill'],
      });

      // Batch-fetch user ships with ship catalog for career + flight hours
      const userShipRepo = AppDataSource.getRepository(UserShip);
      const allUserShips = await userShipRepo
        .createQueryBuilder('us')
        .leftJoinAndMapOne('us.shipRef', Ship, 'ship', 'ship.id = us."shipId"')
        .where('us."userId" IN (:...userIds)', { userIds: applicantIds })
        .andWhere('us."flightHours" > 0')
        .select(['us.userId', 'us.flightHours', 'ship.career'])
        .getRawMany<{ us_userId: string; us_flightHours: number; ship_career: string }>();

      // Index skills by userId
      const skillsByUser = new Map<
        string,
        Array<{ name: string; category: string; level: string }>
      >();
      for (const us of allUserSkills) {
        if (!us.skill) {
          continue;
        }
        const arr = skillsByUser.get(us.userId) ?? [];
        arr.push({ name: us.skill.name, category: us.skill.category, level: us.level });
        skillsByUser.set(us.userId, arr);
      }

      // Aggregate flight hours by career per user
      const careerHoursByUser = new Map<
        string,
        Map<string, { hours: number; shipCount: number }>
      >();
      for (const row of allUserShips) {
        const career = row.ship_career || 'Unknown';
        const hours = Number(row.us_flightHours) || 0;
        if (hours <= 0) {
          continue;
        }

        let userMap = careerHoursByUser.get(row.us_userId);
        if (!userMap) {
          userMap = new Map();
          careerHoursByUser.set(row.us_userId, userMap);
        }
        const existing = userMap.get(career) ?? { hours: 0, shipCount: 0 };
        existing.hours += hours;
        existing.shipCount += 1;
        userMap.set(career, existing);
      }

      return applications.map(app => ({
        ...app,
        skills: skillsByUser.get(app.applicantId) ?? [],
        careerHours: (() => {
          const userMap = careerHoursByUser.get(app.applicantId);
          if (!userMap) {
            return [];
          }
          return Array.from(userMap.entries())
            .map(([career, data]) => ({ career, hours: data.hours, shipCount: data.shipCount }))
            .sort((a, b) => b.hours - a.hours);
        })(),
      }));
    } catch (err: unknown) {
      logger.warn('Failed to enrich applications with profile data', {
        error: err instanceof Error ? err.message : String(err),
      });
      return applications;
    }
  }

  /**
   * PUT /api/recruitments/:id/applications/:applicationId
   * Review an application (accept/reject/interview)
   */
  reviewApplication = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id, applicationId } = req.params;
      const { action, notes, rejectionReason, interviewScheduledAt } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Unauthorized');
      }

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      // Creator or org admins with RECRUITMENT.APPROVE may review applications
      await this.requireApplicationReviewAccess(userId, activity);

      let result;
      switch (action) {
        case 'accept':
          result = await this.activityService.acceptApplication(id, applicationId, userId, notes);
          break;
        case 'reject':
          result = await this.activityService.rejectApplication(
            id,
            applicationId,
            userId,
            rejectionReason
          );
          break;
        case 'advance':
          result = await this.activityService.advanceApplicationStage(
            id,
            applicationId,
            userId,
            notes
          );
          break;
        case 'interview':
          if (!interviewScheduledAt) {
            throw new ValidationError('Interview scheduled date is required');
          }
          result = await this.activityService.scheduleInterview(id, applicationId, {
            scheduledAt: new Date(interviewScheduledAt as string),
            interviewerId: userId,
            notes,
          });
          break;
        default:
          throw new ValidationError('Invalid action');
      }

      res.json(result);
    });
  };

  // ==================== DISCORD INTEGRATION ====================

  /**
   * GET /api/recruitments/my-applications
   * Get current user's applications (used by Discord bot)
   */
  getMyApplications = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const userId = req.user?.id;
      const discordId = req.user?.discordId;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get all recruitments with the user's applications
      const searchFilters = {
        activityType: ActivityType.RECRUITMENT,
        status: [ActivityStatus.OPEN, ActivityStatus.RECRUITING, ActivityStatus.COMPLETED],
      };

      const result = await this.activityService.searchActivities(searchFilters, 1, 100);

      // Extract user's applications from each recruitment
      const userApplications: UserApplicationWithContext[] = [];
      for (const activity of result.activities) {
        const applications = activity.applications ?? [];
        // Match by Discord identity first for guest applicants; then fallback to user id variants.
        const userApp = applications.find((app: ActivityApplication) => {
          if (discordId && app.discordId === discordId) {
            return true;
          }
          return app.applicantId === userId || app.userId === userId;
        });
        if (userApp) {
          userApplications.push({
            ...userApp,
            recruitmentId: activity.id,
            recruitmentTitle: activity.title,
            organizationName: activity.organizationName,
          });
        }
      }

      res.json({
        data: userApplications,
        total: userApplications.length,
      });
    });
  };

  /**
   * POST /api/recruitments/:id/invite-binding
   * Create an invite binding for Discord recruitment (Admin only)
   */
  createInviteBinding = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { bindingCode, guildId, guildName, requireApplication, createdBy } = req.body;

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      // Verify the user is the creator or has org admin access
      if (activity.creatorId !== userId) {
        throw new ForbiddenError('Only the recruitment creator can create invite bindings');
      }

      // Store the binding information in activity metadata
      const existingMetadata = (activity.metadata ?? {}) as RecruitmentMetadata;
      const inviteBindings: InviteBinding[] = existingMetadata.inviteBindings ?? [];

      const newBinding: InviteBinding = {
        bindingCode,
        guildId,
        guildName,
        requireApplication,
        createdBy,
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      inviteBindings.push(newBinding);

      const updatedMetadata: RecruitmentMetadata = {
        ...existingMetadata,
        inviteBindings,
      };

      await this.activityService.updateActivity(id, {
        metadata: updatedMetadata as unknown as Record<string, unknown>,
      });

      res.status(201).json({
        success: true,
        bindingCode,
        recruitmentId: id,
        message: 'Invite binding created successfully',
      });
    });
  };

  /**
   * POST /api/recruitments/:id/discord-apply
   * Submit application from Discord (with Discord user info)
   */
  discordApply = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const activity = await this.activityService.getActivityById(id);
      if (!activity) {
        throw new NotFoundError('Recruitment');
      }

      if (activity.activityType !== ActivityType.RECRUITMENT) {
        throw new NotFoundError('Recruitment');
      }

      // Check org watchlist — block applicants whose RSI handle is flagged
      if (activity.organizationId) {
        await this.orgApplicationService.checkWatchlist(activity.organizationId, userId);
      }

      // Check if already applied (by userId or discordId)
      const discordId = (req.user as Record<string, unknown>)?.discordId as string | undefined;
      const existingApplications = activity.applications ?? [];
      const hasExistingApplication = existingApplications.some((app: ActivityApplication) => {
        if (discordId && app.discordId === discordId) {
          return true;
        }
        return app.applicantId === userId;
      });
      if (hasExistingApplication) {
        throw new ValidationError('You have already applied to this recruitment');
      }

      const applicantName =
        (req.body.discordUsername as string | undefined) ??
        req.user?.username ??
        (req.body.applicantName as string | undefined) ??
        'Unknown';

      const applicationData = {
        applicantId: userId,
        applicantName,
        discordId,
        rsiHandle: req.body.rsiHandle,
        message: req.body.motivation,
        experience: req.body.experience,
        timezone: req.body.timezone,
        availablePlaytimes: req.body.availability ? [req.body.availability] : undefined,
        metadata: {
          source: 'discord',
          guildId: req.user?.currentOrganizationId,
        },
      };

      const application = await this.activityService.submitApplication(id, applicationData);

      res.status(201).json({
        success: true,
        application,
        message: 'Application submitted successfully',
      });
    });
  };

  // ==================== HELPER METHODS ====================

  private mapVisibility(visibility: string | undefined): ActivityVisibility {
    switch (visibility) {
      case 'public':
        return ActivityVisibility.PUBLIC;
      case 'organization':
        return ActivityVisibility.ORGANIZATION;
      case 'alliance':
        return ActivityVisibility.ALLIANCE;
      case 'private':
        return ActivityVisibility.PRIVATE;
      default:
        // Recruitment posts are outward-facing by default so they appear in
        // public recruitment lists and can be discovered by prospective recruits.
        return ActivityVisibility.PUBLIC;
    }
  }

  private mapApplicationStatus(status: string): ApplicationStatus {
    switch (status) {
      case 'pending':
        return ApplicationStatus.PENDING;
      case 'under_review':
        return ApplicationStatus.UNDER_REVIEW;
      case 'interview_scheduled':
        return ApplicationStatus.INTERVIEW_SCHEDULED;
      case 'accepted':
        return ApplicationStatus.ACCEPTED;
      case 'rejected':
        return ApplicationStatus.REJECTED;
      case 'withdrawn':
        return ApplicationStatus.WITHDRAWN;
      default:
        return ApplicationStatus.PENDING;
    }
  }

  /**
   * Extract update fields from request body, mapping frontend field names to Activity fields.
   */
  private extractUpdateFields(body: Record<string, unknown>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    const directFields = [
      'title',
      'description',
      'rolesNeeded',
      'requirements',
      'tags',
      'screeningEnabled',
      'autoAcceptQualified',
      'contractorRequirements',
    ] as const;

    for (const field of directFields) {
      if (body[field] !== undefined) {
        fields[field] = body[field];
      }
    }

    if (body.maxPositions !== undefined) {
      fields.maxApplicants = body.maxPositions;
      fields.maxParticipants = body.maxPositions;
    }
    if (body.expiresAt !== undefined) {
      fields.expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : null;
    }
    if (body.visibility !== undefined) {
      fields.visibility = this.mapVisibility(body.visibility as string);
    }
    if (body.bannerImageUrl !== undefined) {
      fields.bannerImageUrl = body.bannerImageUrl || null;
    }

    return fields;
  }
}
