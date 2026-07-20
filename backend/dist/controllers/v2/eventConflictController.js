"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventConflictControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const EventConflictService_1 = require("../../services/event/EventConflictService");
const api_1 = require("../../types/api");
const authHelpers_1 = require("../../utils/authHelpers");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
class EventConflictControllerV2 {
    conflictService;
    constructor() {
        this.conflictService = new EventConflictService_1.EventConflictService();
    }
    async checkConflicts(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { startDate, endDate, excludeActivityId, options } = req.body;
        if (!startDate || !endDate) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'startDate and endDate are required', 400);
        }
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid date format', 400);
            }
            if (start >= end) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'startDate must be before endDate', 400);
            }
            const result = await this.conflictService.checkConflicts(organizationId, start, end, excludeActivityId, options);
            logger_1.logger.info('Conflicts checked', {
                organizationId,
                hasConflicts: result.hasConflicts,
                conflictCount: result.totalConflicts,
            });
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error checking conflicts', { error, organizationId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to check conflicts'), 500);
        }
    }
    async getMyConflicts(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const userId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        try {
            const options = {
                userId,
            };
            if (req.query.includeTypes) {
                options.includeTypes = req.query.includeTypes;
            }
            if (req.query.excludeTypes) {
                options.excludeTypes = req.query.excludeTypes;
            }
            const result = await this.conflictService.getUserConflicts(organizationId, userId, options);
            logger_1.logger.info('User conflicts retrieved', { organizationId, userId });
            res.success(result);
        }
        catch (error) {
            logger_1.logger.error('Error fetching user conflicts', { error, organizationId, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch user conflicts'), 500);
        }
    }
    async getActivityConflicts(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { activityId } = req.params;
        if (!activityId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'activityId is required', 400);
        }
        try {
            const options = {};
            if (req.query.includeTypes) {
                options.includeTypes = req.query.includeTypes;
            }
            if (req.query.excludeTypes) {
                options.excludeTypes = req.query.excludeTypes;
            }
            if (req.query.bufferMinutes) {
                options.bufferMinutes = Number(req.query.bufferMinutes);
            }
            const result = await this.conflictService.getActivityConflicts(organizationId, activityId, options);
            logger_1.logger.info('Activity conflicts retrieved', { organizationId, activityId });
            res.success(result);
        }
        catch (error) {
            logger_1.logger.error('Error fetching activity conflicts', { error, organizationId, activityId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch activity conflicts'), 500);
        }
    }
    async getUserConflicts(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { userId } = req.params;
        const requestingUserId = (0, authHelpers_1.getAuthenticatedUserId)(req);
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'userId is required', 400);
        }
        if (userId !== requestingUserId &&
            req.user?.role !== 'admin') {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Cannot check conflicts for other users', 403);
        }
        try {
            const options = {
                userId,
            };
            if (req.query.includeTypes) {
                options.includeTypes = req.query.includeTypes;
            }
            if (req.query.excludeTypes) {
                options.excludeTypes = req.query.excludeTypes;
            }
            const result = await this.conflictService.getUserConflicts(organizationId, userId, options);
            logger_1.logger.info('User conflicts retrieved', { organizationId, userId });
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error fetching user conflicts', { error, organizationId, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch user conflicts'), 500);
        }
    }
    async getConflictsInRange(req, res) {
        const organizationId = (0, authHelpers_1.getOrganizationIdFromContext)(req);
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'startDate and endDate query parameters are required', 400);
        }
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid date format', 400);
            }
            if (start >= end) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'startDate must be before endDate', 400);
            }
            const options = {};
            if (req.query.includeTypes) {
                options.includeTypes = req.query.includeTypes;
            }
            if (req.query.excludeTypes) {
                options.excludeTypes = req.query.excludeTypes;
            }
            const conflicts = await this.conflictService.getConflictsInRange(organizationId, start, end, options);
            logger_1.logger.info('Range conflicts retrieved', {
                organizationId,
                startDate: start,
                endDate: end,
                conflictCount: conflicts.length,
            });
            res.success({
                startDate: start,
                endDate: end,
                conflicts,
                totalConflicts: conflicts.length,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('Error fetching range conflicts', { error, organizationId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch conflicts in range'), 500);
        }
    }
}
exports.EventConflictControllerV2 = EventConflictControllerV2;
//# sourceMappingURL=eventConflictController.js.map