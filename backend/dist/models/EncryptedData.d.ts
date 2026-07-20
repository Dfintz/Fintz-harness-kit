import { Organization } from './Organization';
export interface EncryptionMetadata {
    iv: string;
    authTag: string;
    algorithm: string;
    version?: number;
}
export declare class EncryptedData {
    id: string;
    organizationId: string;
    organization: Organization;
    keyId: string;
    encryptionMode: 'flat' | 'hybrid';
    dekId?: string;
    migrationStatus: 'none' | 'pending' | 'migrated';
    dataType: string;
    resourceId?: string;
    encryptedData: string;
    encryptionMetadata: EncryptionMetadata;
    createdBy: string;
    minSecurityLevel: number;
    allowedRoles?: string[];
    createdAt: Date;
    updatedAt: Date;
    accessedCount: number;
    lastAccessedAt?: Date;
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: string;
    meetsSecurityLevel(userSecurityLevel: number): boolean;
    isRoleAllowed(userRole: string): boolean;
    incrementAccessCount(): void;
    softDelete(deletedBy: string): void;
    restore(): void;
}
//# sourceMappingURL=EncryptedData.d.ts.map