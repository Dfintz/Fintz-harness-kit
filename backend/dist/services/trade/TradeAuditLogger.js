"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeAuditLogger = exports.TradeAuditLogger = exports.TradeAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var TradeAuditAction;
(function (TradeAuditAction) {
    TradeAuditAction["TRADE_OFFER_CREATED"] = "TRADE_OFFER_CREATED";
    TradeAuditAction["TRADE_OFFER_ACCEPTED"] = "TRADE_OFFER_ACCEPTED";
    TradeAuditAction["TRADE_OFFER_CANCELLED"] = "TRADE_OFFER_CANCELLED";
    TradeAuditAction["TRADE_OFFER_EXPIRED"] = "TRADE_OFFER_EXPIRED";
    TradeAuditAction["TRADE_COMPLETED"] = "TRADE_COMPLETED";
    TradeAuditAction["TRADE_FAILED"] = "TRADE_FAILED";
    TradeAuditAction["TRADE_DISPUTE_FILED"] = "TRADE_DISPUTE_FILED";
    TradeAuditAction["TRADE_DISPUTE_RESOLVED"] = "TRADE_DISPUTE_RESOLVED";
})(TradeAuditAction || (exports.TradeAuditAction = TradeAuditAction = {}));
class TradeAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.TRADE,
            domainLabel: 'Trade',
        });
    }
    static getInstance() {
        if (!TradeAuditLogger.instance) {
            TradeAuditLogger.instance = new TradeAuditLogger();
        }
        return TradeAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            TradeAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Trade ${entry.action}: Trader ${entry.traderId} - Trade ${entry.tradeId}`;
    }
    buildResource(entry) {
        return `trade/${entry.tradeId}`;
    }
    logTradeCreated(params) {
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
    logTradeCompleted(params) {
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
exports.TradeAuditLogger = TradeAuditLogger;
exports.tradeAuditLogger = TradeAuditLogger.getInstance();
//# sourceMappingURL=TradeAuditLogger.js.map