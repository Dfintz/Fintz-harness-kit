import { IntelEntry } from './IntelEntry';
import { Organization } from './Organization';
import { User } from './User';
export declare enum IntelAuditAction {
    ENTRY_CREATED = "entry_created",
    ENTRY_VIEWED = "entry_viewed",
    ENTRY_UPDATED = "entry_updated",
    ENTRY_DELETED = "entry_deleted",
    ENTRY_ARCHIVED = "entry_archived",
    ENTRY_RESTORED = "entry_restored",
    OFFICER_APPOINTED = "officer_appointed",
    OFFICER_PROMOTED = "officer_promoted",
    OFFICER_DEMOTED = "officer_demoted",
    OFFICER_REMOVED = "officer_removed",
    OFFICER_ACCESS_CHANGED = "officer_access_changed",
    ACCESS_GRANTED = "access_granted",
    ACCESS_DENIED = "access_denied",
    UNAUTHORIZED_ATTEMPT = "unauthorized_attempt",
    VAULT_ACCESSED = "vault_accessed",
    EXPORT_PERFORMED = "export_performed",
    BULK_OPERATION = "bulk_operation",
    APPROVAL_REQUESTED = "approval_requested",
    APPROVAL_GRANTED = "approval_granted",
    APPROVAL_REJECTED = "approval_rejected",
    APPROVAL_WITHDRAWN = "approval_withdrawn",
    APPROVAL_EXPIRED = "approval_expired",
    SHARE_CREATED = "share_created",
    SHARE_ACCEPTED = "share_accepted",
    SHARE_DECLINED = "share_declined",
    SHARE_REVOKED = "share_revoked",
    SHARE_EXPIRED = "share_expired",
    SHARE_VIEWED = "share_viewed",
    DECLASSIFICATION_SCHEDULED = "declassification_scheduled",
    DECLASSIFICATION_EXECUTED = "declassification_executed",
    DECLASSIFICATION_CANCELLED = "declassification_cancelled",
    AGING_REVIEW_DUE = "aging_review_due",
    AGING_REVIEW_COMPLETED = "aging_review_completed",
    EXPIRATION_WARNING = "expiration_warning",
    ENTRY_EXPIRED = "entry_expired"
}
export declare class IntelAuditLog {
    id: string;
    organizationId: string;
    organization?: Organization;
    userId: string;
    user?: User;
    intelEntryId?: string;
    intelEntry?: IntelEntry;
    action: IntelAuditAction;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    severity: 'info' | 'warning' | 'critical';
    metadata?: {
        changes?: Record<string, unknown>;
        oldValues?: Record<string, unknown>;
        newValues?: Record<string, unknown>;
        affectedUsers?: string[];
        reason?: string;
        customData?: Record<string, unknown>;
    };
    createdAt: Date;
}
//# sourceMappingURL=IntelAuditLog.d.ts.map