import {
  deriveDefaultCrewSlots,
  SystemRole,
  type CrewSlot,
  type ParticipantInfo,
  type PassengerSlot,
} from '@sc-fleet-manager/shared-types';
import { Brackets, In, type SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  Activity,
  ActivityApplication,
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ApplicationStatus,
  ParticipantRole,
  RouteWaypoint,
  ShipAssignment,
  type ActivityParticipant,
} from '../../models/Activity';
import {
  ActivityNotFoundError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { invalidateActivityCache } from '../../utils/cacheInvalidation';
import { resolveShipCrew } from '../../utils/crewCalculation';
import { logger } from '../../utils/logger';
import { emitActivityUpdated } from '../../websocket/controllers/activityWebSocketController';
import { TenantService } from '../base/TenantService';
import { VoiceChannelService } from '../communication';
import { RegolithService } from '../content';
import { domainEvents } from '../shared/DomainEventBus';
import { UserService } from '../user/UserService';

import type { ActivityAuditEntry } from './ActivityAuditLogger';
import { ActivityAuditAction, activityAuditLogger } from './ActivityAuditLogger';
import { ActivityEventService } from './ActivityEventService';
import { ActivityJobService } from './ActivityJobService';
import { ActivityParticipantService } from './ActivityParticipantService';
import type {
  ActivitySearchFilters,
  ActivityStatistics,
  BringFleetAndInviteResult,
  CreateActivityDTO,
  JoinActivityDTO,
  ShipManagementCapabilities,
} from './ActivityService.types';
import { RouteCalculationService } from './RouteCalculationService';
// DTOs and result shapes extracted to a sibling types module (E5 decomposition).
// Imported for internal use and re-exported below so `./ActivityService` and the
// `services/activity` barrel keep exposing them unchanged.

export type {
  ActivitySearchFilters,
  ActivityStatistics,
  BringFleetAndInviteResult,
  CreateActivityDTO,
  JoinActivityDTO,
  ShipManagementCapabilities,
} from './ActivityService.types';

/**
 * Unified Activity Service
 * Manages all activity types: missions, contracts, bounties, events, LFG, and operations
 * Supports single-org and cross-org operations with dynamic voice channel integration
 *
 * MULTI-TENANCY: This service is tenant-aware and automatically filters activities by organization.
 * Use findAllIncludingShared() to get activities shared with the organization.
 * CACHING: Enabled with 10-minute TTL for improved performance on frequently accessed activities
 * AUDIT LOGGING: Comprehensive audit trail for all activity operations
 */
export class ActivityService extends TenantService<Activity> {
  private readonly voiceChannelService: VoiceChannelService;

  constructor() {
    super(AppDataSource.getRepository(Activity), {
      enableCache: true,
      cacheTTL: 600, // 10 minutes
      cacheCheckPeriod: 120, // 2 minutes
    });
    this.voiceChannelService = VoiceChannelService.getInstance();
  }

  // ==================== AUDIT LOGGING (delegated to ActivityAuditLogger) ====================

  /**
   * Log an activity audit event.
   * Delegates to the centralized ActivityAuditLogger singleton.
   */
  private logActivityAudit(entry: Omit<ActivityAuditEntry, 'timestamp'>): void {
    activityAuditLogger.log(entry);
  }

  /**
   * Get activity audit log (delegates to ActivityAuditLogger)
   */
  public getActivityAuditLog(options?: {
    activityId?: string;
    organizationId?: string;
    performedById?: string;
    action?: ActivityAuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): ActivityAuditEntry[] {
    return activityAuditLogger.getAuditLog(options);
  }

  /**
   * Get audit statistics for an activity (delegates to ActivityAuditLogger)
   */
  public getActivityAuditStats(activityId: string): {
    totalEvents: number;
    byAction: Record<string, number>;
    uniqueUsers: number;
    lastActivity: Date | null;
    recentEvents: ActivityAuditEntry[];
  } {
    return activityAuditLogger.getActivityAuditStats(activityId);
  }

  // ==================== CREATE ACTIVITY ====================

  /**
   * Create a new activity (tenant-scoped)
   * @param organizationId - Organization creating the activity
   * @param dto - Activity data
   */
  async createActivity(organizationId: string, dto: CreateActivityDTO): Promise<Activity> {
    // ─── NEW (M1): CREW MEMBER VALIDATION ───────────────────────

    if (dto.crewMembers && dto.crewMembers.length > 0) {
      // Safety: Validate crew member objects
      const validCrewMembers = dto.crewMembers.filter(
        (c): c is (typeof dto.crewMembers)[0] =>
          c !== null && typeof c === 'object' && c.userId !== null && typeof c.userId === 'string'
      );

      if (validCrewMembers.length !== dto.crewMembers.length) {
        throw new ValidationError('Crew members contain invalid entries');
      }

      const crewUserIds = validCrewMembers.map(c => c.userId);

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalidFormats = crewUserIds.filter(id => !uuidRegex.test(id));
      if (invalidFormats.length > 0) {
        throw new ValidationError(`Invalid user ID format: ${invalidFormats.join(', ')}`);
      }

      // Check for duplicates
      const uniqueCrewIds = [...new Set(crewUserIds)];
      if (uniqueCrewIds.length !== crewUserIds.length) {
        throw new ValidationError(
          `Duplicate crew members detected (${crewUserIds.length - uniqueCrewIds.length} duplicate(s))`
        );
      }

      // Verify crew belongs to organization
      const userService = new UserService();
      const validation = await userService.validateUsersInOrganization(
        uniqueCrewIds,
        organizationId
      );

      if (validation.invalid.length > 0) {
        throw new ValidationError(
          `Crew members not in organization (${validation.invalid.length}): ${validation.invalid.join(', ')}`
        );
      }

      logger.info('Crew verification passed', {
        organizationId,
        crewCount: validation.valid.length,
      });
    }

    // ─── EXISTING: CREATE ACTIVITY ─────────────────────────────

    // Use the base class create method which automatically sets organizationId
    // Default to PUBLIC visibility when no org (personal events should be discoverable)
    const defaultVisibility = organizationId
      ? ActivityVisibility.ORGANIZATION
      : ActivityVisibility.PUBLIC;
    // Recruitment/job listing posts represent org vacancies — the creator is the poster,
    // not someone filling a position, so they should not be added as a participant.
    const isRecruitmentType =
      dto.activityType === ActivityType.RECRUITMENT ||
      dto.activityType === ActivityType.JOB_LISTING;
    const activity = await this.create(organizationId, {
      title: dto.title,
      description: dto.description,
      activityType: dto.activityType,
      status: ActivityStatus.OPEN,
      visibility: dto.visibility ?? defaultVisibility,
      creatorId: dto.creatorId,
      creatorName: dto.creatorName,
      organizationName: dto.organizationName,
      scheduledStartDate: dto.scheduledStartDate,
      scheduledEndDate: dto.scheduledEndDate,
      timezone: dto.timezone,
      estimatedDuration: dto.estimatedDuration,
      location: dto.location,
      systemLocation: dto.systemLocation,
      maxParticipants: dto.maxParticipants,
      minParticipants: dto.minParticipants ?? 1,
      currentParticipants: isRecruitmentType ? 0 : 1,
      // @ts-expect-error - DTO uses simplified format, will be transformed
      roleRequirements: dto.roleRequirements,
      // @ts-expect-error - DTO uses simplified format, will be transformed
      resourceRequirements: dto.resourceRequirements,
      rewardCredits: dto.rewardCredits ?? 0,
      rewardReputation: dto.rewardReputation ?? 0,
      tags: dto.tags ?? [],
      categories: dto.categories ?? [],
      metadata: dto.metadata,
      participants: isRecruitmentType
        ? []
        : [
            {
              userId: dto.creatorId,
              userName: dto.creatorName,
              organizationId,
              organizationName: dto.organizationName,
              role: ParticipantRole.LEADER,
              status: 'accepted',
              joinedAt: new Date(),
            },
          ],
      participatingOrgs: isRecruitmentType
        ? []
        : [
            {
              organizationId,
              organizationName: dto.organizationName,
              role: 'host',
              memberCount: 1,
              status: 'accepted',
              joinedAt: new Date(),
            },
          ],
      invitedOrgs: [],
      alliedOrgs: [],
    });

    let savedActivity = await this.repository.save(activity);

    // Sync creator to normalized activity_participants table so RSVP, ship
    // management, and all participant lookups work correctly.
    if (!isRecruitmentType) {
      await this.participantService.joinActivity(savedActivity.id, {
        userId: dto.creatorId,
        userName: dto.creatorName,
        organizationId,
        organizationName: dto.organizationName,
        role: ParticipantRole.LEADER,
      });
    }

    // Create voice channel if requested
    if (dto.createVoiceChannel && dto.organizationId) {
      await this.createVoiceChannelForActivity(
        savedActivity,
        dto.voiceChannelTemplate,
        dto.voiceChannelLimit,
        dto.voiceChannelBitrate
      );
    }

    // Add route plan if provided
    if (dto.routePlan && dto.routePlan.length > 0) {
      savedActivity = await this.addRoutePlan(savedActivity.id, dto.creatorId, dto.routePlan);
    }

    // Auto-enrich with mining data if requested
    if (dto.autoEnrichMining !== false) {
      // Default to true
      savedActivity = await this.autoEnrichMiningActivity(savedActivity);
    }

    // Calculate route data if ships and/or route plan provided
    if (
      (savedActivity.shipAssignments && savedActivity.shipAssignments.length > 0) ||
      (savedActivity.routePlan && savedActivity.routePlan.length > 0)
    ) {
      savedActivity = await this.routeCalcService.updateActivityRouteData(savedActivity);
      // Save the updated route calculations
      savedActivity = await this.repository.save(savedActivity);
    }

    // ─── NEW (M1): AUDIT LOG ──────────────────────────────────

    if (dto.crewMembers && dto.crewMembers.length > 0) {
      try {
        logger.info('Activity crew members verified', {
          activityId: savedActivity.id,
          crewCount: dto.crewMembers.length,
          organizationId,
          createdBy: dto.creatorId,
          crewIds: dto.crewMembers.map((c: { userId: string }) => c.userId),
        });
      } catch (auditError) {
        logger.error('Crew verification audit logging failed (non-blocking)', {
          activityId: savedActivity.id,
          error: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }
    }

    // ─── EXISTING: MAIN AUDIT LOG ────────────────────────────

    // Log audit event for activity creation
    this.logActivityAudit({
      action: ActivityAuditAction.ACTIVITY_CREATED,
      activityId: savedActivity.id,
      activityTitle: savedActivity.title,
      activityType: savedActivity.activityType,
      organizationId,
      performedById: dto.creatorId,
      performedByName: dto.creatorName,
      details: {
        visibility: savedActivity.visibility,
        maxParticipants: savedActivity.maxParticipants,
        scheduledStartDate: savedActivity.scheduledStartDate,
        timezone: savedActivity.timezone,
        tags: savedActivity.tags,
        hasVoiceChannel: !!dto.createVoiceChannel,
        hasRoutePlan: dto.routePlan && dto.routePlan.length > 0,
        hasShipAssignments:
          savedActivity.shipAssignments && savedActivity.shipAssignments.length > 0,
        totalCargoCapacity: savedActivity.totalCargoCapacity,
        hasRefuelShip: savedActivity.hasRefuelShip,
      },
    });

    domainEvents.emit('activity:created', {
      activityId: savedActivity.id,
      organizationId,
      activityType: savedActivity.activityType,
      title: savedActivity.title,
      hostUserId: dto.creatorId,
      scheduledAt: dto.scheduledStartDate?.toISOString(),
      maxParticipants: savedActivity.maxParticipants,
      timezone: savedActivity.timezone,
      description: savedActivity.description,
      location: savedActivity.location,
      estimatedDuration: savedActivity.estimatedDuration,
      discordServerId: savedActivity.metadata?.discordServerId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Created activity: ${savedActivity.id} (${dto.activityType})`);
    invalidateActivityCache(organizationId);
    return savedActivity;
  }

  // ==================== PARTICIPANT MANAGEMENT (delegated to ActivityParticipantService) ====================

  private _participantService?: ActivityParticipantService;
  private get participantService(): ActivityParticipantService {
    this._participantService ??= new ActivityParticipantService();
    return this._participantService;
  }

  private _routeCalcService?: RouteCalculationService;
  private get routeCalcService(): RouteCalculationService {
    this._routeCalcService ??= new RouteCalculationService();
    return this._routeCalcService;
  }

  /**
   * Recalculate fleet cargo/fuel totals from ship assignments.
   * Updates activity fields in-place (does NOT save to DB).
   */
  private async recalculateFleetTotals(activity: Activity): Promise<void> {
    const routeData = await this.routeCalcService.calculateRoute(
      activity.shipAssignments ?? activity.ships ?? [],
      activity.routePlan
    );
    activity.totalCargoCapacity = routeData.totalCargoCapacity;
    activity.totalQuantumFuel = routeData.totalQuantumFuel;
    activity.totalQuantumFuelRequired = routeData.totalQuantumFuelRequired;
    activity.maxJumpRange = routeData.maxJumpRange;
    activity.hasRefuelShip = routeData.hasRefuelShip;
  }

  // ==================== VOICE CHANNEL INTEGRATION ====================

  /**
   * Create a voice channel for an activity
   */
  async createVoiceChannelForActivity(
    activity: Activity,
    templateId?: string,
    userLimit?: number,
    bitrate?: number
  ): Promise<void> {
    const expiresAt = activity.scheduledEndDate
      ? new Date(activity.scheduledEndDate.getTime() + 2 * 60 * 60 * 1000)
      : undefined;

    activity.voiceChannel = {
      templateId: templateId ?? 'default',
      autoCreate: true,
      autoDelete: true,
      userLimit: userLimit ?? activity.maxParticipants,
      bitrate,
      expiresAt,
    };

    await this.repository.save(activity);
    logger.info(`Configured voice channel for activity: ${activity.id}`);
  }

  /**
   * Link existing Discord voice channel to activity (delegates to ActivityEventService)
   */
  async linkVoiceChannel(
    activityId: string,
    channelId: string,
    guildId: string
  ): Promise<Activity> {
    return this.eventService.linkVoiceChannel(activityId, channelId, guildId);
  }

  // ==================== JOIN/LEAVE ACTIVITY (delegated to ActivityParticipantService) ====================

  /**
   * Join an activity (delegates to ActivityParticipantService)
   */
  async joinActivity(
    activityId: string,
    dto: JoinActivityDTO
  ): Promise<{ activity: Activity; wasUpdate: boolean }> {
    return this.participantService.joinActivity(activityId, dto);
  }

  /**
   * Non-breaking Phase 1 adapter for canonical participant shape.
   */
  static toParticipantInfo(participant: ActivityParticipant): ParticipantInfo {
    const statusMap: Record<ActivityParticipant['status'], ParticipantInfo['status']> = {
      invited: 'invited',
      accepted: 'active',
      declined: 'inactive',
      standby: 'waitlisted',
    };

    return {
      userId: participant.userId,
      organizationId: participant.organizationId,
      username: participant.userName,
      displayName: participant.userName,
      avatar: participant.avatarUrl,
      roles:
        participant.role === ParticipantRole.LEADER ||
        participant.role === ParticipantRole.CO_LEADER ||
        participant.role === ParticipantRole.COMMANDER
          ? [SystemRole.ACTIVITY_HOST]
          : [SystemRole.ACTIVITY_PARTICIPANT],
      primaryRole: participant.role,
      status: statusMap[participant.status],
      joinedAt: participant.joinedAt,
      source: 'manual',
      metadata: {
        shipType: participant.shipType,
        shipName: participant.shipName,
        shipId: participant.shipId,
        crewPosition: participant.crewPosition,
      },
    };
  }

  toParticipantInfo(participant: ActivityParticipant): ParticipantInfo {
    return ActivityService.toParticipantInfo(participant);
  }

  /**
   * Leave an activity (delegates to ActivityParticipantService)
   */
  async leaveActivity(activityId: string, userId: string): Promise<Activity> {
    return this.participantService.leaveActivity(activityId, userId);
  }

  // ==================== ORGANIZATION MANAGEMENT (delegated to ActivityParticipantService) ====================

  /**
   * Invite organization to activity (delegates to ActivityParticipantService)
   */
  async inviteOrganization(
    activityId: string,
    organizationId: string,
    organizationName: string,
    invitedBy: string,
    role: 'co_host' | 'participant' | 'allied' | 'contracted' = 'participant'
  ): Promise<Activity> {
    return this.participantService.inviteOrganization(
      activityId,
      organizationId,
      organizationName,
      invitedBy,
      role
    );
  }

  /**
   * Accept organization invitation (delegates to ActivityParticipantService)
   */
  async acceptOrganizationInvite(
    activityId: string,
    organizationId: string,
    _acceptedBy: string
  ): Promise<Activity> {
    return this.participantService.acceptOrganizationInvite(activityId, organizationId);
  }

  /**
   * Decline organization invitation (delegates to ActivityParticipantService)
   */
  async declineOrganizationInvite(activityId: string, organizationId: string): Promise<Activity> {
    return this.participantService.declineOrganizationInvite(activityId, organizationId);
  }

  // ==================== SEARCH AND FILTER ====================

  /**
   * Apply activity-type / status / visibility / org / creator filters.
   */
  private applyEnumAndOwnershipFilters(
    qb: SelectQueryBuilder<Activity>,
    filters: ActivitySearchFilters
  ): void {
    // Exclude internal recruitment activities unless explicitly requested
    if (!filters.activityType) {
      qb.andWhere('activity.activityType != :excludedType', {
        excludedType: ActivityType.RECRUITMENT,
      });
    }

    if (filters.activityType) {
      if (Array.isArray(filters.activityType)) {
        qb.andWhere('activity.activityType IN (:...types)', { types: filters.activityType });
      } else {
        qb.andWhere('activity.activityType = :type', { type: filters.activityType });
      }
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        qb.andWhere('activity.status IN (:...statuses)', { statuses: filters.status });
      } else {
        qb.andWhere('activity.status = :status', { status: filters.status });
      }
    }

    if (filters.visibility) {
      qb.andWhere('activity.visibility = :visibility', { visibility: filters.visibility });
    }

    if (filters.organizationId) {
      qb.andWhere('activity.organizationId = :orgId', { orgId: filters.organizationId });
    }

    if (filters.creatorId) {
      qb.andWhere('activity.creatorId = :creatorId', { creatorId: filters.creatorId });
    }
  }

  /**
   * Apply participating-orgs JSONB filter.
   *
   * participatingOrgs is stored as a JSONB array of objects, e.g.:
   *   [{ "organizationId": "ORG1" }, { "organizationId": "ORG2" }, ...]
   *
   * We use PostgreSQL's JSONB @> operator to check whether the array contains
   * at least one element with a matching organizationId.
   */
  private applyParticipatingOrgsFilter(
    qb: SelectQueryBuilder<Activity>,
    participatingOrgIds: string[] | undefined
  ): void {
    if (!participatingOrgIds || participatingOrgIds.length === 0) {
      return;
    }
    const orgConditions = participatingOrgIds
      .map((_, index) => `"participatingOrgs" @> :orgFilter${index}`)
      .join(' OR ');

    const parameters: Record<string, string> = {};
    participatingOrgIds.forEach((orgId, index) => {
      parameters[`orgFilter${index}`] = JSON.stringify([{ organizationId: orgId }]);
    });

    qb.andWhere(`(${orgConditions})`, parameters);
  }

  /**
   * Apply date / tags / categories / open-slots / featured / urgent filters.
   */
  private applyMiscFilters(qb: SelectQueryBuilder<Activity>, filters: ActivitySearchFilters): void {
    if (filters.startDate) {
      qb.andWhere('activity.scheduledStartDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      qb.andWhere('activity.scheduledStartDate <= :endDate', { endDate: filters.endDate });
    }
    if (filters.tags && filters.tags.length > 0) {
      qb.andWhere('activity.tags && ARRAY[:...tags]', { tags: filters.tags });
    }
    if (filters.categories && filters.categories.length > 0) {
      qb.andWhere('activity.categories && ARRAY[:...categories]', {
        categories: filters.categories,
      });
    }
    if (filters.hasOpenSlots) {
      qb.andWhere(
        '(activity.maxParticipants IS NULL OR activity.currentParticipants < activity.maxParticipants)'
      );
    }
    if (filters.isFeatured) {
      qb.andWhere('activity.isFeatured = :featured', { featured: true });
    }
    if (filters.isUrgent) {
      qb.andWhere('activity.isUrgent = :urgent', { urgent: true });
    }
  }

  /**
   * Apply free-text search (tsvector on Postgres, ILIKE elsewhere).
   * Wrapped in Brackets to preserve outer AND grouping.
   */
  private applySearchTermFilter(
    qb: SelectQueryBuilder<Activity>,
    searchTerm: string | undefined
  ): void {
    if (!searchTerm) {
      return;
    }
    const isPostgres = qb.connection.options.type === 'postgres';

    if (isPostgres) {
      const sanitized = searchTerm.replaceAll(/[^a-zA-Z0-9\s-]/g, '').trim();
      const words = sanitized.split(/\s+/).filter(w => w.length > 0);
      const tsquery = words.map(w => (w.length >= 2 && w.length <= 3 ? `${w}:*` : w)).join(' & ');

      qb.andWhere(
        new Brackets(sq => {
          sq.where(`activity.search_vector @@ to_tsquery('english', :tsquery_actSearch)`, {
            tsquery_actSearch: tsquery,
          });
          sq.orWhere('activity.tags && ARRAY[:searchTag]', { searchTag: searchTerm });
        })
      );
      qb.addOrderBy(
        `ts_rank(activity.search_vector, to_tsquery('english', :tsquery_actSearch))`,
        'DESC'
      );
    } else {
      qb.andWhere(
        new Brackets(sq => {
          sq.where('activity.title ILIKE :search_actSearch', {
            search_actSearch: `%${searchTerm}%`,
          });
          sq.orWhere('activity.description ILIKE :search_actSearch');
          sq.orWhere('activity.tags && ARRAY[:searchTag]', { searchTag: searchTerm });
        })
      );
    }
  }

  /**
   * Search activities with filters
   */
  async searchActivities(
    filters: ActivitySearchFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ activities: Activity[]; total: number; page: number; totalPages: number }> {
    const queryBuilder = this.repository.createQueryBuilder('activity');

    this.applyEnumAndOwnershipFilters(queryBuilder, filters);
    this.applyParticipatingOrgsFilter(queryBuilder, filters.participatingOrgIds);
    this.applyMiscFilters(queryBuilder, filters);
    this.applySearchTermFilter(queryBuilder, filters.searchTerm);

    // Pagination
    const total = await queryBuilder.getCount();
    const skip = (page - 1) * limit;

    if (filters.searchTerm) {
      queryBuilder
        .addOrderBy('activity.scheduledStartDate', 'ASC')
        .addOrderBy('activity.createdAt', 'DESC');
    } else {
      queryBuilder
        .orderBy('activity.scheduledStartDate', 'ASC')
        .addOrderBy('activity.createdAt', 'DESC');
    }

    queryBuilder.skip(skip).take(limit);

    const activities = await queryBuilder.getMany();

    return {
      activities,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get activities for a user (based on their organizations)
   */
  async getActivitiesForUser(
    userId: string,
    userOrgIds: string[],
    filters?: Partial<ActivitySearchFilters>
  ): Promise<Activity[]> {
    const queryBuilder = this.repository.createQueryBuilder('activity');

    // Get activities where:
    // 1. User is creator
    // 2. User's organization is the primary org
    // 3. Activity is public
    // 4. User's organization is in participatingOrgs (JSONB check)
    const orgConditions =
      userOrgIds.length > 0
        ? userOrgIds.map((_, index) => `"participatingOrgs" @> :orgFilter${index}`).join(' OR ')
        : '';

    const whereClause = orgConditions
      ? `(
                activity.creatorId = :userId
                OR activity.visibility = :publicVisibility
                OR activity.organizationId IN (:...orgIds)
                OR ${orgConditions}
            )`
      : `(
                activity.creatorId = :userId
                OR activity.visibility = :publicVisibility
                OR activity.organizationId IN (:...orgIds)
            )`;

    const parameters: Record<string, unknown> = {
      userId,
      publicVisibility: ActivityVisibility.PUBLIC,
      orgIds: userOrgIds.length > 0 ? userOrgIds : [''],
    };

    // Add participatingOrgs JSONB filters
    if (userOrgIds.length > 0) {
      userOrgIds.forEach((orgId, index) => {
        parameters[`orgFilter${index}`] = JSON.stringify([{ organizationId: orgId }]);
      });
    }

    queryBuilder.where(whereClause, parameters);

    // Apply additional filters
    if (filters?.activityType) {
      queryBuilder.andWhere('activity.activityType = :type', { type: filters.activityType });
    }

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        queryBuilder.andWhere('activity.status IN (:...statuses)', { statuses: filters.status });
      } else {
        queryBuilder.andWhere('activity.status = :status', { status: filters.status });
      }
    }

    queryBuilder
      .orderBy('activity.scheduledStartDate', 'ASC')
      .addOrderBy('activity.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  // ==================== STATUS MANAGEMENT ====================

  /**
   * Update activity status
   */
  async updateStatus(
    activityId: string,
    status: ActivityStatus,
    userId: string
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (
      activity.creatorId !== userId &&
      !(await this.participantService.isLeader(activityId, userId))
    ) {
      throw new ForbiddenError('Only leaders can update status');
    }

    const previousStatus = activity.status;
    activity.status = status;

    // Set actual dates based on status
    if (status === ActivityStatus.IN_PROGRESS && !activity.actualStartDate) {
      activity.actualStartDate = new Date();
    }

    if (
      (status === ActivityStatus.COMPLETED || status === ActivityStatus.FAILED) &&
      !activity.actualEndDate
    ) {
      activity.actualEndDate = new Date();
    }

    const updated = await this.repository.save(activity);

    logger.info(`Activity ${activityId} status updated to: ${status}`, {
      organizationId: activity.organizationId,
      previousStatus,
    });

    // Audit log the status change
    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_STATUS_CHANGED,
      activityId,
      activityTitle: updated.title,
      activityType: updated.activityType,
      organizationId: updated.organizationId ?? '',
      performedById: userId,
      performedByName: userId, // userId available in context
      details: {
        previousStatus,
        newStatus: status,
        actualStartDate: updated.actualStartDate?.toISOString(),
        actualEndDate: updated.actualEndDate?.toISOString(),
      },
    });

    if (activity.organizationId) {
      invalidateActivityCache(activity.organizationId);
    }
    return updated;
  }

  /**
   * Submit completion report
   */
  async submitCompletionReport(
    activityId: string,
    report: {
      submittedBy: string;
      outcome: 'success' | 'partial' | 'failure';
      duration?: number;
      creditsEarned?: number;
      reputationEarned?: number;
      objectivesCompleted?: string[];
      performanceRatings?: Record<string, number>;
      notableEvents?: string[];
      recommendations?: string;
    }
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    activity.completionReport = {
      submittedBy: report.submittedBy,
      submittedAt: new Date(),
      outcome: report.outcome,
      participantCount: activity.currentParticipants,
      duration:
        report.duration ??
        (activity.actualEndDate && activity.actualStartDate
          ? Math.floor(
              (activity.actualEndDate.getTime() - activity.actualStartDate.getTime()) / 60000
            )
          : 0),
      creditsEarned: report.creditsEarned ?? activity.rewardCredits,
      reputationEarned: report.reputationEarned ?? activity.rewardReputation,
      objectivesCompleted: report.objectivesCompleted,
      performanceRatings: report.performanceRatings,
      notableEvents: report.notableEvents,
      recommendations: report.recommendations,
    };

    activity.status = ActivityStatus.COMPLETED;
    activity.actualEndDate = activity.actualEndDate ?? new Date();

    const updated = await this.repository.save(activity);
    logger.info(`Completion report submitted for activity: ${activityId}`);
    if (activity.organizationId) {
      invalidateActivityCache(activity.organizationId);
    }
    return updated;
  }

  // ==================== STATISTICS ====================

  /**
   * Get activity statistics
   */
  async getStatistics(organizationId?: string): Promise<ActivityStatistics> {
    const queryBuilder = this.repository.createQueryBuilder('activity');

    if (organizationId) {
      // Check both primary organization and participatingOrgs using JSONB
      queryBuilder.where(
        `(activity.organizationId = :orgId OR "participatingOrgs" @> :orgFilter)`,
        {
          orgId: organizationId,
          orgFilter: JSON.stringify([{ organizationId }]),
        }
      );
    }

    const activities = await queryBuilder.getMany();

    const total = activities.length;
    const active = activities.filter(
      a =>
        a.status === ActivityStatus.OPEN ||
        a.status === ActivityStatus.IN_PROGRESS ||
        a.status === ActivityStatus.RECRUITING
    ).length;
    const completed = activities.filter(a => a.status === ActivityStatus.COMPLETED).length;
    const successful = activities.filter(a => a.completionReport?.outcome === 'success').length;

    const totalParticipants = activities.reduce((sum, a) => sum + a.currentParticipants, 0);
    const avgParticipants = total > 0 ? totalParticipants / total : 0;
    const successRate = completed > 0 ? (successful / completed) * 100 : 0;

    const byType = activities.reduce(
      (acc, activity) => {
        acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
        return acc;
      },
      {} as Record<ActivityType, number>
    );

    const byOrganization = activities.reduce(
      (acc, activity) => {
        if (activity.organizationId) {
          acc[activity.organizationId] = (acc[activity.organizationId] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    const totalCreditsRewarded = activities
      .filter(a => a.completionReport)
      .reduce((sum, a) => sum + (a.completionReport?.creditsEarned ?? 0), 0);

    const totalReputationRewarded = activities
      .filter(a => a.completionReport)
      .reduce((sum, a) => sum + (a.completionReport?.reputationEarned ?? 0), 0);

    return {
      totalActivities: total,
      activeActivities: active,
      completedActivities: completed,
      totalParticipants,
      averageParticipants: Math.round(avgParticipants * 10) / 10,
      successRate: Math.round(successRate * 10) / 10,
      byType,
      byOrganization,
      totalCreditsRewarded,
      totalReputationRewarded,
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if user can access activity
   */
  private async canUserAccessActivity(
    activity: Activity,
    userId: string,
    userOrgId?: string
  ): Promise<boolean> {
    // Public activities
    if (activity.visibility === ActivityVisibility.PUBLIC) {
      return true;
    }

    // Creator always has access
    if (activity.creatorId === userId) {
      return true;
    }

    // Already a participant (normalized table lookup)
    if (await this.participantService.isParticipant(activity.id, userId)) {
      return true;
    }

    // Organization-based access
    if (userOrgId) {
      // Host organization
      if (activity.organizationId === userOrgId) {
        return true;
      }

      // Participating organization
      if (
        (activity.participatingOrgs ?? []).some(
          org => org.organizationId === userOrgId && org.status === 'accepted'
        )
      ) {
        return true;
      }

      // Invited organization
      if ((activity.invitedOrgs ?? []).includes(userOrgId)) {
        return true;
      }

      // Allied organization
      if ((activity.alliedOrgs ?? []).includes(userOrgId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get activity by ID
   */
  async getActivityById(id: string): Promise<Activity | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Update activity
   */
  async updateActivity(id: string, updates: Partial<Activity>): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    logger.info(`Updating activity: ${id}`, {
      organizationId: activity.organizationId,
      updateFields: Object.keys(updates),
    });

    // Snapshot fields that drive the Discord embed / scheduled event so we can
    // tell listeners exactly what changed (and skip a no-op refresh).
    const trackedFields: (keyof Activity)[] = [
      'title',
      'description',
      'location',
      'timezone',
      'estimatedDuration',
      'scheduledStartDate',
      'maxParticipants',
      'shipAssignments',
      'ships',
      'routePlan',
    ];
    const before = new Map<string, unknown>(trackedFields.map(f => [f, activity[f]]));

    // Merge updates
    Object.assign(activity, updates);
    activity.updatedAt = new Date();

    // Recalculate route data if ships or route plan changed
    const shouldRecalculateRoute =
      updates.shipAssignments !== undefined ||
      updates.ships !== undefined ||
      updates.routePlan !== undefined;

    if (shouldRecalculateRoute) {
      await this.routeCalcService.updateActivityRouteData(activity);
    }

    const updated = await this.repository.save(activity);
    logger.info(`Activity updated: ${id} (route recalculated: ${shouldRecalculateRoute})`);
    if (activity.organizationId) {
      invalidateActivityCache(activity.organizationId);
    }

    // Audit log the update
    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_UPDATED,
      activityId: id,
      activityTitle: updated.title,
      activityType: updated.activityType,
      organizationId: updated.organizationId ?? '',
      performedById: updated.creatorId,
      performedByName: updated.creatorId,
      details: {
        updatedFields: Object.keys(updates),
        changedFieldCount: Object.keys(updates).length,
      },
    });

    // Emit a domain event so the Discord bot can re-render the origin event
    // message and any mirrored copies. Only the fields that actually changed
    // are reported so listeners can skip Discord scheduled-event updates when
    // nothing relevant moved.
    const updatedFields = Array.from(before.keys()).filter(
      field => before.get(field) !== (updated as unknown as Record<string, unknown>)[field]
    );
    if (updatedFields.length > 0) {
      domainEvents.emit('activity:updated', {
        activityId: updated.id,
        organizationId: updated.organizationId ?? '',
        updatedFields,
        title: updated.title,
        description: updated.description,
        scheduledAt: updated.scheduledStartDate?.toISOString(),
        timezone: updated.timezone,
        estimatedDuration: updated.estimatedDuration,
        location: updated.location,
        timestamp: new Date().toISOString(),
      });
    }

    return updated;
  }

  /**
   * Broadcast a ship-roster change (crew join/leave, passenger join/leave,
   * crew-position move, or passenger-slot edit) to both surfaces that display
   * an activity's roster.
   *
   * These mutations are invoked from BOTH the Discord bot (which calls these
   * service methods directly) and the HTTP API, so the notifications live here
   * in the shared service layer — guaranteeing the roster re-renders no matter
   * which surface initiated the change:
   *
   *  - WebSocket `activity:updated`  → web app React Query invalidation, so the
   *    ship/crew/passenger cards refresh in real time.
   *  - `activity:updated` domain event → the Discord bot re-renders the origin
   *    event embed (and any mirrors). `updatedFields` is limited to
   *    `shipAssignments` so the listener skips the native Discord
   *    scheduled-event update (only the roster changed, not the schedule).
   *
   * Without this, crew/passenger/role changes persisted but neither surface was
   * told to refresh, leaving stale rosters on Discord and the web app.
   */
  private broadcastRosterChange(activity: Activity): void {
    if (!activity.organizationId) {
      return; // Personal (org-less) activities have no realtime room / Discord embed.
    }

    invalidateActivityCache(activity.organizationId);
    emitActivityUpdated(activity.organizationId, activity as unknown as Record<string, unknown>);

    domainEvents.emit('activity:updated', {
      activityId: activity.id,
      organizationId: activity.organizationId,
      updatedFields: ['shipAssignments'],
      title: activity.title,
      description: activity.description,
      scheduledAt: activity.scheduledStartDate?.toISOString(),
      estimatedDuration: activity.estimatedDuration,
      location: activity.location,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Find activity by linked bounty ID
   */
  async findByBountyId(bountyId: string): Promise<Activity | null> {
    return this.repository.findOne({
      where: { linkedBountyId: bountyId },
    });
  }

  /**
   * Find activity by linked mission ID
   */
  async findByMissionId(missionId: string): Promise<Activity | null> {
    return this.repository.findOne({
      where: { linkedMissionId: missionId },
    });
  }

  /**
   * Delete activity
   */
  async deleteActivity(id: string, userId: string): Promise<void> {
    const activity = await this.repository.findOne({ where: { id } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (activity.creatorId !== userId) {
      throw new ForbiddenError('Only creator can delete activity');
    }

    if (activity.status === ActivityStatus.IN_PROGRESS) {
      throw new ValidationError('Cannot delete activity in progress');
    }

    logger.info(`Deleting activity: ${id}`, {
      organizationId: activity.organizationId,
      activityType: activity.activityType,
      creatorId: activity.creatorId,
    });

    // Cleanup voice channel if exists
    if (activity.voiceChannel?.channelId) {
      this.voiceChannelService.deleteChannel(activity.voiceChannel.channelId);
    }

    // Capture the linked Discord event id (if any) before removing the row so
    // listeners can clean up the corresponding Discord Scheduled Event.
    const discordEventId = activity.discordEventId;
    const organizationId = activity.organizationId;

    await this.repository.remove(activity);

    // Audit log the deletion
    activityAuditLogger.log({
      action: ActivityAuditAction.ACTIVITY_DELETED,
      activityId: id,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: organizationId ?? '',
      performedById: userId,
      performedByName: userId,
      details: {
        participantCount: activity.currentParticipants,
        hadDiscordEvent: !!discordEventId,
      },
    });

    logger.info(`Activity deleted: ${id}`);
    if (organizationId) {
      invalidateActivityCache(organizationId);
    }

    domainEvents.emit('activity:deleted', {
      activityId: id,
      organizationId: organizationId ?? '',
      discordEventId: discordEventId ?? undefined,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== SHIP & CREW MANAGEMENT ====================

  /**
   * Add ship to activity
   */
  async addShip(
    activityId: string,
    userId: string,
    ship: {
      shipId?: string;
      shipType: string;
      shipName?: string;
      role: 'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other';
      crewCapacity: number;
      capabilities: string[];
      parentShipId?: string;
      transportType?: string;
    }
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const isParticipant = await this.participantService.isParticipant(activityId, userId);
    if (!isParticipant) {
      throw new ValidationError('User is not a participant');
    }

    activity.shipAssignments ??= [];

    // Validate parent ship exists when nesting
    if (ship.parentShipId) {
      const parentExists = activity.shipAssignments.some(
        s => s.shipId === ship.parentShipId || (s.shipName ?? s.shipType) === ship.parentShipId
      );
      if (!parentExists) {
        throw new ValidationError('Parent ship not found in activity');
      }
    }

    const isNested = !!ship.parentShipId;

    // A pilot can only fly one ship at a time. Check both ship arrays (legacy
    // activity.ships and modern activity.shipAssignments) for an existing crewed,
    // non-loaner ship owned by this user. If found, promote the new ship to a
    // loaner so other crew can still sign up for it — mirrors the same guard in
    // the Discord bot's handleBringShipModal (eventButtons.bringShip.ts).
    const allExistingShips = [...(activity.ships ?? []), ...activity.shipAssignments];
    const isAutoLoaner =
      !isNested &&
      allExistingShips.some(s => s.ownerId === userId && !s.isLoaner && (s.crewAssigned ?? 0) > 0);

    // Update participant ship info in normalized table.
    // Must write shipName too — the frontend groups participants into ship cards
    // by `p.shipName || p.shipType`, and the matching ship assignment is found
    // by `(s.shipName ?? s.shipType).toLowerCase()`. If shipName is missing
    // on the participant but present on the assignment (typical case where
    // shipType already includes the role suffix, e.g. "Perseus (Combat)"),
    // the keys diverge and the UI renders a duplicate phantom ship card.
    // Skip for auto-loaner ships — the user is contributing the ship, not crewing it.
    if (!ship.parentShipId && !isAutoLoaner) {
      await this.participantService.updateParticipant(activityId, userId, {
        shipId: ship.shipId,
        shipType: ship.shipType,
        shipName: ship.shipName,
      });
    }

    const participantRow = await this.participantService.getParticipant(activityId, userId);
    const ownerName = participantRow?.userName ?? userId;
    const ownerAvatarUrl = participantRow?.avatarUrl;
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.shipAssignments = [
      ...activity.shipAssignments,
      {
        shipId: ship.shipId,
        shipType: ship.shipType,
        shipName: ship.shipName,
        ownerId: userId,
        ownerName,
        role: ship.role,
        crewCapacity: ship.crewCapacity,
        crewAssigned: isNested || isAutoLoaner ? 0 : 1,
        crewMembers:
          isNested || isAutoLoaner
            ? []
            : [{ userId, userName: ownerName, avatarUrl: ownerAvatarUrl, position: 'pilot' }],
        capabilities: ship.capabilities,
        status: isAutoLoaner ? 'available' : 'assigned',
        isLoaner: isAutoLoaner || undefined,
        contributedBy: isAutoLoaner ? ownerName : undefined,
        contributedByUserId: isAutoLoaner ? userId : undefined,
        parentShipId: ship.parentShipId,
        isTransported: isNested,
        transportType: ship.transportType as ShipAssignment['transportType'],
      },
    ];

    // Enrich the newly added ship with catalogue data (SCU, fuel, hangar, etc.)
    const newAssignment = activity.shipAssignments.at(-1);
    if (newAssignment) {
      await this.routeCalcService.enrichShipMetadata([newAssignment]);
      // Auto-derive typed crew slots from the (possibly catalogue-bumped) crew
      // capacity. Editable later via setCrewSlots.
      newAssignment.crewSlots ??= deriveDefaultCrewSlots(newAssignment.crewCapacity);
    }

    activity.totalCrewCapacity =
      (activity.totalCrewCapacity ?? 0) + (newAssignment?.crewCapacity ?? ship.crewCapacity);
    if (!isNested && !isAutoLoaner) {
      activity.totalCrewAssigned = (activity.totalCrewAssigned ?? 0) + 1;
    }

    // Recalculate fleet-level cargo/fuel totals (preserves totalCrewCapacity)
    await this.recalculateFleetTotals(activity);

    const updated = await this.repository.save(activity);
    logger.info(`Ship added to activity ${activityId} by user ${userId}`);
    return updated;
  }

  /**
   * Loan multiple ships to an activity.
   * Ships are marked as loaner with contributedBy/contributedByUserId.
   * The contributor is NOT automatically assigned as crew.
   */
  async loanShips(
    activityId: string,
    userId: string,
    userName: string,
    ships: Array<{
      shipId?: string;
      shipType: string;
      shipName?: string;
      crewCapacity?: number;
    }>
  ): Promise<Activity> {
    if (ships.length === 0) {
      throw new ValidationError('At least one ship is required');
    }
    if (ships.length > 20) {
      throw new ValidationError('Cannot loan more than 20 ships at once');
    }

    // Tenant-scoped lookup: activity must exist and user must be a participant
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Participant check via normalized table — doubles as tenant validation
    const isParticipant = await this.participantService.isParticipant(activityId, userId);
    if (!isParticipant) {
      throw new ValidationError('User is not a participant');
    }

    activity.shipAssignments ??= [];

    const addedShipIds: string[] = [];
    const newAssignmentsBuffer: ShipAssignment[] = [];

    for (const ship of ships) {
      const shipAssignment: ShipAssignment = {
        shipId: ship.shipId,
        shipType: ship.shipType,
        shipName: ship.shipName,
        ownerId: userId,
        ownerName: userName,
        role: 'other',
        crewCapacity: ship.crewCapacity ?? 1,
        crewAssigned: 0,
        crewMembers: [],
        capabilities: [],
        status: 'available',
        isLoaner: true,
        contributedBy: userName,
        contributedByUserId: userId,
      };

      newAssignmentsBuffer.push(shipAssignment);
      activity.totalCrewCapacity = (activity.totalCrewCapacity ?? 0) + (ship.crewCapacity ?? 1);
      addedShipIds.push(ship.shipId ?? ship.shipType);
    }

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.shipAssignments = [...activity.shipAssignments, ...newAssignmentsBuffer];

    // Enrich all newly added ship assignments with catalogue data
    const newAssignments = activity.shipAssignments.slice(-ships.length);
    await this.routeCalcService.enrichShipMetadata(newAssignments);

    // If enrichment bumped crewCapacity (from catalog), update the running total
    for (let i = 0; i < newAssignments.length; i++) {
      const original = ships[i].crewCapacity ?? 1;
      const enriched = newAssignments[i].crewCapacity;
      if (enriched > original) {
        activity.totalCrewCapacity = (activity.totalCrewCapacity ?? 0) - original + enriched;
      }
      // Auto-derive typed crew slots from the final crew capacity.
      newAssignments[i].crewSlots ??= deriveDefaultCrewSlots(newAssignments[i].crewCapacity);
    }

    // Recalculate fleet-level cargo/fuel totals (preserves totalCrewCapacity)
    await this.recalculateFleetTotals(activity);

    const updated = await this.repository.save(activity);

    activityAuditLogger.log({
      action: ActivityAuditAction.SHIP_ASSIGNED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: userId,
      performedByName: userName,
      details: {
        loanedShips: addedShipIds,
        shipCount: ships.length,
        isLoaner: true,
        totalShips: updated.shipAssignments?.length ?? 0,
      },
    });

    logger.info(`User ${userId} loaned ${ships.length} ship(s) to activity ${activityId}`);
    return updated;
  }

  /**
   * Remove a ship the user contributed to an activity.
   * Also unassigns any crew from that ship and un-nests children of the removed ship.
   */
  async removeOwnedShip(
    activityId: string,
    userId: string,
    shipIdentifier: string,
    shipIndex?: number
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const isOwnedByUser = (ship: ShipAssignment): boolean =>
      ship.ownerId === userId || ship.contributedByUserId === userId;

    const matchesIdentifier = (ship: ShipAssignment): boolean => {
      const compositeKey = `${ship.shipType}::${ship.shipName ?? ''}`;
      return (
        ship.id === shipIdentifier ||
        ship.shipId === shipIdentifier ||
        ship.ownerId === shipIdentifier ||
        compositeKey === shipIdentifier
      );
    };

    const ownedShips = allShips.filter(isOwnedByUser);
    let targetShip: ShipAssignment | undefined;

    if (shipIndex !== undefined && shipIndex >= 0) {
      const indexedShip = ownedShips[shipIndex];
      if (indexedShip && matchesIdentifier(indexedShip)) {
        targetShip = indexedShip;
      }
    }

    targetShip ??=
      allShips.find(ship => isOwnedByUser(ship) && matchesIdentifier(ship)) ??
      allShips.find(ship => matchesIdentifier(ship));

    if (!targetShip) {
      throw new NotFoundError('Ship in activity');
    }

    if (!isOwnedByUser(targetShip)) {
      throw new ForbiddenError('You can only remove ships you brought to this event');
    }

    const target = targetShip;

    const parentKeys = new Set(
      [target.id, target.shipId, target.shipName, target.shipType].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
    );

    const clearParentReference = (ship: ShipAssignment): ShipAssignment => {
      if (!ship.parentShipId || !parentKeys.has(ship.parentShipId)) {
        return ship;
      }
      return {
        ...ship,
        parentShipId: undefined,
        isTransported: false,
        transportType: undefined,
      };
    };

    const removeTargetShip = (ships?: ShipAssignment[]): ShipAssignment[] | undefined => {
      if (!ships || ships.length === 0) {
        return ships;
      }

      const index = ships.indexOf(target);
      if (index === -1) {
        return ships.map(clearParentReference);
      }

      const next = [...ships];
      next.splice(index, 1);
      return next.map(clearParentReference);
    };

    activity.shipAssignments = removeTargetShip(activity.shipAssignments);
    activity.ships = removeTargetShip(activity.ships);

    const removedCrewMembers = target.crewMembers ?? target.crew ?? [];
    const affectedUserIds = new Set<string>(removedCrewMembers.map(member => member.userId));
    affectedUserIds.add(target.ownerId);

    const remainingShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];

    const findCrewAssignment = (
      participantId: string
    ): { ship: ShipAssignment; position: string } | null => {
      for (const ship of remainingShips) {
        const crewMembers = ship.crewMembers ?? ship.crew ?? [];
        const crewMember = crewMembers.find(member => member.userId === participantId);
        if (crewMember) {
          return { ship, position: crewMember.position };
        }
      }
      return null;
    };

    await Promise.all(
      [...affectedUserIds].map(async affectedUserId => {
        const crewAssignment = findCrewAssignment(affectedUserId);
        if (crewAssignment) {
          await this.participantService.updateParticipant(activityId, affectedUserId, {
            shipId: crewAssignment.ship.shipId,
            shipType: crewAssignment.ship.shipType,
            shipName: crewAssignment.ship.shipName,
            crewPosition: crewAssignment.position,
            crewShipId: crewAssignment.ship.shipId,
          });
          return;
        }

        await this.participantService.updateParticipant(activityId, affectedUserId, {
          shipId: null as unknown as string | undefined,
          shipType: null as unknown as string | undefined,
          shipName: null as unknown as string | undefined,
          crewPosition: null as unknown as string | undefined,
          crewShipId: null as unknown as string | undefined,
        });
      })
    );

    activity.totalCrewCapacity = remainingShips.reduce(
      (sum, ship) => sum + (ship.crewCapacity ?? ship.maxCrew ?? 0),
      0
    );
    activity.totalCrewAssigned = remainingShips.reduce((sum, ship) => {
      const crewMembers = ship.crewMembers ?? ship.crew ?? [];
      return sum + crewMembers.length;
    }, 0);

    await this.recalculateFleetTotals(activity);

    const updated = await this.repository.save(activity);
    if (activity.organizationId) {
      invalidateActivityCache(activity.organizationId);
    }

    activityAuditLogger.log({
      action: ActivityAuditAction.SHIP_UNASSIGNED,
      activityId,
      activityTitle: activity.title,
      activityType: activity.activityType,
      organizationId: activity.organizationId ?? '',
      performedById: userId,
      performedByName: target.ownerName || userId,
      details: {
        shipId: target.shipId,
        shipAssignmentId: target.id,
        shipType: target.shipType,
        shipName: target.shipName,
        displacedCrewCount: removedCrewMembers.length,
        totalShips: remainingShips.length,
      },
    });

    logger.info(`User ${userId} removed ship ${target.shipType} from activity ${activityId}`);
    return updated;
  }

  /**
   * Join ship as crew member
   */
  async joinShipAsCrew(
    activityId: string,
    userId: string,
    userName: string,
    shipOwnerId: string,
    crewPosition: string
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Search BOTH the modern `shipAssignments` and the legacy `ships` array.
    // "Bring Ship" (ActivityParticipantService.addShip) stores ships in
    // `activity.ships`, while fleet/loaner flows use `shipAssignments`. Looking
    // in only one array made crewing a "Bring Ship" ship throw NotFoundError,
    // leaving the member an accepted participant with no ship ("Crew Without
    // Ship" on the web) and never updating the Discord embed.
    // Match by assignment id / shipId first, then ownerId for backward compat.
    const candidateShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
    const shipAssignment =
      candidateShips.find(s => s.id === shipOwnerId || s.shipId === shipOwnerId) ??
      candidateShips.find(s => s.ownerId === shipOwnerId);
    if (!shipAssignment) {
      throw new NotFoundError('Ship in activity');
    }

    const existingCrew = shipAssignment.crewMembers ?? shipAssignment.crew ?? [];

    if ((shipAssignment.crewAssigned ?? existingCrew.length) >= shipAssignment.crewCapacity) {
      throw new ValidationError('Ship is at full crew capacity');
    }

    if (existingCrew.some(member => member.userId === userId)) {
      throw new ValidationError('User is already crew on this ship');
    }

    // When the ship has typed crew slots, enforce per-role availability so a
    // position can't be over-filled beyond its configured seat count.
    if (shipAssignment.crewSlots?.length) {
      const wanted = crewPosition.trim().toLowerCase();
      const slot = shipAssignment.crewSlots.find(s => s.role.toLowerCase() === wanted);
      if (!slot) {
        throw new ValidationError(`This ship has no ${crewPosition} slot`);
      }
      const filledForRole = existingCrew.filter(
        member => member.position.trim().toLowerCase() === wanted
      ).length;
      if (filledForRole >= slot.capacity) {
        throw new ValidationError(`All ${crewPosition} slots are full`);
      }
    }

    // Pull avatarUrl from the participant row so the ship card renders the
    // crew member's avatar (the frontend reads member.avatarUrl).
    const participantRow = await this.participantService.getParticipant(activityId, userId);
    existingCrew.push({
      userId,
      userName,
      avatarUrl: participantRow?.avatarUrl,
      position: crewPosition,
    });
    shipAssignment.crewMembers = [...existingCrew];
    if (shipAssignment.crew) {
      shipAssignment.crew = [...shipAssignment.crewMembers];
    }
    shipAssignment.crewAssigned = shipAssignment.crewMembers.length;
    if (shipAssignment.currentCrew !== undefined) {
      shipAssignment.currentCrew = shipAssignment.crewAssigned;
    }

    // Update normalized table — write shipName/shipType so the crew member
    // groups under the same ship card on the frontend (which keys by
    // `p.shipName || p.shipType`). Without this the crew member would appear
    // in the "unassigned" list even though they're on a ship.
    await this.participantService.updateParticipant(activityId, userId, {
      crewPosition,
      crewShipId: shipAssignment.shipId,
      shipName: shipAssignment.shipName,
      shipType: shipAssignment.shipType,
    });

    activity.totalCrewAssigned = (activity.totalCrewAssigned ?? 0) + 1;

    // Spread-and-replace whichever array holds the mutated ship so TypeORM
    // detects the simple-json change (see /memories/repo/typeorm-jsonb-pitfall.md).
    activity.shipAssignments = activity.shipAssignments
      ? [...activity.shipAssignments]
      : activity.shipAssignments;
    activity.ships = activity.ships ? [...activity.ships] : activity.ships;

    const updated = await this.repository.save(activity);
    this.broadcastRosterChange(updated);
    logger.info(`User ${userId} joined ship as ${crewPosition} in activity ${activityId}`);
    return updated;
  }

  /**
   * Leave ship crew
   */
  async leaveShipCrew(activityId: string, userId: string): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    let removedFrom = false;

    const removeFromCollection = (ships?: ShipAssignment[]): void => {
      if (!ships || removedFrom) {
        return;
      }

      for (const ship of ships) {
        const crewMembers = ship.crewMembers ? [...ship.crewMembers] : [...(ship.crew ?? [])];
        const crewIndex = crewMembers.findIndex(member => member.userId === userId);
        if (crewIndex === -1) {
          continue;
        }

        crewMembers.splice(crewIndex, 1);
        ship.crewMembers = [...crewMembers];
        if (ship.crew) {
          ship.crew = [...ship.crewMembers];
        }
        ship.crewAssigned = ship.crewMembers.length;
        if (ship.currentCrew !== undefined) {
          ship.currentCrew = ship.crewAssigned;
        }
        removedFrom = true;
        return;
      }
    };

    // New data model (shipAssignments)
    removeFromCollection(activity.shipAssignments);
    // Backward compatibility path (legacy ships array)
    removeFromCollection(activity.ships);

    if (!removedFrom) {
      throw new ValidationError('User is not crew on any ship in this activity');
    }

    // Update normalized table — also clear shipName/shipType (set by
    // joinShipAsCrew) so the participant returns to the unassigned list
    // on the frontend instead of remaining grouped under the ship they left.
    await this.participantService.updateParticipant(activityId, userId, {
      crewPosition: null as unknown as string | undefined,
      crewShipId: null as unknown as string | undefined,
      shipName: null as unknown as string | undefined,
      shipType: null as unknown as string | undefined,
    });

    activity.shipAssignments = activity.shipAssignments ? [...activity.shipAssignments] : undefined;
    activity.ships = activity.ships ? [...activity.ships] : undefined;
    activity.totalCrewAssigned = Math.max(0, (activity.totalCrewAssigned ?? 0) - 1);

    const updated = await this.repository.save(activity);
    this.broadcastRosterChange(updated);
    logger.info(`User ${userId} left ship crew in activity ${activityId}`);
    return updated;
  }

  /**
   * Get available crew positions
   */
  async getAvailableCrewPositions(activityId: string): Promise<
    Array<{
      shipId?: string;
      shipType: string;
      shipName?: string;
      ownerName: string;
      availableSlots: number;
      capabilities: string[];
    }>
  > {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity?.shipAssignments) {
      return [];
    }

    return activity.shipAssignments
      .filter(ship => ship.crewAssigned < ship.crewCapacity)
      .map(ship => ({
        shipId: ship.shipId,
        shipType: ship.shipType,
        shipName: ship.shipName,
        ownerName: ship.ownerName,
        availableSlots: ship.crewCapacity - ship.crewAssigned,
        capabilities: ship.capabilities,
      }));
  }

  /**
   * Find a ship assignment by its id, shipId, ownerId, or "shipType::shipName"
   * composite key. Searches `shipAssignments` first, then the legacy `ships`.
   */
  private findShipAssignmentByIdentifier(
    activity: Activity,
    shipIdentifier: string
  ): ShipAssignment | undefined {
    const matches = (ship: ShipAssignment): boolean => {
      const compositeKey = `${ship.shipType}::${ship.shipName ?? ''}`;
      return (
        ship.id === shipIdentifier ||
        ship.shipId === shipIdentifier ||
        ship.ownerId === shipIdentifier ||
        compositeKey === shipIdentifier
      );
    };
    return activity.shipAssignments?.find(matches) ?? activity.ships?.find(matches);
  }

  /**
   * Replace a ship assignment object in whichever array it lives in, using
   * spread-and-replace so TypeORM detects the JSONB change.
   */
  private replaceShipAssignment(
    activity: Activity,
    target: ShipAssignment,
    replacement: ShipAssignment
  ): void {
    const swap = (ships?: ShipAssignment[]): ShipAssignment[] | undefined => {
      if (!ships) {
        return ships;
      }
      const index = ships.indexOf(target);
      if (index === -1) {
        return ships;
      }
      const next = [...ships];
      next[index] = replacement;
      return next;
    };
    activity.shipAssignments = swap(activity.shipAssignments);
    activity.ships = swap(activity.ships);
  }

  /** Canonical ship identifier used by UI and bot slot-management actions. */
  private getShipManagementIdentifier(ship: ShipAssignment): string | null {
    const identifier = ship.id ?? ship.shipId ?? ship.ownerId;
    const normalized = identifier?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
  }

  /** Evaluate slot-management capability from the backend source-of-truth policy. */
  private async canActorManageShip(
    activity: Activity,
    ship: ShipAssignment,
    actorUserId: string,
    knownIsLeader?: boolean
  ): Promise<boolean> {
    if (ship.ownerId === actorUserId || ship.contributedByUserId === actorUserId) {
      return true;
    }
    if (activity.creatorId === actorUserId) {
      return true;
    }
    if (typeof knownIsLeader === 'boolean') {
      return knownIsLeader;
    }
    return this.participantService.isLeader(activity.id, actorUserId);
  }

  /**
   * Return per-activity slot-management capabilities for the current actor.
   * Consumers (REST + bot + frontend) should use this instead of re-implementing
   * permission matrices.
   */
  async getShipManagementCapabilities(
    activityId: string,
    actorUserId: string
  ): Promise<ShipManagementCapabilities> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const ships = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
    if (ships.length === 0) {
      return { manageableShipIdentifiers: [] };
    }

    const isCreator = activity.creatorId === actorUserId;
    let isLeaderCache: boolean | undefined;
    const manageableShipIdentifiers: string[] = [];

    for (const ship of ships) {
      const identifier = this.getShipManagementIdentifier(ship);
      if (!identifier) {
        continue;
      }

      if (isCreator || ship.ownerId === actorUserId || ship.contributedByUserId === actorUserId) {
        manageableShipIdentifiers.push(identifier);
        continue;
      }

      if (isLeaderCache === undefined) {
        isLeaderCache = await this.participantService.isLeader(activity.id, actorUserId);
      }
      if (isLeaderCache) {
        manageableShipIdentifiers.push(identifier);
      }
    }

    return { manageableShipIdentifiers: Array.from(new Set(manageableShipIdentifiers)) };
  }

  /**
   * Authorize a passenger-slot management action. The ship owner/contributor,
   * the activity creator, or a LEADER may configure passenger slots.
   */
  private async assertCanManageShip(
    activity: Activity,
    ship: ShipAssignment,
    actorUserId: string
  ): Promise<void> {
    if (await this.canActorManageShip(activity, ship, actorUserId)) {
      return;
    }
    throw new ForbiddenError(
      'Only the ship owner, activity creator, or a leader can manage passenger slots'
    );
  }

  /**
   * Passenger and crew-slot views/actions are restricted to the activity
   * creator or existing participants.
   */
  private async assertCanAccessPassengerAndCrewSlots(
    activity: Activity,
    actorUserId: string,
    actionDescription: string
  ): Promise<void> {
    if (activity.creatorId === actorUserId) {
      return;
    }

    const isParticipant = await this.participantService.isParticipant(activity.id, actorUserId);
    if (isParticipant) {
      return;
    }

    throw new ForbiddenError(`Only activity participants can ${actionDescription}`);
  }

  /**
   * Define or edit the passenger slots on a ship (e.g. marines in a dropship).
   * Passengers are tracked separately from crew and never count toward crew
   * capacity totals.
   *
   * Editing preserves already-filled assignments: a slot's capacity cannot be
   * reduced below its filled count, and a role that still has passengers
   * assigned cannot be dropped.
   */
  async setPassengerSlots(
    activityId: string,
    actorUserId: string,
    shipIdentifier: string,
    slots: Array<{ role: string; capacity: number }>
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const ship = this.findShipAssignmentByIdentifier(activity, shipIdentifier);
    if (!ship) {
      throw new NotFoundError('Ship in activity');
    }

    await this.assertCanManageShip(activity, ship, actorUserId);

    const existingByRole = new Map(
      (ship.passengers ?? []).map(slot => [slot.role.toLowerCase(), slot])
    );
    const seen = new Set<string>();
    const next: PassengerSlot[] = [];

    for (const slot of slots) {
      const role = slot.role.trim();
      const key = role.toLowerCase();
      if (seen.has(key)) {
        throw new ValidationError(`Duplicate passenger role: ${role}`);
      }
      seen.add(key);

      const prior = existingByRole.get(key);
      const filled = prior?.filled ?? 0;
      if (slot.capacity < filled) {
        throw new ValidationError(
          `Cannot set ${role} capacity to ${slot.capacity}; ${filled} already assigned`
        );
      }
      next.push({
        role,
        capacity: slot.capacity,
        filled,
        assignedUserIds: prior?.assignedUserIds ? [...prior.assignedUserIds] : [],
        assignedUserNames: prior?.assignedUserNames ? [...prior.assignedUserNames] : [],
      });
    }

    // Reject dropping a role that still has passengers assigned.
    for (const slot of ship.passengers ?? []) {
      if (!seen.has(slot.role.toLowerCase()) && slot.filled > 0) {
        throw new ValidationError(
          `Cannot remove passenger role ${slot.role}; ${slot.filled} still assigned`
        );
      }
    }

    this.replaceShipAssignment(activity, ship, { ...ship, passengers: next });

    const updated = await this.repository.save(activity);
    this.broadcastRosterChange(updated);
    logger.info(
      `Passenger slots updated for ship ${shipIdentifier} in activity ${activityId} by ${actorUserId}`
    );
    return updated;
  }

  /**
   * Join a ship as a passenger (non-crew), filling an open slot of the given
   * role. Passengers do not count toward crew totals.
   */
  async joinShipAsPassenger(
    activityId: string,
    userId: string,
    userName: string,
    shipIdentifier: string,
    passengerRole: string
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    await this.assertCanAccessPassengerAndCrewSlots(activity, userId, 'join passenger slots');

    const ship = this.findShipAssignmentByIdentifier(activity, shipIdentifier);
    if (!ship) {
      throw new NotFoundError('Ship in activity');
    }

    // One passenger seat total per activity: a user cannot occupy seats on
    // multiple ships at once.
    const allShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
    const alreadyAssigned = allShips.some(existingShip =>
      (existingShip.passengers ?? []).some(slot => slot.assignedUserIds?.includes(userId))
    );
    if (alreadyAssigned) {
      throw new ValidationError('User already occupies a passenger seat in this activity');
    }

    const passengers = (ship.passengers ?? []).map(slot => ({
      ...slot,
      assignedUserIds: [...(slot.assignedUserIds ?? [])],
      assignedUserNames: [...(slot.assignedUserNames ?? [])],
    }));

    const slot = passengers.find(
      candidate => candidate.role.toLowerCase() === passengerRole.trim().toLowerCase()
    );
    if (!slot) {
      throw new NotFoundError(`Passenger slot for role "${passengerRole}"`);
    }
    if (slot.filled >= slot.capacity) {
      throw new ValidationError('Passenger slot is full');
    }

    slot.filled += 1;
    slot.assignedUserIds = [...(slot.assignedUserIds ?? []), userId];
    slot.assignedUserNames = [...(slot.assignedUserNames ?? []), userName];

    this.replaceShipAssignment(activity, ship, { ...ship, passengers });

    const updated = await this.repository.save(activity);
    this.broadcastRosterChange(updated);
    logger.info(`User ${userId} joined as ${passengerRole} passenger in activity ${activityId}`);
    return updated;
  }

  /**
   * Leave whichever passenger slot the user currently occupies in the activity.
   */
  async leaveShipAsPassenger(activityId: string, userId: string): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    await this.assertCanAccessPassengerAndCrewSlots(activity, userId, 'leave passenger slots');

    const allShips = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
    const uniqueShips = Array.from(new Set(allShips));
    let removedSeats = 0;

    for (const ship of uniqueShips) {
      if (!ship.passengers?.length) {
        continue;
      }

      let changed = false;
      const next = ship.passengers.map(slot => {
        const ids = slot.assignedUserIds ?? [];
        if (!ids.includes(userId)) {
          return slot;
        }

        let removedFromSlot = 0;
        const nextIds: string[] = [];
        const nextNames: string[] = [];
        const names = slot.assignedUserNames ?? [];

        ids.forEach((assignedUserId, index) => {
          if (assignedUserId === userId) {
            removedFromSlot += 1;
            return;
          }
          nextIds.push(assignedUserId);
          if (index < names.length) {
            nextNames.push(names[index]);
          }
        });

        if (removedFromSlot === 0) {
          return slot;
        }

        changed = true;
        removedSeats += removedFromSlot;

        return {
          ...slot,
          filled: Math.max(0, slot.filled - removedFromSlot),
          assignedUserIds: nextIds,
          assignedUserNames: nextNames,
        };
      });

      if (changed) {
        this.replaceShipAssignment(activity, ship, { ...ship, passengers: next });
      }
    }

    if (removedSeats === 0) {
      throw new ValidationError('User is not a passenger on any ship in this activity');
    }

    const updated = await this.repository.save(activity);
    this.broadcastRosterChange(updated);
    logger.info(`User ${userId} left passenger slot in activity ${activityId}`);
    return updated;
  }

  /**
   * List ships that have open passenger slots, one entry per (ship, role).
   */
  async getAvailablePassengerSlots(
    activityId: string,
    actorUserId?: string
  ): Promise<
    Array<{
      shipId?: string;
      shipType: string;
      shipName?: string;
      ownerName: string;
      role: string;
      availableSlots: number;
    }>
  > {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (activity && actorUserId) {
      await this.assertCanAccessPassengerAndCrewSlots(
        activity,
        actorUserId,
        'view passenger slot availability'
      );
    }
    if (!activity?.shipAssignments) {
      return [];
    }

    const results: Array<{
      shipId?: string;
      shipType: string;
      shipName?: string;
      ownerName: string;
      role: string;
      availableSlots: number;
    }> = [];

    for (const ship of activity.shipAssignments) {
      for (const slot of ship.passengers ?? []) {
        const availableSlots = slot.capacity - slot.filled;
        if (availableSlots > 0) {
          results.push({
            shipId: ship.shipId,
            shipType: ship.shipType,
            shipName: ship.shipName,
            ownerName: ship.ownerName,
            role: slot.role,
            availableSlots,
          });
        }
      }
    }

    return results;
  }

  /**
   * Define or edit the typed crew slots on a ship (how many seats of each
   * position). Auto-derived on ship add; this lets the ship owner, activity
   * creator, or a LEADER reshape them. The sum of slot capacities becomes the
   * ship's crew capacity. A role cannot be set below its currently-filled count,
   * and a role with occupants cannot be dropped.
   */
  async setCrewSlots(
    activityId: string,
    actorUserId: string,
    shipIdentifier: string,
    slots: Array<{ role: string; capacity: number }>
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const ship = this.findShipAssignmentByIdentifier(activity, shipIdentifier);
    if (!ship) {
      throw new NotFoundError('Ship in activity');
    }

    await this.assertCanManageShip(activity, ship, actorUserId);

    // Count current occupants per role from the crew roster.
    const crew = ship.crewMembers ?? ship.crew ?? [];
    const filledByRole = new Map<string, number>();
    for (const member of crew) {
      const key = member.position.trim().toLowerCase();
      filledByRole.set(key, (filledByRole.get(key) ?? 0) + 1);
    }

    const seen = new Set<string>();
    const next: CrewSlot[] = [];
    for (const slot of slots) {
      const role = slot.role.trim();
      const key = role.toLowerCase();
      if (seen.has(key)) {
        throw new ValidationError(`Duplicate crew role: ${role}`);
      }
      seen.add(key);

      const filled = filledByRole.get(key) ?? 0;
      if (slot.capacity < filled) {
        throw new ValidationError(
          `Cannot set ${role} capacity to ${slot.capacity}; ${filled} already assigned`
        );
      }
      next.push({ role, capacity: slot.capacity });
    }

    // Reject dropping a role that still has crew assigned.
    for (const [role, filled] of filledByRole) {
      if (filled > 0 && !seen.has(role)) {
        throw new ValidationError(`Cannot remove crew role ${role}; ${filled} still assigned`);
      }
    }

    const newCapacity = next.reduce((sum, slot) => sum + slot.capacity, 0);
    const previousCapacity = ship.crewCapacity ?? 0;

    this.replaceShipAssignment(activity, ship, {
      ...ship,
      crewSlots: next,
      crewCapacity: newCapacity,
      maxCrew: ship.maxCrew !== undefined ? newCapacity : ship.maxCrew,
    });

    activity.totalCrewCapacity = Math.max(
      0,
      (activity.totalCrewCapacity ?? 0) - previousCapacity + newCapacity
    );

    const updated = await this.repository.save(activity);
    logger.info(`Crew slots updated for ship ${shipIdentifier} in activity ${activityId}`);
    return updated;
  }

  /**
   * List per-role crew-slot availability for each ship in the activity.
   */
  async getCrewSlotAvailability(
    activityId: string,
    actorUserId?: string
  ): Promise<
    Array<{
      shipId?: string;
      shipType: string;
      shipName?: string;
      ownerName: string;
      slots: Array<{ role: string; capacity: number; filled: number; available: number }>;
    }>
  > {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (activity && actorUserId) {
      await this.assertCanAccessPassengerAndCrewSlots(
        activity,
        actorUserId,
        'view crew slot availability'
      );
    }
    if (!activity?.shipAssignments) {
      return [];
    }

    return activity.shipAssignments
      .filter(ship => ship.crewSlots?.length)
      .map(ship => {
        const crew = ship.crewMembers ?? ship.crew ?? [];
        const filledByRole = new Map<string, number>();
        for (const member of crew) {
          const key = member.position.trim().toLowerCase();
          filledByRole.set(key, (filledByRole.get(key) ?? 0) + 1);
        }
        return {
          shipId: ship.shipId,
          shipType: ship.shipType,
          shipName: ship.shipName,
          ownerName: ship.ownerName,
          slots: (ship.crewSlots ?? []).map(slot => {
            const filled = filledByRole.get(slot.role.toLowerCase()) ?? 0;
            return {
              role: slot.role,
              capacity: slot.capacity,
              filled,
              available: Math.max(0, slot.capacity - filled),
            };
          }),
        };
      });
  }

  /** Resolve display names for a set of user IDs (best-effort, falls back to ID). */
  private async resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unique = Array.from(new Set(userIds));
    if (unique.length === 0) {
      return map;
    }
    try {
      const { User } = await import('../../models/User');
      const users = await AppDataSource.getRepository(User).findBy({ id: In(unique) });
      for (const user of users) {
        map.set(user.id, user.username ?? user.rsiHandle ?? user.discordId ?? user.id);
      }
    } catch (error: unknown) {
      logger.warn('resolveUserNames failed, falling back to IDs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    for (const id of unique) {
      if (!map.has(id)) {
        map.set(id, id);
      }
    }
    return map;
  }

  /** Authorize a fleet-driven action: fleet leader / 2iC, or the activity creator. */
  private assertCanCommandFleet(
    activity: Activity,
    fleet: { leaderId?: string; secondInCommandId?: string },
    actorUserId: string,
    action: string
  ): void {
    const isFleetLeader = fleet.leaderId === actorUserId || fleet.secondInCommandId === actorUserId;
    const isActivityCreator = activity.creatorId === actorUserId;
    if (!isFleetLeader && !isActivityCreator) {
      throw new ForbiddenError(`Only the fleet leader or activity creator can ${action}`);
    }
  }

  /**
   * Bring some or all of a fleet's ships into an activity. Ships are added as
   * loaner assignments contributed by the actor, with auto-derived crew slots
   * that fleet members can then crew. When `shipIds` is omitted, every ship in
   * the fleet is brought.
   */
  async bringFleetToActivity(
    activityId: string,
    actorUserId: string,
    fleetId: string,
    shipIds?: string[]
  ): Promise<Activity> {
    const actorName = (await this.resolveUserNames([actorUserId])).get(actorUserId) ?? actorUserId;

    const { Fleet } = await import('../../models/Fleet');
    const { FleetShip } = await import('../../models/FleetShip');
    const { Ship } = await import('../../models/Ship');

    return AppDataSource.transaction(async manager => {
      const activityRepository = manager.getRepository(Activity);
      const activity = await activityRepository.findOne({
        where: { id: activityId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!activity) {
        throw new ActivityNotFoundError('activity');
      }

      if (!activity.organizationId) {
        throw new ValidationError('Fleet operations require an organization-bound activity');
      }

      const fleet = await manager.getRepository(Fleet).findOne({
        where: { id: fleetId, organizationId: activity.organizationId },
      });
      if (!fleet) {
        throw new NotFoundError('Fleet');
      }

      this.assertCanCommandFleet(activity, fleet, actorUserId, 'bring a fleet to this event');

      // Fleet→ship membership is canonically stored in the FleetShip join table.
      // Older fleets may still carry the denormalized `shipIds` array, so union
      // both sources — reading `shipIds` alone yields a false "no ships" result
      // for fleets whose ships were added through the join table.
      const joinShipRows = await manager.getRepository(FleetShip).find({
        where: { fleetId: fleet.id },
        select: { shipId: true },
      });
      const fleetShipIds = Array.from(
        new Set<string>(
          [...joinShipRows.map(row => row.shipId), ...(fleet.shipIds ?? [])].filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        )
      );
      const requested = shipIds?.filter(id => id.trim().length > 0) ?? [];
      if (requested.length > 0) {
        const invalid = requested.filter(id => !fleetShipIds.includes(id));
        if (invalid.length > 0) {
          throw new ValidationError('One or more ships do not belong to this fleet');
        }
      }
      const selected = requested.length > 0 ? requested : fleetShipIds;
      if (selected.length === 0) {
        throw new ValidationError('This fleet has no ships to bring');
      }

      const ships = await manager.getRepository(Ship).findBy({ id: In(selected) });
      if (ships.length === 0) {
        throw new NotFoundError('Fleet ships');
      }

      activity.shipAssignments ??= [];
      const existingShipIds = new Set(
        [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])]
          .map(assignment => assignment.shipId)
          .filter((shipId): shipId is string => typeof shipId === 'string' && shipId.length > 0)
      );
      const shipsToAdd = ships.filter(ship => !existingShipIds.has(ship.id));

      if (shipsToAdd.length === 0) {
        logger.info(
          `Fleet ${fleetId} bring for activity ${activityId} by ${actorUserId} was a no-op; all ships already present`
        );
        return activity;
      }

      const newAssignments: ShipAssignment[] = shipsToAdd.map(ship => {
        const crewCapacity = resolveShipCrew(ship);
        return {
          shipId: ship.id,
          shipType: ship.name,
          shipName: ship.name,
          ownerId: actorUserId,
          ownerName: actorName,
          role: 'other',
          crewCapacity,
          crewAssigned: 0,
          crewMembers: [],
          crewSlots: deriveDefaultCrewSlots(crewCapacity),
          capabilities: [],
          status: 'available',
          isLoaner: true,
          contributedBy: actorName,
          contributedByUserId: actorUserId,
          fleetId: fleet.id,
          fleetName: fleet.name,
        };
      });

      // Spread-and-replace so TypeORM detects the JSONB change.
      activity.shipAssignments = [...activity.shipAssignments, ...newAssignments];

      await this.routeCalcService.enrichShipMetadata(newAssignments);

      // Re-derive slots from the (possibly catalogue-bumped) capacity and tally totals.
      for (const assignment of newAssignments) {
        assignment.crewSlots = deriveDefaultCrewSlots(assignment.crewCapacity);
        activity.totalCrewCapacity = (activity.totalCrewCapacity ?? 0) + assignment.crewCapacity;
      }

      await this.recalculateFleetTotals(activity);

      const updated = await activityRepository.save(activity);
      logger.info(
        `Fleet ${fleetId} brought ${newAssignments.length} new ship(s) to activity ${activityId} by ${actorUserId}`
      );
      return updated;
    });
  }

  /**
   * Invite some or all of a fleet's members to an activity. Each invitee gets a
   * participant row with status INVITED; they accept or decline via the normal
   * RSVP flow. Members who are already participants are skipped. When `userIds`
   * is omitted, every fleet member (except the actor) is invited.
   */
  async inviteFleetMembers(
    activityId: string,
    actorUserId: string,
    fleetId: string,
    userIds?: string[]
  ): Promise<{ invited: string[]; skipped: string[] }> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (!activity.organizationId) {
      throw new ValidationError('Fleet operations require an organization-bound activity');
    }
    const organizationId = activity.organizationId;

    const { Fleet } = await import('../../models/Fleet');
    const fleet = await AppDataSource.getRepository(Fleet).findOne({
      where: { id: fleetId, organizationId },
    });
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }

    this.assertCanCommandFleet(activity, fleet, actorUserId, 'invite fleet members');

    const members = fleet.members ?? [];
    const requested = userIds?.filter(id => id.trim().length > 0) ?? [];
    if (requested.length > 0) {
      const invalid = requested.filter(id => !members.includes(id));
      if (invalid.length > 0) {
        throw new ValidationError('One or more users are not members of this fleet');
      }
    }
    const targets = (requested.length > 0 ? requested : members).filter(id => id !== actorUserId);
    if (targets.length === 0) {
      return { invited: [], skipped: [] };
    }

    const names = await this.resolveUserNames(targets);
    const memberInfos = targets.map(userId => ({
      userId,
      userName: names.get(userId) ?? userId,
      organizationId,
    }));

    return this.participantService.inviteMembers(activityId, memberInfos);
  }

  /**
   * Bring fleet ships and invite fleet members as one orchestrated operation.
   * If ship addition succeeds but invites fail, returns an explicit partial
   * result so clients can reconcile state consistently.
   */
  async bringFleetAndInviteMembers(
    activityId: string,
    actorUserId: string,
    fleetId: string,
    options?: { shipIds?: string[]; userIds?: string[] }
  ): Promise<BringFleetAndInviteResult> {
    const activity = await this.bringFleetToActivity(
      activityId,
      actorUserId,
      fleetId,
      options?.shipIds
    );

    try {
      const inviteResult = await this.inviteFleetMembers(
        activityId,
        actorUserId,
        fleetId,
        options?.userIds
      );
      return {
        activity,
        invited: inviteResult.invited,
        skipped: inviteResult.skipped,
        status: 'full',
      };
    } catch (error: unknown) {
      const inviteError =
        error instanceof Error ? error.message : 'Failed to invite fleet members after ship bring';
      logger.warn('Fleet invite failed after successful fleet ship bring', {
        activityId,
        actorUserId,
        fleetId,
        inviteError,
      });
      return {
        activity,
        invited: [],
        skipped: [],
        status: 'ships_only',
        inviteError,
      };
    }
  }

  /**
   * Build a per-member plan for bringing a fleet to an event.
   *
   * Each fleet ship is attributed to the member who added it to the fleet
   * (`FleetShip.assignedBy`). Ships whose assigner is not a current fleet member
   * (or is unset) are returned as `orphanShipIds` — the caller adds those up
   * front under the actor, while member-owned ships are offered to each member
   * individually (the Discord "Bring Fleet" flow DMs each member to accept and
   * optionally loan their own ship).
   *
   * @returns `memberShips` keyed by the member's user ID, plus `orphanShipIds`.
   */
  async getFleetBringPlan(fleetId: string): Promise<{
    fleetName: string;
    memberShips: Map<string, Array<{ shipId: string; shipName: string; maxCrew: number }>>;
    orphanShipIds: string[];
  }> {
    const { Fleet } = await import('../../models/Fleet');
    const { FleetShip } = await import('../../models/FleetShip');
    const { Ship } = await import('../../models/Ship');

    const fleet = await AppDataSource.getRepository(Fleet).findOne({ where: { id: fleetId } });
    if (!fleet) {
      throw new NotFoundError('Fleet');
    }
    const memberSet = new Set(fleet.members ?? []);

    const rows = await AppDataSource.getRepository(FleetShip).find({
      where: { fleetId },
      select: { shipId: true, assignedBy: true },
    });

    const shipIds = Array.from(new Set(rows.map(row => row.shipId)));
    const ships =
      shipIds.length > 0 ? await AppDataSource.getRepository(Ship).findBy({ id: In(shipIds) }) : [];
    const shipById = new Map(ships.map(ship => [ship.id, ship]));

    const memberShips = new Map<
      string,
      Array<{ shipId: string; shipName: string; maxCrew: number }>
    >();
    const orphanShipIds: string[] = [];

    for (const row of rows) {
      const ship = shipById.get(row.shipId);
      if (!ship) {
        continue;
      }
      const owner = row.assignedBy;
      if (!owner || !memberSet.has(owner)) {
        orphanShipIds.push(row.shipId);
        continue;
      }
      const entry = {
        shipId: row.shipId,
        shipName: ship.name,
        maxCrew: resolveShipCrew(ship),
      };
      const list = memberShips.get(owner) ?? [];
      list.push(entry);
      memberShips.set(owner, list);
    }

    return { fleetName: fleet.name, memberShips, orphanShipIds };
  }

  /**
   * Set/move a participant's crew position on a ship.
   * - Self (the participant) can move themselves.
   * - Activity creator or LEADER can move any accepted participant.
   * - Pilot slot is owner-locked; cannot be reassigned away from the ship owner.
   */
  async setCrewPosition(
    activityId: string,
    actorUserId: string,
    targetUserId: string,
    shipAssignmentId: string,
    crewPosition: string
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Authorization: self, activity creator, or LEADER
    const isSelf = actorUserId === targetUserId;
    const isCreator = activity.creatorId === actorUserId;
    const isLeader =
      !isSelf && !isCreator
        ? await this.participantService.isLeader(activityId, actorUserId)
        : false;
    if (!isSelf && !isCreator && !isLeader) {
      throw new ForbiddenError(
        'Only the participant, the activity creator, or a leader can set crew positions'
      );
    }

    // Target must be a participant
    const targetParticipant = await this.participantService.getParticipant(
      activityId,
      targetUserId
    );
    if (!targetParticipant) {
      throw new NotFoundError('Target participant');
    }

    // Search both arrays so crew can be placed on a "Bring Ship" ship (stored in
    // `activity.ships`) as well as fleet/loaner ships (in `shipAssignments`).
    // Restricting to one array made moving crew onto a "Bring Ship" ship throw
    // NotFoundError. Ships are mutated in place (references into their original
    // array), so each ship stays in whichever array it came from.
    const ships = [...(activity.shipAssignments ?? []), ...(activity.ships ?? [])];
    const destShip = ships.find(s => s.id === shipAssignmentId || s.shipId === shipAssignmentId);
    if (!destShip) {
      throw new NotFoundError('Ship in activity');
    }

    // If user already on this ship at this position, no-op
    const existingOnDest = destShip.crewMembers.find(c => c.userId === targetUserId);
    if (existingOnDest?.position === crewPosition) {
      return activity;
    }

    // Pilot guard: pilot slot is reserved for the ship owner
    if (crewPosition === 'pilot' && destShip.ownerId !== targetUserId) {
      throw new ValidationError('The pilot slot is reserved for the ship owner');
    }

    // If target is currently the pilot of a *different* ship they own, block — owner cannot abandon their own pilot slot
    const currentPilotOfOwnedShip = ships.find(
      s =>
        s !== destShip &&
        s.ownerId === targetUserId &&
        s.crewMembers.some(c => c.userId === targetUserId && c.position === 'pilot')
    );
    if (currentPilotOfOwnedShip) {
      throw new ValidationError(
        'Participant is the pilot of their own ship; remove that ship first'
      );
    }

    // Remove target from prior ship crews (we already verified they're not an owner-pilot)
    let removedCount = 0;
    for (const ship of ships) {
      if (ship === destShip) {
        continue;
      }
      const idx = ship.crewMembers.findIndex(c => c.userId === targetUserId);
      if (idx >= 0) {
        ship.crewMembers.splice(idx, 1);
        ship.crewAssigned = Math.max(0, ship.crewAssigned - 1);
        if (ship.crew) {
          ship.crew = [...ship.crewMembers];
        }
        if (ship.currentCrew !== undefined) {
          ship.currentCrew = ship.crewAssigned;
        }
        removedCount++;
      }
    }

    // Apply to destination
    if (existingOnDest) {
      existingOnDest.position = crewPosition;
    } else {
      if (destShip.crewAssigned >= destShip.crewCapacity) {
        throw new ValidationError('Ship is at full crew capacity');
      }
      destShip.crewMembers.push({
        userId: targetUserId,
        userName: targetParticipant.userName ?? 'Unknown',
        avatarUrl: targetParticipant.avatarUrl ?? undefined,
        position: crewPosition,
      });
      destShip.crewAssigned++;
      if (destShip.crew) {
        destShip.crew = [...destShip.crewMembers];
      }
      if (destShip.currentCrew !== undefined) {
        destShip.currentCrew = destShip.crewAssigned;
      }
    }

    // Spread-and-replace whichever array(s) hold the mutated ships so TypeORM
    // detects the simple-json change, preserving each ship's original array
    // (a merged `[...ships]` would wrongly move legacy ships into shipAssignments).
    activity.shipAssignments = activity.shipAssignments
      ? [...activity.shipAssignments]
      : activity.shipAssignments;
    activity.ships = activity.ships ? [...activity.ships] : activity.ships;

    // Adjust totalCrewAssigned: net change is +1 (new on dest) minus removedCount; if existingOnDest, no count change
    if (!existingOnDest) {
      const delta = 1 - removedCount;
      activity.totalCrewAssigned = Math.max(0, (activity.totalCrewAssigned ?? 0) + delta);
    }

    // Sync normalized table
    await this.participantService.updateParticipant(activityId, targetUserId, {
      crewPosition,
      crewShipId: destShip.shipId,
      shipName: destShip.shipName,
      shipType: destShip.shipType,
    });

    const updated = await this.repository.save(activity);
    this.broadcastRosterChange(updated);
    logger.info(
      `Crew position set: user=${targetUserId} position=${crewPosition} ship=${shipAssignmentId} activity=${activityId} actor=${actorUserId}`
    );
    return updated;
  }

  /**
   * Nest an existing ship assignment inside a parent ship, or un-nest it.
   * - Ship owner OR activity creator/leader can move ships.
   * - Validates the parent has sufficient hangar/cargo capacity.
   * Pass parentShipId=null (and transportType=null) to un-nest.
   */
  async nestShip(
    activityId: string,
    actorUserId: string,
    shipAssignmentId: string,
    options: {
      parentShipId: string | null;
      transportType: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar' | null;
    }
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const ships = activity.shipAssignments ?? [];
    const child = ships.find(s => s.id === shipAssignmentId || s.shipId === shipAssignmentId);
    if (!child) {
      throw new NotFoundError('Ship in activity');
    }

    const isOwner = child.ownerId === actorUserId;
    const isCreator = activity.creatorId === actorUserId;
    const isLeader =
      !isOwner && !isCreator
        ? await this.participantService.isLeader(activityId, actorUserId)
        : false;
    if (!isOwner && !isCreator && !isLeader) {
      throw new ForbiddenError(
        'Only the ship owner, the activity creator, or a leader can move ships'
      );
    }

    if (options.parentShipId === null) {
      // Un-nest
      child.parentShipId = undefined;
      child.transportType = undefined;
      child.isTransported = false;
    } else {
      const parent = ships.find(
        s => s.id === options.parentShipId || s.shipId === options.parentShipId
      );
      if (!parent) {
        throw new ValidationError('Parent ship not found in activity');
      }
      if (parent === child) {
        throw new ValidationError('A ship cannot be nested inside itself');
      }
      if (parent.parentShipId) {
        throw new ValidationError('Cannot nest a ship inside one that is already nested');
      }
      // Prevent cycles: ensure no descendant of child is the parent
      const childId = child.shipId ?? child.id;
      if (childId && this.isDescendantOf(ships, parent, childId)) {
        throw new ValidationError('Nesting would create a cycle');
      }
      if (!options.transportType) {
        throw new ValidationError('transportType is required when nesting');
      }
      this.validateNestingCapacity(parent, child, options.transportType, ships);

      child.parentShipId = parent.shipId ?? parent.id;
      child.transportType = options.transportType;
      child.isTransported = true;
    }

    activity.shipAssignments = [...ships];
    const updated = await this.repository.save(activity);
    if (activity.organizationId) {
      invalidateActivityCache(activity.organizationId);
    }
    logger.info(
      `Ship nesting updated: ship=${shipAssignmentId} parent=${options.parentShipId ?? '(none)'} type=${options.transportType ?? 'none'} activity=${activityId} actor=${actorUserId}`
    );
    return updated;
  }

  /** True if `candidate` (or any descendant) has id `ancestorId` somewhere in its parent chain. */
  private isDescendantOf(
    ships: ShipAssignment[],
    candidate: ShipAssignment,
    ancestorId: string
  ): boolean {
    let current: ShipAssignment | undefined = candidate;
    const seen = new Set<string>();
    while (current?.parentShipId) {
      if (current.parentShipId === ancestorId) {
        return true;
      }
      if (seen.has(current.parentShipId)) {
        return false;
      }
      seen.add(current.parentShipId);
      current = ships.find(s => (s.shipId ?? s.id) === current?.parentShipId);
    }
    return false;
  }

  private validateNestingCapacity(
    parent: ShipAssignment,
    child: ShipAssignment,
    transportType: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar',
    allShips: ShipAssignment[]
  ): void {
    // External transport types impose no internal-volume constraint.
    if (transportType === 'tractor_beam' || transportType === 'docking_collar') {
      return;
    }

    const parentId = parent.shipId ?? parent.id;
    if (transportType === 'hangar') {
      const hangarSize = parent.metadata?.hangarSize;
      if (!hangarSize) {
        throw new ValidationError('Parent ship has no hangar');
      }
      const childSize = child.metadata?.size;
      if (childSize && !this.fitsInHangar(childSize, hangarSize)) {
        throw new ValidationError(
          `Ship size '${childSize}' does not fit in parent hangar '${hangarSize}'`
        );
      }
      return;
    }

    if (transportType === 'cargo') {
      const cargoSCU = parent.metadata?.vehicleCargoCapacity ?? parent.metadata?.cargoCapacity ?? 0;
      if (cargoSCU <= 0) {
        throw new ValidationError('Parent ship has no cargo capacity');
      }
      const existingNestedSCU = allShips
        .filter(s => s !== child && s.parentShipId === parentId && s.transportType === 'cargo')
        .reduce((sum, s) => sum + (s.metadata?.cargoCapacity ?? 0), 0);
      const childSCU = child.metadata?.cargoCapacity ?? 0;
      if (childSCU > 0 && existingNestedSCU + childSCU > cargoSCU) {
        throw new ValidationError(
          `Not enough cargo space (parent: ${cargoSCU} SCU, required: ${existingNestedSCU + childSCU} SCU)`
        );
      }
    }
  }

  private fitsInHangar(childSize: string, hangarSize: string): boolean {
    const order = ['snub', 'small', 'medium', 'large', 'capital'];
    const c = order.indexOf(childSize.toLowerCase());
    const h = order.indexOf(hangarSize.toLowerCase());
    if (c === -1 || h === -1) {
      return true;
    } // unknown size — permit (best-effort)
    return c <= h;
  }

  // ==================== ROUTE PLANNING ====================

  /**
   * Add route plan to activity
   */
  async addRoutePlan(
    activityId: string,
    userId: string,
    waypoints: RouteWaypoint[]
  ): Promise<Activity> {
    return this.eventService.addRoutePlan(activityId, waypoints, userId);
  }

  /**
   * Update route waypoint
   */
  async updateWaypoint(
    activityId: string,
    userId: string,
    waypointOrder: number,
    updates: Partial<RouteWaypoint>
  ): Promise<Activity> {
    return this.eventService.updateWaypoint(activityId, waypointOrder, updates, userId);
  }

  // ==================== MINING DATA INTEGRATION ====================

  /**
   * Enrich activity with mining data
   */
  async enrichWithMiningData(activityId: string): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Check if mining-oriented
    const isMining =
      activity.activityType === ActivityType.OPERATION &&
      (activity.tags.includes('mining') ||
        activity.categories.includes('mining') ||
        activity.location?.toLowerCase().includes('mining'));

    if (!isMining || !activity.location) {
      return activity;
    }

    // Fetch mining data
    const miningData = await RegolithService.getMiningDataSummary(activity.location);
    if (miningData) {
      activity.miningData = {
        ...miningData,
        lastUpdated: new Date(),
      };
      activity.isMiningOperation = true;

      // Add mining description
      const miningDesc = await RegolithService.generateMiningDescription(
        activity.location,
        activity.systemLocation
      );

      if (miningDesc) {
        activity.description += miningDesc;
      }

      // Update resource requirements if not set
      if (!activity.resourceRequirements || activity.resourceRequirements.length === 0) {
        activity.resourceRequirements = miningData.recommendedShips.map((shipType, _idx) => ({
          type: 'ship' as const,
          name: shipType,
          quantity: 1,
          provided: 0,
          requiredCapabilities: ['mining'],
        }));
      }

      logger.info(`Mining data enriched for activity ${activityId}`);
    }

    return this.repository.save(activity);
  }

  /**
   * Auto-enrich mining activities on creation
   */
  async autoEnrichMiningActivity(activity: Activity): Promise<Activity> {
    const isMining =
      activity.activityType === ActivityType.OPERATION &&
      (activity.tags.includes('mining') ||
        activity.categories.includes('mining') ||
        activity.location?.toLowerCase().includes('mining'));

    if (isMining && activity.location) {
      return this.enrichWithMiningData(activity.id);
    }

    return activity;
  }

  // ==================== APPLICATION MANAGEMENT (delegated to ActivityJobService) ====================

  private _jobService?: ActivityJobService;
  private get jobService(): ActivityJobService {
    this._jobService ??= new ActivityJobService();
    return this._jobService;
  }

  /**
   * Submit application to an activity (delegates to ActivityJobService)
   */
  async submitApplication(
    activityId: string,
    applicationData: {
      applicantId: string;
      applicantName: string;
      applicantEmail?: string;
      rsiHandle?: string;
      discordId?: string;
      message?: string;
      answers?: Array<{ questionId: string; question: string; answer: string }>;
      referredBy?: string;
      timezone?: string;
      availablePlaytimes?: string[];
      preferredRoles?: string[];
    }
  ): Promise<ActivityApplication> {
    return this.jobService.submitApplication(activityId, applicationData);
  }

  /**
   * Accept application (delegates to ActivityJobService)
   */
  async acceptApplication(
    activityId: string,
    applicationId: string,
    reviewerId: string,
    notes?: string
  ): Promise<ActivityApplication> {
    return this.jobService.acceptApplication(activityId, applicationId, reviewerId, notes);
  }

  /**
   * Reject application (delegates to ActivityJobService)
   */
  async rejectApplication(
    activityId: string,
    applicationId: string,
    reviewerId: string,
    reason?: string
  ): Promise<ActivityApplication> {
    return this.jobService.rejectApplication(activityId, applicationId, reviewerId, reason);
  }

  /**
   * Advance application to the next review stage (pending → under_review).
   * (delegates to ActivityJobService)
   */
  async advanceApplicationStage(
    activityId: string,
    applicationId: string,
    reviewerId: string,
    comment?: string
  ): Promise<ActivityApplication> {
    return this.jobService.advanceApplicationStage(activityId, applicationId, reviewerId, comment);
  }

  /**
   * Withdraw application (delegates to ActivityJobService)
   */
  async withdrawApplication(
    activityId: string,
    applicationId: string,
    applicantId: string
  ): Promise<ActivityApplication> {
    return this.jobService.withdrawApplication(activityId, applicationId, applicantId);
  }

  /**
   * Get applications for activity (delegates to ActivityJobService)
   */
  async getApplications(
    activityId: string,
    filters?: {
      status?: ApplicationStatus;
      applicantId?: string;
    }
  ): Promise<ActivityApplication[]> {
    return this.jobService.getApplications(activityId, filters);
  }

  /**
   * Schedule interview (delegates to ActivityJobService)
   */
  async scheduleInterview(
    activityId: string,
    applicationId: string,
    interviewData: {
      scheduledAt: Date;
      interviewerId: string;
      notes?: string;
    }
  ): Promise<ActivityApplication> {
    return this.jobService.scheduleInterview(activityId, applicationId, interviewData);
  }

  /**
   * Complete job (delegates to ActivityJobService)
   */
  async completeJob(
    activityId: string,
    applicationId: string,
    completionData: {
      rating?: number;
      review?: string;
    }
  ): Promise<ActivityApplication> {
    return this.jobService.completeJob(activityId, applicationId, completionData);
  }

  // ==================== EVENT-SPECIFIC OPERATIONS (delegated to ActivityEventService) ====================

  private _eventService?: ActivityEventService;
  private get eventService(): ActivityEventService {
    this._eventService ??= new ActivityEventService();
    return this._eventService;
  }

  /**
   * Join waitlist when activity is full (delegates to ActivityEventService)
   */
  async joinWaitlist(activityId: string, userId: string): Promise<Activity> {
    return this.eventService.joinWaitlist(activityId, userId);
  }

  /**
   * Leave waitlist (delegates to ActivityEventService)
   */
  async leaveWaitlist(activityId: string, userId: string): Promise<Activity> {
    return this.eventService.leaveWaitlist(activityId, userId);
  }

  /**
   * Promote from waitlist (delegates to ActivityEventService)
   */
  async promoteFromWaitlist(activityId: string, userId?: string): Promise<Activity> {
    return this.eventService.promoteFromWaitlist(activityId, userId);
  }

  /**
   * Update RSVP status (delegates to ActivityEventService)
   */
  async updateRSVPStatus(
    activityId: string,
    userId: string,
    status: 'accepted' | 'declined' | 'standby',
    role?: ParticipantRole
  ): Promise<Activity> {
    return this.eventService.updateRSVPStatus(activityId, userId, status, role);
  }

  /**
   * Clone activity (useful for recurring events or templates)
   */
  async cloneActivity(
    activityId: string,
    overrides?: {
      scheduledStartDate?: Date;
      scheduledEndDate?: Date;
      organizationId?: string;
      discordServerId?: string;
    }
  ): Promise<Activity> {
    const original = await this.repository.findOne({ where: { id: activityId } });
    if (!original) {
      throw new ActivityNotFoundError('activity');
    }

    const cloned = this.repository.create({
      ...original,
      id: undefined, // Let DB generate new ID
      participants: [], // Start fresh
      currentParticipants: 0,
      waitlist: [],
      applications: [],
      currentApplicants: 0,
      status: ActivityStatus.DRAFT,
      createdAt: undefined,
      updatedAt: undefined,
      actualStartDate: undefined,
      actualEndDate: undefined,
      completionReport: undefined,
      // A clone is a brand-new event with no posted Discord presence yet — never
      // inherit the source's per-instance Discord/voice linkage. Otherwise edits
      // or cancellations of the clone would act on the original's linked Discord
      // scheduled event or voice channel.
      discordEventId: undefined,
      voiceChannelId: undefined,
      voiceChannelName: undefined,
      metadata: {
        ...original.metadata,
        parentEventId: original.id,
        isTemplate: false,
        ...overrides,
      },
      scheduledStartDate: overrides?.scheduledStartDate ?? original.scheduledStartDate,
      scheduledEndDate: overrides?.scheduledEndDate ?? original.scheduledEndDate,
      organizationId: overrides?.organizationId ?? original.organizationId,
    });

    const saved = await this.repository.save(cloned);
    logger.info(`Activity ${activityId} cloned to ${saved.id}`);

    return saved;
  }

  /**
   * Create activity from template
   */
  async createFromTemplate(
    templateId: string,
    data: {
      scheduledStartDate: Date;
      scheduledEndDate?: Date;
      organizationId?: string;
      customizations?: Partial<CreateActivityDTO>;
    }
  ): Promise<Activity> {
    const template = await this.repository.findOne({
      where: {
        id: templateId,
        metadata: { isTemplate: true } as Record<string, unknown>,
      },
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    return this.cloneActivity(templateId, {
      scheduledStartDate: data.scheduledStartDate,
      scheduledEndDate: data.scheduledEndDate,
      organizationId: data.organizationId,
    });
  }

  /**
   * Get upcoming activities (useful for event listings)
   */
  async getUpcomingActivities(filters?: {
    activityType?: ActivityType;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Activity[]> {
    const query = this.repository.createQueryBuilder('activity');

    // Only future activities (exclude internal recruitment unless explicitly requested)
    query.where('activity.scheduledStartDate > :now', { now: new Date() });

    // Exclude terminal / non-live statuses so cancelled, completed, failed, expired,
    // and draft activities don't show up as "upcoming". Without this filter, dead
    // events linger in listings (e.g. /events list) until they are hard-deleted.
    query.andWhere('activity.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [
        ActivityStatus.DRAFT,
        ActivityStatus.CANCELLED,
        ActivityStatus.COMPLETED,
        ActivityStatus.FAILED,
        ActivityStatus.EXPIRED,
      ],
    });

    if (!filters?.activityType) {
      query.andWhere('activity.activityType != :excludedType', {
        excludedType: ActivityType.RECRUITMENT,
      });
    }

    if (filters?.activityType) {
      query.andWhere('activity.activityType = :type', { type: filters.activityType });
    }

    if (filters?.organizationId) {
      query.andWhere('activity.organizationId = :orgId', { orgId: filters.organizationId });
    }

    if (filters?.startDate) {
      query.andWhere('activity.scheduledStartDate >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('activity.scheduledStartDate <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('activity.scheduledStartDate', 'ASC');

    if (filters?.limit) {
      query.take(filters.limit);
    }

    return query.getMany();
  }

  /**
   * Complete activity with final report
   */
  async completeActivity(
    activityId: string,
    completionData: {
      submittedBy: string;
      submittedAt: Date;
      outcome: 'success' | 'partial' | 'failure';
      participantCount: number;
      duration: number;
      creditsEarned: number;
      reputationEarned: number;
      objectivesCompleted?: string[];
      casualties?: number;
      performanceRatings?: Record<string, number>;
      notableEvents?: string[];
      recommendations?: string;
    }
  ): Promise<Activity> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    activity.status = ActivityStatus.COMPLETED;
    activity.actualEndDate = new Date();
    activity.completionReport = completionData;

    const updated = await this.repository.save(activity);

    domainEvents.emit('activity:completed', {
      activityId,
      organizationId: activity.organizationId ?? '',
      participantCount: completionData.participantCount,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Activity ${activityId} completed with outcome: ${completionData.outcome}`);
    if (activity.organizationId) {
      invalidateActivityCache(activity.organizationId);
    }

    return updated;
  }
}
