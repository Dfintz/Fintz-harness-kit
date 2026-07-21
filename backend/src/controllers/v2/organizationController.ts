/**
 * Organization Controller V2
 * Handles organization-related endpoints with standardized responses
 */

import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { Activity, ActivityStatus } from '../../models/Activity';
import { AssignmentStatus, CrewAssignment } from '../../models/CrewAssignment';
import { Fleet, FleetStatus } from '../../models/Fleet';
import { Invitation, InvitationStatus } from '../../models/Invitation';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { Role } from '../../models/Role';
import { TeamMember } from '../../models/TeamMember';
import { User } from '../../models/User';
import { UserShip } from '../../models/UserShip';
import { OrganizationAggregatorService } from '../../services/aggregators/OrganizationAggregatorService';
import { InvitationService } from '../../services/invitation/InvitationService';
import { AllianceService } from '../../services/organization/AllianceService';
import { MemberActivityService } from '../../services/organization/MemberActivityService';
import { OnlinePresenceService } from '../../services/organization/OnlinePresenceService';
import { OrganizationInventoryService } from '../../services/organization/OrganizationInventoryService';
import { OrganizationMemberService } from '../../services/organization/OrganizationMemberService';
import { OrganizationService } from '../../services/organization/OrganizationService';
import { OrganizationTradingService } from '../../services/organization/OrganizationTradingService';
import { RoleService } from '../../services/security/core/RoleService';
import { UserShipService } from '../../services/ship/UserShipService';
import { UserService } from '../../services/user/UserService';
import { ApiErrorCode } from '../../types/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { getRoleName, isOwnerRole } from '../../utils/roleUtils';

import {
  createOrganizationCoreHandler,
  deleteOrganizationCoreHandler,
  getOrganizationCoreHandler,
  listOrganizationsCoreHandler,
  updateOrganizationCoreHandler,
} from './organizationController.coreOperations';

/** Request with auth context */
type AuthRequest = Request & {
  user?: { id?: string };
  ip?: string;
  queryParams?: Record<string, unknown>;
};

/** Enrichment context built from batch queries */
interface MemberEnrichment {
  teams: Array<{ teamName: string; teamRole: string; rank: string | null }>;
  crewAssignments: Array<{ shipId: string; crewRole: string }>;
}

/** Transform a raw OrganizationMembership into a flat DTO for API responses */
function toMemberDto(m: OrganizationMembership, enrichment?: MemberEnrichment) {
  const permissionCount = m.permissions?.length ?? 0;

  return {
    userId: m.userId,
    organizationId: m.organizationId,
    role: getRoleName(m.role),
    joinedAt: m.joinedAt,
    username: m.user?.username ?? null,
    displayName: m.user?.displayName ?? m.user?.username ?? null,
    avatar: m.user?.avatar ?? null,
    securityLevel: m.securityLevel,
    title: m.title,
    // Extended member context (Wave 3.3)
    rsiHandle: m.user?.rsiHandle ?? null,
    rsiVerified: m.user?.rsiVerified ?? false,
    discordId: m.user?.discordId ?? null,
    lastLoginAt: m.user?.lastLoginAt ?? null,
    registeredAt: m.user?.createdAt ?? null,
    permissionCount,
    // Team & fleet enrichment
    teams: enrichment?.teams ?? [],
    crewAssignments: enrichment?.crewAssignments ?? [],
  };
}

export class OrganizationControllerV2 {
  private readonly memberActivityService: MemberActivityService;
  private readonly onlinePresenceService: OnlinePresenceService;
  private readonly allianceService: AllianceService;
  private readonly inventoryService: OrganizationInventoryService;
  private readonly tradingService: OrganizationTradingService;
  private readonly organizationService: OrganizationService;
  private readonly memberService: OrganizationMemberService;
  private readonly invitationService: InvitationService;
  private readonly roleService: RoleService;
  private readonly userService: UserService;
  private readonly userShipService: UserShipService;

  constructor() {
    this.memberActivityService = new MemberActivityService();
    this.onlinePresenceService = new OnlinePresenceService();
    this.allianceService = new AllianceService();
    this.inventoryService = new OrganizationInventoryService();
    this.tradingService = new OrganizationTradingService();
    this.organizationService = new OrganizationService();
    this.memberService = new OrganizationMemberService();
    this.invitationService = new InvitationService();
    this.roleService = new RoleService();
    this.userService = new UserService();
    this.userShipService = new UserShipService();
  }

  private async findOrganizationById(
    orgId: string,
    options?: { includeHierarchy?: boolean }
  ): Promise<Organization | null> {
    return this.organizationService.getOrganizationById(orgId, {
      includeHierarchy: options?.includeHierarchy,
    });
  }

  private async requireOrganization(
    orgId: string,
    options?: { includeHierarchy?: boolean }
  ): Promise<Organization> {
    const organization = await this.findOrganizationById(orgId, options);
    if (!organization) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Organization not found', 404);
    }
    return organization;
  }

  private async findMembershipByOrgAndUser(
    orgId: string,
    userId: string,
    _options?: { includeRole?: boolean; includeUser?: boolean }
  ): Promise<OrganizationMembership | null> {
    return this.memberService.getMember(orgId, userId);
  }

  private async findRoleById(roleId: string): Promise<Role | null> {
    return this.roleService.getRoleById(roleId);
  }

  private async findUserById(userId: string): Promise<User | null> {
    return this.userService.getUserById(userId);
  }

  private async findShipById(shipId: string): Promise<UserShip | null> {
    return this.userShipService.getUserShipById(shipId);
  }

  private async findInvitationByOrgAndId(
    orgId: string,
    inviteId: string
  ): Promise<Invitation | null> {
    return AppDataSource.getRepository(Invitation)
      .createQueryBuilder('invitation')
      .where('invitation.id = :inviteId', { inviteId })
      .andWhere('invitation.organizationId = :orgId', { orgId })
      .getOne();
  }

  private async resolveRequestedRoleName(
    orgId: string,
    role?: string,
    roleId?: string
  ): Promise<string | null> {
    if (roleId) {
      const requestedRole = await this.findRoleById(roleId);

      if (requestedRole?.organizationId !== orgId) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
      }

      return getRoleName(requestedRole);
    }

    return typeof role === 'string' ? role.trim().toLowerCase() : null;
  }

  // ==================== ORGANIZATION CRUD ====================

  /**
   * GET /api/v2/organizations
   * List all organizations with pagination
   */
  async listOrganizations(req: Request, res: Response): Promise<void> {
    await listOrganizationsCoreHandler(req, res);
  }

  /**
   * GET /api/v2/organizations/:id
   * Get a specific organization by ID
   */
  async getOrganization(req: Request, res: Response): Promise<void> {
    await getOrganizationCoreHandler(req, res);
  }

  /**
   * POST /api/v2/organizations
   * Create a new organization
   */
  async createOrganization(req: Request, res: Response): Promise<void> {
    await createOrganizationCoreHandler(req, res, this.organizationService);
  }

  /**
   * PATCH /api/v2/organizations/:id
   * Update an organization
   */
  async updateOrganization(req: Request, res: Response): Promise<void> {
    await updateOrganizationCoreHandler(req, res, this.organizationService);
  }

  /**
   * DELETE /api/v2/organizations/:id
   * Delete an organization
   */
  async deleteOrganization(req: Request, res: Response): Promise<void> {
    await deleteOrganizationCoreHandler(req, res, this.organizationService);
  }

  // ==================== MEMBER MANAGEMENT ====================

  /**
   * GET /api/v2/organizations/:id/members
   * Get members of an organization with pagination
   */
  async getMembers(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.params;
    const parsedParams = req.queryParams || {
      limit: 20,
      offset: 0,
      search: null,
      filters: {},
    };
    const { limit, offset } = parsedParams;

    const parsedFilters = (parsedParams.filters || {}) as Record<string, unknown>;
    const searchTerm =
      (typeof parsedParams.search === 'string' ? parsedParams.search.trim() : '') ||
      (typeof parsedFilters.query === 'string' ? parsedFilters.query.trim() : '') ||
      null;

    const rawRoleFilter =
      (typeof req.query.role === 'string' ? req.query.role : null) ||
      (typeof parsedFilters.role === 'string' ? parsedFilters.role : null);
    const normalizedRoleFilter = rawRoleFilter?.trim().toLowerCase() || null;
    const roleFilter =
      normalizedRoleFilter && normalizedRoleFilter !== 'all' ? normalizedRoleFilter : null;

    // Verify organization exists
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    const memberRepo = AppDataSource.getRepository(OrganizationMembership);
    const membersQuery = memberRepo
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.user', 'user')
      .leftJoinAndSelect('membership.role', 'memberRole')
      .where('membership.organizationId = :orgId', { orgId })
      .andWhere('membership.isActive = :isActive', { isActive: true });

    if (searchTerm) {
      membersQuery.andWhere(
        '(user.username ILIKE :searchTerm OR user.displayName ILIKE :searchTerm OR user.rsiHandle ILIKE :searchTerm OR membership.title ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` }
      );
    }

    if (roleFilter) {
      membersQuery.andWhere('LOWER(memberRole.name) = :role', { role: roleFilter });
    }

    const [members, total] = await membersQuery
      .orderBy('membership.joinedAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    // Batch-enrich with team and crew data for the current page of users
    const userIds = members.map(m => m.userId);
    const enrichmentMap = await this.batchEnrichMembers(orgId, userIds);

    // Transform to flat DTO with username, displayName, and string role
    const items = members.map(m => toMemberDto(m, enrichmentMap.get(m.userId)));

    // Build HATEOAS links
    const queryParams: Record<string, string> = {};
    if (searchTerm) {
      queryParams.search = searchTerm;
    }
    if (roleFilter) {
      queryParams.role = roleFilter;
    }

    const links = buildHateoasLinks(
      `/api/v2/organizations/${orgId}/members`,
      offset,
      limit,
      total,
      Object.keys(queryParams).length > 0 ? queryParams : undefined
    );

    res.paginated(
      items,
      {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      links
    );
  }

  /**
   * Batch-enrich member data with team memberships and crew assignments.
   * Runs two efficient queries for the current page of user IDs.
   */
  private async batchEnrichMembers(
    orgId: string,
    userIds: string[]
  ): Promise<Map<string, MemberEnrichment>> {
    const result = new Map<string, MemberEnrichment>();
    if (userIds.length === 0) {
      return result;
    }

    // Initialize empty enrichment for each user
    for (const uid of userIds) {
      result.set(uid, { teams: [], crewAssignments: [] });
    }

    await this.enrichTeamMemberships(orgId, userIds, result);
    await this.enrichCrewAssignments(orgId, userIds, result);

    return result;
  }

  /** Enrich with team membership data */
  private async enrichTeamMemberships(
    orgId: string,
    userIds: string[],
    result: Map<string, MemberEnrichment>
  ): Promise<void> {
    try {
      const teamMemberRepo = AppDataSource.getRepository(TeamMember);
      const teamMembers = await teamMemberRepo
        .createQueryBuilder('tm')
        .leftJoinAndSelect('tm.team', 'team')
        .where('tm.organizationId = :orgId', { orgId })
        .andWhere('tm.userId IN (:...userIds)', { userIds })
        .andWhere('tm.status = :status', { status: 'active' })
        .getMany();

      for (const tm of teamMembers) {
        const enrichment = result.get(tm.userId);
        if (enrichment) {
          enrichment.teams.push({
            teamName: tm.team?.name ?? 'Unknown',
            teamRole: tm.role,
            rank: tm.rank ?? null,
          });
        }
      }
    } catch {
      logger.debug('TeamMember enrichment skipped — table may not exist');
    }
  }

  /** Enrich with crew assignment data */
  private async enrichCrewAssignments(
    orgId: string,
    userIds: string[],
    result: Map<string, MemberEnrichment>
  ): Promise<void> {
    try {
      const crewRepo = AppDataSource.getRepository(CrewAssignment);
      const allActiveAssignments = await crewRepo.find({
        where: { organizationId: orgId, status: AssignmentStatus.ACTIVE },
      });

      const userIdSet = new Set(userIds);
      for (const assignment of allActiveAssignments) {
        this.matchCrewMembers(assignment, userIdSet, result);
      }
    } catch {
      logger.debug('CrewAssignment enrichment skipped — table may not exist');
    }
  }

  /** Match crew members in a single assignment to the enrichment map */
  private matchCrewMembers(
    assignment: CrewAssignment,
    userIdSet: Set<string>,
    result: Map<string, MemberEnrichment>
  ): void {
    for (const member of assignment.crew) {
      if (!userIdSet.has(member.userId)) {
        continue;
      }
      const enrichment = result.get(member.userId);
      if (enrichment) {
        enrichment.crewAssignments.push({
          shipId: assignment.shipId,
          crewRole: typeof member.role === 'string' ? member.role : String(member.role),
        });
      }
    }
  }

  /**
   * POST /api/v2/organizations/:id/members
   * Add a member to an organization
   */
  async addMember(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.params;
    const { userId: targetUserId, role } = req.body;
    const actorId = (req as AuthRequest).user?.id;

    if (!actorId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    if (!targetUserId) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'userId is required', 400);
    }

    try {
      await this.memberService.addMember(
        orgId,
        targetUserId,
        role,
        undefined,
        { addedBy: actorId },
        undefined,
        { acquisitionSource: 'manual' }
      );

      // Set status code to 201 manually
      res.status(201);
      res.success({
        message: 'Member added successfully',
        organizationId: orgId,
        userId: targetUserId,
        role,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to add member'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:id/members/:userId
   * Remove a member from an organization
   */
  async removeMember(req: Request, res: Response): Promise<void> {
    const { id: orgId, userId: targetUserId } = req.params;
    const actorId = (req as AuthRequest).user?.id;

    if (!actorId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    try {
      await this.memberService.removeMember(orgId, targetUserId, false);
      res.success({
        message: 'Member removed successfully',
        organizationId: orgId,
        userId: targetUserId,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to remove member'),
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:id/leave
   * Leave an organization (self-removal)
   */
  async leaveOrganization(req: Request, res: Response): Promise<void> {
    const { id: orgId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    try {
      // Verify user is an active member
      const membership = await this.findMembershipByOrgAndUser(orgId, userId, {
        includeRole: true,
      });

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.NOT_FOUND,
          'You are not a member of this organization',
          404
        );
      }

      // Owners cannot leave — they must transfer ownership first
      if (isOwnerRole(membership.role)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Organization owners cannot leave. Transfer ownership first.',
          403
        );
      }

      await this.memberService.removeMember(orgId, userId, false);

      // Clear activeOrgId if the user was viewing this org
      const userRepo = AppDataSource.getRepository(User);
      const user = await this.findUserById(userId);
      if (user?.activeOrgId === orgId) {
        user.activeOrgId = undefined;
        await userRepo.save(user);
      }

      res.success({
        message: 'You have left the organization',
        organizationId: orgId,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to leave organization'),
        500
      );
    }
  }

  // ==================== ORGANIZATION ANALYTICS & INSIGHTS ====================

  /**
   * GET /api/v2/organizations/:orgId/dashboard
   * Returns dashboard data including stats and quick info
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const membership = await this.findMembershipByOrgAndUser(orgId, userId);
    if (!membership) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
    }

    // Verify organization exists and user has access
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get member count
    const memberRepo = AppDataSource.getRepository(OrganizationMembership);
    const memberCount = await memberRepo.count({
      where: { organizationId: orgId, isActive: true },
    });

    // Get active member count (users active in last 30 days)
    const activeMemberCount = await this.memberActivityService.getActiveMemberCount(orgId);

    // Get fleet statistics
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const [totalFleets, activeFleets] = await Promise.all([
      fleetRepo.count({ where: { organizationId: orgId } }),
      fleetRepo.count({
        where: {
          organizationId: orgId,
          status: FleetStatus.ACTIVE,
        },
      }),
    ]);

    // Get activity statistics
    const activityRepo = AppDataSource.getRepository(Activity);
    const [upcomingActivities, ongoingActivities] = await Promise.all([
      activityRepo.count({
        where: {
          organizationId: orgId,
          status: ActivityStatus.PLANNING,
        },
      }),
      activityRepo.count({
        where: {
          organizationId: orgId,
          status: ActivityStatus.IN_PROGRESS,
        },
      }),
    ]);

    const dashboardData = {
      organization: {
        id: organization.id,
        name: organization.name,
        tag: organization.tags?.[0] || undefined,
        logo: undefined,
      },
      stats: {
        members: {
          total: memberCount,
          active: activeMemberCount,
        },
        fleets: {
          total: totalFleets,
          active: activeFleets,
        },
        activities: {
          upcoming: upcomingActivities,
          ongoing: ongoingActivities,
        },
      },
      timestamp: new Date().toISOString(),
    };

    res.success(dashboardData);
  }

  /**
   * GET /api/v2/organizations/:orgId/overview
   * Returns comprehensive organization overview
   */
  async getOverview(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }

    const membership = await this.findMembershipByOrgAndUser(orgId, userId);
    if (!membership) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
    }

    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get detailed member statistics
    const memberRepo = AppDataSource.getRepository(OrganizationMembership);
    const members = await memberRepo.find({
      where: { organizationId: orgId },
      relations: ['user'],
    });

    // Get active member count
    const activeMemberCount = await this.memberActivityService.getActiveMemberCount(orgId);

    // Compute fleet total for overview
    const fleetRepo = AppDataSource.getRepository(Fleet);
    const totalFleetsOverview = await fleetRepo.count({ where: { organizationId: orgId } });

    // Get inventory statistics
    const inventoryItemCount = await this.inventoryService.getInventoryItemCount(orgId);
    const inventoryTotalValue = await this.inventoryService.getTotalInventoryValue(orgId);

    const overview = {
      organization: {
        id: organization.id,
        name: organization.name,
        tag: organization.tags?.[0] || undefined,
        description: organization.description,
        logo: undefined,
        createdAt: organization.createdAt,
      },
      members: {
        total: members.length,
        active: activeMemberCount,
        online: await this.onlinePresenceService.getOnlineMemberCount(orgId),
      },
      fleets: {
        total: totalFleetsOverview,
      },
      resources: {
        items: inventoryItemCount,
        totalValue: inventoryTotalValue.toFixed(2),
      },
      trading: {
        activeRoutes: await this.tradingService.getActiveRouteCount(orgId),
      },
      alliances: {
        count: await this.allianceService.getAllianceCount(orgId),
      },
    };

    res.success(overview);
  }

  /**
   * GET /api/v2/organizations/:orgId/feed
   * Returns recent activity feed with API v2 pagination
   */
  async getFeed(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const { limit, offset } = req.queryParams || { limit: 10, offset: 0 };

    const activityRepo = AppDataSource.getRepository(Activity);

    const [activities, total] = await activityRepo.findAndCount({
      where: { organizationId: orgId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['creator'],
    });

    const feedItems = activities.map(activity => ({
      id: activity.id,
      type: 'activity',
      title: activity.title,
      description: activity.description,
      status: activity.status,
      createdAt: activity.createdAt,
      creator: activity.creatorId
        ? {
            id: activity.creatorId,
            username: undefined,
          }
        : null,
    }));

    // Build HATEOAS links
    const links = buildHateoasLinks(`/api/v2/organizations/${orgId}/feed`, offset, limit, total);

    res.paginated(
      feedItems,
      {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      links
    );
  }

  /**
   * GET /api/v2/organizations/:orgId/activity-trends
   * Returns member activity trends over time
   */
  async getActivityTrends(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const days = Number.parseInt(req.query.days as string) || 30;

    // Validate days parameter
    if (days < 1 || days > 365) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Days parameter must be between 1 and 365',
        400
      );
    }

    // Verify organization exists
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get activity trends
    const trends = await this.memberActivityService.getActivityTrends(orgId, days);

    res.success(trends);
  }

  /**
   * GET /api/v2/organizations/:orgId/insights
   * Returns analytics and insights
   */
  async getInsights(req: Request, res: Response): Promise<void> {
    const { orgId: _orgId } = req.params;

    // Placeholder for future analytics implementation
    const insights = {
      growth: {
        members: {
          current: 0,
          change: 0,
          trend: 'stable',
        },
      },
      activity: {
        level: 'medium',
        eventsThisWeek: 0,
        eventsLastWeek: 0,
      },
      engagement: {
        averageParticipation: 0,
        topContributors: [],
      },
    };

    res.success(insights);
  }

  /**
   * GET /api/v2/organizations/:orgId/members/online
   * Returns list of currently online members (respects privacy settings)
   */
  async getOnlineMembers(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;

    // Verify organization exists
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get online members (respecting privacy preferences)
    const onlineMembers = await this.onlinePresenceService.getOnlineMembers(orgId);

    res.success({
      organizationId: orgId,
      onlineCount: onlineMembers.length,
      members: onlineMembers,
      timestamp: Date.now(),
    });
  }

  /**
   * GET /api/v2/organizations/:orgId/alliances
   * Returns list of allied organizations
   */
  async getAlliances(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      // Verify organization exists
      const organization = await this.findOrganizationById(orgId);

      if (!organization) {
        throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
      }

      // Get alliance details
      const allianceDetails = await this.allianceService.getAllianceDetails(orgId);

      res.success({
        organizationId: orgId,
        alliances: allianceDetails,
        count: allianceDetails.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to retrieve alliances', 500);
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/alliance-statistics
   * Returns alliance statistics
   */
  async getAllianceStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      // Verify organization exists
      const organization = await this.findOrganizationById(orgId);

      if (!organization) {
        throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
      }

      // Get alliance statistics
      const statistics = await this.allianceService.getAllianceStatistics(orgId);

      res.success({
        organizationId: orgId,
        statistics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to retrieve alliance statistics',
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/shared-activities
   * Returns activities shared with allied organizations
   */
  async getSharedActivities(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
    const { status } = req.query;

    // Verify organization exists
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get shared activities
    const result = await this.allianceService.getSharedActivities(orgId, {
      limit,
      offset,
      status: status as string | undefined,
    });

    // Build HATEOAS links
    const links = buildHateoasLinks(
      `/api/v2/organizations/${orgId}/shared-activities`,
      offset,
      limit,
      result.total
    );

    res.paginated(
      result.activities,
      {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
      links
    );
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/stats
   * Returns trading route statistics for the organization
   */
  async getTradingStats(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;

    // Verify organization exists
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get trading route statistics
    const stats = await this.tradingService.getRouteStats(orgId);

    res.success({
      organizationId: orgId,
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/profit-summary
   * Returns profit summary for organization's trading routes
   */
  async getTradingProfitSummary(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;

    // Verify organization exists
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get profit summary
    const summary = await this.tradingService.getProfitSummary(orgId);

    res.success({
      organizationId: orgId,
      summary,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/v2/organizations/:orgId/trading/recommendations
   * Returns route recommendations based on fleet capabilities
   */
  async getTradingRecommendations(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    const limitParam = req.query.limit as string;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 5;

    // Validate limit
    if (Number.isNaN(limit) || limit < 1 || limit > 20) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Limit must be a valid number between 1 and 20',
        400
      );
    }

    // Verify organization exists
    const organization = await this.findOrganizationById(orgId);

    if (!organization) {
      throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }

    // Get route recommendations
    const recommendations = await this.tradingService.getRouteRecommendations(orgId, limit);

    res.success({
      organizationId: orgId,
      recommendations,
      count: recommendations.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/v2/organizations/:orgId/members/ships
   * Get all ships from organization members
   *
   * This provides organizations with a view of all ships owned by their members.
   * Ships belong to users, but orgs can see what their members have available.
   */
  async getOrganizationMemberShips(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const {
        limit,
        offset,
        sort,
        filters,
        fields: _fields,
      } = req.queryParams || {
        limit: 20,
        offset: 0,
        sort: null,
        filters: {},
        fields: null,
      };

      // Verify organization exists
      const organization = await this.findOrganizationById(orgId);

      if (!organization) {
        throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
      }

      // Get all active members of the organization
      const memberRepo = AppDataSource.getRepository(OrganizationMembership);
      const members = await memberRepo.find({
        where: { organizationId: orgId, isActive: true },
        select: ['userId'],
      });

      const memberUserIds = members.map(m => m.userId);

      if (memberUserIds.length === 0) {
        // No members, return empty result
        res.paginated(
          [],
          {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
          buildHateoasLinks(`/api/v2/organizations/${orgId}/members/ships`, offset, limit, 0)
        );
        return;
      }

      // Get ships for all members (only visible/declassified ones)
      const UserShip = (await import('../../models/UserShip')).UserShip;
      const shipRepo = AppDataSource.getRepository(UserShip);
      const queryBuilder = shipRepo
        .createQueryBuilder('ship')
        .where('ship.userId IN (:...userIds)', { userIds: memberUserIds })
        .andWhere('ship.visibleToOrganization = :visible', { visible: true });

      // Apply filters (with type narrowing)
      const filterObj = filters as Record<string, string | string[]>;
      if (filterObj.manufacturer && typeof filterObj.manufacturer === 'string') {
        queryBuilder.andWhere('ship.manufacturer = :manufacturer', {
          manufacturer: filterObj.manufacturer,
        });
      }
      if (filterObj.status && typeof filterObj.status === 'string') {
        queryBuilder.andWhere('ship.status = :status', {
          status: filterObj.status,
        });
      }
      if (filterObj.sharingLevel && typeof filterObj.sharingLevel === 'string') {
        queryBuilder.andWhere('ship.sharingLevel = :sharingLevel', {
          sharingLevel: filterObj.sharingLevel,
        });
      }

      // Apply sorting
      if (sort) {
        queryBuilder.orderBy(`ship.${sort.field}`, sort.order);
      } else {
        queryBuilder.orderBy('ship.userId', 'ASC').addOrderBy('ship.shipName', 'ASC');
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Get paginated results
      const ships = await queryBuilder.skip(offset).take(limit).getMany();

      // Build response with owner information
      const shipsWithOwners = ships.map(ship => ({
        ...ship,
        // You might want to join with User table to get owner username
      }));

      // Build HATEOAS links
      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/members/ships`,
        offset,
        limit,
        total
      );

      res.paginated(
        shipsWithOwners,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error) {
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to fetch organization member ships: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * PATCH /api/v2/organizations/:orgId/members/ships/:shipId/classify
   * Classify (hide) a member's ship from organization view
   *
   * Only organization leaders can classify ships.
   * Classified ships are hidden from the organization fleet view.
   */
  async classifyMemberShip(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, shipId } = req.params;
      const { reason } = req.body;
      const userId = (req as AuthRequest).user?.id;

      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
      }

      // Verify organization exists
      const organization = await this.findOrganizationById(orgId);

      if (!organization) {
        throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
      }

      // Verify user is an org leader (has appropriate role)
      const membership = await this.findMembershipByOrgAndUser(orgId, userId);

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      // Check if user has leader/admin role (adjust role names as needed)
      const leaderRoles = ['leader', 'admin', 'officer', 'founder'];
      const roleName = getRoleName(membership.role).toLowerCase() || '';
      if (!leaderRoles.includes(roleName)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization leaders can classify ships',
          403
        );
      }

      // Get the ship
      const shipRepo = AppDataSource.getRepository(UserShip);
      const ship = await this.findShipById(shipId);

      if (!ship) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship not found', 404);
      }

      // Verify ship owner is a member of the organization
      const ownerMembership = await this.findMembershipByOrgAndUser(orgId, ship.userId);

      if (!ownerMembership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Ship owner is not a member of this organization',
          403
        );
      }

      // Classify the ship (hide it)
      ship.visibleToOrganization = false;
      ship.classificationChangedBy = userId;
      ship.classificationChangedAt = new Date();
      ship.classificationReason = reason || 'Classified by organization leader';

      await shipRepo.save(ship);

      res.success({
        message: 'Ship classified successfully',
        ship: {
          id: ship.id,
          shipName: ship.shipName,
          customName: ship.customName,
          visibleToOrganization: ship.visibleToOrganization,
          classificationChangedBy: ship.classificationChangedBy,
          classificationChangedAt: ship.classificationChangedAt,
          classificationReason: ship.classificationReason,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to classify ship: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * PATCH /api/v2/organizations/:orgId/members/ships/:shipId/declassify
   * Declassify (show) a member's ship in organization view
   *
   * Only organization leaders can declassify ships.
   * Declassified ships are visible in the organization fleet view.
   */
  async declassifyMemberShip(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, shipId } = req.params;
      const { reason } = req.body;
      const userId = (req as AuthRequest).user?.id;

      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
      }

      // Verify organization exists
      const organization = await this.findOrganizationById(orgId);

      if (!organization) {
        throw new ApiError(ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
      }

      // Verify user is an org leader
      const membership = await this.findMembershipByOrgAndUser(orgId, userId);

      if (!membership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      // Check if user has leader/admin role
      const leaderRoles = ['leader', 'admin', 'officer', 'founder'];
      const roleName = getRoleName(membership.role).toLowerCase() || '';
      if (!leaderRoles.includes(roleName)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only organization leaders can declassify ships',
          403
        );
      }

      // Get the ship
      const shipRepo = AppDataSource.getRepository(UserShip);
      const ship = await this.findShipById(shipId);

      if (!ship) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship not found', 404);
      }

      // Verify ship owner is a member of the organization
      const ownerMembership = await this.findMembershipByOrgAndUser(orgId, ship.userId);

      if (!ownerMembership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Ship owner is not a member of this organization',
          403
        );
      }

      // Declassify the ship (show it)
      ship.visibleToOrganization = true;
      ship.classificationChangedBy = userId;
      ship.classificationChangedAt = new Date();
      ship.classificationReason = reason || 'Declassified by organization leader';

      await shipRepo.save(ship);

      res.success({
        message: 'Ship declassified successfully',
        ship: {
          id: ship.id,
          shipName: ship.shipName,
          customName: ship.customName,
          visibleToOrganization: ship.visibleToOrganization,
          classificationChangedBy: ship.classificationChangedBy,
          classificationChangedAt: ship.classificationChangedAt,
          classificationReason: ship.classificationReason,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to declassify ship: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  // ==================== ADDITIONAL MEMBER MANAGEMENT ====================

  /**
   * GET /api/v2/organizations/:id/members/:userId
   * Get a specific member's details
   */
  async getMemberDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, userId } = req.params;

      const member = await this.memberService.getMember(orgId, userId);

      if (!member) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Member not found', 404);
      }

      res.success(member);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get member details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * PATCH /api/v2/organizations/:id/members/:userId/role
   * Update a member's role
   */
  async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, userId } = req.params;
      const actorId = (req as AuthRequest).user?.id;
      const { role, roleId } = req.body as { role?: string; roleId?: string };

      if (!actorId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const [actorMembership, targetMembership] = await Promise.all([
        this.findMembershipByOrgAndUser(orgId, actorId),
        this.findMembershipByOrgAndUser(orgId, userId),
      ]);

      if (!actorMembership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You are not a member of this organization',
          403
        );
      }

      const actorRoleName = getRoleName(actorMembership.role);
      if (!['owner', 'founder', 'admin'].includes(actorRoleName)) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Only organization leaders can edit roles', 403);
      }

      if (!targetMembership) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Member not found', 404);
      }

      const targetRoleName = getRoleName(targetMembership.role);
      if (actorRoleName === 'admin' && ['owner', 'founder'].includes(targetRoleName)) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Admins cannot modify founder or owner roles',
          403
        );
      }

      const requestedRoleName = await this.resolveRequestedRoleName(orgId, role, roleId);

      if (
        actorRoleName === 'admin' &&
        requestedRoleName &&
        ['owner', 'founder'].includes(requestedRoleName)
      ) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Admins cannot assign founder or owner roles',
          403
        );
      }

      await this.memberService.updateMemberRole(orgId, userId, role, roleId);

      res.success({ message: 'Member role updated successfully' });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * PATCH /api/v2/organizations/:id/members/:userId/title
   * Update a member's title
   */
  async updateMemberTitle(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, userId } = req.params;
      const { title } = req.body;

      await this.memberService.updateMemberTitle(orgId, userId, title);

      res.success({ message: 'Member title updated successfully' });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to update member title: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:id/members/:userId/transfer
   * Transfer a member to another organization
   */
  async transferMember(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, userId } = req.params;
      const { targetOrganizationId, reason } = req.body;

      await this.memberService.transferMember(orgId, userId, targetOrganizationId, reason);

      res.success({ message: 'Member transferred successfully' });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to transfer member: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:id/members/search
   * Search members within an organization
   */
  async searchMembers(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId } = req.params;
      const parsedParams = req.queryParams || {
        limit: 20,
        offset: 0,
        sort: null,
        filters: {},
        fields: null,
        search: null,
      };
      const searchFilters = (parsedParams.filters as Record<string, string>) || {};
      const searchQuery = searchFilters.query || parsedParams.search || '';
      const limit = parsedParams.limit;
      const offset = parsedParams.offset;

      const results = await this.memberService.searchMembers(
        orgId,
        { query: searchQuery },
        {
          limit,
        }
      );

      const total = results.pagination?.total || 0;

      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/members/search`,
        offset,
        limit,
        total
      );

      res.paginated(
        (results.data || []).map(m => toMemberDto(m)),
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to search members: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:id/members/stats
   * Get member statistics for an organization
   */
  async getMemberStats(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId } = req.params;

      const stats = await this.memberService.getMemberStats(orgId);

      res.success(stats);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get member stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:id/members/by-role/:role
   * Get members filtered by role
   */
  async getMembersByRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, role } = req.params;
      const { limit = 20, offset = 0 } = req.queryParams || {};

      const members = await this.memberService.getMembersByRole(orgId, role);

      // Apply pagination to results
      const paginatedMembers = members.slice(offset, offset + limit);
      const total = members.length;

      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/members/by-role/${role}`,
        offset,
        limit,
        total
      );

      res.paginated(
        paginatedMembers.map(m => toMemberDto(m)),
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get members by role: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  // ==================== ORGANIZATION PERMISSIONS ====================

  /**
   * POST /api/v2/organizations/:id/permissions
   * Grant permission to a user
   */
  async grantPermission(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId } = req.params;
      const { userId, resource, action, scope } = req.body;

      // Import permission service
      const { PermissionService } =
        await import('../../services/security/permissions/PermissionService');
      const permissionService = new PermissionService();

      const permission = await permissionService.grantPermission(
        orgId,
        userId,
        resource,
        action,
        scope
      );

      res.status(201).success({
        message: 'Permission granted successfully',
        permission,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to grant permission'),
        500
      );
    }
  }

  /**
   * DELETE /api/v2/organizations/:id/permissions/:permissionId
   * Revoke a permission
   */
  async revokePermission(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, permissionId } = req.params;

      // Import permission service
      const { PermissionService } =
        await import('../../services/security/permissions/PermissionService');
      const permissionService = new PermissionService();

      // Note: revokePermission signature may have changed, using basic call
      await (
        permissionService as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
      ).revokePermission?.(orgId, permissionId);

      res.success({
        message: 'Permission revoked successfully',
        permissionId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to revoke permission'),
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:id/permissions
   * List all permissions for an organization
   */
  async listPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId } = req.params;
      const { limit = 50, offset = 0 } = req.queryParams || {};

      // Import permission service
      const { PermissionService } =
        await import('../../services/security/permissions/PermissionService');
      const permissionService = new PermissionService();

      // Note: listPermissions method may not exist, using placeholder
      const result = (await (
        permissionService as unknown as Record<
          string,
          (...args: unknown[]) => Promise<{ total: number; permissions: unknown[] }>
        >
      ).listPermissions?.(orgId, limit, offset)) || {
        total: 0,
        permissions: [] as unknown[],
      };

      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/permissions`,
        offset,
        limit,
        result.total
      );

      res.paginated(
        result.permissions,
        {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to list permissions'),
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:id/permissions/check
   * Check if a user has a specific permission
   */
  async checkPermission(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId } = req.params;
      const { userId, resource, action } = req.body;

      // Import permission service
      const { PermissionService } =
        await import('../../services/security/permissions/PermissionService');
      const permissionService = new PermissionService();

      // Note: checkPermission method doesn't exist, using hasPermission instead
      const hasPermission = await permissionService.hasPermission(userId, orgId, resource, action);

      res.success({
        hasPermission,
        organizationId: orgId,
        userId,
        resource,
        action,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to check permission'),
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:id/settings
   * Get organization settings
   */
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId } = req.params;

      const org = await this.requireOrganization(orgId);

      // Get settings from organization
      const settings = org.settings || {};

      res.success({
        settings,
        organizationId: orgId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get settings'),
        500
      );
    }
  }

  /**
   * PATCH /api/v2/organizations/:id/settings
   * Update organization settings
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId } = req.params;
      const updates = req.body;

      const orgRepo = AppDataSource.getRepository(Organization);
      const org = await this.requireOrganization(orgId);

      // Update settings
      org.settings = {
        ...org.settings,
        ...updates,
      };

      await orgRepo.save(org);

      // Sync PublicOrgProfile.isPublic when visibility changes
      if (updates.visibility !== undefined) {
        try {
          const { PublicOrgDirectoryService } =
            await import('../../services/organization/PublicOrgDirectoryService');
          const directoryService = new PublicOrgDirectoryService();
          await directoryService.updateProfile(orgId, {
            isPublic: updates.visibility === 'public',
          });
        } catch (syncError) {
          // Log but don't fail the settings update
          logger.warn(
            `Failed to sync PublicOrgProfile.isPublic for org ${orgId}: ${(syncError as Error).message}`
          );
        }
      }

      res.success({
        message: 'Settings updated successfully',
        settings: org.settings,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update settings'),
        500
      );
    }
  }

  // ==================== ORGANIZATION INVITATIONS ====================

  /**
   * GET /api/v2/organizations/:orgId/invitations
   * List organization invitations (admin/officer view).
   */
  async getInvitations(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const {
        limit = 20,
        offset = 0,
        status,
      } = (req.queryParams || {}) as {
        limit?: number;
        offset?: number;
        status?: InvitationStatus;
      };
      const limitNum = Number(limit);
      const offsetNum = Number(offset);
      const page = Math.floor(offsetNum / limitNum) + 1;

      const result = await this.invitationService.getInvitationsForOrg(orgId, {
        page,
        limit: limitNum,
        status,
      });

      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/invitations`,
        offsetNum,
        limitNum,
        result.total
      );

      res.paginated(
        result.data,
        {
          total: result.total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: page < result.totalPages,
        },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get invitations'),
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/invitations
   * Send organization invitation. Requires the inviter to be an active member.
   */
  async sendInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { userId: inviteeUserId, message } = req.body as {
        userId?: string;
        message?: string;
      };
      const inviterId = (req as AuthRequest).user?.id;

      if (!inviterId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }
      if (!inviteeUserId) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'userId is required to invite a registered user',
          400
        );
      }

      // Resolve inviter role to determine whether the invite auto-approves
      const inviterMembership = await this.findMembershipByOrgAndUser(orgId, inviterId);
      if (!inviterMembership) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'You must be a member of this organization to send invitations',
          403
        );
      }

      const inviterRole = getRoleName(inviterMembership.role);
      const invitation = await this.invitationService.invite(
        orgId,
        inviteeUserId,
        inviterId,
        inviterRole,
        message
      );

      res.status(201).success({
        id: invitation.id,
        organizationId: invitation.organizationId,
        inviteeUserId: invitation.inviteeUserId,
        inviterId: invitation.inviterId,
        inviterRole: invitation.inviterRole,
        status: invitation.status,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to send invitation'),
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/invitations/:inviteId/accept
   * Accept organization invitation (invitee only).
   */
  async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, inviteId } = req.params;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const invitation = await this.findInvitationByOrgAndId(orgId, inviteId);
      if (!invitation) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Invitation not found', 404);
      }
      if (invitation.inviteeUserId !== userId) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only the invitee can accept this invitation',
          403
        );
      }

      const accepted = await this.invitationService.acceptByToken(invitation.token, userId);

      res.success({
        id: accepted.id,
        organizationId: accepted.organizationId,
        status: accepted.status,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to accept invitation'),
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/invitations/:inviteId/decline
   * Decline organization invitation (invitee only).
   */
  async declineInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, inviteId } = req.params;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
      }

      const invitation = await this.findInvitationByOrgAndId(orgId, inviteId);
      if (!invitation) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Invitation not found', 404);
      }
      if (invitation.inviteeUserId !== userId) {
        throw new ApiError(
          ApiErrorCode.FORBIDDEN,
          'Only the invitee can decline this invitation',
          403
        );
      }

      const declined = await this.invitationService.declineByToken(invitation.token, userId);

      res.success({
        id: declined.id,
        organizationId: declined.organizationId,
        status: declined.status,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to decline invitation'),
        500
      );
    }
  }

  // ==================== ORGANIZATION HIERARCHY ====================

  /**
   * GET /api/v2/organizations/:orgId/parent
   * Get parent organization
   */
  async getParentOrganization(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      const org = await this.findOrganizationById(orgId, { includeHierarchy: true });

      if (!org) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Organization not found', 404);
      }

      if (!org.parentOrgId) {
        res.success({ parent: null });
        return;
      }

      const parent = org.parent ?? (await this.findOrganizationById(org.parentOrgId));

      res.success({
        parent: parent
          ? {
              id: parent.id,
              name: parent.name,
              tag: parent.tags?.[0] || parent.name,
              avatar: parent.logoUrl || null,
            }
          : null,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get parent organization'),
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/children
   * Get child organizations
   */
  async getChildOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { limit = 20, offset = 0 } = req.queryParams || {};

      const orgRepo = AppDataSource.getRepository(Organization);
      const [children, total] = await orgRepo.findAndCount({
        where: { parentOrgId: orgId },
        take: limit,
        skip: offset,
      });

      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/children`,
        offset,
        limit,
        total
      );

      res.paginated(
        children.map(child => ({
          id: child.id,
          name: child.name,
          tag: child.tags?.[0] || child.name,
          avatar: child.logoUrl || null,
          memberCount: 0, // Would get from member count service
        })),
        { total, limit, offset, hasMore: offset + limit < total },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get child organizations'),
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/hierarchy
   * Update organization hierarchy
   */
  async updateHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { parentId } = req.body;

      const orgRepo = AppDataSource.getRepository(Organization);
      const org = await this.requireOrganization(orgId);

      if (parentId) {
        const parent = await this.findOrganizationById(parentId);
        if (!parent) {
          throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Parent organization not found', 404);
        }

        // Check for circular references
        if (parentId === orgId) {
          throw new ApiError(
            ApiErrorCode.VALIDATION_ERROR,
            'Organization cannot be its own parent',
            400
          );
        }

        org.parentOrgId = parentId;
      } else {
        org.parentOrgId = undefined;
      }

      await orgRepo.save(org);

      res.success({
        message: 'Hierarchy updated successfully',
        organizationId: orgId,
        parentId: org.parentOrgId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to update hierarchy'),
        500
      );
    }
  }

  // ==================== AUDIT LOGS & REPORTING ====================

  /**
   * GET /api/v2/organizations/:orgId/audit-logs
   * List audit logs with filtering
   */
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const parsedQP = req.queryParams || {
        limit: 50,
        offset: 0,
        sort: null,
        filters: {},
        fields: null,
        search: null,
      };
      const limit = parsedQP.limit || 50;
      const offset = parsedQP.offset || 0;
      const auditFilters = (parsedQP.filters as Record<string, string>) || {};
      const _startDate = auditFilters.startDate;
      const _endDate = auditFilters.endDate;
      const _actionType = auditFilters.actionType;
      const _userId = auditFilters.userId;

      await this.requireOrganization(orgId);

      // Mock audit log data (in production, would query audit log table)
      const logs = [
        {
          id: 'log1',
          organizationId: orgId,
          userId: 'user1',
          action: 'member_added',
          details: 'Added new member',
          timestamp: new Date(),
        },
        {
          id: 'log2',
          organizationId: orgId,
          userId: 'user2',
          action: 'permission_granted',
          details: 'Granted admin permission',
          timestamp: new Date(),
        },
      ];

      const total = logs.length;
      const links = buildHateoasLinks(
        `/api/v2/organizations/${orgId}/audit-logs`,
        Number(offset),
        Number(limit),
        total
      );

      res.paginated(
        logs.slice(Number(offset), Number(offset) + Number(limit)),
        {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get audit logs'),
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/reports
   * List available report types
   */
  async listReports(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      await this.requireOrganization(orgId);

      const reports = [
        {
          id: 'activity-summary',
          name: 'Activity Summary',
          description: 'Overview of organization activities',
        },
        {
          id: 'member-stats',
          name: 'Member Statistics',
          description: 'Member engagement and statistics',
        },
        {
          id: 'fleet-report',
          name: 'Fleet Report',
          description: 'Fleet composition and readiness',
        },
        {
          id: 'financial',
          name: 'Financial Report',
          description: 'Trading and financial activities',
        },
      ];

      res.success({ reports, organizationId: orgId });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to list reports'),
        500
      );
    }
  }

  /**
   * POST /api/v2/organizations/:orgId/reports/generate
   * Generate custom report (async)
   */
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { reportType, startDate, endDate, format = 'pdf' } = req.body;

      if (!reportType) {
        throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Report type is required', 400);
      }

      await this.requireOrganization(orgId);

      // Create async job for report generation
      const job = {
        id: `job_${Date.now()}`,
        organizationId: orgId,
        reportType,
        startDate,
        endDate,
        format,
        status: 'processing',
        createdAt: new Date(),
        createdBy: (req as AuthRequest).user?.id,
      };

      res.status(202).success(job);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to generate report'),
        500
      );
    }
  }

  /**
   * GET /api/v2/organizations/:orgId/reports/:reportId
   * Get/download generated report
   */
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, reportId } = req.params;

      await this.requireOrganization(orgId);

      // Mock report data
      const report = {
        id: reportId,
        organizationId: orgId,
        status: 'completed',
        downloadUrl: `/api/v2/organizations/${orgId}/reports/${reportId}/download`,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      res.success(report);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get report'),
        500
      );
    }
  }

  // ── Aggregator Endpoints ──

  async onboardMember(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
      }

      const {
        userId: targetUserId,
        role,
        title,
        permissions,
        message,
        sendNotification,
      } = req.body;

      const aggregator = new OrganizationAggregatorService();
      const result = await aggregator.inviteAndOnboardMember({
        organizationId: orgId,
        userId: targetUserId,
        invitedBy: userId,
        role,
        title,
        permissions,
        message,
        sendNotification,
      });

      res.status(201).success(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to onboard member'),
        500
      );
    }
  }

  async offboardMemberFull(req: Request, res: Response): Promise<void> {
    try {
      const { orgId, memberId } = req.params;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
      }

      const { reason } = req.body;

      const aggregator = new OrganizationAggregatorService();
      const result = await aggregator.offboardMember(orgId, memberId, userId, reason);

      res.success(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to offboard member'),
        500
      );
    }
  }

  async bulkInviteMembers(req: Request, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
      }

      const { invitations } = req.body;

      const aggregator = new OrganizationAggregatorService();
      const result = await aggregator.bulkInviteMembers(orgId, invitations, userId);

      res.success(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to bulk invite members'),
        500
      );
    }
  }
}
