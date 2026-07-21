"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrgActivitiesHandler = listOrgActivitiesHandler;
exports.getPublicActivityByIdHandler = getPublicActivityByIdHandler;
exports.getActivityByIdHandler = getActivityByIdHandler;
exports.createActivityHandler = createActivityHandler;
exports.updateActivityHandler = updateActivityHandler;
exports.deleteActivityHandler = deleteActivityHandler;
exports.getRecommendedActivitiesHandler = getRecommendedActivitiesHandler;
exports.getUpcomingActivitiesHandler = getUpcomingActivitiesHandler;
exports.getActivityAnalyticsHandler = getActivityAnalyticsHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const Activity_1 = require("../../models/Activity");
const NotificationRouter_1 = require("../../services/communication/notifications/NotificationRouter");
const DomainEventBus_1 = require("../../services/shared/DomainEventBus");
const api_1 = require("../../types/api");
const crewCalculation_1 = require("../../utils/crewCalculation");
const activityWebSocketController_1 = require("../../websocket/controllers/activityWebSocketController");
const activityController_avatars_1 = require("./activityController.avatars");
async function listOrgActivitiesHandler(req, res) {
    const { orgId } = req.params;
    const { limit, offset, sort, filters, search, fields } = req.queryParams ?? {
        limit: 20,
        offset: 0,
        sort: null,
        filters: {},
        search: null,
        fields: null,
    };
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const queryBuilder = activityRepo
        .createQueryBuilder('activity')
        .where('activity.organizationId = :orgId', { orgId })
        .andWhere('activity.activityType != :excludedType', {
        excludedType: Activity_1.ActivityType.RECRUITMENT,
    });
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
    }
    else {
        queryBuilder.orderBy('activity.createdAt', 'DESC');
    }
    const total = await queryBuilder.getCount();
    const activities = await queryBuilder.skip(offset).take(limit).getMany();
    const filteredActivities = (0, queryParser_1.selectFieldsFromArray)(activities, fields);
    const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/activities`, offset, limit, total);
    res.paginated(filteredActivities, {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
    }, links);
}
async function getPublicActivityByIdHandler(req, res, deps) {
    const { id } = req.params;
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const activity = await activityRepo
        .createQueryBuilder('activity')
        .where('activity.id = :id', { id })
        .andWhere('activity.visibility = :visibility', { visibility: 'public' })
        .getOne();
    if (!activity) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
    await (0, activityController_avatars_1.enrichActivityWithAvatars)(activity);
    await deps.hydrateParticipants(activity);
    res.success(activity);
}
async function getActivityByIdHandler(req, res, deps) {
    const { id } = req.params;
    const actorUserId = req.user?.id;
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const activity = await activityRepo
        .createQueryBuilder('activity')
        .where('activity.id = :id', { id })
        .getOne();
    if (!activity) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
    await (0, activityController_avatars_1.enrichActivityWithAvatars)(activity);
    await deps.hydrateParticipants(activity);
    if (actorUserId) {
        const { ActivityService } = await Promise.resolve().then(() => __importStar(require('../../services/activity/ActivityService')));
        const activityService = new ActivityService();
        const capabilities = await activityService.getShipManagementCapabilities(id, actorUserId);
        activity.manageableShipIdentifiers =
            capabilities.manageableShipIdentifiers;
    }
    res.success(activity);
}
async function createActivityHandler(req, res, deps) {
    const body = req.body;
    const orgId = req.params.orgId ?? body.organizationId;
    const { title, description, type, status = Activity_1.ActivityStatus.OPEN, visibility, maxParticipants, startDate, endDate, timezone, location, requirements, estimatedDuration, voiceChannelMode, voiceChannelLimit, metadata, shipRequirementType, requiredShips, crewSpotsTotal, } = body;
    if (!title || !type) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Title and type are required', 400);
    }
    let effectiveMaxParticipants = maxParticipants;
    let effectiveCrewCapacity = crewSpotsTotal;
    if (requiredShips?.length && !effectiveCrewCapacity) {
        const totalCrew = (0, crewCalculation_1.calculateCrewFromRequirements)(requiredShips);
        if (totalCrew > 0) {
            effectiveCrewCapacity = totalCrew;
        }
    }
    if (effectiveCrewCapacity && !effectiveMaxParticipants) {
        effectiveMaxParticipants = effectiveCrewCapacity;
    }
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const userId = req.user?.id;
    const username = req.user?.username ?? 'Unknown';
    let orgName;
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
                role: Activity_1.ParticipantRole.LEADER,
                status: 'accepted',
                joinedAt: new Date(),
            },
        ],
    });
    await activityRepo.save(activity);
    if (userId) {
        await deps.participantService.joinActivity(activity.id, {
            userId,
            userName: username,
            organizationId: orgId,
            organizationName: orgName,
            role: Activity_1.ParticipantRole.LEADER,
        });
    }
    if (orgId && userId) {
        DomainEventBus_1.domainEvents.emit('activity:created', {
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
    (0, activityWebSocketController_1.emitActivityCreated)(orgId ?? null, activity);
    if (orgId) {
        deps.notifyOrg({
            context: NotificationRouter_1.NotificationContext.ACTIVITY_INVITATION,
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
async function updateActivityHandler(req, res, deps) {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user?.id;
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const activity = await deps.findActivityById(id);
    if (!activity) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
    if (activity.creatorId && activity.creatorId !== userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only the activity creator can update this activity', 403);
    }
    deps.applyAllowedActivityUpdates(activity, updates);
    deps.applyScheduleUpdates(activity, updates);
    deps.applyMetadataUpdate(activity, updates);
    await activityRepo.save(activity);
    (0, activityWebSocketController_1.emitActivityUpdated)(activity.organizationId ?? '', activity);
    await (0, activityController_avatars_1.enrichActivityWithAvatars)(activity);
    await deps.hydrateParticipants(activity);
    res.success(activity);
}
async function deleteActivityHandler(req, res, deps) {
    const { id } = req.params;
    const userId = req.user?.id;
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const activity = await deps.findActivityById(id);
    if (!activity) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
    if (activity.creatorId && activity.creatorId !== userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only the activity creator can delete this activity', 403);
    }
    const orgId = activity.organizationId ?? '';
    await activityRepo.remove(activity);
    (0, activityWebSocketController_1.emitActivityDeleted)(orgId, id);
    res.success({
        id,
        deleted: true,
    });
}
async function getRecommendedActivitiesHandler(req, res) {
    const _userId = req.user?.id;
    const limit = Math.min(Number.parseInt(req.query.limit) || 10, 200);
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const activities = await activityRepo
        .createQueryBuilder('activity')
        .where('activity.status IN (:...statuses)', {
        statuses: [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING],
    })
        .andWhere('activity.visibility IN (:...visibilities)', {
        visibilities: ['public', 'listed'],
    })
        .andWhere('activity.activityType != :excludedType', {
        excludedType: Activity_1.ActivityType.RECRUITMENT,
    })
        .orderBy('activity.scheduledStartDate', 'ASC')
        .limit(limit)
        .getMany();
    res.success({
        activities,
        count: activities.length,
    });
}
async function getUpcomingActivitiesHandler(req, res) {
    try {
        const { orgId } = req.query;
        const limit = Math.min(Number.parseInt(req.query.limit) || 10, 200);
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const queryBuilder = activityRepo
            .createQueryBuilder('activity')
            .where('activity.status IN (:...statuses)', {
            statuses: [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING, Activity_1.ActivityStatus.READY],
        })
            .andWhere('activity.scheduledStartDate > :now', { now: new Date() })
            .andWhere('activity.activityType != :excludedType', {
            excludedType: Activity_1.ActivityType.RECRUITMENT,
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
    }
    catch (error) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to fetch upcoming activities: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
}
async function getActivityAnalyticsHandler(req, res) {
    const { orgId } = req.params;
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const byStatus = await activityRepo
        .createQueryBuilder('activity')
        .select('activity.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('activity.organizationId = :orgId', { orgId })
        .groupBy('activity.status')
        .getRawMany();
    const byType = await activityRepo
        .createQueryBuilder('activity')
        .select('activity.activityType', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('activity.organizationId = :orgId', { orgId })
        .groupBy('activity.activityType')
        .getRawMany();
    const total = await activityRepo.count({
        where: { organizationId: orgId },
    });
    const upcoming = await activityRepo
        .createQueryBuilder('activity')
        .where('activity.organizationId = :orgId', { orgId })
        .andWhere('activity.scheduledStartDate > :now', { now: new Date() })
        .andWhere('activity.status IN (:...statuses)', {
        statuses: [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING, Activity_1.ActivityStatus.READY],
    })
        .getCount();
    const analytics = {
        total,
        upcoming,
        byStatus: byStatus.reduce((acc, curr) => {
            acc[curr.status] = Number.parseInt(curr.count);
            return acc;
        }, {}),
        byType: byType.reduce((acc, curr) => {
            acc[curr.type] = Number.parseInt(curr.count);
            return acc;
        }, {}),
    };
    res.success(analytics);
}
//# sourceMappingURL=activityController.lifecycleDiscovery.js.map