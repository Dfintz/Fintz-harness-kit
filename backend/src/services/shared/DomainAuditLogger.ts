import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

/**
 * Base audit entry interface that all domain-specific entries must extend.
 */
export interface BaseDomainAuditEntry<TAction extends string> {
  action: TAction;
  organizationId: string;
  performedById?: string;
  performedByName?: string;
  timestamp: Date;
  details: Record<string, unknown>;
}

/**
 * Configuration for a domain audit logger.
 */
export interface DomainAuditLoggerConfig {
  /** AuditService category for this domain */
  category: AuditCategory;
  /** Human-readable domain name for log messages (e.g. "Fleet", "Diplomacy") */
  domainLabel: string;
  /** Maximum circular buffer entries (default: 5000) */
  maxEntries?: number;
}

/**
 * DomainAuditLogger — Generic base class for domain-specific audit loggers.
 *
 * Provides:
 * - Singleton lifecycle (via static factory in subclasses)
 * - Circular buffer for domain-specific queries (prevents memory leaks)
 * - Delegation to centralized AuditService for Winston persistence
 *
 * Subclasses define:
 * - TAction enum (domain-specific audit action types)
 * - TEntry interface (extending BaseDomainAuditEntry<TAction>)
 * - Convenience log methods for common operations
 * - buildMessage(entry) to format audit log messages
 * - buildResource(entry) to produce resource identifiers
 *
 * Example:
 * ```
 * class MyAuditLogger extends DomainAuditLogger<MyAction, MyEntry> {
 *   constructor() {
 *     super({ category: AuditCategory.MY_DOMAIN, domainLabel: 'MyDomain' });
 *   }
 *   protected buildMessage(entry: MyEntry): string { return `${entry.action}: ${entry.name}`; }
 *   protected buildResource(entry: MyEntry): string { return `myDomain/${entry.id}`; }
 * }
 * ```
 */
export abstract class DomainAuditLogger<
  TAction extends string,
  TEntry extends BaseDomainAuditEntry<TAction>,
> {
  private readonly buffer: (TEntry | null)[];
  private head: number = 0;
  private count: number = 0;
  private readonly maxEntries: number;
  protected readonly config: DomainAuditLoggerConfig;

  protected constructor(config: DomainAuditLoggerConfig) {
    this.config = config;
    this.maxEntries = config.maxEntries ?? 5000;
    this.buffer = new Array<TEntry | null>(this.maxEntries).fill(null);
  }

  /**
   * Build a human-readable message for the audit log.
   * Subclasses must implement this.
   */
  protected abstract buildMessage(entry: TEntry): string;

  /**
   * Build a resource identifier string (e.g. "fleet/abc-123").
   * Subclasses must implement this.
   */
  protected abstract buildResource(entry: TEntry): string;

  /**
   * Log an audit event.
   * Stores in local circular buffer and delegates to centralized AuditService.
   */
  log(entry: Omit<TEntry, 'timestamp'>): void {
    const auditEntry = {
      ...entry,
      timestamp: new Date(),
    } as TEntry;

    // Store in local circular buffer
    this.pushEntry(auditEntry);

    // Delegate to centralized AuditService. Audit transport failures must not
    // propagate to the caller — the business operation has already succeeded
    // by the time we reach this point and a downstream logging glitch should
    // never roll back or surface as a user-visible error.
    try {
      auditService.log({
        category: this.config.category,
        action: entry.action,
        message: this.buildMessage(auditEntry),
        userId: entry.performedById,
        username: entry.performedByName,
        organizationId: entry.organizationId,
        resource: this.buildResource(auditEntry),
        metadata: {
          ...entry.details,
        },
      });
    } catch (err: unknown) {
      logger.error(`${this.config.domainLabel} audit emission failed`, {
        action: entry.action,
        organizationId: entry.organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    logger.debug(`${this.config.domainLabel} audit logged`, {
      action: entry.action,
      performedBy: entry.performedByName,
    });
  }

  /**
   * Get filtered audit log entries from the local circular buffer.
   */
  getAuditLog(options?: {
    organizationId?: string;
    action?: TAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    filter?: (entry: TEntry) => boolean;
  }): TEntry[] {
    let filtered = this.getEntries();

    if (options?.organizationId) {
      filtered = filtered.filter(e => e.organizationId === options.organizationId);
    }
    if (options?.action) {
      filtered = filtered.filter(e => e.action === options.action);
    }
    if (options?.startDate) {
      const start = options.startDate;
      filtered = filtered.filter(e => e.timestamp >= start);
    }
    if (options?.endDate) {
      const end = options.endDate;
      filtered = filtered.filter(e => e.timestamp <= end);
    }
    if (options?.filter) {
      filtered = filtered.filter(options.filter);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // ── Circular buffer internals ───────────────────────────────────────

  private pushEntry(entry: TEntry): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.maxEntries;
    if (this.count < this.maxEntries) {
      this.count++;
    }
  }

  private getEntries(): TEntry[] {
    const entries: TEntry[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.maxEntries) % this.maxEntries;
      const entry = this.buffer[idx];
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  /** Reset buffer (for testing only). */
  protected resetBuffer(): void {
    if (process.env.NODE_ENV === 'test') {
      this.buffer.fill(null);
      this.head = 0;
      this.count = 0;
    }
  }
}

