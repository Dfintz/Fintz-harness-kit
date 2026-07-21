import { ActivityType } from '../../models/Activity';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

/**
 * Activity audit event types for comprehensive logging
 * Used across all Activity domain services for consistent audit tracking
 */
export enum ActivityAuditAction {
  // Core activity operations
  ACTIVITY_CREATED = 'ACTIVITY_CREATED',
  ACTIVITY_UPDATED = 'ACTIVITY_UPDATED',
  ACTIVITY_DELETED = 'ACTIVITY_DELETED',
  ACTIVITY_STATUS_CHANGED = 'ACTIVITY_STATUS_CHANGED',
  ACTIVITY_STARTED = 'ACTIVITY_STARTED',
  ACTIVITY_COMPLETED = 'ACTIVITY_COMPLETED',
  ACTIVITY_CANCELLED = 'ACTIVITY_CANCELLED',
  ACTIVITY_RESCHEDULED = 'ACTIVITY_RESCHEDULED',

  // Participant operations
  PARTICIPANT_JOINED = 'PARTICIPANT_JOINED',
  PARTICIPANT_LEFT = 'PARTICIPANT_LEFT',
  PARTICIPANT_REMOVED = 'PARTICIPANT_REMOVED',
  PARTICIPANT_ROLE_CHANGED = 'PARTICIPANT_ROLE_CHANGED',

  // Ship and crew operations
  SHIP_ASSIGNED = 'SHIP_ASSIGNED',
  SHIP_UNASSIGNED = 'SHIP_UNASSIGNED',
  CREW_JOINED = 'CREW_JOINED',
  CREW_LEFT = 'CREW_LEFT',

  // Application and job operations
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  APPLICATION_REVIEWED = 'APPLICATION_REVIEWED',
  APPLICATION_ACCEPTED = 'APPLICATION_ACCEPTED',
  APPLICATION_REJECTED = 'APPLICATION_REJECTED',
  CONTRACTOR_SCREENED = 'CONTRACTOR_SCREENED',
  BOUNTY_STATUS_UPDATED = 'BOUNTY_STATUS_UPDATED',

  // Organization operations
  ORG_INVITED = 'ORG_INVITED',
  ORG_INVITE_ACCEPTED = 'ORG_INVITE_ACCEPTED',
  ORG_INVITE_DECLINED = 'ORG_INVITE_DECLINED',
  ORG_JOINED = 'ORG_JOINED',
  ORG_LEFT = 'ORG_LEFT',

  // Voice and route operations
  VOICE_CHANNEL_CREATED = 'VOICE_CHANNEL_CREATED',
  VOICE_CHANNEL_LINKED = 'VOICE_CHANNEL_LINKED',
  ROUTE_ADDED = 'ROUTE_ADDED',
  ROUTE_UPDATED = 'ROUTE_UPDATED',
  WAYPOINT_UPDATED = 'WAYPOINT_UPDATED',

  // Event operations
  COMPLETION_REPORT_SUBMITTED = 'COMPLETION_REPORT_SUBMITTED',

  // Ready check operations
  READY_CHECK_INITIATED = 'READY_CHECK_INITIATED',
  READY_CHECK_RESPONDED = 'READY_CHECK_RESPONDED',
  READY_CHECK_COMPLETED = 'READY_CHECK_COMPLETED',
  READY_CHECK_EXPIRED = 'READY_CHECK_EXPIRED',
  READY_CHECK_CANCELLED = 'READY_CHECK_CANCELLED',
}

/**
 * Activity audit log entry interface
 */
export interface ActivityAuditEntry {
  action: ActivityAuditAction;
  activityId: string;
  activityTitle: string;
  activityType: ActivityType;
  organizationId: string;
  performedById: string;
  performedByName: string;
  timestamp: Date;
  details: Record<string, unknown>;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    previousValue?: unknown;
    newValue?: unknown;
  };
}

/**
 * ActivityAuditLogger
 *
 * Domain-specific audit logger for Activity services.
 * Now delegates to the centralized AuditService facade for Winston logging
 * while maintaining a local circular buffer for activity-specific queries.
 *
 * The circular buffer replaces the previous unbounded array that caused
 * memory leaks at 10k+ entries (issue P1-9).
 */
export class ActivityAuditLogger {
  private static instance: ActivityAuditLogger;

  /** Circular buffer for activity-specific entries */
  private buffer: (ActivityAuditEntry | null)[];
  private head: number = 0;
  private count: number = 0;
  private static readonly MAX_ENTRIES = 5000;

  private constructor() {
    this.buffer = new Array(ActivityAuditLogger.MAX_ENTRIES).fill(null);
  }

  /**
   * Get singleton instance of ActivityAuditLogger
   */
  public static getInstance(): ActivityAuditLogger {
    if (!ActivityAuditLogger.instance) {
      ActivityAuditLogger.instance = new ActivityAuditLogger();
    }
    return ActivityAuditLogger.instance;
  }

  /**
   * Log an activity audit event.
   * Delegates to the centralized AuditService and stores in local circular buffer.
   */
  public log(entry: Omit<ActivityAuditEntry, 'timestamp'>): void {
    const auditEntry: ActivityAuditEntry = {
      ...entry,
      timestamp: new Date(),
    };

    // Store in local circular buffer for activity-specific queries
    this.pushEntry(auditEntry);

    // Delegate to centralized AuditService facade
    auditService.log({
      category: AuditCategory.ACTIVITY,
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

    logger.debug('Activity audit logged', {
      action: entry.action,
      activityId: entry.activityId,
      performedBy: entry.performedByName,
    });
  }

  /**
   * Get filtered audit log entries
   */
  public getAuditLog(options?: {
    activityId?: string;
    organizationId?: string;
    performedById?: string;
    action?: ActivityAuditAction;
    actions?: ActivityAuditAction[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): ActivityAuditEntry[] {
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
      filtered = filtered.filter(e => options.actions!.includes(e.action));
    }

    if (options?.startDate) {
      const start = options.startDate.getTime();
      filtered = filtered.filter(e => e.timestamp.getTime() >= start);
    }

    if (options?.endDate) {
      const end = options.endDate.getTime();
      filtered = filtered.filter(e => e.timestamp.getTime() <= end);
    }

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get audit statistics for an activity
   */
  public getActivityAuditStats(activityId: string): {
    totalEvents: number;
    byAction: Record<string, number>;
    uniqueUsers: number;
    lastActivity: Date | null;
    recentEvents: ActivityAuditEntry[];
  } {
    const events = this.getEntries().filter(e => e.activityId === activityId);

    const byAction: Record<string, number> = {};
    const userIds = new Set<string>();

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

  /**
   * Get organization-wide audit statistics
   */
  public getOrganizationAuditStats(organizationId: string): {
    totalEvents: number;
    byAction: Record<string, number>;
    byActivity: Record<string, number>;
    uniqueUsers: number;
    activeActivities: number;
    timeRange: { earliest: Date | null; latest: Date | null };
  } {
    const events = this.getEntries().filter(e => e.organizationId === organizationId);

    const byAction: Record<string, number> = {};
    const byActivity: Record<string, number> = {};
    const userIds = new Set<string>();
    const activityIds = new Set<string>();

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

  /**
   * Clear all audit entries (for testing purposes only)
   */
  public clearAuditLog(): void {
    if (process.env.NODE_ENV === 'test') {
      this.buffer = new Array(ActivityAuditLogger.MAX_ENTRIES).fill(null);
      this.head = 0;
      this.count = 0;
    }
  }

  /**
   * Get total count of audit entries
   */
  public getEntryCount(): number {
    return this.count;
  }

  // ---------------------------------------------------------------------------
  // Circular buffer internals
  // ---------------------------------------------------------------------------

  private pushEntry(entry: ActivityAuditEntry): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % ActivityAuditLogger.MAX_ENTRIES;
    if (this.count < ActivityAuditLogger.MAX_ENTRIES) {
      this.count++;
    }
  }

  private getEntries(): ActivityAuditEntry[] {
    const entries: ActivityAuditEntry[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx =
        (this.head - 1 - i + ActivityAuditLogger.MAX_ENTRIES) % ActivityAuditLogger.MAX_ENTRIES;
      const entry = this.buffer[idx];
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }
}

// Export singleton instance
export const activityAuditLogger = ActivityAuditLogger.getInstance();

