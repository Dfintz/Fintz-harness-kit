"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecurityEventService = exports.SecurityEventService = exports.SecurityEventType = exports.SecurityEventCategory = exports.SecurityEventSeverity = void 0;
const events_1 = require("events");
const logger_1 = require("../../../utils/logger");
var SecurityEventSeverity;
(function (SecurityEventSeverity) {
    SecurityEventSeverity["INFO"] = "info";
    SecurityEventSeverity["LOW"] = "low";
    SecurityEventSeverity["MEDIUM"] = "medium";
    SecurityEventSeverity["HIGH"] = "high";
    SecurityEventSeverity["CRITICAL"] = "critical";
})(SecurityEventSeverity || (exports.SecurityEventSeverity = SecurityEventSeverity = {}));
var SecurityEventCategory;
(function (SecurityEventCategory) {
    SecurityEventCategory["AUTHENTICATION"] = "authentication";
    SecurityEventCategory["AUTHORIZATION"] = "authorization";
    SecurityEventCategory["DATA_ACCESS"] = "data_access";
    SecurityEventCategory["DATA_MODIFICATION"] = "data_modification";
    SecurityEventCategory["ACCOUNT_MANAGEMENT"] = "account_management";
    SecurityEventCategory["SECURITY_CONFIGURATION"] = "security_configuration";
    SecurityEventCategory["NETWORK"] = "network";
    SecurityEventCategory["SYSTEM"] = "system";
    SecurityEventCategory["COMPLIANCE"] = "compliance";
    SecurityEventCategory["ANOMALY"] = "anomaly";
})(SecurityEventCategory || (exports.SecurityEventCategory = SecurityEventCategory = {}));
var SecurityEventType;
(function (SecurityEventType) {
    SecurityEventType["LOGIN_SUCCESS"] = "auth.login.success";
    SecurityEventType["LOGIN_FAILURE"] = "auth.login.failure";
    SecurityEventType["LOGIN_BLOCKED"] = "auth.login.blocked";
    SecurityEventType["LOGOUT"] = "auth.logout";
    SecurityEventType["PASSWORD_CHANGED"] = "auth.password.changed";
    SecurityEventType["PASSWORD_RESET_REQUESTED"] = "auth.password.reset_requested";
    SecurityEventType["PASSWORD_RESET_COMPLETED"] = "auth.password.reset_completed";
    SecurityEventType["TWO_FACTOR_ENABLED"] = "auth.2fa.enabled";
    SecurityEventType["TWO_FACTOR_DISABLED"] = "auth.2fa.disabled";
    SecurityEventType["TWO_FACTOR_FAILURE"] = "auth.2fa.failure";
    SecurityEventType["SESSION_CREATED"] = "auth.session.created";
    SecurityEventType["SESSION_EXPIRED"] = "auth.session.expired";
    SecurityEventType["SESSION_TERMINATED"] = "auth.session.terminated";
    SecurityEventType["ACCESS_GRANTED"] = "authz.access.granted";
    SecurityEventType["ACCESS_DENIED"] = "authz.access.denied";
    SecurityEventType["PERMISSION_ESCALATION"] = "authz.permission.escalation";
    SecurityEventType["ROLE_CHANGED"] = "authz.role.changed";
    SecurityEventType["ACCOUNT_CREATED"] = "account.created";
    SecurityEventType["ACCOUNT_MODIFIED"] = "account.modified";
    SecurityEventType["ACCOUNT_DELETED"] = "account.deleted";
    SecurityEventType["ACCOUNT_LOCKED"] = "account.locked";
    SecurityEventType["ACCOUNT_UNLOCKED"] = "account.unlocked";
    SecurityEventType["SENSITIVE_DATA_ACCESSED"] = "data.sensitive.accessed";
    SecurityEventType["DATA_EXPORTED"] = "data.exported";
    SecurityEventType["DATA_DELETED"] = "data.deleted";
    SecurityEventType["SECURITY_SETTING_CHANGED"] = "security.setting.changed";
    SecurityEventType["API_KEY_CREATED"] = "security.apikey.created";
    SecurityEventType["API_KEY_REVOKED"] = "security.apikey.revoked";
    SecurityEventType["DEVICE_REGISTERED"] = "device.registered";
    SecurityEventType["DEVICE_REVOKED"] = "device.revoked";
    SecurityEventType["UNKNOWN_DEVICE_DETECTED"] = "device.unknown.detected";
    SecurityEventType["RATE_LIMIT_EXCEEDED"] = "network.ratelimit.exceeded";
    SecurityEventType["SUSPICIOUS_REQUEST"] = "network.suspicious.request";
    SecurityEventType["BLOCKED_IP"] = "network.ip.blocked";
    SecurityEventType["GDPR_CONSENT_GRANTED"] = "compliance.gdpr.consent.granted";
    SecurityEventType["GDPR_CONSENT_REVOKED"] = "compliance.gdpr.consent.revoked";
    SecurityEventType["GDPR_DATA_EXPORT"] = "compliance.gdpr.data.export";
    SecurityEventType["GDPR_DATA_DELETION"] = "compliance.gdpr.data.deletion";
    SecurityEventType["BRUTE_FORCE_DETECTED"] = "anomaly.bruteforce.detected";
    SecurityEventType["UNUSUAL_ACTIVITY"] = "anomaly.unusual.activity";
    SecurityEventType["SUSPICIOUS_PATTERN"] = "anomaly.suspicious.pattern";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
class SecurityEventService extends events_1.EventEmitter {
    events = [];
    eventCounts = new Map();
    maxEventsInMemory = 10000;
    alertThresholds = [
        { eventType: SecurityEventType.LOGIN_FAILURE, count: 5, windowMs: 300000, severity: SecurityEventSeverity.MEDIUM },
        { eventType: SecurityEventType.LOGIN_BLOCKED, count: 3, windowMs: 600000, severity: SecurityEventSeverity.HIGH },
        { eventType: SecurityEventType.BRUTE_FORCE_DETECTED, count: 1, windowMs: 60000, severity: SecurityEventSeverity.CRITICAL },
        { eventType: SecurityEventType.ACCESS_DENIED, count: 10, windowMs: 300000, severity: SecurityEventSeverity.MEDIUM },
        { eventType: SecurityEventType.RATE_LIMIT_EXCEEDED, count: 3, windowMs: 60000, severity: SecurityEventSeverity.LOW },
        { eventType: SecurityEventType.UNKNOWN_DEVICE_DETECTED, count: 3, windowMs: 3600000, severity: SecurityEventSeverity.MEDIUM },
    ];
    constructor() {
        super();
        logger_1.logger.info('SecurityEventService initialized - SIEM integration ready');
    }
    logEvent(event) {
        const fullEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: new Date()
        };
        this.events.push(fullEvent);
        if (this.events.length > this.maxEventsInMemory) {
            this.events = this.events.slice(-this.maxEventsInMemory);
        }
        this.logToWinston(fullEvent);
        this.checkAlertThresholds(fullEvent);
        this.emit('security-event', fullEvent);
        return fullEvent;
    }
    logAuthEvent(type, outcome, details) {
        return this.logEvent({
            type,
            category: SecurityEventCategory.AUTHENTICATION,
            severity: this.getSeverityForAuthEvent(type, outcome),
            outcome,
            ...details
        });
    }
    logAuthzEvent(type, outcome, details) {
        return this.logEvent({
            type,
            category: SecurityEventCategory.AUTHORIZATION,
            severity: type === SecurityEventType.ACCESS_DENIED ? SecurityEventSeverity.MEDIUM : SecurityEventSeverity.INFO,
            outcome,
            ...details
        });
    }
    logDataEvent(type, details) {
        return this.logEvent({
            type,
            category: SecurityEventCategory.DATA_ACCESS,
            severity: type === SecurityEventType.SENSITIVE_DATA_ACCESSED ? SecurityEventSeverity.MEDIUM : SecurityEventSeverity.INFO,
            outcome: 'success',
            ...details
        });
    }
    logComplianceEvent(type, details) {
        return this.logEvent({
            type,
            category: SecurityEventCategory.COMPLIANCE,
            severity: SecurityEventSeverity.INFO,
            outcome: 'success',
            ...details
        });
    }
    logAnomalyEvent(type, details) {
        return this.logEvent({
            type,
            category: SecurityEventCategory.ANOMALY,
            severity: details.severity || SecurityEventSeverity.HIGH,
            outcome: 'blocked',
            ...details
        });
    }
    getRecentEvents(limit = 100, filter) {
        let filtered = [...this.events];
        if (filter) {
            if (filter.category) {
                filtered = filtered.filter(e => e.category === filter.category);
            }
            if (filter.severity) {
                filtered = filtered.filter(e => e.severity === filter.severity);
            }
            if (filter.userId) {
                filtered = filtered.filter(e => e.userId === filter.userId);
            }
            if (filter.startDate) {
                filtered = filtered.filter(e => e.timestamp >= filter.startDate);
            }
            if (filter.endDate) {
                filtered = filtered.filter(e => e.timestamp <= filter.endDate);
            }
        }
        return filtered.slice(-limit).reverse();
    }
    getEventStatistics(windowMs = 3600000) {
        const windowStart = Date.now() - windowMs;
        const recentEvents = this.events.filter(e => e.timestamp.getTime() >= windowStart);
        const bySeverity = {
            [SecurityEventSeverity.INFO]: 0,
            [SecurityEventSeverity.LOW]: 0,
            [SecurityEventSeverity.MEDIUM]: 0,
            [SecurityEventSeverity.HIGH]: 0,
            [SecurityEventSeverity.CRITICAL]: 0
        };
        const byCategory = {
            [SecurityEventCategory.AUTHENTICATION]: 0,
            [SecurityEventCategory.AUTHORIZATION]: 0,
            [SecurityEventCategory.DATA_ACCESS]: 0,
            [SecurityEventCategory.DATA_MODIFICATION]: 0,
            [SecurityEventCategory.ACCOUNT_MANAGEMENT]: 0,
            [SecurityEventCategory.SECURITY_CONFIGURATION]: 0,
            [SecurityEventCategory.NETWORK]: 0,
            [SecurityEventCategory.SYSTEM]: 0,
            [SecurityEventCategory.COMPLIANCE]: 0,
            [SecurityEventCategory.ANOMALY]: 0
        };
        const byType = new Map();
        for (const event of recentEvents) {
            bySeverity[event.severity]++;
            byCategory[event.category]++;
            byType.set(event.type, (byType.get(event.type) || 0) + 1);
        }
        const topEventTypes = Array.from(byType.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            total: recentEvents.length,
            bySeverity,
            byCategory,
            topEventTypes
        };
    }
    exportEvents(format = 'json', events) {
        const eventsToExport = events || this.events;
        switch (format) {
            case 'cef':
                return eventsToExport.map(e => this.toCEF(e)).join('\n');
            case 'leef':
                return eventsToExport.map(e => this.toLEEF(e)).join('\n');
            default:
                return JSON.stringify(eventsToExport, null, 2);
        }
    }
    toCEF(event) {
        const severityMap = {
            [SecurityEventSeverity.INFO]: 1,
            [SecurityEventSeverity.LOW]: 3,
            [SecurityEventSeverity.MEDIUM]: 5,
            [SecurityEventSeverity.HIGH]: 7,
            [SecurityEventSeverity.CRITICAL]: 10
        };
        const cefSeverity = severityMap[event.severity];
        const extension = [
            `src=${event.ipAddress || ''}`,
            `suser=${event.username || ''}`,
            `msg=${event.message}`,
            `outcome=${event.outcome}`,
            `cs1=${event.userId || ''}`,
            `cs1Label=userId`
        ].join(' ');
        return `CEF:0|SCFleetManager|SecurityMonitor|1.0|${event.type}|${event.message}|${cefSeverity}|${extension}`;
    }
    toLEEF(event) {
        const attrs = [
            `devTime=${event.timestamp.toISOString()}`,
            `src=${event.ipAddress || ''}`,
            `usrName=${event.username || ''}`,
            `msg=${event.message}`,
            `severity=${event.severity}`,
            `cat=${event.category}`
        ].join('\t');
        return `LEEF:2.0|SCFleetManager|SecurityMonitor|1.0|${event.type}|${attrs}`;
    }
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    logToWinston(event) {
        const logLevel = this.getLogLevel(event.severity);
        logger_1.logger[logLevel](`[SECURITY] ${event.type}: ${event.message}`, {
            eventId: event.id,
            category: event.category,
            severity: event.severity,
            userId: event.userId,
            ipAddress: event.ipAddress,
            outcome: event.outcome,
            metadata: event.metadata
        });
    }
    getLogLevel(severity) {
        switch (severity) {
            case SecurityEventSeverity.CRITICAL:
            case SecurityEventSeverity.HIGH:
                return 'error';
            case SecurityEventSeverity.MEDIUM:
                return 'warn';
            default:
                return 'info';
        }
    }
    getSeverityForAuthEvent(type, outcome) {
        if (outcome === 'blocked') {
            return SecurityEventSeverity.HIGH;
        }
        switch (type) {
            case SecurityEventType.LOGIN_FAILURE:
                return SecurityEventSeverity.LOW;
            case SecurityEventType.LOGIN_BLOCKED:
                return SecurityEventSeverity.HIGH;
            case SecurityEventType.TWO_FACTOR_FAILURE:
                return SecurityEventSeverity.MEDIUM;
            case SecurityEventType.BRUTE_FORCE_DETECTED:
                return SecurityEventSeverity.CRITICAL;
            default:
                return SecurityEventSeverity.INFO;
        }
    }
    checkAlertThresholds(event) {
        for (const threshold of this.alertThresholds) {
            if (event.type !== threshold.eventType) {
                continue;
            }
            const key = `${threshold.eventType}:${event.userId || event.ipAddress || 'global'}`;
            const now = Date.now();
            const entry = this.eventCounts.get(key);
            if (!entry || now - entry.windowStart > threshold.windowMs) {
                this.eventCounts.set(key, { count: 1, windowStart: now });
            }
            else {
                entry.count++;
                if (entry.count >= threshold.count) {
                    this.emit('security-alert', {
                        threshold,
                        event,
                        count: entry.count,
                        message: `Alert threshold exceeded: ${threshold.count} ${threshold.eventType} events in ${threshold.windowMs / 1000}s`
                    });
                    logger_1.logger.warn(`[SECURITY ALERT] Threshold exceeded for ${threshold.eventType}`, {
                        threshold,
                        count: entry.count,
                        userId: event.userId,
                        ipAddress: event.ipAddress
                    });
                }
            }
        }
    }
    setAlertThresholds(thresholds) {
        this.alertThresholds = thresholds;
    }
    addAlertThreshold(threshold) {
        this.alertThresholds.push(threshold);
    }
}
exports.SecurityEventService = SecurityEventService;
let instance = null;
const getSecurityEventService = () => {
    if (!instance) {
        instance = new SecurityEventService();
    }
    return instance;
};
exports.getSecurityEventService = getSecurityEventService;
//# sourceMappingURL=SecurityEventService.js.map