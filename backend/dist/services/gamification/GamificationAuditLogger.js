"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gamificationAuditLogger = exports.GamificationAuditLogger = exports.GamificationAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var GamificationAuditAction;
(function (GamificationAuditAction) {
    GamificationAuditAction["BADGE_CREATED"] = "BADGE_CREATED";
    GamificationAuditAction["BADGE_UPDATED"] = "BADGE_UPDATED";
    GamificationAuditAction["BADGE_DELETED"] = "BADGE_DELETED";
    GamificationAuditAction["BADGE_AWARDED"] = "BADGE_AWARDED";
    GamificationAuditAction["BADGE_REVOKED"] = "BADGE_REVOKED";
})(GamificationAuditAction || (exports.GamificationAuditAction = GamificationAuditAction = {}));
class GamificationAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.GAMIFICATION,
            domainLabel: 'Gamification',
        });
    }
    static getInstance() {
        if (!GamificationAuditLogger.instance) {
            GamificationAuditLogger.instance = new GamificationAuditLogger();
        }
        return GamificationAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            GamificationAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Gamification ${entry.action}: ${entry.achievementName}`;
    }
    buildResource(entry) {
        return `achievement/${entry.achievementId}`;
    }
    logBadgeCreated(organizationId, achievementId, achievementName, performedById) {
        this.log({
            action: GamificationAuditAction.BADGE_CREATED,
            achievementId,
            achievementName,
            organizationId,
            performedById,
            details: {},
        });
    }
    logBadgeUpdated(organizationId, achievementId, achievementName, performedById, changes) {
        this.log({
            action: GamificationAuditAction.BADGE_UPDATED,
            achievementId,
            achievementName,
            organizationId,
            performedById,
            details: { changes },
        });
    }
    logBadgeDeleted(organizationId, achievementId, achievementName, performedById) {
        this.log({
            action: GamificationAuditAction.BADGE_DELETED,
            achievementId,
            achievementName,
            organizationId,
            performedById,
            details: {},
        });
    }
    logBadgeAwarded(organizationId, achievementId, achievementName, userId, awardedBy) {
        this.log({
            action: GamificationAuditAction.BADGE_AWARDED,
            achievementId,
            achievementName,
            organizationId,
            performedById: awardedBy,
            details: { userId },
        });
    }
    logBadgeRevoked(organizationId, achievementId, achievementName, userId, performedById) {
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
exports.GamificationAuditLogger = GamificationAuditLogger;
exports.gamificationAuditLogger = GamificationAuditLogger.getInstance();
//# sourceMappingURL=GamificationAuditLogger.js.map