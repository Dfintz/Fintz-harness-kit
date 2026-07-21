import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Trade audit event types for comprehensive logging.
 * Tracks trading operations and transactions.
 */
export enum TradeAuditAction {
  TRADE_OFFER_CREATED = 'TRADE_OFFER_CREATED',
  TRADE_OFFER_ACCEPTED = 'TRADE_OFFER_ACCEPTED',
  TRADE_OFFER_CANCELLED = 'TRADE_OFFER_CANCELLED',
  TRADE_OFFER_EXPIRED = 'TRADE_OFFER_EXPIRED',
  TRADE_COMPLETED = 'TRADE_COMPLETED',
  TRADE_FAILED = 'TRADE_FAILED',
  TRADE_DISPUTE_FILED = 'TRADE_DISPUTE_FILED',
  TRADE_DISPUTE_RESOLVED = 'TRADE_DISPUTE_RESOLVED',
}

/**
 * Trade audit log entry interface
 */
export interface TradeAuditEntry extends BaseDomainAuditEntry<TradeAuditAction> {
  tradeId: string;
  traderId: string;
  counterpartyId?: string;
  itemsOffered?: string[];
  itemsRequested?: string[];
  value?: number;
}

/**
 * TradeAuditLogger
 *
 * Domain-specific audit logger for trade operations.
 */
export class TradeAuditLogger extends DomainAuditLogger<TradeAuditAction, TradeAuditEntry> {
  private static instance: TradeAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.TRADE,
      domainLabel: 'Trade',
    });
  }

  static getInstance(): TradeAuditLogger {
    if (!TradeAuditLogger.instance) {
      TradeAuditLogger.instance = new TradeAuditLogger();
    }
    return TradeAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      TradeAuditLogger.instance = undefined as unknown as TradeAuditLogger;
    }
  }

  protected buildMessage(entry: TradeAuditEntry): string {
    return `Trade ${entry.action}: Trader ${entry.traderId} - Trade ${entry.tradeId}`;
  }

  protected buildResource(entry: TradeAuditEntry): string {
    return `trade/${entry.tradeId}`;
  }

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
  }): void {
    this.log({
      action: TradeAuditAction.TRADE_OFFER_CREATED,
      tradeId: params.tradeId,
      traderId: params.traderId,
      counterpartyId: params.counterpartyId,
      itemsOffered: params.itemsOffered,
      itemsRequested: params.itemsRequested,
      value: params.value,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        counterpartyId: params.counterpartyId,
        itemsOffered: params.itemsOffered,
        itemsRequested: params.itemsRequested,
        value: params.value,
      },
    });
  }

  logTradeCompleted(params: {
    organizationId: string;
    tradeId: string;
    traderId: string;
    counterpartyId?: string;
    value?: number;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: TradeAuditAction.TRADE_COMPLETED,
      tradeId: params.tradeId,
      traderId: params.traderId,
      counterpartyId: params.counterpartyId,
      value: params.value,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        counterpartyId: params.counterpartyId,
        value: params.value,
      },
    });
  }
}

export const tradeAuditLogger = TradeAuditLogger.getInstance();

