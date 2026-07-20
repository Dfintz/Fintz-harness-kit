import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum UserAuditAction {
    USER_CREATED = "USER_CREATED",
    USER_UPDATED = "USER_UPDATED",
    USER_DELETED = "USER_DELETED",
    USER_ACTIVATED = "USER_ACTIVATED",
    USER_DEACTIVATED = "USER_DEACTIVATED",
    USER_EMAIL_VERIFIED = "USER_EMAIL_VERIFIED",
    USER_PROFILE_UPDATED = "USER_PROFILE_UPDATED",
    USER_AVATAR_UPLOADED = "USER_AVATAR_UPLOADED",
    USER_PASSWORD_CHANGED = "USER_PASSWORD_CHANGED",
    USER_PASSWORD_RESET = "USER_PASSWORD_RESET",
    USER_MFA_ENABLED = "USER_MFA_ENABLED",
    USER_MFA_DISABLED = "USER_MFA_DISABLED"
}
export interface UserAuditEntry extends BaseDomainAuditEntry<UserAuditAction> {
    userId: string;
    userEmail?: string;
    userName?: string;
}
export declare class UserAuditLogger extends DomainAuditLogger<UserAuditAction, UserAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): UserAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: UserAuditEntry): string;
    protected buildResource(entry: UserAuditEntry): string;
    logUserCreated(params: {
        organizationId: string;
        userId: string;
        userEmail: string;
        userName?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
    logUserPasswordChanged(params: {
        organizationId: string;
        userId: string;
        userEmail?: string;
        performedById?: string;
        performedByName?: string;
    }): void;
    logMfaEnabled(params: {
        organizationId: string;
        userId: string;
        userEmail?: string;
        mfaType: string;
        performedById?: string;
        performedByName?: string;
    }): void;
}
export declare const userAuditLogger: UserAuditLogger;
//# sourceMappingURL=UserAuditLogger.d.ts.map