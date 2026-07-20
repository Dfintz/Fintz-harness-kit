"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuditLogger = exports.AdminAuditLogger = exports.AdminAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var AdminAuditAction;
(function (AdminAuditAction) {
    AdminAuditAction["ADMIN_CREATED"] = "ADMIN_CREATED";
    AdminAuditAction["ADMIN_REMOVED"] = "ADMIN_REMOVED";
    AdminAuditAction["ADMIN_PERMISSION_CHANGED"] = "ADMIN_PERMISSION_CHANGED";
    AdminAuditAction["ADMIN_ROLE_ASSIGNED"] = "ADMIN_ROLE_ASSIGNED";
    AdminAuditAction["ADMIN_ROLE_REVOKED"] = "ADMIN_ROLE_REVOKED";
    AdminAuditAction["SYSTEM_CONFIG_UPDATED"] = "SYSTEM_CONFIG_UPDATED";
    AdminAuditAction["SECURITY_POLICY_UPDATED"] = "SECURITY_POLICY_UPDATED";
    AdminAuditAction["AUDIT_SETTINGS_CHANGED"] = "AUDIT_SETTINGS_CHANGED";
})(AdminAuditAction || (exports.AdminAuditAction = AdminAuditAction = {}));
class AdminAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.ADMIN,
            domainLabel: 'Admin',
        });
    }
    static getInstance() {
        if (!AdminAuditLogger.instance) {
            AdminAuditLogger.instance = new AdminAuditLogger();
        }
        return AdminAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            AdminAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Admin ${entry.action}: ${entry.adminEmail || entry.adminId}`;
    }
    buildResource(entry) {
        return `admin/${entry.adminId}`;
    }
    logPermissionChanged(params) {
        this.log({
            action: AdminAuditAction.ADMIN_PERMISSION_CHANGED,
            adminId: params.adminId,
            adminEmail: params.adminEmail,
            targetId: params.targetId,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                targetId: params.targetId,
                permissionType: params.permissionType,
                granted: params.granted,
            },
        });
    }
}
exports.AdminAuditLogger = AdminAuditLogger;
exports.adminAuditLogger = AdminAuditLogger.getInstance();
//# sourceMappingURL=AdminAuditLogger.js.map