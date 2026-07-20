"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivityFullHandler = createActivityFullHandler;
exports.completeActivityFullHandler = completeActivityFullHandler;
exports.generateJoinLinkHandler = generateJoinLinkHandler;
exports.previewActivityByTokenHandler = previewActivityByTokenHandler;
exports.joinActivityByTokenHandler = joinActivityByTokenHandler;
const node_crypto_1 = __importDefault(require("node:crypto"));
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const ActivityAggregatorService_1 = require("../../services/aggregators/ActivityAggregatorService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
async function createActivityFullHandler(req, res, deps) {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const orgAccess = await deps.organizationServiceCanUserAccessOrganization(userId, orgId);
        if (!orgAccess.canAccess || orgAccess.accessLevel === 'viewer') {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, orgAccess.reason ?? 'User cannot create activities in this organization', 403);
        }
        const { activityData, participantIds, notifyParticipants, postToDiscord, discordChannelId } = req.body;
        const aggregator = new ActivityAggregatorService_1.ActivityAggregatorService();
        const result = await aggregator.createActivityWithParticipants({
            organizationId: orgId,
            activityData: { ...activityData, creatorId: userId },
            participantIds,
            notifyParticipants,
            postToDiscord,
            discordChannelId,
        });
        res.status(201).success(result);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create activity with participants'), 500);
    }
}
async function completeActivityFullHandler(req, res, deps) {
    try {
        const { id: activityId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const activity = await deps.getCompletionActivityForUser(req, activityId, userId);
        if (activity.creatorId !== userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only activity creator can complete the activity', 403);
        }
        const { outcome, summary, participantReports, notifyParticipants } = req.body;
        const aggregator = new ActivityAggregatorService_1.ActivityAggregatorService();
        if (!activity.organizationId) {
            res.success(await aggregator.completePersonalActivity({
                activity,
                completedById: userId,
                outcome,
                summary,
                participantReports,
                notifyParticipants,
            }));
            return;
        }
        const result = await aggregator.completeActivity({
            organizationId: activity.organizationId,
            activityId,
            completedById: userId,
            outcome,
            summary,
            participantReports,
            notifyParticipants,
        });
        res.success(result);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to complete activity'), 500);
    }
}
async function generateJoinLinkHandler(req, res, deps) {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }
    try {
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const activity = await deps.findActivityById(id);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
        }
        if (activity.creatorId !== userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only the activity creator can generate join links', 403);
        }
        if (activity.status === Activity_1.ActivityStatus.CANCELLED ||
            activity.status === Activity_1.ActivityStatus.COMPLETED) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Cannot generate join links for cancelled or completed activities', 400);
        }
        const token = node_crypto_1.default.randomBytes(16).toString('base64url');
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        activity.metadata = {
            ...activity.metadata,
            quickJoin: true,
            quickJoinToken: token,
            quickJoinTokenExpiry: expiry.toISOString(),
        };
        await activityRepo.save(activity);
        res.status(201);
        res.success({
            token,
            expiresAt: expiry.toISOString(),
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to generate join link'), 500);
    }
}
async function previewActivityByTokenHandler(req, res, deps) {
    const { token } = req.params;
    try {
        const activity = await deps.findActivityByQuickJoinToken(token);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Invalid or expired join link', 404);
        }
        if (activity.metadata?.quickJoinTokenExpiry) {
            const expiry = new Date(activity.metadata.quickJoinTokenExpiry);
            if (expiry < new Date()) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'This join link has expired', 410);
            }
        }
        if (activity.status === Activity_1.ActivityStatus.CANCELLED ||
            activity.status === Activity_1.ActivityStatus.COMPLETED) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'This activity is no longer accepting participants', 400);
        }
        const acceptedCount = await deps.getParticipantCount(activity.id, ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED);
        res.success({
            id: activity.id,
            title: activity.title,
            description: activity.description,
            type: activity.activityType,
            status: activity.status,
            scheduledStart: activity.scheduledStartDate,
            scheduledEnd: activity.scheduledEndDate,
            location: activity.location,
            maxParticipants: activity.maxParticipants,
            currentParticipants: acceptedCount,
            organizationId: activity.organizationId,
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to preview activity'), 500);
    }
}
async function joinActivityByTokenHandler(req, res, deps) {
    const { token } = req.params;
    const userId = req.user?.id;
    const userName = req.user?.username ?? 'Unknown';
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }
    const { role, shipId, shipType, shipName, notes } = req.body;
    try {
        const activity = await deps.findActivityByQuickJoinToken(token);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Invalid or expired join link', 404);
        }
        deps.validateQuickJoinActivity(activity);
        const alreadyJoined = await deps.isParticipant(activity.id, userId);
        if (alreadyJoined) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'User is already a participant', 400);
        }
        const { activity: updatedActivity } = await deps.joinActivityByToken(activity.id, {
            userId,
            userName,
            role,
            shipId,
            shipType,
            shipName,
            notes,
        });
        res.status(201);
        res.success(updatedActivity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to join activity via token'), 500);
    }
}
//# sourceMappingURL=activityController.fullFlowQuickJoin.js.map