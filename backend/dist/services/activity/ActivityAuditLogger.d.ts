import { ActivityType } from '../../models/Activity';
export declare enum ActivityAuditAction {
    ACTIVITY_CREATED = "ACTIVITY_CREATED",
    ACTIVITY_UPDATED = "ACTIVITY_UPDATED",
    ACTIVITY_DELETED = "ACTIVITY_DELETED",
    ACTIVITY_STATUS_CHANGED = "ACTIVITY_STATUS_CHANGED",
    ACTIVITY_STARTED = "ACTIVITY_STARTED",
    ACTIVITY_COMPLETED = "ACTIVITY_COMPLETED",
    ACTIVITY_CANCELLED = "ACTIVITY_CANCELLED",
    ACTIVITY_RESCHEDULED = "ACTIVITY_RESCHEDULED",
    PARTICIPANT_JOINED = "PARTICIPANT_JOINED",
    PARTICIPANT_LEFT = "PARTICIPANT_LEFT",
    PARTICIPANT_REMOVED = "PARTICIPANT_REMOVED",
    PARTICIPANT_ROLE_CHANGED = "PARTICIPANT_ROLE_CHANGED",
    SHIP_ASSIGNED = "SHIP_ASSIGNED",
    SHIP_UNASSIGNED = "SHIP_UNASSIGNED",
    CREW_JOINED = "CREW_JOINED",
    CREW_LEFT = "CREW_LEFT",
    APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED",
    APPLICATION_REVIEWED = "APPLICATION_REVIEWED",
    APPLICATION_ACCEPTED = "APPLICATION_ACCEPTED",
    APPLICATION_REJECTED = "APPLICATION_REJECTED",
    CONTRACTOR_SCREENED = "CONTRACTOR_SCREENED",
    BOUNTY_STATUS_UPDATED = "BOUNTY_STATUS_UPDATED",
    ORG_INVITED = "ORG_INVITED",
    ORG_INVITE_ACCEPTED = "ORG_INVITE_ACCEPTED",
    ORG_INVITE_DECLINED = "ORG_INVITE_DECLINED",
    ORG_JOINED = "ORG_JOINED",
    ORG_LEFT = "ORG_LEFT",
    VOICE_CHANNEL_CREATED = "VOICE_CHANNEL_CREATED",
    VOICE_CHANNEL_LINKED = "VOICE_CHANNEL_LINKED",
    ROUTE_ADDED = "ROUTE_ADDED",
    ROUTE_UPDATED = "ROUTE_UPDATED",
    WAYPOINT_UPDATED = "WAYPOINT_UPDATED",
    COMPLETION_REPORT_SUBMITTED = "COMPLETION_REPORT_SUBMITTED",
    READY_CHECK_INITIATED = "READY_CHECK_INITIATED",
    READY_CHECK_RESPONDED = "READY_CHECK_RESPONDED",
    READY_CHECK_COMPLETED = "READY_CHECK_COMPLETED",
    READY_CHECK_EXPIRED = "READY_CHECK_EXPIRED",
    READY_CHECK_CANCELLED = "READY_CHECK_CANCELLED"
}
export interface ActivityAuditEntry {
    action: ActivityAuditAction;
    activityId: string;
    activityTitle: string;
    activityType: ActivityType;
    organizationId: string;
    performedById: string;
    performedByName: string;
    timestamp: Date;
    details: Record<string, unknown>;
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        previousValue?: unknown;
        newValue?: unknown;
    };
}
export declare class ActivityAuditLogger {
    private static instance;
    private buffer;
    private head;
    private count;
    private static readonly MAX_ENTRIES;
    private constructor();
    static getInstance(): ActivityAuditLogger;
    log(entry: Omit<ActivityAuditEntry, 'timestamp'>): void;
    getAuditLog(options?: {
        activityId?: string;
        organizationId?: string;
        performedById?: string;
        action?: ActivityAuditAction;
        actions?: ActivityAuditAction[];
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    }): ActivityAuditEntry[];
    getActivityAuditStats(activityId: string): {
        totalEvents: number;
        byAction: Record<string, number>;
        uniqueUsers: number;
        lastActivity: Date | null;
        recentEvents: ActivityAuditEntry[];
    };
    getOrganizationAuditStats(organizationId: string): {
        totalEvents: number;
        byAction: Record<string, number>;
        byActivity: Record<string, number>;
        uniqueUsers: number;
        activeActivities: number;
        timeRange: {
            earliest: Date | null;
            latest: Date | null;
        };
    };
    clearAuditLog(): void;
    getEntryCount(): number;
    private pushEntry;
    private getEntries;
}
export declare const activityAuditLogger: ActivityAuditLogger;
//# sourceMappingURL=ActivityAuditLogger.d.ts.map