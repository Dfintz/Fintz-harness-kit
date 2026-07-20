import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum TradeAuditAction {
    TRADE_OFFER_CREATED = "TRADE_OFFER_CREATED",
    TRADE_OFFER_ACCEPTED = "TRADE_OFFER_ACCEPTED",
    TRADE_OFFER_CANCELLED = "TRADE_OFFER_CANCELLED",
    TRADE_OFFER_EXPIRED = "TRADE_OFFER_EXPIRED",
    TRADE_COMPLETED = "TRADE_COMPLETED",
    TRADE_FAILED = "TRADE_FAILED",
    TRADE_DISPUTE_FILED = "TRADE_DISPUTE_FILED",
    TRADE_DISPUTE_RESOLVED = "TRADE_DISPUTE_RESOLVED"
}
export interface TradeAuditEntry extends BaseDomainAuditEntry<TradeAuditAction> {
    tradeId: string;
    traderId: string;
    counterpartyId?: string;
    itemsOffered?: string[];
    itemsRequested?: string[];
    value?: number;
}
export declare class TradeAuditLogger extends DomainAuditLogger<TradeAuditAction, TradeAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): TradeAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: TradeAuditEntry): string;
    protected buildResource(entry: TradeAuditEntry): string;
    logTradeCreated(params: {
        organizationId: string;
        tradeId: string;
        traderId: string;
        counterpartyId?: string;
        itemsOffered?: string[];
        itemsRequested?: string[];
        value?: number;
        performedById?: string;
        performedByName?: string;
    }): void;
    logTradeCompleted(params: {
        organizationId: string;
        tradeId: string;
        traderId: string;
        counterpartyId?: string;
        value?: number;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const tradeAuditLogger: TradeAuditLogger;
//# sourceMappingURL=TradeAuditLogger.d.ts.map