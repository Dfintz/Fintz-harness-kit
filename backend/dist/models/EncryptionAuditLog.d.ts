import { Organization } from './Organization';
export declare enum EncryptionEventType {
    KEY_GENERATED = "key_generated",
    KEY_ROTATED = "key_rotated",
    KEY_SHARED = "key_shared",
    KEY_REVOKED = "key_revoked",
    DATA_ENCRYPTED = "data_encrypted",
    DATA_DECRYPTED = "data_decrypted",
    DATA_DELETED = "data_deleted",
    ENCRYPTION_ENABLED = "encryption_enabled",
    ENCRYPTION_DISABLED = "encryption_disabled",
    ACCESS_DENIED = "access_denied",
    RECOVERY_PHRASE_USED = "recovery_phrase_used",
    DATA_REENCRYPTED = "data_reencrypted"
}
export declare class EncryptionAuditLog {
    id: string;
    organizationId: string;
    organization: Organization;
    eventType: EncryptionEventType | string;
    userId: string;
    message: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
    static createEntry(organizationId: string, eventType: EncryptionEventType | string, userId: string, message: string, details?: Record<string, unknown>, ipAddress?: string, userAgent?: string): Partial<EncryptionAuditLog>;
}
//# sourceMappingURL=EncryptionAuditLog.d.ts.map