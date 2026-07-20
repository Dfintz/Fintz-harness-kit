import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum AuthorizationAuditAction {
    PERMISSION_GRANTED = "PERMISSION_GRANTED",
    PERMISSION_REVOKED = "PERMISSION_REVOKED",
    ROLE_ASSIGNED = "ROLE_ASSIGNED",
    ROLE_REVOKED = "ROLE_REVOKED",
    AUTHORIZATION_CHECK_FAILED = "AUTHORIZATION_CHECK_FAILED",
    PERMISSION_POLICY_UPDATED = "PERMISSION_POLICY_UPDATED",
    SCOPE_EXPANDED = "SCOPE_EXPANDED",
    SCOPE_RESTRICTED = "SCOPE_RESTRICTED"
}
export interface AuthorizationAuditEntry extends BaseDomainAuditEntry<AuthorizationAuditAction> {
    authorizationId: string;
    subjectId: string;
    subjectType: string;
    resourceType: string;
    permission: string;
}
export declare class AuthorizationAuditLogger extends DomainAuditLogger<AuthorizationAuditAction, AuthorizationAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): AuthorizationAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: AuthorizationAuditEntry): string;
    protected buildResource(entry: AuthorizationAuditEntry): string;
    logPermissionGranted(params: {
        organizationId: string;
        authorizationId: string;
        subjectId: string;
        subjectType: string;
        resourceType: string;
        permission: string;
        performedById?: string;
        performedByName?: string;
    }): void;
    logPermissionRevoked(params: {
        organizationId: string;
        authorizationId: string;
        subjectId: string;
        subjectType: string;
        resourceType: string;
        permission: string;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const authorizationAuditLogger: AuthorizationAuditLogger;
//# sourceMappingURL=AuthorizationAuditLogger.d.ts.map