"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityAuditLogger = exports.ActivityAuditLogger = exports.ActivityAuditAction = void 0;
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
var ActivityAuditAction;
(function (ActivityAuditAction) {
    ActivityAuditAction["ACTIVITY_CREATED"] = "ACTIVITY_CREATED";
    ActivityAuditAction["ACTIVITY_UPDATED"] = "ACTIVITY_UPDATED";
    ActivityAuditAction["ACTIVITY_DELETED"] = "ACTIVITY_DELETED";
    ActivityAuditAction["ACTIVITY_STATUS_CHANGED"] = "ACTIVITY_STATUS_CHANGED";
    ActivityAuditAction["ACTIVITY_STARTED"] = "ACTIVITY_STARTED";
    ActivityAuditAction["ACTIVITY_COMPLETED"] = "ACTIVITY_COMPLETED";
    ActivityAuditAction["ACTIVITY_CANCELLED"] = "ACTIVITY_CANCELLED";
    ActivityAuditAction["ACTIVITY_RESCHEDULED"] = "ACTIVITY_RESCHEDULED";
    ActivityAuditAction["PARTICIPANT_JOINED"] = "PARTICIPANT_JOINED";
    ActivityAuditAction["PARTICIPANT_LEFT"] = "PARTICIPANT_LEFT";
    ActivityAuditAction["PARTICIPANT_REMOVED"] = "PARTICIPANT_REMOVED";
    ActivityAuditAction["PARTICIPANT_ROLE_CHANGED"] = "PARTICIPANT_ROLE_CHANGED";
    ActivityAuditAction["SHIP_ASSIGNED"] = "SHIP_ASSIGNED";
    ActivityAuditAction["SHIP_UNASSIGNED"] = "SHIP_UNASSIGNED";
    ActivityAuditAction["CREW_JOINED"] = "CREW_JOINED";
    ActivityAuditAction["CREW_LEFT"] = "CREW_LEFT";
    ActivityAuditAction["APPLICATION_SUBMITTED"] = "APPLICATION_SUBMITTED";
    ActivityAuditAction["APPLICATION_REVIEWED"] = "APPLICATION_REVIEWED";
    ActivityAuditAction["APPLICATION_ACCEPTED"] = "APPLICATION_ACCEPTED";
    ActivityAuditAction["APPLICATION_REJECTED"] = "APPLICATION_REJECTED";
    ActivityAuditAction["CONTRACTOR_SCREENED"] = "CONTRACTOR_SCREENED";
    ActivityAuditAction["BOUNTY_STATUS_UPDATED"] = "BOUNTY_STATUS_UPDATED";
    ActivityAuditAction["ORG_INVITED"] = "ORG_INVITED";
    ActivityAuditAction["ORG_INVITE_ACCEPTED"] = "ORG_INVITE_ACCEPTED";
    ActivityAuditAction["ORG_INVITE_DECLINED"] = "ORG_INVITE_DECLINED";
    ActivityAuditAction["ORG_JOINED"] = "ORG_JOINED";
    ActivityAuditAction["ORG_LEFT"] = "ORG_LEFT";
    ActivityAuditAction["VOICE_CHANNEL_CREATED"] = "VOICE_CHANNEL_CREATED";
    ActivityAuditAction["VOICE_CHANNEL_LINKED"] = "VOICE_CHANNEL_LINKED";
    ActivityAuditAction["ROUTE_ADDED"] = "ROUTE_ADDED";
    ActivityAuditAction["ROUTE_UPDATED"] = "ROUTE_UPDATED";
    ActivityAuditAction["WAYPOINT_UPDATED"] = "WAYPOINT_UPDATED";
    ActivityAuditAction["COMPLETION_REPORT_SUBMITTED"] = "COMPLETION_REPORT_SUBMITTED";
    ActivityAuditAction["READY_CHECK_INITIATED"] = "READY_CHECK_INITIATED";
    ActivityAuditAction["READY_CHECK_RESPONDED"] = "READY_CHECK_RESPONDED";
    ActivityAuditAction["READY_CHECK_COMPLETED"] = "READY_CHECK_COMPLETED";
    ActivityAuditAction["READY_CHECK_EXPIRED"] = "READY_CHECK_EXPIRED";
    ActivityAuditAction["READY_CHECK_CANCELLED"] = "READY_CHECK_CANCELLED";
})(ActivityAuditAction || (exports.ActivityAuditAction = ActivityAuditAction = {}));
class ActivityAuditLogger {
    static instance;
    buffer;
    head = 0;
    count = 0;
    static MAX_ENTRIES = 5000;
    constructor() {
        this.buffer = new Array(ActivityAuditLogger.MAX_ENTRIES).fill(null);
    }
    static getInstance() {
        if (!ActivityAuditLogger.instance) {
            ActivityAuditLogger.instance = new ActivityAuditLogger();
        }
        return ActivityAuditLogger.instance;
    }
    log(entry) {
        const auditEntry = {
            ...entry,
            timestamp: new Date(),
        };
        this.pushEntry(auditEntry);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ACTIVITY,
            action: entry.action,
            message: `Activity ${entry.action}: ${entry.activityTitle} (${entry.activityType})`,
            userId: entry.performedById,
            username: entry.performedByName,
            organizationId: entry.organizationId,
            resource: `activity/${entry.activityId}`,
            ipAddress: entry.metadata?.ipAddress,
            userAgent: entry.metadata?.userAgent,
            metadata: {
                ...entry.details,
                activityId: entry.activityId,
                activityTitle: entry.activityTitle,
                activityType: entry.activityType,
            },
        });
        logger_1.logger.debug('Activity audit logged', {
            action: entry.action,
            activityId: entry.activityId,
            performedBy: entry.performedByName,
        });
    }
    getAuditLog(options) {
        let filtered = this.getEntries();
        if (options?.activityId) {
            filtered = filtered.filter(e => e.activityId === options.activityId);
        }
        if (options?.organizationId) {
            filtered = filtered.filter(e => e.organizationId === options.organizationId);
        }
        if (options?.performedById) {
            filtered = filtered.filter(e => e.performedById === options.performedById);
        }
        if (options?.action) {
            filtered = filtered.filter(e => e.action === options.action);
        }
        if (options?.actions && options.actions.length > 0) {
            filtered = filtered.filter(e => options.actions.includes(e.action));
        }
        if (options?.startDate) {
            const start = options.startDate.getTime();
            filtered = filtered.filter(e => e.timestamp.getTime() >= start);
        }
        if (options?.endDate) {
            const end = options.endDate.getTime();
            filtered = filtered.filter(e => e.timestamp.getTime() <= end);
        }
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (options?.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
    getActivityAuditStats(activityId) {
        const events = this.getEntries().filter(e => e.activityId === activityId);
        const byAction = {};
        const userIds = new Set();
        for (const event of events) {
            byAction[event.action] = (byAction[event.action] || 0) + 1;
            userIds.add(event.performedById);
        }
        const sortedEvents = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return {
            totalEvents: events.length,
            byAction,
            uniqueUsers: userIds.size,
            lastActivity: sortedEvents.length > 0 ? sortedEvents[0].timestamp : null,
            recentEvents: sortedEvents.slice(0, 10),
        };
    }
    getOrganizationAuditStats(organizationId) {
        const events = this.getEntries().filter(e => e.organizationId === organizationId);
        const byAction = {};
        const byActivity = {};
        const userIds = new Set();
        const activityIds = new Set();
        for (const event of events) {
            byAction[event.action] = (byAction[event.action] || 0) + 1;
            byActivity[event.activityId] = (byActivity[event.activityId] || 0) + 1;
            userIds.add(event.performedById);
            activityIds.add(event.activityId);
        }
        const timestamps = events.map(e => e.timestamp.getTime());
        return {
            totalEvents: events.length,
            byAction,
            byActivity,
            uniqueUsers: userIds.size,
            activeActivities: activityIds.size,
            timeRange: {
                earliest: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
                latest: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
            },
        };
    }
    clearAuditLog() {
        if (process.env.NODE_ENV === 'test') {
            this.buffer = new Array(ActivityAuditLogger.MAX_ENTRIES).fill(null);
            this.head = 0;
            this.count = 0;
        }
    }
    getEntryCount() {
        return this.count;
    }
    pushEntry(entry) {
        this.buffer[this.head] = entry;
        this.head = (this.head + 1) % ActivityAuditLogger.MAX_ENTRIES;
        if (this.count < ActivityAuditLogger.MAX_ENTRIES) {
            this.count++;
        }
    }
    getEntries() {
        const entries = [];
        for (let i = 0; i < this.count; i++) {
            const idx = (this.head - 1 - i + ActivityAuditLogger.MAX_ENTRIES) % ActivityAuditLogger.MAX_ENTRIES;
            const entry = this.buffer[idx];
            if (entry) {
                entries.push(entry);
            }
        }
        return entries;
    }
}
exports.ActivityAuditLogger = ActivityAuditLogger;
exports.activityAuditLogger = ActivityAuditLogger.getInstance();
//# sourceMappingURL=ActivityAuditLogger.js.map