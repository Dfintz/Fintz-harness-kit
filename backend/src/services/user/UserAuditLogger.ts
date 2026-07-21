import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * User audit event types for comprehensive logging.
 * Tracks user lifecycle and security-related operations.
 */
export enum UserAuditAction {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_EMAIL_VERIFIED = 'USER_EMAIL_VERIFIED',
  USER_PROFILE_UPDATED = 'USER_PROFILE_UPDATED',
  USER_AVATAR_UPLOADED = 'USER_AVATAR_UPLOADED',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',
  USER_PASSWORD_RESET = 'USER_PASSWORD_RESET',
  USER_MFA_ENABLED = 'USER_MFA_ENABLED',
  USER_MFA_DISABLED = 'USER_MFA_DISABLED',
}

/**
 * User audit log entry interface
 */
export interface UserAuditEntry extends BaseDomainAuditEntry<UserAuditAction> {
  userId: string;
  userEmail?: string;
  userName?: string;
}

/**
 * UserAuditLogger
 *
 * Domain-specific audit logger for User services.
 * Delegates to the centralized AuditService facade for Winston logging
 * while maintaining a local circular buffer for user-specific queries.
 */
export class UserAuditLogger extends DomainAuditLogger<UserAuditAction, UserAuditEntry> {
  private static instance: UserAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.USER,
      domainLabel: 'User',
    });
  }

  static getInstance(): UserAuditLogger {
    if (!UserAuditLogger.instance) {
      UserAuditLogger.instance = new UserAuditLogger();
    }
    return UserAuditLogger.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      UserAuditLogger.instance = undefined as unknown as UserAuditLogger;
    }
  }

  protected buildMessage(entry: UserAuditEntry): string {
    return `User ${entry.action}: ${entry.userName || entry.userEmail || entry.userId}`;
  }

  protected buildResource(entry: UserAuditEntry): string {
    return `user/${entry.userId}`;
  }

  // ── Convenience methods ─────────────────────────────────────────────

  logUserCreated(params: {
    organizationId: string;
    userId: string;
    userEmail: string;
    userName?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: UserAuditAction.USER_CREATED,
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: { email: params.userEmail },
    });
  }

  logUserPasswordChanged(params: {
    organizationId: string;
    userId: string;
    userEmail?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: UserAuditAction.USER_PASSWORD_CHANGED,
      userId: params.userId,
      userEmail: params.userEmail,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {},
    });
  }

  logMfaEnabled(params: {
    organizationId: string;
    userId: string;
    userEmail?: string;
    mfaType: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: UserAuditAction.USER_MFA_ENABLED,
      userId: params.userId,
      userEmail: params.userEmail,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: { mfaType: params.mfaType },
    });
  }
}

export const userAuditLogger = UserAuditLogger.getInstance();

