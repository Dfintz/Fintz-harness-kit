"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventWaitlistControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const communication_1 = require("../../services/communication");
const EventWaitlistService_1 = require("../../services/event/EventWaitlistService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
class EventWaitlistControllerV2 {
    waitlistService;
    constructor() {
        const notificationService = new communication_1.NotificationService();
        this.waitlistService = new EventWaitlistService_1.EventWaitlistService(notificationService);
    }
    async joinWaitlist(req, res) {
        const { id } = req.params;
        const userId = req.user?.id;
        const organizationId = req.tenantContext?.organizationId;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        if (!organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_MEMBERSHIP_REQUIRED, 'Organization context required', 400);
        }
        const { notes } = req.body;
        try {
            const entry = await this.waitlistService.joinWaitlist(id, userId, organizationId, notes);
            logger_1.logger.info('User joined waitlist', {
                activityId: id,
                userId,
                position: entry.position,
            });
            res.status(201);
            res.success(entry);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error joining waitlist', { error, activityId: id, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to join waitlist'), 500);
        }
    }
    async leaveWaitlist(req, res) {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        try {
            const success = await this.waitlistService.leaveWaitlist(id, userId);
            if (!success) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User is not on the waitlist', 404);
            }
            logger_1.logger.info('User left waitlist', { activityId: id, userId });
            res.status(204).send();
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error leaving waitlist', { error, activityId: id, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to leave waitlist'), 500);
        }
    }
    async getWaitlist(req, res) {
        const { id } = req.params;
        const organizationId = req.tenantContext?.organizationId;
        if (!organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_MEMBERSHIP_REQUIRED, 'Organization context required', 400);
        }
        try {
            const waitlist = this.waitlistService.getWaitlist(id);
            const stats = this.waitlistService.getWaitlistStats(id);
            logger_1.logger.info('Waitlist retrieved', {
                activityId: id,
                count: waitlist.length,
            });
            res.success({
                waitlist,
                stats,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching waitlist', { error, activityId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch waitlist'), 500);
        }
    }
    async promoteFromWaitlist(req, res) {
        const { id } = req.params;
        const organizationId = req.tenantContext?.organizationId;
        const adminUserId = req.user?.id;
        if (!organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_MEMBERSHIP_REQUIRED, 'Organization context required', 400);
        }
        if (!adminUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        const { spotsAvailable = 1 } = req.body;
        if (typeof spotsAvailable !== 'number' || spotsAvailable < 1) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'spotsAvailable must be a positive number', 400);
        }
        try {
            const result = await this.waitlistService.promoteFromWaitlist(id, spotsAvailable);
            logger_1.logger.info('Users promoted from waitlist', {
                activityId: id,
                promotedCount: result.promoted.length,
                adminUserId,
            });
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error promoting from waitlist', { error, activityId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to promote from waitlist'), 500);
        }
    }
}
exports.EventWaitlistControllerV2 = EventWaitlistControllerV2;
//# sourceMappingURL=eventWaitlistController.js.map