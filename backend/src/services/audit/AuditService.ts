import { randomUUID } from 'crypto';

import { AuditEventType, AuditLogEntry, logAuditEvent } from '../../utils/auditLogger';

/**
 * Unified audit event categories spanning all domains.
 * Maps to the underlying AuditEventType while providing domain-specific granularity.
 */
export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_ACCESS = 'DATA_ACCESS',
  PERMISSION = 'PERMISSION',
  ACTIVITY = 'ACTIVITY',
  ORGANIZATION = 'ORGANIZATION',
  MEMBERSHIP = 'MEMBERSHIP',
  RSI_SYNC = 'RSI_SYNC',
  ENCRYPTION = 'ENCRYPTION',
  INTEL = 'INTEL',
  USER = 'USER',
  ADMIN = 'ADMIN', // H3: New category for admin operations
  SECURITY = 'SECURITY', // H3: New category for security operations
  FLEET = 'FLEET',
  DIPLOMACY = 'DIPLOMACY',
  FEDERATION = 'FEDERATION',
  BOUNTY = 'BOUNTY', // H3: New category for bounty operations
  MINING = 'MINING', // H3: New category for mining operations
  TRADE = 'TRADE', // H3: New category for trade operations
  DISCORD = 'DISCORD',
  GAMIFICATION = 'GAMIFICATION',
  VOICE = 'VOICE',
  SYSTEM = 'SYSTEM',
  APPROVAL = 'APPROVAL', // H3: New category for approval workflow operations
}

/**
 * Severity levels for audit events
 */
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Unified audit event interface used by the facade
 */
export interface AuditEvent {
  category: AuditCategory;
  action: string;
  message: string;
  severity?: AuditSeverity;
  userId?: string;
  username?: string;
  organizationId?: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Stored audit entry with server-generated fields
 */
export interface StoredAuditEntry extends AuditEvent {
  id: string;
  timestamp: Date;
  correlationId: string;
}

/**
 * Filter options for querying audit logs
 */
export interface AuditFilter {
  userId?: string;
  organizationId?: string;
  category?: AuditCategory;
  action?: string;
  severity?: AuditSeverity;
  correlationId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  totalEvents: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  uniqueUsers: number;
  timeRange: { earliest: Date | null; latest: Date | null };
}

// Map AuditCategory to the underlying AuditEventType
const CATEGORY_TO_EVENT_TYPE: Record<AuditCategory, AuditEventType> = {
  [AuditCategory.AUTHENTICATION]: AuditEventType.AUTH_SUCCESS,
  [AuditCategory.AUTHORIZATION]: AuditEventType.AUTHZ_FAILURE,
  [AuditCategory.DATA_ACCESS]: AuditEventType.SENSITIVE_DATA_ACCESS,
  [AuditCategory.PERMISSION]: AuditEventType.PERMISSION_GRANTED,
  [AuditCategory.ACTIVITY]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.ORGANIZATION]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.MEMBERSHIP]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.RSI_SYNC]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.ENCRYPTION]: AuditEventType.SENSITIVE_DATA_ACCESS,
  [AuditCategory.INTEL]: AuditEventType.SENSITIVE_DATA_ACCESS,
  [AuditCategory.USER]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.ADMIN]: AuditEventType.ACTIVITY_ACTION, // H3: New category
  [AuditCategory.SECURITY]: AuditEventType.AUTHZ_FAILURE, // H3: New category (security importance)
  [AuditCategory.FLEET]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.DIPLOMACY]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.FEDERATION]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.BOUNTY]: AuditEventType.ACTIVITY_ACTION, // H3: New category
  [AuditCategory.MINING]: AuditEventType.ACTIVITY_ACTION, // H3: New category
  [AuditCategory.TRADE]: AuditEventType.ACTIVITY_ACTION, // H3: New category
  [AuditCategory.DISCORD]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.SYSTEM]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.GAMIFICATION]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.VOICE]: AuditEventType.ACTIVITY_ACTION,
  [AuditCategory.APPROVAL]: AuditEventType.ACTIVITY_ACTION, // H3: New category for approval governance
};

/**
 * AuditService - Unified audit logging facade
 *
 * Consolidates 15+ scattered audit logging patterns into a single service
 * with a consistent interface. Wraps the existing Winston-based auditLogger
 * and provides:
 *
 * - Unified event interface across all domains
 * - Correlation IDs for request tracing
 * - In-memory circular buffer for recent event queries
 * - Domain-specific convenience methods
 * - Statistics and filtering
 *
 * The in-memory buffer uses a fixed-size circular buffer (not an unbounded array)
 * to prevent the memory leak identified in ActivityAuditLogger.
 */
export class AuditService {
  private static instance: AuditService;

  /** Circular buffer for recent audit entries */
  private buffer: (StoredAuditEntry | null)[];
  private bufferHead: number = 0;
  private bufferCount: number = 0;
  private readonly bufferSize: number;

  private constructor(bufferSize: number = 5000) {
    this.bufferSize = bufferSize;
    this.buffer = new Array(bufferSize).fill(null);
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Reset the singleton (for testing only)
   */
  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      AuditService.instance = undefined as unknown as AuditService;
    }
  }

  // ---------------------------------------------------------------------------
  // Core logging
  // ---------------------------------------------------------------------------

  /**
   * Log a unified audit event.
   * Writes to both the Winston file logger and the in-memory circular buffer.
   */
  log(event: AuditEvent): StoredAuditEntry {
    const entry: StoredAuditEntry = {
      ...event,
      id: randomUUID(),
      timestamp: new Date(),
      correlationId: event.correlationId || randomUUID(),
      severity: event.severity || AuditSeverity.LOW,
    };

    // Write to Winston audit log file
    const eventType = CATEGORY_TO_EVENT_TYPE[event.category] || AuditEventType.ACTIVITY_ACTION;

    const logEntry: AuditLogEntry = {
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

    logAuditEvent(logEntry);

    // Write to circular buffer
    this.bufferPush(entry);

    return entry;
  }

  // ---------------------------------------------------------------------------
  // Domain-specific convenience methods
  // ---------------------------------------------------------------------------

  /**
   * Log an authentication event (login success/failure)
   */
  logAuthentication(
    success: boolean,
    userId: string | undefined,
    username: string | undefined,
    ipAddress?: string,
    userAgent?: string,
    reason?: string
  ): StoredAuditEntry {
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

  /**
   * Log an authorization failure
   */
  logAuthorizationFailure(
    userId: string,
    username: string,
    role: string,
    resource: string,
    action: string,
    ipAddress?: string,
    userAgent?: string
  ): StoredAuditEntry {
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

  /**
   * Log sensitive data access
   */
  logDataAccess(
    userId: string,
    username: string,
    resource: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>
  ): StoredAuditEntry {
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

  /**
   * Log a permission change (grant/revoke)
   */
  logPermissionChange(
    userId: string,
    targetUserId: string,
    organizationId: string,
    action: 'GRANTED' | 'REVOKED',
    resource: string,
    permissions: string,
    metadata?: Record<string, unknown>
  ): StoredAuditEntry {
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

  /**
   * Log an organization event
   */
  logOrganizationEvent(
    action: string,
    organizationId: string,
    userId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): StoredAuditEntry {
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

  /**
   * Log an RSI sync event
   */
  logRsiSync(
    organizationId: string,
    action: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): StoredAuditEntry {
    return this.log({
      category: AuditCategory.RSI_SYNC,
      action,
      severity: success ? AuditSeverity.LOW : AuditSeverity.HIGH,
      message: `RSI sync ${action}: ${success ? 'success' : 'failure'}`,
      organizationId,
      metadata: { ...metadata, success },
    });
  }

  /**
   * Log a security-critical system event
   */
  logSecurityEvent(
    action: string,
    message: string,
    severity: AuditSeverity = AuditSeverity.HIGH,
    metadata?: Record<string, unknown>
  ): StoredAuditEntry {
    return this.log({
      category: AuditCategory.SYSTEM,
      action,
      severity,
      message,
      metadata,
    });
  }

  // ---------------------------------------------------------------------------
  // Query operations (from in-memory circular buffer)
  // ---------------------------------------------------------------------------

  /**
   * Query recent audit entries with filtering
   */
  query(filter: AuditFilter = {}): StoredAuditEntry[] {
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

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply offset and limit
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get a single audit entry by ID
   */
  getById(id: string): StoredAuditEntry | undefined {
    return this.getBufferEntries().find(e => e.id === id);
  }

  /**
   * Get audit statistics, optionally scoped to an organization
   */
  getStatistics(organizationId?: string): AuditStatistics {
    let entries = this.getBufferEntries();

    if (organizationId) {
      entries = entries.filter(e => e.organizationId === organizationId);
    }

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const userIds = new Set<string>();
    let earliest: Date | null = null;
    let latest: Date | null = null;

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

  /**
   * Get the total number of entries in the buffer
   */
  getEntryCount(): number {
    return this.bufferCount;
  }

  /**
   * Clear the buffer (testing only)
   */
  clear(): void {
    if (process.env.NODE_ENV === 'test') {
      this.buffer = new Array(this.bufferSize).fill(null);
      this.bufferHead = 0;
      this.bufferCount = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Circular buffer internals
  // ---------------------------------------------------------------------------

  private bufferPush(entry: StoredAuditEntry): void {
    this.buffer[this.bufferHead] = entry;
    this.bufferHead = (this.bufferHead + 1) % this.bufferSize;
    if (this.bufferCount < this.bufferSize) {
      this.bufferCount++;
    }
  }

  /**
   * Return all non-null entries from the circular buffer (newest first).
   */
  private getBufferEntries(): StoredAuditEntry[] {
    const entries: StoredAuditEntry[] = [];
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

// Export singleton
export const auditService = AuditService.getInstance();

// Re-export for convenience so callers can import { auditService, AuditCategory } from one place
export { AuditEventType } from '../../utils/auditLogger';
