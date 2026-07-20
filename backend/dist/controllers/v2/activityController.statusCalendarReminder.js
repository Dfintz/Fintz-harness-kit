"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityCalendarHandler = getActivityCalendarHandler;
exports.exportActivityToCalendarHandler = exportActivityToCalendarHandler;
exports.createActivityReminderHandler = createActivityReminderHandler;
exports.getActivityRemindersHandler = getActivityRemindersHandler;
exports.updateActivityStatusHandler = updateActivityStatusHandler;
exports.completeActivityHandler = completeActivityHandler;
exports.cancelActivityHandler = cancelActivityHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Activity_1 = require("../../models/Activity");
const NotificationRouter_1 = require("../../services/communication/notifications/NotificationRouter");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const activityWebSocketController_1 = require("../../websocket/controllers/activityWebSocketController");
async function getActivityCalendarHandler(req, res) {
    try {
        const { orgId } = req.params;
        const { start, end, view } = req.query;
        if (!start || !end) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Start and end dates are required', 400);
        }
        const startDate = new Date(start);
        const endDate = new Date(end);
        const { ActivityCalendarService } = await Promise.resolve().then(() => __importStar(require('../../services/activity/ActivityCalendarService')));
        const calendarService = new ActivityCalendarService();
        const calendar = await calendarService.getCalendar(orgId, startDate, endDate, view);
        res.success({
            calendar,
            range: { start: startDate, end: endDate },
            view: view ?? 'month',
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch calendar'), 500);
    }
}
async function exportActivityToCalendarHandler(req, res, deps) {
    try {
        const { id } = req.params;
        const { format = 'ical' } = req.query;
        const activity = await deps.findActivityById(id);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
        const { CalendarExportService } = await Promise.resolve().then(() => __importStar(require('../../services/activity/CalendarExportService')));
        const exportService = CalendarExportService.getInstance();
        const calendarData = await exportService.generateActivityICS(activity.id);
        if (format === 'ical') {
            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', `attachment; filename="activity-${id}.ics"`);
        }
        res.success({
            format,
            data: calendarData,
            activity: {
                id: activity.id,
                title: activity.title,
            },
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to export calendar'), 500);
    }
}
async function createActivityReminderHandler(req, res, deps) {
    try {
        const { id: activityId } = req.params;
        const reminderData = req.body;
        const activity = await deps.findActivityById(activityId);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
        const { ActivityReminderService } = await Promise.resolve().then(() => __importStar(require('../../services/activity/ActivityReminderService')));
        const { NotificationService } = await Promise.resolve().then(() => __importStar(require('../../services/communication')));
        const notificationService = new NotificationService();
        const reminderService = new ActivityReminderService(notificationService);
        const reminder = await reminderService.createReminder({
            activityId,
            ...reminderData,
        });
        res.status(201).success({
            message: 'Reminder created successfully',
            reminder,
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create reminder'), 500);
    }
}
async function getActivityRemindersHandler(req, res, deps) {
    try {
        const { id: activityId } = req.params;
        const activity = await deps.findActivityById(activityId);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
        const { ActivityReminderService } = await Promise.resolve().then(() => __importStar(require('../../services/activity/ActivityReminderService')));
        const { NotificationService } = await Promise.resolve().then(() => __importStar(require('../../services/communication')));
        const notificationService = new NotificationService();
        const reminderService = new ActivityReminderService(notificationService);
        const reminders = await reminderService.getReminders(activityId);
        res.success({ reminders });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to fetch reminders'), 500);
    }
}
async function updateActivityStatusHandler(req, res, deps) {
    try {
        const { id: activityId } = req.params;
        const { status, notes } = req.body;
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const activity = await deps.findActivityById(activityId);
        if (!activity) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
        activity.status = status;
        if (notes) {
            activity.statusNotes = notes;
        }
        activity.statusUpdatedAt = new Date();
        await activityRepo.save(activity);
        (0, activityWebSocketController_1.emitActivityUpdated)(activity.organizationId ?? null, activity);
        if (activity.organizationId) {
            let statusContext = null;
            if (status === Activity_1.ActivityStatus.COMPLETED) {
                statusContext = NotificationRouter_1.NotificationContext.ACTIVITY_COMPLETED;
            }
            else if (status === Activity_1.ActivityStatus.CANCELLED) {
                statusContext = NotificationRouter_1.NotificationContext.ACTIVITY_CANCELLED;
            }
            if (statusContext) {
                deps.notifyOrg({
                    context: statusContext,
                    organizationId: activity.organizationId,
                    title: `Activity ${status}: ${activity.title}`,
                    message: `"${activity.title}" has been ${status}`,
                    activityId: activity.id,
                    metadata: { status },
                });
            }
        }
        res.success({
            message: 'Activity status updated successfully',
            activity: {
                id: activity.id,
                title: activity.title,
                status: activity.status,
            },
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update activity status'), 500);
    }
}
async function completeActivityHandler(req, res, deps) {
    try {
        const { id: activityId } = req.params;
        const { report, attendanceCount, notes } = req.body;
        const completedBy = req.user?.id;
        if (!completedBy) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const activity = await deps.getCompletionActivityForUser(req, activityId, completedBy);
        if (activity.creatorId !== completedBy) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only activity creator can complete the activity', 403);
        }
        activity.status = Activity_1.ActivityStatus.COMPLETED;
        activity.completionReport = report;
        activity.attendanceCount = attendanceCount;
        activity.completionNotes = notes;
        activity.completedAt = new Date();
        await activityRepo.save(activity);
        (0, activityWebSocketController_1.emitActivityUpdated)(activity.organizationId, activity);
        res.success({
            message: 'Activity marked as complete',
            activity: {
                id: activity.id,
                title: activity.title,
                status: activity.status,
                completedAt: activity.completedAt,
            },
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to complete activity'), 500);
    }
}
async function cancelActivityHandler(req, res, deps) {
    try {
        const { id: activityId } = req.params;
        const { notes } = req.body;
        const cancelledBy = req.user?.id;
        if (!cancelledBy) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const activity = await deps.getCompletionActivityForUser(req, activityId, cancelledBy);
        if (activity.creatorId !== cancelledBy) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, 'Activity not found', 404);
        }
        const cancelledActivity = activity.organizationId
            ? await deps.activityEventService.cancelActivityAsSystem(activity.organizationId, activity.id, cancelledBy, notes)
            : await deps.activityEventService.cancelActivity(activity.id, cancelledBy, notes);
        (0, activityWebSocketController_1.emitActivityUpdated)(cancelledActivity.organizationId ?? null, cancelledActivity);
        res.success({
            message: 'Activity cancelled successfully',
            activity: {
                id: cancelledActivity.id,
                title: cancelledActivity.title,
                status: cancelledActivity.status,
            },
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        if (error instanceof Error) {
            switch (error.name) {
                case 'ValidationError':
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
                case 'ForbiddenError':
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, error.message, 403);
                case 'ActivityNotFoundError':
                case 'NotFoundError':
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ACTIVITY_NOT_FOUND, error.message, 404);
                default:
                    break;
            }
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to cancel activity'), 500);
    }
}
//# sourceMappingURL=activityController.statusCalendarReminder.js.map