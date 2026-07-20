"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findActivityByIdHelper = findActivityByIdHelper;
exports.getScopedOrganizationIdHelper = getScopedOrganizationIdHelper;
exports.getCompletionActivityForUserHelper = getCompletionActivityForUserHelper;
exports.findOrganizationByIdHelper = findOrganizationByIdHelper;
exports.applyAllowedActivityUpdatesHelper = applyAllowedActivityUpdatesHelper;
exports.applyScheduleUpdatesHelper = applyScheduleUpdatesHelper;
exports.applyMetadataUpdateHelper = applyMetadataUpdateHelper;
exports.hydrateParticipantsHelper = hydrateParticipantsHelper;
exports.notifyOrgHelper = notifyOrgHelper;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Activity_1 = require("../../models/Activity");
const api_1 = require("../../types/api");
async function findActivityByIdHelper(id, options) {
    const queryBuilder = database_1.AppDataSource.getRepository(Activity_1.Activity)
        .createQueryBuilder('activity')
        .where('activity.id = :id', { id });
    if (options?.organizationId) {
        queryBuilder.andWhere('activity.organizationId = :organizationId', {
            organizationId: options.organizationId,
        });
    }
    if (options?.visibility) {
        queryBuilder.andWhere('activity.visibility = :visibility', {
            visibility: options.visibility,
        });
    }
    if (options?.includeParticipants) {
        queryBuilder.addSelect('activity.participants');
    }
    return queryBuilder.getOne();
}
function getScopedOrganizationIdHelper(req) {
    const authReq = req;
    const organizationId = authReq.user?.currentOrganizationId ?? authReq.tenantContext?.organizationId;
    if (!organizationId || organizationId.trim().length === 0) {
        return undefined;
    }
    return organizationId;
}
async function getCompletionActivityForUserHelper(input) {
    const scopedOrganizationId = input.getScopedOrganizationId(input.req);
    let activity = null;
    if (scopedOrganizationId) {
        activity = await input.findActivityById(input.activityId, {
            organizationId: scopedOrganizationId,
        });
    }
    activity ??= await input.findActivityById(input.activityId);
    if (!activity) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
    const requireOrganization = input.options?.requireOrganization ?? false;
    if (!activity.organizationId) {
        if (requireOrganization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
        return activity;
    }
    const orgAccess = await input.canUserAccessOrganization(input.userId, activity.organizationId);
    if (!orgAccess.canAccess) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
    }
    return activity;
}
async function findOrganizationByIdHelper(orgId, getOrganizationById) {
    return getOrganizationById(orgId);
}
function applyAllowedActivityUpdatesHelper(activity, updates) {
    const allowedFields = [
        'title',
        'description',
        'status',
        'visibility',
        'maxParticipants',
        'timezone',
        'location',
        'requirements',
        'shipRequirementType',
        'requiredShips',
        'crewSpotsTotal',
        'estimatedDuration',
    ];
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            activity[field] = updates[field];
        }
    }
}
function applyScheduleUpdatesHelper(activity, updates) {
    if (updates.startDate !== undefined) {
        activity.scheduledStartDate = updates.startDate
            ? new Date(updates.startDate)
            : undefined;
    }
    if (updates.scheduledStartDate !== undefined) {
        activity.scheduledStartDate = updates.scheduledStartDate
            ? new Date(updates.scheduledStartDate)
            : undefined;
    }
    if (updates.endDate !== undefined) {
        activity.scheduledEndDate = updates.endDate ? new Date(updates.endDate) : undefined;
    }
    if (updates.scheduledEndDate !== undefined) {
        activity.scheduledEndDate = updates.scheduledEndDate
            ? new Date(updates.scheduledEndDate)
            : undefined;
    }
}
function applyMetadataUpdateHelper(activity, updates) {
    if (updates.metadata !== undefined && updates.metadata !== null) {
        activity.metadata = {
            ...activity.metadata,
            ...updates.metadata,
        };
    }
}
async function hydrateParticipantsHelper(activity, getParticipants) {
    const participantRows = await getParticipants(activity.id);
    activity.participants =
        participantRows.map(p => ({
            userId: p.userId,
            userName: p.userName,
            avatarUrl: p.avatarUrl ?? undefined,
            organizationId: p.organizationId ?? undefined,
            organizationName: p.organizationName ?? undefined,
            role: p.role,
            status: p.status,
            joinedAt: p.joinedAt,
            shipType: p.shipType ?? undefined,
            shipName: p.shipName ?? undefined,
            shipId: p.shipId ?? undefined,
            crewPosition: p.crewPosition ?? undefined,
            crewShipId: p.crewShipId ?? undefined,
            reputation: p.reputation ?? undefined,
            notes: p.notes ?? undefined,
            message: p.message ?? undefined,
            metadata: p.metadata ?? undefined,
        }));
}
function notifyOrgHelper(input, notifyOrganization) {
    try {
        notifyOrganization({
            context: input.context,
            organizationId: input.organizationId,
            title: input.title,
            message: input.message,
            senderId: input.senderId,
            actionUrl: `/activities/${input.activityId}`,
            metadata: { activityId: input.activityId, ...input.metadata },
        });
    }
    catch {
    }
}
//# sourceMappingURL=activityController.coreHelpers.js.map