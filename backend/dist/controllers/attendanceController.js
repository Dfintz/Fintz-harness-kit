"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const activity_1 = require("../services/activity");
const communication_1 = require("../services/communication");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
class AttendanceController extends BaseController_1.BaseController {
    attendanceService;
    constructor() {
        super();
        const notificationService = new communication_1.NotificationService();
        this.attendanceService = new activity_1.ActivityAttendanceService(notificationService);
        logger_1.logger.debug('AttendanceController initialized - using ActivityAttendanceService from Activity domain');
    }
    initializeAttendance = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { activityId } = req.params;
            const confirmations = await this.attendanceService.initializeActivityAttendance(activityId);
            return {
                success: true,
                message: `Initialized attendance tracking with ${confirmations.length} participants`,
                data: confirmations,
            };
        });
    };
    confirmAttendance = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { activityId } = req.params;
            const { userId, actualRole, confirmedBy } = req.body;
            const requesterId = req.user?.id;
            this.validateRequired({ userId }, 'userId');
            const confirmation = await this.attendanceService.confirmAttendance(activityId, userId, actualRole, confirmedBy || requesterId);
            return {
                success: true,
                message: 'Attendance confirmed',
                data: confirmation,
            };
        });
    };
    recordAttendance = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { activityId } = req.params;
            const record = req.body;
            const requesterId = req.user?.id;
            const organizationId = this.getOrganizationId(req);
            this.validateRequired(record, 'userId');
            record.confirmedBy = record.confirmedBy || requesterId;
            const confirmation = await this.attendanceService.recordAttendance(organizationId, activityId, record);
            return {
                success: true,
                message: 'Attendance recorded',
                data: confirmation,
            };
        });
    };
    markNoShow = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { activityId } = req.params;
            const { userId, excused, reason } = req.body;
            const requesterId = req.user?.id;
            this.validateRequired({ userId }, 'userId');
            const confirmation = await this.attendanceService.markNoShow(activityId, userId, excused || false, reason, requesterId);
            return {
                success: true,
                message: 'Marked as no-show',
                data: confirmation,
            };
        });
    };
    sendConfirmationRequests = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { activityId } = req.params;
            const sentCount = await this.attendanceService.sendConfirmationRequests(activityId);
            return {
                success: true,
                message: `Sent ${sentCount} confirmation requests`,
                data: { sentCount },
            };
        });
    };
    getAttendanceStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { activityId } = req.params;
            const stats = await this.attendanceService.getActivityAttendanceStats(activityId);
            return {
                success: true,
                data: stats,
            };
        });
    };
    getUserHistory = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId } = req.params;
            const monthsBack = parseInt(req.query.monthsBack) || 6;
            const history = await this.attendanceService.getUserAttendanceHistory(userId, monthsBack);
            return {
                success: true,
                data: history,
            };
        });
    };
    getAttendanceReport = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { activityId } = req.params;
            const report = await this.attendanceService.generateAttendanceReport(activityId);
            return {
                success: true,
                data: report,
            };
        });
    };
    getLeaderboard = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { organizationId } = req.params;
            const monthsBack = parseInt(req.query.monthsBack) || 3;
            const limit = Math.min(parseInt(req.query.limit) || 10, 200);
            const leaderboard = await this.attendanceService.getAttendanceLeaderboard(organizationId, monthsBack, limit);
            return {
                success: true,
                data: leaderboard,
            };
        });
    };
    addRating = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { confirmationId } = req.params;
            const rating = req.body;
            const requesterId = req.user?.id;
            if (!requesterId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const confirmation = await this.attendanceService.addPerformanceRating(confirmationId, rating, requesterId);
            return {
                success: true,
                message: 'Performance rating added',
                data: confirmation,
            };
        });
    };
}
exports.AttendanceController = AttendanceController;
//# sourceMappingURL=attendanceController.js.map