"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userAuditLogger = exports.UserAuditLogger = exports.UserAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var UserAuditAction;
(function (UserAuditAction) {
    UserAuditAction["USER_CREATED"] = "USER_CREATED";
    UserAuditAction["USER_UPDATED"] = "USER_UPDATED";
    UserAuditAction["USER_DELETED"] = "USER_DELETED";
    UserAuditAction["USER_ACTIVATED"] = "USER_ACTIVATED";
    UserAuditAction["USER_DEACTIVATED"] = "USER_DEACTIVATED";
    UserAuditAction["USER_EMAIL_VERIFIED"] = "USER_EMAIL_VERIFIED";
    UserAuditAction["USER_PROFILE_UPDATED"] = "USER_PROFILE_UPDATED";
    UserAuditAction["USER_AVATAR_UPLOADED"] = "USER_AVATAR_UPLOADED";
    UserAuditAction["USER_PASSWORD_CHANGED"] = "USER_PASSWORD_CHANGED";
    UserAuditAction["USER_PASSWORD_RESET"] = "USER_PASSWORD_RESET";
    UserAuditAction["USER_MFA_ENABLED"] = "USER_MFA_ENABLED";
    UserAuditAction["USER_MFA_DISABLED"] = "USER_MFA_DISABLED";
})(UserAuditAction || (exports.UserAuditAction = UserAuditAction = {}));
class UserAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.USER,
            domainLabel: 'User',
        });
    }
    static getInstance() {
        if (!UserAuditLogger.instance) {
            UserAuditLogger.instance = new UserAuditLogger();
        }
        return UserAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            UserAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `User ${entry.action}: ${entry.userName || entry.userEmail || entry.userId}`;
    }
    buildResource(entry) {
        return `user/${entry.userId}`;
    }
    logUserCreated(params) {
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
    logUserPasswordChanged(params) {
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
    logMfaEnabled(params) {
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
exports.UserAuditLogger = UserAuditLogger;
exports.userAuditLogger = UserAuditLogger.getInstance();
//# sourceMappingURL=UserAuditLogger.js.map