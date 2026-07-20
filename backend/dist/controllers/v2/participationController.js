"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParticipationControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const UnifiedParticipantService_1 = require("../../services/aggregators/UnifiedParticipantService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const VALID_SYSTEMS = new Set(['team', 'activity', 'job', 'lfg']);
class ParticipationControllerV2 {
    async getSummary(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const organizationId = req.query.organizationId;
            const systemsParam = req.query.systems;
            let systems;
            if (typeof systemsParam === 'string') {
                const requested = systemsParam.split(',').map(s => s.trim().toLowerCase());
                const invalid = requested.filter(s => !VALID_SYSTEMS.has(s));
                if (invalid.length > 0) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, `Invalid systems: ${invalid.join(', ')}. Valid values: team, activity, job, lfg`, 400);
                }
                systems = requested;
            }
            const service = new UnifiedParticipantService_1.UnifiedParticipantService();
            const summary = await service.getUserParticipationSummary({
                userId,
                organizationId,
                systems,
            });
            res.success(summary);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[ParticipationControllerV2.getSummary] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch participation summary'), 500);
        }
    }
    async getUserSummary(req, res) {
        try {
            const { userId } = req.params;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'User ID is required', 400);
            }
            const organizationId = req.query.organizationId;
            const systemsParam = req.query.systems;
            let systems;
            if (typeof systemsParam === 'string') {
                const requested = systemsParam.split(',').map(s => s.trim().toLowerCase());
                const invalid = requested.filter(s => !VALID_SYSTEMS.has(s));
                if (invalid.length > 0) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, `Invalid systems: ${invalid.join(', ')}. Valid values: team, activity, job, lfg`, 400);
                }
                systems = requested;
            }
            const service = new UnifiedParticipantService_1.UnifiedParticipantService();
            const summary = await service.getUserParticipationSummary({
                userId,
                organizationId,
                systems,
            });
            res.success(summary);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[ParticipationControllerV2.getUserSummary] Error:', error);
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch user participation summary'), 500);
        }
    }
}
exports.ParticipationControllerV2 = ParticipationControllerV2;
//# sourceMappingURL=participationController.js.map