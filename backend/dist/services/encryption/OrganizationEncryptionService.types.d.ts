import type { EncryptionMetadata } from '../../models/EncryptedData';
export interface InitializeEncryptionInput {
    organizationId: string;
    keyId: string;
    algorithm: string;
    wrappedKeys: Record<string, string>;
    recoveryHint?: string;
    createdBy: string;
    ipAddress?: string;
    userAgent?: string;
}
export interface StoreEncryptedDataInput {
    organizationId: string;
    keyId: string;
    dataType: string;
    resourceId?: string;
    encryptedData: string;
    encryptionMetadata: EncryptionMetadata;
    createdBy: string;
    minSecurityLevel?: number;
    allowedRoles?: string[];
}
export interface ShareKeyInput {
    organizationId: string;
    keyId: string;
    userId: string;
    wrappedKey: string;
    sharedBy: string;
    ipAddress?: string;
    userAgent?: string;
}
//# sourceMappingURL=OrganizationEncryptionService.types.d.ts.map