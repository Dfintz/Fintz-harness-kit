import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum BountyAuditAction {
    BOUNTY_CREATED = "BOUNTY_CREATED",
    BOUNTY_UPDATED = "BOUNTY_UPDATED",
    BOUNTY_ACCEPTED = "BOUNTY_ACCEPTED",
    BOUNTY_COMPLETED = "BOUNTY_COMPLETED",
    BOUNTY_CANCELLED = "BOUNTY_CANCELLED",
    BOUNTY_REWARD_CLAIMED = "BOUNTY_REWARD_CLAIMED",
    BOUNTY_REWARD_DISTRIBUTED = "BOUNTY_REWARD_DISTRIBUTED",
    BOUNTY_VERIFICATION_FAILED = "BOUNTY_VERIFICATION_FAILED"
}
export interface BountyAuditEntry extends BaseDomainAuditEntry<BountyAuditAction> {
    bountyId: string;
    bountyTitle: string;
    amount?: number;
    currency?: string;
    targetId?: string;
}
export declare class BountyAuditLogger extends DomainAuditLogger<BountyAuditAction, BountyAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): BountyAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: BountyAuditEntry): string;
    protected buildResource(entry: BountyAuditEntry): string;
    logBountyCreated(params: {
        organizationId: string;
        bountyId: string;
        bountyTitle: string;
        amount?: number;
        currency?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
    logBountyCompleted(params: {
        organizationId: string;
        bountyId: string;
        bountyTitle: string;
        amount?: number;
        targetId?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const bountyAuditLogger: BountyAuditLogger;
//# sourceMappingURL=BountyAuditLogger.d.ts.map