"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchCreateActivitiesHandler = batchCreateActivitiesHandler;
exports.batchUpdateActivitiesHandler = batchUpdateActivitiesHandler;
exports.batchDeleteActivitiesHandler = batchDeleteActivitiesHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Activity_1 = require("../../models/Activity");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const activityWebSocketController_1 = require("../../websocket/controllers/activityWebSocketController");
async function batchCreateActivitiesHandler(req, res) {
    try {
        const { orgId } = req.params;
        const { activities } = req.body;
        if (!Array.isArray(activities) || activities.length === 0) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Activities array is required', 400);
        }
        if (activities.length > 50) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Maximum 50 activities can be created at once', 400);
        }
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const createdActivities = [];
        for (const activityData of activities) {
            const status = Object.values(Activity_1.ActivityStatus).find(value => value === activityData.status) ??
                Activity_1.ActivityStatus.OPEN;
            const activity = activityRepo.create({
                ...activityData,
                organizationId: orgId,
                status,
            });
            const saved = await activityRepo.save(activity);
            createdActivities.push(saved);
            (0, activityWebSocketController_1.emitActivityCreated)(orgId, saved);
        }
        res.status(201).success({
            message: `${createdActivities.length} activities created successfully`,
            count: createdActivities.length,
            activities: createdActivities.map(a => ({
                id: a.id,
                title: a.title,
                status: a.status,
            })),
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to batch create activities'), 500);
    }
}
async function batchUpdateActivitiesHandler(req, res, deps) {
    try {
        const { updates } = req.body;
        if (!Array.isArray(updates) || updates.length === 0) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Updates array is required', 400);
        }
        if (updates.length > 50) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Maximum 50 activities can be updated at once', 400);
        }
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const updatedActivities = [];
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        for (const update of updates) {
            const { id, ...updateData } = update;
            if (!id) {
                continue;
            }
            const activity = await deps.findActivityById(id);
            if (activity?.organizationId !== organizationId) {
                continue;
            }
            Object.assign(activity, updateData);
            const saved = await activityRepo.save(activity);
            updatedActivities.push(saved);
            (0, activityWebSocketController_1.emitActivityUpdated)(saved.organizationId ?? '', saved);
        }
        res.success({
            message: `${updatedActivities.length} activities updated successfully`,
            count: updatedActivities.length,
            activities: updatedActivities.map(a => ({
                id: a.id,
                title: a.title,
                status: a.status,
            })),
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to batch update activities'), 500);
    }
}
async function batchDeleteActivitiesHandler(req, res, deps) {
    try {
        const { activityIds } = req.body;
        if (!Array.isArray(activityIds) || activityIds.length === 0) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Activity IDs array is required', 400);
        }
        if (activityIds.length > 50) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Maximum 50 activities can be deleted at once', 400);
        }
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        let deletedCount = 0;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        for (const id of activityIds) {
            const activity = await deps.findActivityById(id);
            if (activity?.organizationId !== organizationId) {
                continue;
            }
            const orgId = activity.organizationId;
            await activityRepo.remove(activity);
            deletedCount++;
            (0, activityWebSocketController_1.emitActivityDeleted)(orgId, id);
        }
        res.success({
            message: `${deletedCount} activities deleted successfully`,
            count: deletedCount,
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to batch delete activities'), 500);
    }
}
//# sourceMappingURL=activityController.batchOperations.js.map