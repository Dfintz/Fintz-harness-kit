import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum MiningAuditAction {
    MINING_SESSION_STARTED = "MINING_SESSION_STARTED",
    MINING_SESSION_ENDED = "MINING_SESSION_ENDED",
    ORE_HARVESTED = "ORE_HARVESTED",
    ORE_PROCESSED = "ORE_PROCESSED",
    MINING_CLAIM_FILED = "MINING_CLAIM_FILED",
    MINING_CLAIM_ABANDONED = "MINING_CLAIM_ABANDONED",
    MINING_QUOTA_EXCEEDED = "MINING_QUOTA_EXCEEDED",
    MINING_EQUIPMENT_DAMAGED = "MINING_EQUIPMENT_DAMAGED"
}
export interface MiningAuditEntry extends BaseDomainAuditEntry<MiningAuditAction> {
    miningSessionId: string;
    userId: string;
    locationId?: string;
    quantityHarvested?: number;
    resourceType?: string;
}
export declare class MiningAuditLogger extends DomainAuditLogger<MiningAuditAction, MiningAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): MiningAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: MiningAuditEntry): string;
    protected buildResource(entry: MiningAuditEntry): string;
    logSessionStarted(params: {
        organizationId: string;
        miningSessionId: string;
        userId: string;
        locationId?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
    logOreHarvested(params: {
        organizationId: string;
        miningSessionId: string;
        userId: string;
        quantityHarvested: number;
        resourceType: string;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const miningAuditLogger: MiningAuditLogger;
//# sourceMappingURL=MiningAuditLogger.d.ts.map