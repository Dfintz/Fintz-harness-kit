"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.miningAuditLogger = exports.MiningAuditLogger = exports.MiningAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var MiningAuditAction;
(function (MiningAuditAction) {
    MiningAuditAction["MINING_SESSION_STARTED"] = "MINING_SESSION_STARTED";
    MiningAuditAction["MINING_SESSION_ENDED"] = "MINING_SESSION_ENDED";
    MiningAuditAction["ORE_HARVESTED"] = "ORE_HARVESTED";
    MiningAuditAction["ORE_PROCESSED"] = "ORE_PROCESSED";
    MiningAuditAction["MINING_CLAIM_FILED"] = "MINING_CLAIM_FILED";
    MiningAuditAction["MINING_CLAIM_ABANDONED"] = "MINING_CLAIM_ABANDONED";
    MiningAuditAction["MINING_QUOTA_EXCEEDED"] = "MINING_QUOTA_EXCEEDED";
    MiningAuditAction["MINING_EQUIPMENT_DAMAGED"] = "MINING_EQUIPMENT_DAMAGED";
})(MiningAuditAction || (exports.MiningAuditAction = MiningAuditAction = {}));
class MiningAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.MINING,
            domainLabel: 'Mining',
        });
    }
    static getInstance() {
        if (!MiningAuditLogger.instance) {
            MiningAuditLogger.instance = new MiningAuditLogger();
        }
        return MiningAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            MiningAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Mining ${entry.action}: User ${entry.userId} - Session ${entry.miningSessionId}`;
    }
    buildResource(entry) {
        return `mining/${entry.miningSessionId}`;
    }
    logSessionStarted(params) {
        this.log({
            action: MiningAuditAction.MINING_SESSION_STARTED,
            miningSessionId: params.miningSessionId,
            userId: params.userId,
            locationId: params.locationId,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                locationId: params.locationId,
            },
        });
    }
    logOreHarvested(params) {
        this.log({
            action: MiningAuditAction.ORE_HARVESTED,
            miningSessionId: params.miningSessionId,
            userId: params.userId,
            quantityHarvested: params.quantityHarvested,
            resourceType: params.resourceType,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                quantityHarvested: params.quantityHarvested,
                resourceType: params.resourceType,
            },
        });
    }
}
exports.MiningAuditLogger = MiningAuditLogger;
exports.miningAuditLogger = MiningAuditLogger.getInstance();
//# sourceMappingURL=MiningAuditLogger.js.map