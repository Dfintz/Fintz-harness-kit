import winston from 'winston';
export declare const auditLogger: winston.Logger;
export declare enum AuditEventType {
    AUTH_SUCCESS = "AUTH_SUCCESS",
    AUTH_FAILURE = "AUTH_FAILURE",
    AUTH_MISSING_TOKEN = "AUTH_MISSING_TOKEN",
    AUTHZ_FAILURE = "AUTHZ_FAILURE",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    PERMISSION_GRANTED = "PERMISSION_GRANTED",
    PERMISSION_REVOKED = "PERMISSION_REVOKED",
    SENSITIVE_DATA_ACCESS = "SENSITIVE_DATA_ACCESS",
    SECURITY_LEVEL_CHANGED = "SECURITY_LEVEL_CHANGED",
    ACTIVITY_ACTION = "ACTIVITY_ACTION",
    BOT_TEAM_CREATED = "BOT_TEAM_CREATED",
    DISCORD_MESSAGE_DELETED = "DISCORD_MESSAGE_DELETED",
    DISCORD_MESSAGE_EDITED = "DISCORD_MESSAGE_EDITED",
    DISCORD_ROLE_CHANGED = "DISCORD_ROLE_CHANGED",
    DISCORD_CHANNEL_CREATED = "DISCORD_CHANNEL_CREATED",
    DISCORD_CHANNEL_DELETED = "DISCORD_CHANNEL_DELETED",
    DISCORD_MEMBER_JOINED = "DISCORD_MEMBER_JOINED",
    DISCORD_MEMBER_LEFT = "DISCORD_MEMBER_LEFT"
}
export interface AuditLogEntry {
    eventType: AuditEventType;
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    statusCode?: number;
    message: string;
    metadata?: Record<string, unknown>;
}
export declare const logAuditEvent: (entry: AuditLogEntry) => void;
export declare const logAuthenticationAttempt: (success: boolean, userId: string | undefined, username: string | undefined, ipAddress: string | undefined, userAgent: string | undefined, reason?: string) => void;
export interface LogPermissionDenialOptions {
    username?: string;
    resource: string;
    action: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    resourceId?: string;
    scope?: string;
}
export declare const logPermissionDenial: (userId: string, options: LogPermissionDenialOptions) => void;
export declare const logAuthorizationFailure: (userId: string, username: string, role: string, resource: string, action: string, ipAddress: string | undefined, userAgent: string | undefined) => void;
export declare const logSensitiveDataAccess: (userId: string, username: string, resource: string, action: string, ipAddress: string | undefined, userAgent: string | undefined, metadata?: Record<string, unknown>) => void;
//# sourceMappingURL=auditLogger.d.ts.map