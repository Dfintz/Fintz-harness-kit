"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEventType = exports.auditService = exports.AuditService = exports.AuditSeverity = exports.AuditCategory = void 0;
const crypto_1 = require("crypto");
const auditLogger_1 = require("../../utils/auditLogger");
var AuditCategory;
(function (AuditCategory) {
    AuditCategory["AUTHENTICATION"] = "AUTHENTICATION";
    AuditCategory["AUTHORIZATION"] = "AUTHORIZATION";
    AuditCategory["DATA_ACCESS"] = "DATA_ACCESS";
    AuditCategory["PERMISSION"] = "PERMISSION";
    AuditCategory["ACTIVITY"] = "ACTIVITY";
    AuditCategory["ORGANIZATION"] = "ORGANIZATION";
    AuditCategory["MEMBERSHIP"] = "MEMBERSHIP";
    AuditCategory["RSI_SYNC"] = "RSI_SYNC";
    AuditCategory["ENCRYPTION"] = "ENCRYPTION";
    AuditCategory["INTEL"] = "INTEL";
    AuditCategory["USER"] = "USER";
    AuditCategory["ADMIN"] = "ADMIN";
    AuditCategory["SECURITY"] = "SECURITY";
    AuditCategory["FLEET"] = "FLEET";
    AuditCategory["DIPLOMACY"] = "DIPLOMACY";
    AuditCategory["FEDERATION"] = "FEDERATION";
    AuditCategory["BOUNTY"] = "BOUNTY";
    AuditCategory["MINING"] = "MINING";
    AuditCategory["TRADE"] = "TRADE";
    AuditCategory["DISCORD"] = "DISCORD";
    AuditCategory["GAMIFICATION"] = "GAMIFICATION";
    AuditCategory["VOICE"] = "VOICE";
    AuditCategory["SYSTEM"] = "SYSTEM";
    AuditCategory["APPROVAL"] = "APPROVAL";
})(AuditCategory || (exports.AuditCategory = AuditCategory = {}));
var AuditSeverity;
(function (AuditSeverity) {
    AuditSeverity["LOW"] = "low";
    AuditSeverity["MEDIUM"] = "medium";
    AuditSeverity["HIGH"] = "high";
    AuditSeverity["CRITICAL"] = "critical";
})(AuditSeverity || (exports.AuditSeverity = AuditSeverity = {}));
const CATEGORY_TO_EVENT_TYPE = {
    [AuditCategory.AUTHENTICATION]: auditLogger_1.AuditEventType.AUTH_SUCCESS,
    [AuditCategory.AUTHORIZATION]: auditLogger_1.AuditEventType.AUTHZ_FAILURE,
    [AuditCategory.DATA_ACCESS]: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
    [AuditCategory.PERMISSION]: auditLogger_1.AuditEventType.PERMISSION_GRANTED,
    [AuditCategory.ACTIVITY]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.ORGANIZATION]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.MEMBERSHIP]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.RSI_SYNC]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.ENCRYPTION]: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
    [AuditCategory.INTEL]: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
    [AuditCategory.USER]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.ADMIN]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.SECURITY]: auditLogger_1.AuditEventType.AUTHZ_FAILURE,
    [AuditCategory.FLEET]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.DIPLOMACY]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.FEDERATION]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.BOUNTY]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.MINING]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.TRADE]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.DISCORD]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.SYSTEM]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.GAMIFICATION]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.VOICE]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
    [AuditCategory.APPROVAL]: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
};
class AuditService {
    static instance;
    buffer;
    bufferHead = 0;
    bufferCount = 0;
    bufferSize;
    constructor(bufferSize = 5000) {
        this.bufferSize = bufferSize;
        this.buffer = new Array(bufferSize).fill(null);
    }
    static getInstance() {
        if (!AuditService.instance) {
            AuditService.instance = new AuditService();
        }
        return AuditService.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            AuditService.instance = undefined;
        }
    }
    log(event) {
        const entry = {
            ...event,
            id: (0, crypto_1.randomUUID)(),
            timestamp: new Date(),
            correlationId: event.correlationId || (0, crypto_1.randomUUID)(),
            severity: event.severity || AuditSeverity.LOW,
        };
        const eventType = CATEGORY_TO_EVENT_TYPE[event.category] || auditLogger_1.AuditEventType.ACTIVITY_ACTION;
        const logEntry = {
            eventType,
            userId: event.userId,
            username: event.username,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            resource: event.resource,
            action: event.action,
            message: event.message,
            metadata: {
                ...event.metadata,
                category: event.category,
                severity: entry.severity,
                correlationId: entry.correlationId,
                organizationId: event.organizationId,
                auditId: entry.id,
            },
        };
        (0, auditLogger_1.logAuditEvent)(logEntry);
        this.bufferPush(entry);
        return entry;
    }
    logAuthentication(success, userId, username, ipAddress, userAgent, reason) {
        return this.log({
            category: AuditCategory.AUTHENTICATION,
            action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE',
            severity: success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
            message: success
                ? `Authentication successful for user: ${username}`
                : `Authentication failed: ${reason || 'unknown'}`,
            userId,
            username,
            ipAddress,
            userAgent,
            metadata: reason ? { reason } : undefined,
        });
    }
    logAuthorizationFailure(userId, username, role, resource, action, ipAddress, userAgent) {
        return this.log({
            category: AuditCategory.AUTHORIZATION,
            action: 'ACCESS_DENIED',
            severity: AuditSeverity.MEDIUM,
            message: `Authorization failed: User ${username} (role: ${role}) attempted ${action} on ${resource}`,
            userId,
            username,
            resource,
            ipAddress,
            userAgent,
            metadata: { role, attemptedAction: action },
        });
    }
    logDataAccess(userId, username, resource, action, ipAddress, userAgent, metadata) {
        return this.log({
            category: AuditCategory.DATA_ACCESS,
            action,
            severity: AuditSeverity.MEDIUM,
            message: `Sensitive data access: User ${username} performed ${action} on ${resource}`,
            userId,
            username,
            resource,
            ipAddress,
            userAgent,
            metadata,
        });
    }
    logPermissionChange(userId, targetUserId, organizationId, action, resource, permissions, metadata) {
        return this.log({
            category: AuditCategory.PERMISSION,
            action: `PERMISSION_${action}`,
            severity: AuditSeverity.HIGH,
            message: `Permission ${action.toLowerCase()}: ${permissions} on ${resource} for user ${targetUserId}`,
            userId,
            organizationId,
            resource,
            metadata: { ...metadata, targetUserId, permissions },
        });
    }
    logOrganizationEvent(action, organizationId, userId, message, metadata) {
        return this.log({
            category: AuditCategory.ORGANIZATION,
            action,
            severity: AuditSeverity.MEDIUM,
            message,
            userId,
            organizationId,
            metadata,
        });
    }
    logRsiSync(organizationId, action, success, metadata) {
        return this.log({
            category: AuditCategory.RSI_SYNC,
            action,
            severity: success ? AuditSeverity.LOW : AuditSeverity.HIGH,
            message: `RSI sync ${action}: ${success ? 'success' : 'failure'}`,
            organizationId,
            metadata: { ...metadata, success },
        });
    }
    logSecurityEvent(action, message, severity = AuditSeverity.HIGH, metadata) {
        return this.log({
            category: AuditCategory.SYSTEM,
            action,
            severity,
            message,
            metadata,
        });
    }
    query(filter = {}) {
        const entries = this.getBufferEntries();
        let filtered = entries;
        if (filter.userId) {
            filtered = filtered.filter(e => e.userId === filter.userId);
        }
        if (filter.organizationId) {
            filtered = filtered.filter(e => e.organizationId === filter.organizationId);
        }
        if (filter.category) {
            filtered = filtered.filter(e => e.category === filter.category);
        }
        if (filter.action) {
            filtered = filtered.filter(e => e.action === filter.action);
        }
        if (filter.severity) {
            filtered = filtered.filter(e => e.severity === filter.severity);
        }
        if (filter.correlationId) {
            filtered = filtered.filter(e => e.correlationId === filter.correlationId);
        }
        if (filter.startDate) {
            const start = filter.startDate.getTime();
            filtered = filtered.filter(e => e.timestamp.getTime() >= start);
        }
        if (filter.endDate) {
            const end = filter.endDate.getTime();
            filtered = filtered.filter(e => e.timestamp.getTime() <= end);
        }
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const offset = filter.offset || 0;
        const limit = filter.limit || 100;
        return filtered.slice(offset, offset + limit);
    }
    getById(id) {
        return this.getBufferEntries().find(e => e.id === id);
    }
    getStatistics(organizationId) {
        let entries = this.getBufferEntries();
        if (organizationId) {
            entries = entries.filter(e => e.organizationId === organizationId);
        }
        const byCategory = {};
        const bySeverity = {};
        const userIds = new Set();
        let earliest = null;
        let latest = null;
        for (const entry of entries) {
            byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
            if (entry.severity) {
                bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
            }
            if (entry.userId) {
                userIds.add(entry.userId);
            }
            if (!earliest || entry.timestamp < earliest) {
                earliest = entry.timestamp;
            }
            if (!latest || entry.timestamp > latest) {
                latest = entry.timestamp;
            }
        }
        return {
            totalEvents: entries.length,
            byCategory,
            bySeverity,
            uniqueUsers: userIds.size,
            timeRange: { earliest, latest },
        };
    }
    getEntryCount() {
        return this.bufferCount;
    }
    clear() {
        if (process.env.NODE_ENV === 'test') {
            this.buffer = new Array(this.bufferSize).fill(null);
            this.bufferHead = 0;
            this.bufferCount = 0;
        }
    }
    bufferPush(entry) {
        this.buffer[this.bufferHead] = entry;
        this.bufferHead = (this.bufferHead + 1) % this.bufferSize;
        if (this.bufferCount < this.bufferSize) {
            this.bufferCount++;
        }
    }
    getBufferEntries() {
        const entries = [];
        for (let i = 0; i < this.bufferCount; i++) {
            const idx = (this.bufferHead - 1 - i + this.bufferSize) % this.bufferSize;
            const entry = this.buffer[idx];
            if (entry) {
                entries.push(entry);
            }
        }
        return entries;
    }
}
exports.AuditService = AuditService;
exports.auditService = AuditService.getInstance();
var auditLogger_2 = require("../../utils/auditLogger");
Object.defineProperty(exports, "AuditEventType", { enumerable: true, get: function () { return auditLogger_2.AuditEventType; } });
//# sourceMappingURL=AuditService.js.map