"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Activity_1 = require("../../models/Activity");
const ActivityCalendarService_1 = require("../../services/activity/ActivityCalendarService");
const api_1 = require("../../types/api");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toActivityType(rawType) {
    switch (rawType) {
        case 'mission':
            return Activity_1.ActivityType.MISSION;
        case 'contract':
            return Activity_1.ActivityType.CONTRACT;
        case 'bounty':
            return Activity_1.ActivityType.BOUNTY;
        case 'event':
            return Activity_1.ActivityType.EVENT;
        case 'lfg':
            return Activity_1.ActivityType.LFG;
        case 'operation':
            return Activity_1.ActivityType.OPERATION;
        case 'recruitment':
            return Activity_1.ActivityType.RECRUITMENT;
        case 'job_listing':
            return Activity_1.ActivityType.JOB_LISTING;
        default:
            return null;
    }
}
class CalendarControllerV2 {
    service = ActivityCalendarService_1.ActivityCalendarService.getInstance();
    async getEvents(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const orgId = req.query.orgId;
        const startDateStr = req.query.startDate;
        const endDateStr = req.query.endDate;
        const startDate = startDateStr ? new Date(startDateStr) : new Date();
        const endDate = endDateStr
            ? new Date(endDateStr)
            : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid date format. Use ISO 8601.', 400);
        }
        if (!orgId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'orgId query parameter is required', 400);
        }
        const calendar = await this.service.getCalendar(orgId, startDate, endDate, req.query.view);
        res.success(calendar);
    }
    async getEventById(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { eventId } = req.params;
        if (!eventId || !UUID_RE.test(eventId)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Valid eventId is required', 400);
        }
        try {
            const ics = await this.service.generateActivityICS(eventId);
            res.success({ id: eventId, ics });
        }
        catch {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
    }
    async downloadEventICS(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { eventId } = req.params;
        if (!eventId || !UUID_RE.test(eventId)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Valid eventId is required', 400);
        }
        try {
            const ics = await this.service.generateActivityICS(eventId);
            const safeId = eventId.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Disposition', `attachment; filename="event-${safeId}.ics"`);
            res.end(Buffer.from(ics, 'utf-8'));
        }
        catch {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
    }
    async exportOrgCalendar(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { orgId } = req.params;
        if (!orgId || !UUID_RE.test(orgId)) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Valid orgId is required', 400);
        }
        const startDateStr = req.query.startDate;
        const endDateStr = req.query.endDate;
        const typesStr = req.query.types;
        const options = {};
        if (startDateStr) {
            options.startDate = new Date(startDateStr);
            if (Number.isNaN(options.startDate.getTime())) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid startDate format', 400);
            }
        }
        if (endDateStr) {
            options.endDate = new Date(endDateStr);
            if (Number.isNaN(options.endDate.getTime())) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid endDate format', 400);
            }
        }
        if (typesStr) {
            const canonicalActivityTypes = [];
            for (const rawType of typesStr.split(',')) {
                const type = toActivityType(rawType.trim().toLowerCase());
                if (type) {
                    canonicalActivityTypes.push(type);
                }
            }
            if (canonicalActivityTypes.length > 0) {
                options.activityTypes = canonicalActivityTypes;
            }
        }
        const ics = await this.service.generateICS(orgId, options);
        const safeOrgId = orgId.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `attachment; filename="org-${safeOrgId}-calendar.ics"`);
        res.end(Buffer.from(ics, 'utf-8'));
    }
    async exportUserCalendar(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const startDateStr = req.query.startDate;
        const endDateStr = req.query.endDate;
        const options = {};
        if (startDateStr) {
            options.startDate = new Date(startDateStr);
            if (Number.isNaN(options.startDate.getTime())) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid startDate format', 400);
            }
        }
        if (endDateStr) {
            options.endDate = new Date(endDateStr);
            if (Number.isNaN(options.endDate.getTime())) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Invalid endDate format', 400);
            }
        }
        const ics = await this.service.generateUserICS(userId, options);
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'attachment; filename="my-calendar.ics"');
        res.end(Buffer.from(ics, 'utf-8'));
    }
}
exports.CalendarControllerV2 = CalendarControllerV2;
//# sourceMappingURL=calendarController.js.map