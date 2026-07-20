import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum AdminAuditAction {
    ADMIN_CREATED = "ADMIN_CREATED",
    ADMIN_REMOVED = "ADMIN_REMOVED",
    ADMIN_PERMISSION_CHANGED = "ADMIN_PERMISSION_CHANGED",
    ADMIN_ROLE_ASSIGNED = "ADMIN_ROLE_ASSIGNED",
    ADMIN_ROLE_REVOKED = "ADMIN_ROLE_REVOKED",
    SYSTEM_CONFIG_UPDATED = "SYSTEM_CONFIG_UPDATED",
    SECURITY_POLICY_UPDATED = "SECURITY_POLICY_UPDATED",
    AUDIT_SETTINGS_CHANGED = "AUDIT_SETTINGS_CHANGED"
}
export interface AdminAuditEntry extends BaseDomainAuditEntry<AdminAuditAction> {
    adminId: string;
    adminEmail?: string;
    targetId?: string;
    configSection?: string;
}
export declare class AdminAuditLogger extends DomainAuditLogger<AdminAuditAction, AdminAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): AdminAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: AdminAuditEntry): string;
    protected buildResource(entry: AdminAuditEntry): string;
    logPermissionChanged(params: {
        organizationId: string;
        adminId: string;
        adminEmail?: string;
        targetId: string;
        permissionType: string;
        granted: boolean;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const adminAuditLogger: AdminAuditLogger;
//# sourceMappingURL=AdminAuditLogger.d.ts.map