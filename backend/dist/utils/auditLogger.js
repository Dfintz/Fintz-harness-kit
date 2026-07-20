"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSensitiveDataAccess = exports.logAuthorizationFailure = exports.logPermissionDenial = exports.logAuthenticationAttempt = exports.logAuditEvent = exports.AuditEventType = exports.auditLogger = void 0;
const node_path_1 = __importDefault(require("node:path"));
const winston_1 = __importDefault(require("winston"));
const auditLogFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const logsDir = node_path_1.default.join(process.cwd(), 'logs');
const AUDIT_LOG_MAX_SIZE = Number.parseInt(process.env.AUDIT_LOG_MAX_SIZE || '10485760', 10);
const AUDIT_LOG_MAX_FILES = Number.parseInt(process.env.AUDIT_LOG_MAX_FILES || '30', 10);
exports.auditLogger = winston_1.default.createLogger({
    level: 'info',
    format: auditLogFormat,
    defaultMeta: { service: 'sc-fleet-manager-audit' },
    transports: [
        new winston_1.default.transports.File({
            filename: node_path_1.default.join(logsDir, 'audit.log'),
            maxsize: AUDIT_LOG_MAX_SIZE,
            maxFiles: AUDIT_LOG_MAX_FILES,
        }),
    ],
});
if (process.env.NODE_ENV === 'test') {
    exports.auditLogger.transports.forEach(transport => {
        transport.silent = true;
    });
}
var AuditEventType;
(function (AuditEventType) {
    AuditEventType["AUTH_SUCCESS"] = "AUTH_SUCCESS";
    AuditEventType["AUTH_FAILURE"] = "AUTH_FAILURE";
    AuditEventType["AUTH_MISSING_TOKEN"] = "AUTH_MISSING_TOKEN";
    AuditEventType["AUTHZ_FAILURE"] = "AUTHZ_FAILURE";
    AuditEventType["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    AuditEventType["PERMISSION_GRANTED"] = "PERMISSION_GRANTED";
    AuditEventType["PERMISSION_REVOKED"] = "PERMISSION_REVOKED";
    AuditEventType["SENSITIVE_DATA_ACCESS"] = "SENSITIVE_DATA_ACCESS";
    AuditEventType["SECURITY_LEVEL_CHANGED"] = "SECURITY_LEVEL_CHANGED";
    AuditEventType["ACTIVITY_ACTION"] = "ACTIVITY_ACTION";
    AuditEventType["BOT_TEAM_CREATED"] = "BOT_TEAM_CREATED";
    AuditEventType["DISCORD_MESSAGE_DELETED"] = "DISCORD_MESSAGE_DELETED";
    AuditEventType["DISCORD_MESSAGE_EDITED"] = "DISCORD_MESSAGE_EDITED";
    AuditEventType["DISCORD_ROLE_CHANGED"] = "DISCORD_ROLE_CHANGED";
    AuditEventType["DISCORD_CHANNEL_CREATED"] = "DISCORD_CHANNEL_CREATED";
    AuditEventType["DISCORD_CHANNEL_DELETED"] = "DISCORD_CHANNEL_DELETED";
    AuditEventType["DISCORD_MEMBER_JOINED"] = "DISCORD_MEMBER_JOINED";
    AuditEventType["DISCORD_MEMBER_LEFT"] = "DISCORD_MEMBER_LEFT";
})(AuditEventType || (exports.AuditEventType = AuditEventType = {}));
const logAuditEvent = (entry) => {
    const logData = {
        timestamp: new Date().toISOString(),
        ...entry,
    };
    exports.auditLogger.info('Audit event', logData);
};
exports.logAuditEvent = logAuditEvent;
const logAuthenticationAttempt = (success, userId, username, ipAddress, userAgent, reason) => {
    (0, exports.logAuditEvent)({
        eventType: success ? AuditEventType.AUTH_SUCCESS : AuditEventType.AUTH_FAILURE,
        userId,
        username,
        ipAddress,
        userAgent,
        message: success
            ? `Authentication successful for user: ${username}`
            : `Authentication failed: ${reason}`,
    });
};
exports.logAuthenticationAttempt = logAuthenticationAttempt;
const logPermissionDenial = (userId, options) => {
    (0, exports.logAuditEvent)({
        eventType: AuditEventType.PERMISSION_DENIED,
        userId,
        username: options.username,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        resource: options.resource,
        action: options.action,
        message: `Permission denied: User ${options.username || userId} attempted ${options.resource}:${options.action}. Reason: ${options.reason || 'Unknown'}`,
        metadata: {
            resource: options.resource,
            action: options.action,
            reason: options.reason,
            resourceId: options.resourceId,
            scope: options.scope,
            timestamp: new Date().toISOString(),
        },
    });
};
exports.logPermissionDenial = logPermissionDenial;
const logAuthorizationFailure = (userId, username, role, resource, action, ipAddress, userAgent) => {
    (0, exports.logAuditEvent)({
        eventType: AuditEventType.AUTHZ_FAILURE,
        userId,
        username,
        ipAddress,
        userAgent,
        resource,
        action,
        message: `Authorization failed: User ${username} (role: ${role}) attempted to access ${resource}`,
        metadata: { role, requiredPermissions: action },
    });
};
exports.logAuthorizationFailure = logAuthorizationFailure;
const logSensitiveDataAccess = (userId, username, resource, action, ipAddress, userAgent, metadata) => {
    (0, exports.logAuditEvent)({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        userId,
        username,
        ipAddress,
        userAgent,
        resource,
        action,
        message: `Sensitive data access: User ${username} performed ${action} on ${resource}`,
        metadata,
    });
};
exports.logSensitiveDataAccess = logSensitiveDataAccess;
//# sourceMappingURL=auditLogger.js.map