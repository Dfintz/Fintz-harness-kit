import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks, selectFieldsFromArray } from '../../middleware/queryParser';
import { Activity, ActivityStatus, ActivityType, ParticipantRole } from '../../models/Activity';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
import { domainEvents } from '../../services/shared/DomainEventBus';
import { ApiErrorCode } from '../../types/api';
import { calculateCrewFromRequirements } from '../../utils/crewCalculation';
import {
  emitActivityCreated,
  emitActivityDeleted,
  emitActivityUpdated,
} from '../../websocket/controllers/activityWebSocketController';

import { enrichActivityWithAvatars } from './activityController.avatars';
import type { CreateActivityBody, UpdateActivityBody } from './activityController.types';

type AuthRequest = Request & {
  user?: { id?: string; username?: string; currentOrganizationId?: string };
};

type LifecycleDiscoveryDeps = {
  findActivityById: (
    id: string,
    options?: {
      organizationId?: string;
      visibility?: Activity['visibility'];
      includeParticipants?: boolean;
    }
  ) => Promise<Activity | null>;
  findOrganizationById: (orgId: string) => Promise<{ name: string } | null>;
  hydrateParticipants: (activity: Activity) => Promise<void>;
  applyAllowedActivityUpdates: (activity: Activity, updates: Record<string, unknown>) => void;
  applyScheduleUpdates: (activity: Activity, updates: Record<string, unknown>) => void;
  applyMetadataUpdate: (activity: Activity, updates: Record<string, unknown>) => void;
  notifyOrg: (input: {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    activityId: string;
    senderId?: string;
    metadata?: Record<string, unknown>;
  }) => void;
  participantService: {
    joinActivity: (
      activityId: string,
      dto: {
        userId: string;
        userName: string;
        organizationId?: string;
        organizationName?: string;
        role?: ParticipantRole;
      }
    ) => Promise<{ activity: Activity; wasUpdate: boolean }>;
  };
};

/**
 * GET /api/v2/organizations/:orgId/activities
 * List all activities for an organization
 */
export async function listOrgActivitiesHandler(req: Request, res: Response): Promise<void> {
  const { orgId } = req.params;
  const { limit, offset, sort, filters, search, fields } = req.queryParams ?? {
    limit: 20,
    offset: 0,
    sort: null,
    filters: {},
    search: null,
    fields: null,
  };

  const activityRepo = AppDataSource.getRepository(Activity);
  const queryBuilder = activityRepo
    .createQueryBuilder('activity')
    .where('activity.organizationId = :orgId', { orgId })
    .andWhere('activity.activityType != :excludedType', {
      excludedType: ActivityType.RECRUITMENT,
    });

  // Add filters
  if (filters.status) {
    queryBuilder.andWhere('activity.status = :status', { status: filters.status });
  }
  if (filters.type) {
    queryBuilder.andWhere('activity.activityType = :type', { type: filters.type });
  }
  if (search) {
    queryBuilder.andWhere('(activity.title ILIKE :search OR activity.description ILIKE :search)', {
      search: `%${search}%`,
    });
  }

  // Apply sorting (allowlist to prevent SQL injection via column name)
  const ALLOWED_SORT_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'scheduledStartDate',
    'title',
    'status',
    'activityType',
  ]);
  if (sort) {
    const safeField = ALLOWED_SORT_FIELDS.has(sort.field) ? sort.field : 'createdAt';
    queryBuilder.orderBy(`activity.${safeField}`, sort.order);
  } else {
    queryBuilder.orderBy('activity.createdAt', 'DESC');
  }

  // Get total count
  const total = await queryBuilder.getCount();

  // Get paginated results
  const activities = await queryBuilder.skip(offset).take(limit).getMany();

  // Apply field selection
  const filteredActivities = selectFieldsFromArray(activities, fields);

  // Build HATEOAS links
  const links = buildHateoasLinks(
    `/api/v2/organizations/${orgId}/activities`,
    offset,
    limit,
    total
  );

  res.paginated(
    filteredActivities,
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
 * GET /api/v2/search/activities/:id
 * Public activity detail - only returns activities with visibility: 'public'
 */
export async function getPublicActivityByIdHandler(
  req: Request,
  res: Response,
  deps: Pick<LifecycleDiscoveryDeps, 'hydrateParticipants'>
): Promise<void> {
  const { id } = req.params;

  const activityRepo = AppDataSource.getRepository(Activity);
  const activity = await activityRepo
    .createQueryBuilder('activity')
    .where('activity.id = :id', { id })
    .andWhere('activity.visibility = :visibility', { visibility: 'public' })
    .getOne();

  if (!activity) {
    throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
  }

  await enrichActivityWithAvatars(activity);
  await deps.hydrateParticipants(activity);
  res.success(activity);
}

/**
 * GET /api/v2/activities/:id
 * Get a specific activity by ID (cross-org: any authenticated user can view)
 */
export async function getActivityByIdHandler(
  req: Request,
  res: Response,
  deps: Pick<LifecycleDiscoveryDeps, 'hydrateParticipants'>
): Promise<void> {
  const { id } = req.params;
  const actorUserId = (req as AuthRequest).user?.id;

  const activityRepo = AppDataSource.getRepository(Activity);
  const activity = await activityRepo
    .createQueryBuilder('activity')
    .where('activity.id = :id', { id })
    .getOne();

  if (!activity) {
    throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
  }

  await enrichActivityWithAvatars(activity);
  await deps.hydrateParticipants(activity);

  if (actorUserId) {
    const { ActivityService } = await import('../../services/activity/ActivityService');
    const activityService = new ActivityService();
    const capabilities = await activityService.getShipManagementCapabilities(id, actorUserId);

    (activity as Activity & { manageableShipIdentifiers?: string[] }).manageableShipIdentifiers =
      capabilities.manageableShipIdentifiers;
  }

  res.success(activity);
}

/**
 * POST /api/v2/organizations/:orgId/activities
 * Create a new activity
 */
export async function createActivityHandler(
  req: Request,
  res: Response,
  deps: Pick<LifecycleDiscoveryDeps, 'findOrganizationById' | 'participantService' | 'notifyOrg'>
): Promise<void> {
  const body = req.body as CreateActivityBody;
  const orgId = req.params.orgId ?? body.organizationId;
  const {
    title,
    description,
    type,
    status = ActivityStatus.OPEN,
    visibility,
    maxParticipants,
    startDate,
    endDate,
    timezone,
    location,
    requirements,
    estimatedDuration,
    voiceChannelMode,
    voiceChannelLimit,
    metadata,
    shipRequirementType,
    requiredShips,
    crewSpotsTotal,
  } = body;

  if (!title || !type) {
    throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Title and type are required', 400);
  }

  // Auto-calculate maxParticipants from ship requirements if not manually set
  let effectiveMaxParticipants = maxParticipants;
  let effectiveCrewCapacity = crewSpotsTotal;
  if (requiredShips?.length && !effectiveCrewCapacity) {
    const totalCrew = calculateCrewFromRequirements(requiredShips);
    if (totalCrew > 0) {
      effectiveCrewCapacity = totalCrew;
    }
  }
  if (effectiveCrewCapacity && !effectiveMaxParticipants) {
    effectiveMaxParticipants = effectiveCrewCapacity;
  }

  const activityRepo = AppDataSource.getRepository(Activity);

  const userId = (req as AuthRequest).user?.id;
  const username = (req as AuthRequest).user?.username ?? 'Unknown';

  // Resolve org name for display
  let orgName: string | undefined;
  if (orgId) {
    const org = await deps.findOrganizationById(orgId);
    orgName = org?.name;
  }

  const activity = activityRepo.create({
    title,
    description,
    activityType: type,
    status,
    visibility,
    maxParticipants: effectiveMaxParticipants,
    scheduledStartDate: startDate ? new Date(startDate) : undefined,
    scheduledEndDate: endDate ? new Date(endDate) : undefined,
    timezone: timezone ?? undefined,
    estimatedDuration,
    location,
    requirements,
    metadata: {
      ...metadata,
      ...(voiceChannelMode && voiceChannelMode !== 'none'
        ? {
            discordVoiceChannelMode: voiceChannelMode,
            ...(voiceChannelMode === 'temp' && voiceChannelLimit
              ? { discordVoiceChannelLimit: voiceChannelLimit }
              : {}),
          }
        : {}),
    },
    organizationId: orgId,
    organizationName: orgName,
    shipRequirementType: shipRequirementType ?? undefined,
    requiredShips: requiredShips ?? undefined,
    totalCrewCapacity: effectiveCrewCapacity ?? undefined,

    creatorId: userId,
    creatorName: username,
    currentParticipants: 1,
    participants: [
      {
        userId,
        userName: username,
        organizationId: orgId,
        organizationName: orgName,
        role: ParticipantRole.LEADER,
        status: 'accepted',
        joinedAt: new Date(),
      },
    ],
  } as Partial<Activity>);

  await activityRepo.save(activity);

  // Register creator in the normalized `activity_participants` table via the
  // owner service (audit log, JSON-column sync, and counter recompute included).
  // The deprecated `participants` JSON column written above is kept solely for
  // backward compatibility with code paths that still read it.
  if (userId) {
    await deps.participantService.joinActivity(activity.id, {
      userId,
      userName: username,
      organizationId: orgId,
      organizationName: orgName,
      role: ParticipantRole.LEADER,
    });
  }

  if (orgId && userId) {
    domainEvents.emit('activity:created', {
      activityId: activity.id,
      organizationId: orgId,
      activityType: type,
      title,
      hostUserId: userId,
      scheduledAt: activity.scheduledStartDate?.toISOString(),
      maxParticipants: effectiveMaxParticipants,
      timezone: timezone ?? undefined,
      description: description ?? undefined,
      location: location ?? undefined,
      estimatedDuration,
      voiceChannelMode,
      voiceChannelLimit,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit WebSocket event
  emitActivityCreated(orgId ?? null, activity as unknown as Record<string, unknown>);

  // Create in-app notification for org members
  if (orgId) {
    deps.notifyOrg({
      context: NotificationContext.ACTIVITY_INVITATION,
      organizationId: orgId,
      title: `New Activity: ${title}`,
      message: `${username} created "${title}"`,
      senderId: userId,
      activityId: activity.id,
      metadata: { activityType: type },
    });
  }

  res.success(activity);
}

/**
 * PUT /api/v2/activities/:id
 * Update an activity (creator or org-admin only)
 */
export async function updateActivityHandler(
  req: Request,
  res: Response,
  deps: Pick<
    LifecycleDiscoveryDeps,
    | 'findActivityById'
    | 'applyAllowedActivityUpdates'
    | 'applyScheduleUpdates'
    | 'applyMetadataUpdate'
    | 'hydrateParticipants'
  >
): Promise<void> {
  const { id } = req.params;
  const updates = req.body as UpdateActivityBody & Record<string, unknown>;
  const userId = (req as AuthRequest).user?.id;

  const activityRepo = AppDataSource.getRepository(Activity);
  const activity = await deps.findActivityById(id);

  if (!activity) {
    throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
  }

  // Only the creator can update the activity
  if (activity.creatorId && activity.creatorId !== userId) {
    throw new ApiError(
      ApiErrorCode.FORBIDDEN,
      'Only the activity creator can update this activity',
      403
    );
  }

  deps.applyAllowedActivityUpdates(activity, updates);
  deps.applyScheduleUpdates(activity, updates);
  deps.applyMetadataUpdate(activity, updates);

  await activityRepo.save(activity);

  // Emit WebSocket event
  emitActivityUpdated(
    activity.organizationId ?? '',
    activity as unknown as Record<string, unknown>
  );

  await enrichActivityWithAvatars(activity);
  await deps.hydrateParticipants(activity);
  res.success(activity);
}

/**
 * DELETE /api/v2/activities/:id
 * Delete an activity (creator or org-admin only)
 */
export async function deleteActivityHandler(
  req: Request,
  res: Response,
  deps: Pick<LifecycleDiscoveryDeps, 'findActivityById'>
): Promise<void> {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.id;

  const activityRepo = AppDataSource.getRepository(Activity);
  const activity = await deps.findActivityById(id);

  if (!activity) {
    throw new ApiError(ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
  }

  // Only the creator can delete the activity
  if (activity.creatorId && activity.creatorId !== userId) {
    throw new ApiError(
      ApiErrorCode.FORBIDDEN,
      'Only the activity creator can delete this activity',
      403
    );
  }

  const orgId = activity.organizationId ?? '';
  await activityRepo.remove(activity);

  // Emit WebSocket event
  emitActivityDeleted(orgId, id);

  res.success({
    id,
    deleted: true,
  });
}

/**
 * GET /api/v2/activities/recommended
 * Get recommended activities for the user
 */
export async function getRecommendedActivitiesHandler(req: Request, res: Response): Promise<void> {
  const _userId = (req as AuthRequest).user?.id;
  const limit = Math.min(Number.parseInt(req.query.limit as string) || 10, 200);

  const activityRepo = AppDataSource.getRepository(Activity);

  // Get open activities (exclude internal recruitment activities)
  const activities = await activityRepo
    .createQueryBuilder('activity')
    .where('activity.status IN (:...statuses)', {
      statuses: [ActivityStatus.OPEN, ActivityStatus.RECRUITING],
    })
    .andWhere('activity.visibility IN (:...visibilities)', {
      visibilities: ['public', 'listed'],
    })
    .andWhere('activity.activityType != :excludedType', {
      excludedType: ActivityType.RECRUITMENT,
    })
    .orderBy('activity.scheduledStartDate', 'ASC')
    .limit(limit)
    .getMany();

  res.success({
    activities,
    count: activities.length,
  });
}

/**
 * GET /api/v2/activities/upcoming
 * Get upcoming activities
 */
export async function getUpcomingActivitiesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.query;
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 10, 200);

    const activityRepo = AppDataSource.getRepository(Activity);
    const queryBuilder = activityRepo
      .createQueryBuilder('activity')
      .where('activity.status IN (:...statuses)', {
        statuses: [ActivityStatus.OPEN, ActivityStatus.RECRUITING, ActivityStatus.READY],
      })
      .andWhere('activity.scheduledStartDate > :now', { now: new Date() })
      .andWhere('activity.activityType != :excludedType', {
        excludedType: ActivityType.RECRUITMENT,
      });

    if (orgId) {
      queryBuilder.andWhere('activity.organizationId = :orgId', { orgId });
    }

    const activities = await queryBuilder
      .orderBy('activity.scheduledStartDate', 'ASC')
      .limit(limit)
      .getMany();

    res.success({
      activities,
      count: activities.length,
    });
  } catch (error) {
    throw new ApiError(
      ApiErrorCode.INTERNAL_ERROR,
      `Failed to fetch upcoming activities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * GET /api/v2/organizations/:orgId/activities/analytics
 * Get activity analytics for an organization
 */
export async function getActivityAnalyticsHandler(req: Request, res: Response): Promise<void> {
  const { orgId } = req.params;

  const activityRepo = AppDataSource.getRepository(Activity);

  // Get counts by status
  const byStatus = await activityRepo
    .createQueryBuilder('activity')
    .select('activity.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .where('activity.organizationId = :orgId', { orgId })
    .groupBy('activity.status')
    .getRawMany();

  // Get counts by type
  const byType = await activityRepo
    .createQueryBuilder('activity')
    .select('activity.activityType', 'type')
    .addSelect('COUNT(*)', 'count')
    .where('activity.organizationId = :orgId', { orgId })
    .groupBy('activity.activityType')
    .getRawMany();

  // Get total count
  const total = await activityRepo.count({
    where: { organizationId: orgId },
  });

  // Get upcoming count
  const upcoming = await activityRepo
    .createQueryBuilder('activity')
    .where('activity.organizationId = :orgId', { orgId })
    .andWhere('activity.scheduledStartDate > :now', { now: new Date() })
    .andWhere('activity.status IN (:...statuses)', {
      statuses: [ActivityStatus.OPEN, ActivityStatus.RECRUITING, ActivityStatus.READY],
    })
    .getCount();

  const analytics = {
    total,
    upcoming,
    byStatus: (byStatus as { status: string; count: string }[]).reduce(
      (acc: Record<string, number>, curr) => {
        acc[curr.status] = Number.parseInt(curr.count);
        return acc;
      },
      {}
    ),
    byType: (byType as { type: string; count: string }[]).reduce(
      (acc: Record<string, number>, curr) => {
        acc[curr.type] = Number.parseInt(curr.count);
        return acc;
      },
      {}
    ),
  };

  res.success(analytics);
}
