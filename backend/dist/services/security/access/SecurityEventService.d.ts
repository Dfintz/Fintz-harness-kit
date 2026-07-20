import { EventEmitter } from 'events';
export declare enum SecurityEventSeverity {
    INFO = "info",
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum SecurityEventCategory {
    AUTHENTICATION = "authentication",
    AUTHORIZATION = "authorization",
    DATA_ACCESS = "data_access",
    DATA_MODIFICATION = "data_modification",
    ACCOUNT_MANAGEMENT = "account_management",
    SECURITY_CONFIGURATION = "security_configuration",
    NETWORK = "network",
    SYSTEM = "system",
    COMPLIANCE = "compliance",
    ANOMALY = "anomaly"
}
export declare enum SecurityEventType {
    LOGIN_SUCCESS = "auth.login.success",
    LOGIN_FAILURE = "auth.login.failure",
    LOGIN_BLOCKED = "auth.login.blocked",
    LOGOUT = "auth.logout",
    PASSWORD_CHANGED = "auth.password.changed",
    PASSWORD_RESET_REQUESTED = "auth.password.reset_requested",
    PASSWORD_RESET_COMPLETED = "auth.password.reset_completed",
    TWO_FACTOR_ENABLED = "auth.2fa.enabled",
    TWO_FACTOR_DISABLED = "auth.2fa.disabled",
    TWO_FACTOR_FAILURE = "auth.2fa.failure",
    SESSION_CREATED = "auth.session.created",
    SESSION_EXPIRED = "auth.session.expired",
    SESSION_TERMINATED = "auth.session.terminated",
    ACCESS_GRANTED = "authz.access.granted",
    ACCESS_DENIED = "authz.access.denied",
    PERMISSION_ESCALATION = "authz.permission.escalation",
    ROLE_CHANGED = "authz.role.changed",
    ACCOUNT_CREATED = "account.created",
    ACCOUNT_MODIFIED = "account.modified",
    ACCOUNT_DELETED = "account.deleted",
    ACCOUNT_LOCKED = "account.locked",
    ACCOUNT_UNLOCKED = "account.unlocked",
    SENSITIVE_DATA_ACCESSED = "data.sensitive.accessed",
    DATA_EXPORTED = "data.exported",
    DATA_DELETED = "data.deleted",
    SECURITY_SETTING_CHANGED = "security.setting.changed",
    API_KEY_CREATED = "security.apikey.created",
    API_KEY_REVOKED = "security.apikey.revoked",
    DEVICE_REGISTERED = "device.registered",
    DEVICE_REVOKED = "device.revoked",
    UNKNOWN_DEVICE_DETECTED = "device.unknown.detected",
    RATE_LIMIT_EXCEEDED = "network.ratelimit.exceeded",
    SUSPICIOUS_REQUEST = "network.suspicious.request",
    BLOCKED_IP = "network.ip.blocked",
    GDPR_CONSENT_GRANTED = "compliance.gdpr.consent.granted",
    GDPR_CONSENT_REVOKED = "compliance.gdpr.consent.revoked",
    GDPR_DATA_EXPORT = "compliance.gdpr.data.export",
    GDPR_DATA_DELETION = "compliance.gdpr.data.deletion",
    BRUTE_FORCE_DETECTED = "anomaly.bruteforce.detected",
    UNUSUAL_ACTIVITY = "anomaly.unusual.activity",
    SUSPICIOUS_PATTERN = "anomaly.suspicious.pattern"
}
export interface SecurityEvent {
    id: string;
    timestamp: Date;
    type: SecurityEventType;
    category: SecurityEventCategory;
    severity: SecurityEventSeverity;
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    outcome: 'success' | 'failure' | 'blocked';
    message: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
    sessionId?: string;
    organizationId?: string;
}
export interface AlertThreshold {
    eventType: SecurityEventType;
    count: number;
    windowMs: number;
    severity: SecurityEventSeverity;
}
export declare class SecurityEventService extends EventEmitter {
    private events;
    private eventCounts;
    private maxEventsInMemory;
    private alertThresholds;
    constructor();
    logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): SecurityEvent;
    logAuthEvent(type: SecurityEventType, outcome: SecurityEvent['outcome'], details: {
        userId?: string;
        username?: string;
        ipAddress?: string;
        userAgent?: string;
        message: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent;
    logAuthzEvent(type: SecurityEventType, outcome: SecurityEvent['outcome'], details: {
        userId?: string;
        username?: string;
        resource?: string;
        action?: string;
        message: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent;
    logDataEvent(type: SecurityEventType, details: {
        userId?: string;
        resource: string;
        action: string;
        message: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent;
    logComplianceEvent(type: SecurityEventType, details: {
        userId?: string;
        message: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent;
    logAnomalyEvent(type: SecurityEventType, details: {
        userId?: string;
        ipAddress?: string;
        message: string;
        severity?: SecurityEventSeverity;
        metadata?: Record<string, unknown>;
    }): SecurityEvent;
    getRecentEvents(limit?: number, filter?: {
        category?: SecurityEventCategory;
        severity?: SecurityEventSeverity;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
    }): SecurityEvent[];
    getEventStatistics(windowMs?: number): {
        total: number;
        bySeverity: Record<SecurityEventSeverity, number>;
        byCategory: Record<SecurityEventCategory, number>;
        topEventTypes: Array<{
            type: SecurityEventType;
            count: number;
        }>;
    };
    exportEvents(format?: 'json' | 'cef' | 'leef', events?: SecurityEvent[]): string;
    private toCEF;
    private toLEEF;
    private generateEventId;
    private logToWinston;
    private getLogLevel;
    private getSeverityForAuthEvent;
    private checkAlertThresholds;
    setAlertThresholds(thresholds: AlertThreshold[]): void;
    addAlertThreshold(threshold: AlertThreshold): void;
}
export declare const getSecurityEventService: () => SecurityEventService;
//# sourceMappingURL=SecurityEventService.d.ts.map