"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinActivityHandler = joinActivityHandler;
exports.leaveActivityHandler = leaveActivityHandler;
exports.getParticipantsHandler = getParticipantsHandler;
exports.updateParticipantHandler = updateParticipantHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const User_1 = require("../../models/User");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const activityController_avatars_1 = require("./activityController.avatars");
function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
async function joinActivityHandler(req, res, deps) {
    const { id } = req.params;
    const userId = req.user?.id;
    const userName = req.user?.username ?? 'Unknown';
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }
    const { role, shipId, shipType, shipName, crewPosition, crewShipId, notes } = req.body;
    try {
        const { activity, wasUpdate } = await deps.participantService.joinActivity(id, {
            userId,
            userName,
            role,
            shipId,
            shipType,
            shipName,
            crewPosition,
            crewShipId,
            notes,
        });
        if (!wasUpdate) {
            deps.notifyActivityJoined(activity, userId, userName);
        }
        await (0, activityController_avatars_1.enrichActivityWithAvatars)(activity);
        await deps.hydrateParticipants(activity);
        res.status(wasUpdate ? 200 : 201);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to join activity'), 500);
    }
}
async function leaveActivityHandler(req, res, deps) {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }
    try {
        const activity = await deps.participantService.leaveActivity(id, userId);
        await (0, activityController_avatars_1.enrichActivityWithAvatars)(activity);
        await deps.hydrateParticipants(activity);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to leave activity'), 500);
    }
}
async function getParticipantsHandler(req, res, deps) {
    const { id } = req.params;
    try {
        const activity = await deps.findActivityById(id, { includeParticipants: true });
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
        }
        const participants = await deps.participantService.getParticipants(id);
        if (participants.length > 0) {
            const userIds = participants.map(p => p.userId).filter(isNonEmptyString);
            if (userIds.length > 0) {
                const userRepo = database_1.AppDataSource.getRepository(User_1.User);
                const users = await userRepo
                    .createQueryBuilder('user')
                    .select(['user.id', 'user.avatar'])
                    .where('user.id IN (:...userIds)', { userIds })
                    .getMany();
                const avatarMap = new Map(users.map(u => [u.id, u.avatar]));
                for (const p of participants) {
                    const avatar = avatarMap.get(p.userId);
                    if (avatar) {
                        p.avatarUrl = avatar;
                    }
                }
            }
        }
        res.success({
            participants,
            count: participants.length,
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch participants'), 500);
    }
}
async function updateParticipantHandler(req, res, deps) {
    const { id, userId } = req.params;
    const requestingUserId = req.user?.id;
    if (!requestingUserId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
    }
    const { role, status, shipId, notes } = req.body;
    try {
        const activity = await deps.findActivityById(id);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
        }
        const canManageParticipants = activity.creatorId === requestingUserId ||
            (await deps.participantService.isLeader(id, requestingUserId));
        if (!canManageParticipants) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only activity leaders can update participants', 403);
        }
        const isParticipant = await deps.participantService.isParticipant(id, userId);
        if (!isParticipant) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Participant not found', 404);
        }
        const normalizedUpdates = {};
        if (role !== undefined) {
            normalizedUpdates.role = role;
        }
        if (status !== undefined) {
            normalizedUpdates.status = status;
        }
        if (shipId !== undefined) {
            normalizedUpdates.shipId = shipId;
        }
        if (notes !== undefined) {
            normalizedUpdates.notes = notes;
        }
        if (Object.keys(normalizedUpdates).length > 0) {
            await deps.participantService.updateParticipant(id, userId, normalizedUpdates);
        }
        await (0, activityController_avatars_1.enrichActivityWithAvatars)(activity);
        await deps.hydrateParticipants(activity);
        res.success(activity);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update participant'), 500);
    }
}
//# sourceMappingURL=activityController.participation.js.map