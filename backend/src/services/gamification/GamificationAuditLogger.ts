import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Gamification audit event types.
 */
export enum GamificationAuditAction {
  BADGE_CREATED = 'BADGE_CREATED',
  BADGE_UPDATED = 'BADGE_UPDATED',
  BADGE_DELETED = 'BADGE_DELETED',
  BADGE_AWARDED = 'BADGE_AWARDED',
  BADGE_REVOKED = 'BADGE_REVOKED',
}

/**
 * Gamification audit log entry.
 */
export interface GamificationAuditEntry extends BaseDomainAuditEntry<GamificationAuditAction> {
  achievementId: string;
  achievementName: string;
}

/**
 * GamificationAuditLogger
 *
 * Domain-specific audit logger for the Titles & Badges subsystem.
 * Singleton pattern with delegation to the centralized AuditService.
 */
export class GamificationAuditLogger extends DomainAuditLogger<
  GamificationAuditAction,
  GamificationAuditEntry
> {
  private static instance: GamificationAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.GAMIFICATION,
      domainLabel: 'Gamification',
    });
  }

  static getInstance(): GamificationAuditLogger {
    if (!GamificationAuditLogger.instance) {
      GamificationAuditLogger.instance = new GamificationAuditLogger();
    }
    return GamificationAuditLogger.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      GamificationAuditLogger.instance = undefined as unknown as GamificationAuditLogger;
    }
  }

  protected buildMessage(entry: GamificationAuditEntry): string {
    return `Gamification ${entry.action}: ${entry.achievementName}`;
  }

  protected buildResource(entry: GamificationAuditEntry): string {
    return `achievement/${entry.achievementId}`;
  }

  // ── Convenience methods ──

  logBadgeCreated(
    organizationId: string,
    achievementId: string,
    achievementName: string,
    performedById: string
  ): void {
    this.log({
      action: GamificationAuditAction.BADGE_CREATED,
      achievementId,
      achievementName,
      organizationId,
      performedById,
      details: {},
    });
  }

  logBadgeUpdated(
    organizationId: string,
    achievementId: string,
    achievementName: string,
    performedById: string,
    changes: Record<string, unknown>
  ): void {
    this.log({
      action: GamificationAuditAction.BADGE_UPDATED,
      achievementId,
      achievementName,
      organizationId,
      performedById,
      details: { changes },
    });
  }

  logBadgeDeleted(
    organizationId: string,
    achievementId: string,
    achievementName: string,
    performedById: string
  ): void {
    this.log({
      action: GamificationAuditAction.BADGE_DELETED,
      achievementId,
      achievementName,
      organizationId,
      performedById,
      details: {},
    });
  }

  logBadgeAwarded(
    organizationId: string,
    achievementId: string,
    achievementName: string,
    userId: string,
    awardedBy: string
  ): void {
    this.log({
      action: GamificationAuditAction.BADGE_AWARDED,
      achievementId,
      achievementName,
      organizationId,
      performedById: awardedBy,
      details: { userId },
    });
  }

  logBadgeRevoked(
    organizationId: string,
    achievementId: string,
    achievementName: string,
    userId: string,
    performedById: string
  ): void {
    this.log({
      action: GamificationAuditAction.BADGE_REVOKED,
      achievementId,
      achievementName,
      organizationId,
      performedById,
      details: { userId },
    });
  }
}

export const gamificationAuditLogger = GamificationAuditLogger.getInstance();

