import path from 'node:path';

import winston from 'winston';

// Define audit log format
const auditLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logs directory path
const logsDir = path.join(process.cwd(), 'logs');

// Log retention settings from environment or defaults
const AUDIT_LOG_MAX_SIZE = Number.parseInt(process.env.AUDIT_LOG_MAX_SIZE || '10485760', 10); // 10MB default
const AUDIT_LOG_MAX_FILES = Number.parseInt(process.env.AUDIT_LOG_MAX_FILES || '30', 10); // 30 files default (30 days if rotated daily)
// Note: AUDIT_LOG_RETENTION_DAYS reserved for future use in automated cleanup
// const AUDIT_LOG_RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10); // 90 days default

// Configure audit logger with separate file
export const auditLogger = winston.createLogger({
  level: 'info',
  format: auditLogFormat,
  defaultMeta: { service: 'sc-fleet-manager-audit' },
  transports: [
    // Write all audit logs to audit.log
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      maxsize: AUDIT_LOG_MAX_SIZE,
      maxFiles: AUDIT_LOG_MAX_FILES,
    }),
  ],
});

// Suppress audit logs in test environment
if (process.env.NODE_ENV === 'test') {
  auditLogger.transports.forEach(transport => {
    transport.silent = true;
  });
}

// Audit event types
export enum AuditEventType {
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  AUTH_MISSING_TOKEN = 'AUTH_MISSING_TOKEN',
  AUTHZ_FAILURE = 'AUTHZ_FAILURE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  SECURITY_LEVEL_CHANGED = 'SECURITY_LEVEL_CHANGED',
  ACTIVITY_ACTION = 'ACTIVITY_ACTION',
  BOT_TEAM_CREATED = 'BOT_TEAM_CREATED',
  // Discord audit events (unified with web audit trail)
  DISCORD_MESSAGE_DELETED = 'DISCORD_MESSAGE_DELETED',
  DISCORD_MESSAGE_EDITED = 'DISCORD_MESSAGE_EDITED',
  DISCORD_ROLE_CHANGED = 'DISCORD_ROLE_CHANGED',
  DISCORD_CHANNEL_CREATED = 'DISCORD_CHANNEL_CREATED',
  DISCORD_CHANNEL_DELETED = 'DISCORD_CHANNEL_DELETED',
  DISCORD_MEMBER_JOINED = 'DISCORD_MEMBER_JOINED',
  DISCORD_MEMBER_LEFT = 'DISCORD_MEMBER_LEFT',
}

// Audit log entry interface
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

/**
 * Log an audit event
 * @param entry The audit log entry details
 */
export const logAuditEvent = (entry: AuditLogEntry): void => {
  const logData = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  auditLogger.info('Audit event', logData);
};

/**
 * Log authentication attempt
 * @param success Whether authentication was successful
 * @param userId User ID (if successful)
 * @param username Username
 * @param ipAddress IP address of the request
 * @param userAgent User agent string
 * @param reason Failure reason (if applicable)
 */
export const logAuthenticationAttempt = (
  success: boolean,
  userId: string | undefined,
  username: string | undefined,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  reason?: string
): void => {
  logAuditEvent({
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

/**
 * Options for logging permission denial
 */
export interface LogPermissionDenialOptions {
  /** Username (optional) */
  username?: string;
  /** Resource type (e.g., 'fleet', 'ship') */
  resource: string;
  /** Action being denied (e.g., 'edit', 'delete') */
  action: string;
  /** Reason for denial */
  reason?: string;
  /** IP address of the request */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Specific resource ID */
  resourceId?: string;
  /** Organization ID / scope */
  scope?: string;
}

/**
 * Log permission denial (when user lacks required permission)
 * @param userId User ID
 * @param options Permission denial logging options
 */
export const logPermissionDenial = (userId: string, options: LogPermissionDenialOptions): void => {
  logAuditEvent({
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

/**
 * Log authorization failure
 * @param userId User ID
 * @param username Username
 * @param role User role
 * @param resource Resource being accessed
 * @param action Action being performed
 * @param ipAddress IP address of the request
 * @param userAgent User agent string
 */
export const logAuthorizationFailure = (
  userId: string,
  username: string,
  role: string,
  resource: string,
  action: string,
  ipAddress: string | undefined,
  userAgent: string | undefined
): void => {
  logAuditEvent({
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

/**
 * Log sensitive data access
 * @param userId User ID
 * @param username Username
 * @param resource Resource being accessed
 * @param action Action being performed (READ, UPDATE, DELETE)
 * @param ipAddress IP address of the request
 * @param userAgent User agent string
 * @param metadata Additional metadata
 */
export const logSensitiveDataAccess = (
  userId: string,
  username: string,
  resource: string,
  action: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  metadata?: Record<string, unknown>
): void => {
  logAuditEvent({
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
