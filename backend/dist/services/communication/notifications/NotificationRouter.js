"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRouter = exports.NotificationContext = void 0;
const Notification_1 = require("../../../models/Notification");
const logger_1 = require("../../../utils/logger");
const websocketServer_1 = require("../../../websocket/websocketServer");
const NotificationPreferencesService_1 = require("./NotificationPreferencesService");
const NotificationService_1 = require("./NotificationService");
var NotificationContext;
(function (NotificationContext) {
    NotificationContext["TEAM_JOINED"] = "team_joined";
    NotificationContext["TEAM_LEFT"] = "team_left";
    NotificationContext["TEAM_ROLE_CHANGED"] = "team_role_changed";
    NotificationContext["ACTIVITY_JOINED"] = "activity_joined";
    NotificationContext["ACTIVITY_LEFT"] = "activity_left";
    NotificationContext["ACTIVITY_COMPLETED"] = "activity_completed";
    NotificationContext["ACTIVITY_CANCELLED"] = "activity_cancelled";
    NotificationContext["ACTIVITY_INVITATION"] = "activity_invitation";
    NotificationContext["ACTIVITY_REMINDER"] = "activity_reminder";
    NotificationContext["LFG_SESSION_STARTED"] = "lfg_session_started";
    NotificationContext["LFG_SESSION_FILLED"] = "lfg_session_filled";
    NotificationContext["CONTACT_REQUEST_RECEIVED"] = "contact_request_received";
    NotificationContext["CONTACT_REQUEST_ACCEPTED"] = "contact_request_accepted";
    NotificationContext["APPLICATION_RECEIVED"] = "application_received";
    NotificationContext["APPLICATION_REVIEWED"] = "application_reviewed";
    NotificationContext["JOB_LISTING_EXPIRED"] = "job_listing_expired";
    NotificationContext["FLEET_CREATED"] = "fleet_created";
    NotificationContext["FLEET_DEPLOYED"] = "fleet_deployed";
    NotificationContext["FLEET_DISSOLVED"] = "fleet_dissolved";
    NotificationContext["TRADE_OPERATION_CREATED"] = "trade_operation_created";
    NotificationContext["ROUTE_STATUS_CHANGED"] = "route_status_changed";
    NotificationContext["BOUNTY_CLAIMED"] = "bounty_claimed";
    NotificationContext["BOUNTY_COMPLETED"] = "bounty_completed";
    NotificationContext["ORG_MEMBER_JOINED"] = "org_member_joined";
    NotificationContext["ORG_MEMBER_LEFT"] = "org_member_left";
    NotificationContext["ORG_ROLE_CHANGED"] = "org_role_changed";
    NotificationContext["SYSTEM_ANNOUNCEMENT"] = "system_announcement";
    NotificationContext["SECURITY_ALERT"] = "security_alert";
    NotificationContext["READY_CHECK_INITIATED"] = "ready_check_initiated";
    NotificationContext["READY_CHECK_COMPLETED"] = "ready_check_completed";
    NotificationContext["COMMAND_RECEIVED"] = "command_received";
    NotificationContext["PREFLIGHT_CHECK"] = "preflight_check";
})(NotificationContext || (exports.NotificationContext = NotificationContext = {}));
const CONTEXT_TO_CATEGORY = {
    [NotificationContext.TEAM_JOINED]: 'organization',
    [NotificationContext.TEAM_LEFT]: 'organization',
    [NotificationContext.TEAM_ROLE_CHANGED]: 'organization',
    [NotificationContext.ACTIVITY_JOINED]: 'activity',
    [NotificationContext.ACTIVITY_LEFT]: 'activity',
    [NotificationContext.ACTIVITY_COMPLETED]: 'activity',
    [NotificationContext.ACTIVITY_CANCELLED]: 'activity',
    [NotificationContext.ACTIVITY_INVITATION]: 'activity',
    [NotificationContext.ACTIVITY_REMINDER]: 'activity',
    [NotificationContext.LFG_SESSION_STARTED]: 'social',
    [NotificationContext.LFG_SESSION_FILLED]: 'social',
    [NotificationContext.CONTACT_REQUEST_RECEIVED]: 'social',
    [NotificationContext.CONTACT_REQUEST_ACCEPTED]: 'social',
    [NotificationContext.APPLICATION_RECEIVED]: 'activity',
    [NotificationContext.APPLICATION_REVIEWED]: 'activity',
    [NotificationContext.JOB_LISTING_EXPIRED]: 'activity',
    [NotificationContext.FLEET_CREATED]: 'fleet',
    [NotificationContext.FLEET_DEPLOYED]: 'fleet',
    [NotificationContext.FLEET_DISSOLVED]: 'fleet',
    [NotificationContext.TRADE_OPERATION_CREATED]: 'trade',
    [NotificationContext.ROUTE_STATUS_CHANGED]: 'trade',
    [NotificationContext.BOUNTY_CLAIMED]: 'security',
    [NotificationContext.BOUNTY_COMPLETED]: 'security',
    [NotificationContext.ORG_MEMBER_JOINED]: 'organization',
    [NotificationContext.ORG_MEMBER_LEFT]: 'organization',
    [NotificationContext.ORG_ROLE_CHANGED]: 'organization',
    [NotificationContext.SYSTEM_ANNOUNCEMENT]: 'system',
    [NotificationContext.SECURITY_ALERT]: 'system',
    [NotificationContext.READY_CHECK_INITIATED]: 'activity',
    [NotificationContext.READY_CHECK_COMPLETED]: 'activity',
    [NotificationContext.COMMAND_RECEIVED]: 'activity',
    [NotificationContext.PREFLIGHT_CHECK]: 'activity',
};
const CONTEXT_TO_TYPE = {
    [NotificationContext.TEAM_JOINED]: Notification_1.NotificationType.INFO,
    [NotificationContext.TEAM_LEFT]: Notification_1.NotificationType.INFO,
    [NotificationContext.TEAM_ROLE_CHANGED]: Notification_1.NotificationType.INFO,
    [NotificationContext.ACTIVITY_JOINED]: Notification_1.NotificationType.SUCCESS,
    [NotificationContext.ACTIVITY_LEFT]: Notification_1.NotificationType.INFO,
    [NotificationContext.ACTIVITY_COMPLETED]: Notification_1.NotificationType.ACTIVITY_COMPLETED,
    [NotificationContext.ACTIVITY_CANCELLED]: Notification_1.NotificationType.ACTIVITY_CANCELLED,
    [NotificationContext.ACTIVITY_INVITATION]: Notification_1.NotificationType.ACTIVITY_INVITATION,
    [NotificationContext.ACTIVITY_REMINDER]: Notification_1.NotificationType.WARNING,
    [NotificationContext.LFG_SESSION_STARTED]: Notification_1.NotificationType.INFO,
    [NotificationContext.LFG_SESSION_FILLED]: Notification_1.NotificationType.SUCCESS,
    [NotificationContext.CONTACT_REQUEST_RECEIVED]: Notification_1.NotificationType.INFO,
    [NotificationContext.CONTACT_REQUEST_ACCEPTED]: Notification_1.NotificationType.SUCCESS,
    [NotificationContext.APPLICATION_RECEIVED]: Notification_1.NotificationType.INFO,
    [NotificationContext.APPLICATION_REVIEWED]: Notification_1.NotificationType.INFO,
    [NotificationContext.JOB_LISTING_EXPIRED]: Notification_1.NotificationType.WARNING,
    [NotificationContext.FLEET_CREATED]: Notification_1.NotificationType.FLEET_CREATED,
    [NotificationContext.FLEET_DEPLOYED]: Notification_1.NotificationType.FLEET_DEPLOYED,
    [NotificationContext.FLEET_DISSOLVED]: Notification_1.NotificationType.FLEET_DISSOLVED,
    [NotificationContext.TRADE_OPERATION_CREATED]: Notification_1.NotificationType.TRADE_OPERATION_CREATED,
    [NotificationContext.ROUTE_STATUS_CHANGED]: Notification_1.NotificationType.ROUTE_STATUS_CHANGED,
    [NotificationContext.BOUNTY_CLAIMED]: Notification_1.NotificationType.WARNING,
    [NotificationContext.BOUNTY_COMPLETED]: Notification_1.NotificationType.SUCCESS,
    [NotificationContext.ORG_MEMBER_JOINED]: Notification_1.NotificationType.INFO,
    [NotificationContext.ORG_MEMBER_LEFT]: Notification_1.NotificationType.INFO,
    [NotificationContext.ORG_ROLE_CHANGED]: Notification_1.NotificationType.INFO,
    [NotificationContext.SYSTEM_ANNOUNCEMENT]: Notification_1.NotificationType.ANNOUNCEMENT,
    [NotificationContext.SECURITY_ALERT]: Notification_1.NotificationType.ERROR,
    [NotificationContext.READY_CHECK_INITIATED]: Notification_1.NotificationType.WARNING,
    [NotificationContext.READY_CHECK_COMPLETED]: Notification_1.NotificationType.SUCCESS,
    [NotificationContext.COMMAND_RECEIVED]: Notification_1.NotificationType.WARNING,
    [NotificationContext.PREFLIGHT_CHECK]: Notification_1.NotificationType.WARNING,
};
class NotificationRouter {
    notificationService;
    preferencesService;
    constructor(notificationService, preferencesService) {
        this.notificationService = notificationService ?? new NotificationService_1.NotificationService(undefined, undefined);
        this.preferencesService = preferencesService ?? new NotificationPreferencesService_1.NotificationPreferencesService();
    }
    async notifyUser(input) {
        const { userId, context, title, message } = input;
        const category = CONTEXT_TO_CATEGORY[context];
        const type = CONTEXT_TO_TYPE[context];
        const result = { delivered: [], skipped: [], errors: [] };
        const shouldInApp = await this.shouldDeliver(userId, 'inApp', category);
        if (shouldInApp) {
            await this.deliverInApp(input, type, result);
            this.deliverWebSocket(userId, type, title, message, category, input, result);
        }
        else {
            result.skipped.push('inApp', 'websocket');
        }
        const shouldDiscord = await this.shouldDeliver(userId, 'discord', category);
        if (shouldDiscord) {
            await this.deliverDiscord(title, message, result);
        }
        else {
            result.skipped.push('discord');
        }
        logger_1.logger.debug('NotificationRouter: routed user notification', {
            userId,
            context,
            delivered: result.delivered,
            skipped: result.skipped,
            errors: result.errors,
        });
        return result;
    }
    notifyOrganization(input) {
        const { organizationId, context, title, message, actionUrl, metadata } = input;
        const category = CONTEXT_TO_CATEGORY[context];
        const type = CONTEXT_TO_TYPE[context];
        const result = { delivered: [], skipped: [], errors: [] };
        try {
            (0, websocketServer_1.emitToOrganization)(organizationId, 'notification:new', {
                id: crypto.randomUUID(),
                type: this.mapTypeToWsType(type),
                title,
                message,
                category,
                data: { context, actionUrl, ...metadata },
                timestamp: new Date().toISOString(),
                read: false,
                actionUrl,
            });
            result.delivered.push('websocket');
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error('NotificationRouter: org broadcast failed', {
                organizationId,
                context,
                error: errorMsg,
            });
            result.errors.push(`websocket: ${errorMsg}`);
        }
        logger_1.logger.debug('NotificationRouter: routed org notification', {
            organizationId,
            context,
            delivered: result.delivered,
            errors: result.errors,
        });
        return result;
    }
    async deliverInApp(input, type, result) {
        const { userId, context, title, message, senderId, actionUrl, metadata, priority } = input;
        try {
            const persisted = await this.notificationService.create({
                userId,
                type,
                title,
                message,
                senderId,
                priority: priority ?? Notification_1.NotificationPriority.NORMAL,
                data: { context, actionUrl, ...metadata },
            });
            result.notificationId = persisted.notificationId;
            result.delivered.push('inApp');
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error('NotificationRouter: in-app delivery failed', {
                userId,
                context,
                error: errorMsg,
            });
            result.errors.push(`inApp: ${errorMsg}`);
        }
    }
    deliverWebSocket(userId, type, title, message, category, input, result) {
        const { context, actionUrl, metadata } = input;
        try {
            (0, websocketServer_1.emitToUser)(userId, 'notification:new', {
                id: result.notificationId ?? crypto.randomUUID(),
                type: this.mapTypeToWsType(type),
                title,
                message,
                category,
                data: { context, actionUrl, ...metadata },
                timestamp: new Date().toISOString(),
                read: false,
                actionUrl,
            });
            result.delivered.push('websocket');
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger_1.logger.error('NotificationRouter: websocket delivery failed', {
                userId,
                context,
                error: errorMsg,
            });
            result.errors.push(`websocket: ${errorMsg}`);
        }
    }
    async deliverDiscord(title, message, result) {
        try {
            await this.notificationService.sendDiscordNotification({ subject: title, body: message });
            result.delivered.push('discord');
        }
        catch {
            result.skipped.push('discord');
        }
    }
    getCategoryForContext(context) {
        return CONTEXT_TO_CATEGORY[context];
    }
    getTypeForContext(context) {
        return CONTEXT_TO_TYPE[context];
    }
    async shouldDeliver(userId, channel, category) {
        try {
            return await this.preferencesService.shouldDeliver(userId, channel, category);
        }
        catch (err) {
            logger_1.logger.warn('NotificationRouter: preference check failed, defaulting to deliver', {
                userId,
                channel,
                category,
                error: err instanceof Error ? err.message : String(err),
            });
            return true;
        }
    }
    mapTypeToWsType(type) {
        switch (type) {
            case Notification_1.NotificationType.ERROR:
                return 'error';
            case Notification_1.NotificationType.WARNING:
                return 'warning';
            case Notification_1.NotificationType.SUCCESS:
            case Notification_1.NotificationType.ACTIVITY_COMPLETED:
            case Notification_1.NotificationType.FLEET_DEPLOYED:
                return 'success';
            default:
                return 'info';
        }
    }
}
exports.NotificationRouter = NotificationRouter;
//# sourceMappingURL=NotificationRouter.js.map