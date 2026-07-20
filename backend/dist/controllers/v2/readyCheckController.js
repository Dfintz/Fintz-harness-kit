"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadyCheckController = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const ReadyCheckService_1 = require("../../services/activity/ReadyCheckService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
class ReadyCheckController {
    readyCheckService = new ReadyCheckService_1.ReadyCheckService();
    async initiateReadyCheck(req, res) {
        try {
            const { id: activityId } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username ?? 'Unknown';
            const organizationId = req.user?.currentOrganizationId;
            if (!userId || !organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const body = req.body;
            const durationSeconds = body.durationSeconds ?? 120;
            const readyCheck = await this.readyCheckService.initiateReadyCheck(activityId, organizationId, userId, userName, durationSeconds);
            res.status(201).success({
                id: readyCheck.id,
                activityId: readyCheck.activityId,
                status: readyCheck.status,
                expiresAt: readyCheck.expiresAt,
                durationSeconds: readyCheck.durationSeconds,
                totalParticipants: readyCheck.totalParticipants,
                responses: Object.values(readyCheck.responses),
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to initiate ready check'), 500);
        }
    }
    async respondToReadyCheck(req, res) {
        try {
            const { id: activityId } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username ?? 'Unknown';
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const { response } = req.body;
            if (!response || !['ready', 'not_ready'].includes(response)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Response must be "ready" or "not_ready"', 400);
            }
            const readyCheck = await this.readyCheckService.respond(activityId, userId, userName, response);
            const responses = Object.values(readyCheck.responses);
            const readyCount = responses.filter(r => r.response === 'ready').length;
            const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
            const pendingCount = responses.filter(r => r.response === 'pending').length;
            res.success({
                readyCheckId: readyCheck.id,
                activityId: readyCheck.activityId,
                status: readyCheck.status,
                totalParticipants: readyCheck.totalParticipants,
                readyCount,
                notReadyCount,
                pendingCount,
                expiresAt: readyCheck.expiresAt,
                allReady: readyCount === readyCheck.totalParticipants,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to respond to ready check'), 500);
        }
    }
    async getReadyCheck(req, res) {
        try {
            const { id: activityId } = req.params;
            const readyCheck = await this.readyCheckService.getActiveReadyCheck(activityId);
            if (!readyCheck) {
                res.success({ active: false, readyCheck: null });
                return;
            }
            const responses = Object.values(readyCheck.responses);
            const readyCount = responses.filter(r => r.response === 'ready').length;
            const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
            const pendingCount = responses.filter(r => r.response === 'pending').length;
            res.success({
                active: readyCheck.status === 'pending',
                readyCheck: {
                    id: readyCheck.id,
                    activityId: readyCheck.activityId,
                    organizationId: readyCheck.organizationId,
                    initiatedBy: readyCheck.initiatedBy,
                    initiatedByName: readyCheck.initiatedByName,
                    status: readyCheck.status,
                    expiresAt: readyCheck.expiresAt,
                    durationSeconds: readyCheck.durationSeconds,
                    responses,
                    totalParticipants: readyCheck.totalParticipants,
                    readyCount,
                    notReadyCount,
                    pendingCount,
                    createdAt: readyCheck.createdAt,
                    completedAt: readyCheck.completedAt,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get ready check'), 500);
        }
    }
    async cancelReadyCheck(req, res) {
        try {
            const { id: activityId } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username ?? 'Unknown';
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            await this.readyCheckService.cancelReadyCheck(activityId, userId, userName);
            res.success({ cancelled: true });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to cancel ready check'), 500);
        }
    }
}
exports.ReadyCheckController = ReadyCheckController;
//# sourceMappingURL=readyCheckController.js.map