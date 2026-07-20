"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bountyAuditLogger = exports.BountyAuditLogger = exports.BountyAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var BountyAuditAction;
(function (BountyAuditAction) {
    BountyAuditAction["BOUNTY_CREATED"] = "BOUNTY_CREATED";
    BountyAuditAction["BOUNTY_UPDATED"] = "BOUNTY_UPDATED";
    BountyAuditAction["BOUNTY_ACCEPTED"] = "BOUNTY_ACCEPTED";
    BountyAuditAction["BOUNTY_COMPLETED"] = "BOUNTY_COMPLETED";
    BountyAuditAction["BOUNTY_CANCELLED"] = "BOUNTY_CANCELLED";
    BountyAuditAction["BOUNTY_REWARD_CLAIMED"] = "BOUNTY_REWARD_CLAIMED";
    BountyAuditAction["BOUNTY_REWARD_DISTRIBUTED"] = "BOUNTY_REWARD_DISTRIBUTED";
    BountyAuditAction["BOUNTY_VERIFICATION_FAILED"] = "BOUNTY_VERIFICATION_FAILED";
})(BountyAuditAction || (exports.BountyAuditAction = BountyAuditAction = {}));
class BountyAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.BOUNTY,
            domainLabel: 'Bounty',
        });
    }
    static getInstance() {
        if (!BountyAuditLogger.instance) {
            BountyAuditLogger.instance = new BountyAuditLogger();
        }
        return BountyAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            BountyAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Bounty ${entry.action}: ${entry.bountyTitle}`;
    }
    buildResource(entry) {
        return `bounty/${entry.bountyId}`;
    }
    logBountyCreated(params) {
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
    logBountyCompleted(params) {
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
exports.BountyAuditLogger = BountyAuditLogger;
exports.bountyAuditLogger = BountyAuditLogger.getInstance();
//# sourceMappingURL=BountyAuditLogger.js.map