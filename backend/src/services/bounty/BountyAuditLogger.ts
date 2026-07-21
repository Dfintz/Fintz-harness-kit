import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Bounty audit event types for comprehensive logging.
 * Tracks bounty lifecycle and operations.
 */
export enum BountyAuditAction {
  BOUNTY_CREATED = 'BOUNTY_CREATED',
  BOUNTY_UPDATED = 'BOUNTY_UPDATED',
  BOUNTY_ACCEPTED = 'BOUNTY_ACCEPTED',
  BOUNTY_COMPLETED = 'BOUNTY_COMPLETED',
  BOUNTY_CANCELLED = 'BOUNTY_CANCELLED',
  BOUNTY_REWARD_CLAIMED = 'BOUNTY_REWARD_CLAIMED',
  BOUNTY_REWARD_DISTRIBUTED = 'BOUNTY_REWARD_DISTRIBUTED',
  BOUNTY_VERIFICATION_FAILED = 'BOUNTY_VERIFICATION_FAILED',
}

/**
 * Bounty audit log entry interface
 */
export interface BountyAuditEntry extends BaseDomainAuditEntry<BountyAuditAction> {
  bountyId: string;
  bountyTitle: string;
  amount?: number;
  currency?: string;
  targetId?: string;
}

/**
 * BountyAuditLogger
 *
 * Domain-specific audit logger for bounty operations.
 */
export class BountyAuditLogger extends DomainAuditLogger<BountyAuditAction, BountyAuditEntry> {
  private static instance: BountyAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.BOUNTY,
      domainLabel: 'Bounty',
    });
  }

  static getInstance(): BountyAuditLogger {
    if (!BountyAuditLogger.instance) {
      BountyAuditLogger.instance = new BountyAuditLogger();
    }
    return BountyAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      BountyAuditLogger.instance = undefined as unknown as BountyAuditLogger;
    }
  }

  protected buildMessage(entry: BountyAuditEntry): string {
    return `Bounty ${entry.action}: ${entry.bountyTitle}`;
  }

  protected buildResource(entry: BountyAuditEntry): string {
    return `bounty/${entry.bountyId}`;
  }

  logBountyCreated(params: {
    organizationId: string;
    bountyId: string;
    bountyTitle: string;
    amount?: number;
    currency?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: BountyAuditAction.BOUNTY_CREATED,
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      amount: params.amount,
      currency: params.currency,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        amount: params.amount,
        currency: params.currency,
      },
    });
  }

  logBountyCompleted(params: {
    organizationId: string;
    bountyId: string;
    bountyTitle: string;
    amount?: number;
    targetId?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: BountyAuditAction.BOUNTY_COMPLETED,
      bountyId: params.bountyId,
      bountyTitle: params.bountyTitle,
      amount: params.amount,
      targetId: params.targetId,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        amount: params.amount,
        targetId: params.targetId,
      },
    });
  }
}

export const bountyAuditLogger = BountyAuditLogger.getInstance();

