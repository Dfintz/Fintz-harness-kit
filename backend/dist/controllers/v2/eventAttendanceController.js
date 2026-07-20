"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventAttendanceControllerV2 = void 0;
const data_source_1 = require("../../data-source");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Activity_1 = require("../../models/Activity");
const EventAttendanceConfirmation_1 = require("../../models/EventAttendanceConfirmation");
const CrossSystemAnalyticsService_1 = require("../../services/analytics/CrossSystemAnalyticsService");
const communication_1 = require("../../services/communication");
const EventAttendanceService_1 = require("../../services/event/EventAttendanceService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
class EventAttendanceControllerV2 {
    attendanceService = null;
    notificationService;
    analyticsService;
    constructor() {
        this.notificationService = new communication_1.NotificationService();
        this.analyticsService = new CrossSystemAnalyticsService_1.CrossSystemAnalyticsService();
    }
    getService() {
        this.attendanceService ??= new EventAttendanceService_1.AttendanceConfirmationService(this.notificationService);
        return this.attendanceService;
    }
    async recordAttendance(req, res) {
        const { id } = req.params;
        const userId = req.user?.id;
        const userOrgId = req.user?.currentOrganizationId;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        if (!userOrgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        const { status, actualRole, checkInTime, checkOutTime, notes } = req.body;
        if (!status) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Attendance status is required', 400);
        }
        try {
            const activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
            const activity = await activityRepository
                .createQueryBuilder('activity')
                .where('activity.id = :id', { id })
                .andWhere('activity.organizationId = :organizationId', { organizationId: userOrgId })
                .getOne();
            if (!activity) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
            }
            const record = {
                userId,
                organizationId: activity.organizationId ?? '',
                status,
                actualRole,
                checkInTime: checkInTime ? new Date(checkInTime) : undefined,
                checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
                notes,
                confirmedBy: userId,
            };
            const confirmation = await this.getService().recordAttendance(id, record);
            logger_1.logger.info('Attendance recorded', {
                activityId: id,
                userId,
                status,
            });
            res.success(confirmation);
        }
        catch (error) {
            logger_1.logger.error('Error recording attendance', { error, activityId: id, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to record attendance'), 500);
        }
    }
    async getAttendanceRecords(req, res) {
        const { id } = req.params;
        const organizationId = req.tenantContext?.organizationId;
        if (!organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_MEMBERSHIP_REQUIRED, 'Organization context required', 400);
        }
        try {
            const confirmations = await this.getService().getAttendanceRecordsForActivity(id, organizationId);
            logger_1.logger.info('Attendance records retrieved', {
                activityId: id,
                count: confirmations.length,
            });
            res.success(confirmations);
        }
        catch (error) {
            logger_1.logger.error('Error fetching attendance records', { error, activityId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch attendance records'), 500);
        }
    }
    async updateAttendanceStatus(req, res) {
        const { id, userId } = req.params;
        const adminUserId = req.user?.id;
        const userOrgId = req.user?.currentOrganizationId;
        const { status, actualRole, notes, excused, reason } = req.body;
        if (!adminUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
        }
        if (!userOrgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Organization context required', 401);
        }
        if (!status) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.MISSING_REQUIRED_FIELD, 'Attendance status is required', 400);
        }
        try {
            const activityRepository = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
            const activity = await activityRepository
                .createQueryBuilder('activity')
                .where('activity.id = :id', { id })
                .andWhere('activity.organizationId = :organizationId', { organizationId: userOrgId })
                .getOne();
            if (!activity) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity not found', 404);
            }
            let confirmation;
            if (status === EventAttendanceConfirmation_1.AttendanceStatus.NO_SHOW) {
                confirmation = await this.getService().markNoShow(id, userId, excused || false, reason || notes, adminUserId);
            }
            else {
                const record = {
                    userId,
                    organizationId: activity.organizationId ?? '',
                    status,
                    actualRole,
                    notes,
                    confirmedBy: adminUserId,
                };
                confirmation = await this.getService().recordAttendance(id, record);
            }
            logger_1.logger.info('Attendance status updated', {
                activityId: id,
                userId,
                status,
                updatedBy: adminUserId,
            });
            res.success(confirmation);
        }
        catch (error) {
            logger_1.logger.error('Error updating attendance status', { error, activityId: id, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update attendance status'), 500);
        }
    }
    async getAttendanceStats(req, res) {
        const { id } = req.params;
        try {
            const stats = await this.getService().getActivityAttendanceStats(id);
            logger_1.logger.info('Attendance stats retrieved', {
                activityId: id,
                attendanceRate: stats.attendanceRate,
            });
            res.success(stats);
        }
        catch (error) {
            logger_1.logger.error('Error fetching attendance stats', { error, activityId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch attendance stats'), 500);
        }
    }
    async getUserAttendanceHistory(req, res) {
        const { userId } = req.params;
        const organizationId = req.tenantContext?.organizationId;
        const requestingUserId = req.user?.id;
        if (!organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_MEMBERSHIP_REQUIRED, 'Organization context required', 400);
        }
        if (userId !== requestingUserId &&
            req.user?.role !== 'admin') {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Cannot view attendance history for other users', 403);
        }
        try {
            const monthsBack = req.query.months ? Number.parseInt(req.query.months, 10) : 6;
            const history = await this.getService().getUserAttendanceHistory(userId, monthsBack, organizationId);
            logger_1.logger.info('User attendance history retrieved', {
                userId,
                organizationId,
                monthsBack,
            });
            res.success(history);
        }
        catch (error) {
            logger_1.logger.error('Error fetching user attendance history', { error, userId });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch attendance history'), 500);
        }
    }
    async getAttendanceCorrelationSummary(req, res) {
        const { id } = req.params;
        const organizationId = req.tenantContext?.organizationId;
        if (!organizationId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_MEMBERSHIP_REQUIRED, 'Organization context required', 400);
        }
        try {
            const report = await this.analyticsService.getActivityAttendanceCorrelationReport(organizationId, id);
            logger_1.logger.info('Attendance correlation summary retrieved', {
                activityId: id,
                organizationId,
            });
            res.success(report);
        }
        catch (error) {
            logger_1.logger.error('Error fetching attendance correlation summary', { error, activityId: id });
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch attendance correlation summary'), 500);
        }
    }
}
exports.EventAttendanceControllerV2 = EventAttendanceControllerV2;
//# sourceMappingURL=eventAttendanceController.js.map