"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSecurityLogService = exports.SecuritySeverity = exports.SecurityEventType = void 0;
const logger_1 = require("../../utils/logger");
const DataObfuscationService_1 = require("./DataObfuscationService");
var SecurityEventType;
(function (SecurityEventType) {
    SecurityEventType["LOGIN_SUCCESS"] = "login_success";
    SecurityEventType["LOGIN_FAILURE"] = "login_failure";
    SecurityEventType["LOGOUT"] = "logout";
    SecurityEventType["PASSWORD_CHANGE"] = "password_change";
    SecurityEventType["PASSWORD_RESET"] = "password_reset";
    SecurityEventType["PERMISSION_GRANTED"] = "permission_granted";
    SecurityEventType["PERMISSION_DENIED"] = "permission_denied";
    SecurityEventType["ROLE_CHANGED"] = "role_changed";
    SecurityEventType["DATA_ACCESSED"] = "data_accessed";
    SecurityEventType["DATA_MODIFIED"] = "data_modified";
    SecurityEventType["DATA_DELETED"] = "data_deleted";
    SecurityEventType["DATA_EXPORTED"] = "data_exported";
    SecurityEventType["BRUTE_FORCE_ATTEMPT"] = "brute_force_attempt";
    SecurityEventType["SUSPICIOUS_ACTIVITY"] = "suspicious_activity";
    SecurityEventType["API_RATE_LIMIT_EXCEEDED"] = "api_rate_limit_exceeded";
    SecurityEventType["INVALID_TOKEN"] = "invalid_token";
    SecurityEventType["ADMIN_ACTION"] = "admin_action";
    SecurityEventType["FEATURE_FLAG_CHANGED"] = "feature_flag_changed";
    SecurityEventType["CONFIGURATION_CHANGED"] = "configuration_changed";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
var SecuritySeverity;
(function (SecuritySeverity) {
    SecuritySeverity["INFO"] = "info";
    SecuritySeverity["WARNING"] = "warning";
    SecuritySeverity["CRITICAL"] = "critical";
})(SecuritySeverity || (exports.SecuritySeverity = SecuritySeverity = {}));
class SecurityEventStore {
    events = [];
    maxEvents = 10000;
    add(event) {
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
    }
    getAll(limit) {
        if (limit) {
            return this.events.slice(-limit);
        }
        return [...this.events];
    }
    getByType(type, limit) {
        const filtered = this.events.filter(e => e.type === type);
        return limit ? filtered.slice(-limit) : filtered;
    }
    getBySeverity(severity, limit) {
        const filtered = this.events.filter(e => e.severity === severity);
        return limit ? filtered.slice(-limit) : filtered;
    }
    getInTimeRange(start, end) {
        return this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
    }
}
const eventStore = new SecurityEventStore();
class AdminSecurityLogService {
    static logEvent(type, userId, action, outcome, options = {}) {
        const severity = this.determineSeverity(type, outcome);
        const event = {
            id: this.generateEventId(),
            timestamp: new Date(),
            type,
            severity,
            userHash: DataObfuscationService_1.DataObfuscationService.hash(userId),
            organizationHash: options.organizationId
                ? DataObfuscationService_1.DataObfuscationService.hash(options.organizationId)
                : undefined,
            action,
            resource: options.resource,
            outcome,
            ipAddress: options.ipAddress ? this.maskIpAddress(options.ipAddress) : undefined,
            userAgent: options.userAgent ? this.sanitizeUserAgent(options.userAgent) : undefined,
            details: options.details ? this.sanitizeDetails(options.details) : {}
        };
        eventStore.add(event);
        logger_1.logger.info('Security event', {
            type,
            severity,
            action,
            outcome
        });
    }
    static getRecentEvents(limit = 100) {
        return eventStore.getAll(limit);
    }
    static getEventsByType(type, limit) {
        return eventStore.getByType(type, limit);
    }
    static getEventsBySeverity(severity, limit) {
        return eventStore.getBySeverity(severity, limit);
    }
    static getLogSummary(period = '24h') {
        const now = new Date();
        const periodMs = period === '24h' ? 24 * 60 * 60 * 1000 :
            period === '7d' ? 7 * 24 * 60 * 60 * 1000 :
                30 * 24 * 60 * 60 * 1000;
        const start = new Date(now.getTime() - periodMs);
        const events = eventStore.getInTimeRange(start, now);
        const byType = {};
        Object.values(SecurityEventType).forEach(type => {
            byType[type] = events.filter(e => e.type === type).length;
        });
        const bySeverity = {
            [SecuritySeverity.INFO]: events.filter(e => e.severity === SecuritySeverity.INFO).length,
            [SecuritySeverity.WARNING]: events.filter(e => e.severity === SecuritySeverity.WARNING).length,
            [SecuritySeverity.CRITICAL]: events.filter(e => e.severity === SecuritySeverity.CRITICAL).length
        };
        const topEvents = Object.entries(byType)
            .map(([type, count]) => ({ type: type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const suspiciousActivity = {
            bruteForceAttempts: byType[SecurityEventType.BRUTE_FORCE_ATTEMPT] || 0,
            rateLimitExceeded: byType[SecurityEventType.API_RATE_LIMIT_EXCEEDED] || 0,
            invalidTokens: byType[SecurityEventType.INVALID_TOKEN] || 0,
            total: (byType[SecurityEventType.BRUTE_FORCE_ATTEMPT] || 0) +
                (byType[SecurityEventType.API_RATE_LIMIT_EXCEEDED] || 0) +
                (byType[SecurityEventType.INVALID_TOKEN] || 0) +
                (byType[SecurityEventType.SUSPICIOUS_ACTIVITY] || 0)
        };
        const authenticationStats = {
            successfulLogins: byType[SecurityEventType.LOGIN_SUCCESS] || 0,
            failedLogins: byType[SecurityEventType.LOGIN_FAILURE] || 0,
            passwordResets: byType[SecurityEventType.PASSWORD_RESET] || 0
        };
        const authorizationStats = {
            permissionDenials: byType[SecurityEventType.PERMISSION_DENIED] || 0,
            roleChanges: byType[SecurityEventType.ROLE_CHANGED] || 0
        };
        return {
            period,
            totalEvents: events.length,
            byType,
            bySeverity,
            topEvents,
            suspiciousActivity,
            authenticationStats,
            authorizationStats
        };
    }
    static searchEvents(criteria) {
        let events = eventStore.getAll();
        if (criteria.type) {
            events = events.filter(e => e.type === criteria.type);
        }
        if (criteria.severity) {
            events = events.filter(e => e.severity === criteria.severity);
        }
        if (criteria.userHash) {
            events = events.filter(e => e.userHash === criteria.userHash);
        }
        if (criteria.organizationHash) {
            events = events.filter(e => e.organizationHash === criteria.organizationHash);
        }
        if (criteria.startDate) {
            events = events.filter(e => e.timestamp >= criteria.startDate);
        }
        if (criteria.endDate) {
            events = events.filter(e => e.timestamp <= criteria.endDate);
        }
        return events;
    }
    static determineSeverity(type, outcome) {
        if ([
            SecurityEventType.BRUTE_FORCE_ATTEMPT,
            SecurityEventType.SUSPICIOUS_ACTIVITY,
            SecurityEventType.DATA_DELETED
        ].includes(type)) {
            return SecuritySeverity.CRITICAL;
        }
        if ([
            SecurityEventType.LOGIN_FAILURE,
            SecurityEventType.PERMISSION_DENIED,
            SecurityEventType.API_RATE_LIMIT_EXCEEDED,
            SecurityEventType.INVALID_TOKEN
        ].includes(type) || outcome === 'failure') {
            return SecuritySeverity.WARNING;
        }
        return SecuritySeverity.INFO;
    }
    static maskIpAddress(ip) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
        }
        return 'xxx.xxx.xxx.xxx';
    }
    static sanitizeUserAgent(userAgent) {
        if (userAgent.includes('Chrome')) {
            return 'Chrome/Desktop';
        }
        if (userAgent.includes('Firefox')) {
            return 'Firefox/Desktop';
        }
        if (userAgent.includes('Safari')) {
            return 'Safari/Desktop';
        }
        if (userAgent.includes('Edge')) {
            return 'Edge/Desktop';
        }
        if (userAgent.includes('Mobile')) {
            return 'Mobile Browser';
        }
        return 'Unknown Browser';
    }
    static sanitizeDetails(details) {
        const sanitized = {};
        for (const [key, value] of Object.entries(details)) {
            if (['password', 'token', 'secret', 'apiKey'].some(s => key.toLowerCase().includes(s))) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = '[OBJECT]';
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    static generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.AdminSecurityLogService = AdminSecurityLogService;
//# sourceMappingURL=AdminSecurityLogService.js.map