export declare enum SecurityEventType {
    LOGIN_SUCCESS = "login_success",
    LOGIN_FAILURE = "login_failure",
    LOGOUT = "logout",
    PASSWORD_CHANGE = "password_change",
    PASSWORD_RESET = "password_reset",
    PERMISSION_GRANTED = "permission_granted",
    PERMISSION_DENIED = "permission_denied",
    ROLE_CHANGED = "role_changed",
    DATA_ACCESSED = "data_accessed",
    DATA_MODIFIED = "data_modified",
    DATA_DELETED = "data_deleted",
    DATA_EXPORTED = "data_exported",
    BRUTE_FORCE_ATTEMPT = "brute_force_attempt",
    SUSPICIOUS_ACTIVITY = "suspicious_activity",
    API_RATE_LIMIT_EXCEEDED = "api_rate_limit_exceeded",
    INVALID_TOKEN = "invalid_token",
    ADMIN_ACTION = "admin_action",
    FEATURE_FLAG_CHANGED = "feature_flag_changed",
    CONFIGURATION_CHANGED = "configuration_changed"
}
export declare enum SecuritySeverity {
    INFO = "info",
    WARNING = "warning",
    CRITICAL = "critical"
}
export interface SecurityEvent {
    id: string;
    timestamp: Date;
    type: SecurityEventType;
    severity: SecuritySeverity;
    userHash: string;
    organizationHash?: string;
    action: string;
    resource?: string;
    outcome: 'success' | 'failure';
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    details: Record<string, unknown>;
}
export interface SecurityLogSummary {
    period: string;
    totalEvents: number;
    byType: Record<SecurityEventType, number>;
    bySeverity: Record<SecuritySeverity, number>;
    topEvents: Array<{
        type: SecurityEventType;
        count: number;
    }>;
    suspiciousActivity: {
        bruteForceAttempts: number;
        rateLimitExceeded: number;
        invalidTokens: number;
        total: number;
    };
    authenticationStats: {
        successfulLogins: number;
        failedLogins: number;
        passwordResets: number;
    };
    authorizationStats: {
        permissionDenials: number;
        roleChanges: number;
    };
}
export declare class AdminSecurityLogService {
    static logEvent(type: SecurityEventType, userId: string, action: string, outcome: 'success' | 'failure', options?: {
        organizationId?: string;
        resource?: string;
        ipAddress?: string;
        userAgent?: string;
        details?: Record<string, unknown>;
    }): void;
    static getRecentEvents(limit?: number): SecurityEvent[];
    static getEventsByType(type: SecurityEventType, limit?: number): SecurityEvent[];
    static getEventsBySeverity(severity: SecuritySeverity, limit?: number): SecurityEvent[];
    static getLogSummary(period?: '24h' | '7d' | '30d'): SecurityLogSummary;
    static searchEvents(criteria: {
        type?: SecurityEventType;
        severity?: SecuritySeverity;
        userHash?: string;
        organizationHash?: string;
        startDate?: Date;
        endDate?: Date;
    }): SecurityEvent[];
    private static determineSeverity;
    private static maskIpAddress;
    private static sanitizeUserAgent;
    private static sanitizeDetails;
    private static generateEventId;
}
//# sourceMappingURL=AdminSecurityLogService.d.ts.map