"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizationAuditLogger = exports.AuthorizationAuditLogger = exports.AuthorizationAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var AuthorizationAuditAction;
(function (AuthorizationAuditAction) {
    AuthorizationAuditAction["PERMISSION_GRANTED"] = "PERMISSION_GRANTED";
    AuthorizationAuditAction["PERMISSION_REVOKED"] = "PERMISSION_REVOKED";
    AuthorizationAuditAction["ROLE_ASSIGNED"] = "ROLE_ASSIGNED";
    AuthorizationAuditAction["ROLE_REVOKED"] = "ROLE_REVOKED";
    AuthorizationAuditAction["AUTHORIZATION_CHECK_FAILED"] = "AUTHORIZATION_CHECK_FAILED";
    AuthorizationAuditAction["PERMISSION_POLICY_UPDATED"] = "PERMISSION_POLICY_UPDATED";
    AuthorizationAuditAction["SCOPE_EXPANDED"] = "SCOPE_EXPANDED";
    AuthorizationAuditAction["SCOPE_RESTRICTED"] = "SCOPE_RESTRICTED";
})(AuthorizationAuditAction || (exports.AuthorizationAuditAction = AuthorizationAuditAction = {}));
class AuthorizationAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.AUTHORIZATION,
            domainLabel: 'Authorization',
        });
    }
    static getInstance() {
        if (!AuthorizationAuditLogger.instance) {
            AuthorizationAuditLogger.instance = new AuthorizationAuditLogger();
        }
        return AuthorizationAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            AuthorizationAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Authorization ${entry.action}: ${entry.subjectType} ${entry.subjectId} on ${entry.resourceType}/${entry.permission}`;
    }
    buildResource(entry) {
        return `authorization/${entry.authorizationId}`;
    }
    logPermissionGranted(params) {
        this.log({
            action: AuthorizationAuditAction.PERMISSION_GRANTED,
            authorizationId: params.authorizationId,
            subjectId: params.subjectId,
            subjectType: params.subjectType,
            resourceType: params.resourceType,
            permission: params.permission,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                subjectType: params.subjectType,
                resourceType: params.resourceType,
                permission: params.permission,
            },
        });
    }
    logPermissionRevoked(params) {
        this.log({
            action: AuthorizationAuditAction.PERMISSION_REVOKED,
            authorizationId: params.authorizationId,
            subjectId: params.subjectId,
            subjectType: params.subjectType,
            resourceType: params.resourceType,
            permission: params.permission,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                subjectType: params.subjectType,
                resourceType: params.resourceType,
                permission: params.permission,
            },
        });
    }
}
exports.AuthorizationAuditLogger = AuthorizationAuditLogger;
exports.authorizationAuditLogger = AuthorizationAuditLogger.getInstance();
//# sourceMappingURL=AuthorizationAuditLogger.js.map