import { NotificationPriority, NotificationType } from '../../../models/Notification';
import type { NotificationCategories } from '../../../models/NotificationPreferences';
import { NotificationPreferencesService } from './NotificationPreferencesService';
import { NotificationService } from './NotificationService';
export declare enum NotificationContext {
    TEAM_JOINED = "team_joined",
    TEAM_LEFT = "team_left",
    TEAM_ROLE_CHANGED = "team_role_changed",
    ACTIVITY_JOINED = "activity_joined",
    ACTIVITY_LEFT = "activity_left",
    ACTIVITY_COMPLETED = "activity_completed",
    ACTIVITY_CANCELLED = "activity_cancelled",
    ACTIVITY_INVITATION = "activity_invitation",
    ACTIVITY_REMINDER = "activity_reminder",
    LFG_SESSION_STARTED = "lfg_session_started",
    LFG_SESSION_FILLED = "lfg_session_filled",
    CONTACT_REQUEST_RECEIVED = "contact_request_received",
    CONTACT_REQUEST_ACCEPTED = "contact_request_accepted",
    APPLICATION_RECEIVED = "application_received",
    APPLICATION_REVIEWED = "application_reviewed",
    JOB_LISTING_EXPIRED = "job_listing_expired",
    FLEET_CREATED = "fleet_created",
    FLEET_DEPLOYED = "fleet_deployed",
    FLEET_DISSOLVED = "fleet_dissolved",
    TRADE_OPERATION_CREATED = "trade_operation_created",
    ROUTE_STATUS_CHANGED = "route_status_changed",
    BOUNTY_CLAIMED = "bounty_claimed",
    BOUNTY_COMPLETED = "bounty_completed",
    ORG_MEMBER_JOINED = "org_member_joined",
    ORG_MEMBER_LEFT = "org_member_left",
    ORG_ROLE_CHANGED = "org_role_changed",
    SYSTEM_ANNOUNCEMENT = "system_announcement",
    SECURITY_ALERT = "security_alert",
    READY_CHECK_INITIATED = "ready_check_initiated",
    READY_CHECK_COMPLETED = "ready_check_completed",
    COMMAND_RECEIVED = "command_received",
    PREFLIGHT_CHECK = "preflight_check"
}
export interface RouteNotificationInput {
    context: NotificationContext;
    userId: string;
    title: string;
    message: string;
    senderId?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
    priority?: NotificationPriority;
}
export interface RouteOrgNotificationInput {
    context: NotificationContext;
    organizationId: string;
    title: string;
    message: string;
    senderId?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
    priority?: NotificationPriority;
}
export interface NotificationRouteResult {
    delivered: string[];
    skipped: string[];
    errors: string[];
    notificationId?: string;
}
export declare class NotificationRouter {
    private readonly notificationService;
    private readonly preferencesService;
    constructor(notificationService?: NotificationService, preferencesService?: NotificationPreferencesService);
    notifyUser(input: RouteNotificationInput): Promise<NotificationRouteResult>;
    notifyOrganization(input: RouteOrgNotificationInput): NotificationRouteResult;
    private deliverInApp;
    private deliverWebSocket;
    private deliverDiscord;
    getCategoryForContext(context: NotificationContext): keyof NotificationCategories;
    getTypeForContext(context: NotificationContext): NotificationType;
    private shouldDeliver;
    private mapTypeToWsType;
}
//# sourceMappingURL=NotificationRouter.d.ts.map