import { DataEncryptionKey } from '../../models/DataEncryptionKey';
import { EncryptedData, EncryptionMetadata } from '../../models/EncryptedData';
import { EncryptionAuditLog, EncryptionEventType } from '../../models/EncryptionAuditLog';
import { EncryptionKeyClaim, KeyClaimStatus } from '../../models/EncryptionKeyClaim';
import { MemberPublicKey } from '../../models/MemberPublicKey';
import { OrganizationEncryptionKey } from '../../models/OrganizationEncryptionKey';
import type { InitializeEncryptionInput, ShareKeyInput, StoreEncryptedDataInput } from './OrganizationEncryptionService.types';
export type { InitializeEncryptionInput, ShareKeyInput, StoreEncryptedDataInput, } from './OrganizationEncryptionService.types';
export declare class OrganizationEncryptionService {
    private readonly keyRepository;
    private readonly dataRepository;
    private readonly auditRepository;
    private readonly membershipRepository;
    private readonly claimRepository;
    private readonly publicKeyRepository;
    private readonly dekRepository;
    private normalizeEncryptionMetadata;
    initializeEncryption(input: InitializeEncryptionInput): Promise<OrganizationEncryptionKey>;
    getEncryptionStatus(organizationId: string): Promise<{
        enabled: boolean;
        keyId?: string;
        algorithm?: string;
        version?: number;
        createdAt?: Date;
        numKeyHolders?: number;
    }>;
    getKeyWrapperForUser(organizationId: string, userId: string): Promise<{
        keyId: string;
        wrappedKey: string;
        algorithm: string;
    } | null>;
    shareKey(input: ShareKeyInput): Promise<void>;
    revokeKeyAccess(organizationId: string, keyId: string, userId: string, revokedBy: string): Promise<void>;
    storeEncryptedData(input: StoreEncryptedDataInput): Promise<EncryptedData>;
    getEncryptedData(organizationId: string, dataId: string, userId: string, userSecurityLevel: number, userRole: string): Promise<EncryptedData>;
    deleteEncryptedData(organizationId: string, dataId: string, deletedBy: string): Promise<void>;
    getAuditLog(organizationId: string, options?: {
        eventType?: EncryptionEventType | string;
        userId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: EncryptionAuditLog[];
        total: number;
    }>;
    rotateKey(organizationId: string, newKeyId: string, newWrappedKeys: Record<string, string>, rotatedBy: string): Promise<OrganizationEncryptionKey>;
    getDataPendingReEncryption(organizationId: string, activeKeyId: string, limit?: number, offset?: number): Promise<{
        items: EncryptedData[];
        total: number;
    }>;
    updateReEncryptedData(organizationId: string, dataId: string, newKeyId: string, newEncryptedData: string, newEncryptionMetadata: EncryptionMetadata, updatedBy: string): Promise<EncryptedData>;
    getReEncryptionProgress(organizationId: string): Promise<{
        totalItems: number;
        reEncryptedItems: number;
        pendingItems: number;
        percentComplete: number;
    }>;
    getInactiveKeyWrapper(organizationId: string, keyId: string, userId: string): Promise<{
        wrappedKey: string;
        algorithm: string;
    } | null>;
    disableEncryption(organizationId: string, disabledBy: string): Promise<void>;
    createKeyClaim(input: {
        organizationId: string;
        keyId: string;
        encryptedClaim: string;
        claimMetadata: {
            iv: string;
            salt: string;
            iterations: number;
            algorithm: string;
        };
        createdBy: string;
        label?: string;
        expiresInHours?: number;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<EncryptionKeyClaim>;
    getClaimToken(organizationId: string, claimId: string, userId: string): Promise<{
        encryptedClaim: string;
        claimMetadata: {
            iv: string;
            salt: string;
            iterations: number;
            algorithm: string;
        };
    } | null>;
    completeClaim(organizationId: string, claimId: string, claimedBy: string, wrappedKey: string, ipAddress?: string, userAgent?: string): Promise<void>;
    listClaims(organizationId: string, options?: {
        status?: KeyClaimStatus;
        limit?: number;
        offset?: number;
    }): Promise<{
        claims: EncryptionKeyClaim[];
        total: number;
    }>;
    revokeClaim(organizationId: string, claimId: string, revokedBy: string): Promise<void>;
    expireOldClaims(organizationId?: string): Promise<number>;
    registerPublicKey(input: {
        organizationId: string;
        userId: string;
        publicKey: string;
        keyFingerprint: string;
        keySize?: number;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<MemberPublicKey>;
    getPublicKey(organizationId: string, userId: string): Promise<MemberPublicKey | null>;
    getOrganizationPublicKeys(organizationId: string): Promise<MemberPublicKey[]>;
    revokePublicKey(input: {
        organizationId: string;
        userId: string;
        revokedBy: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void>;
    createDEK(input: {
        organizationId: string;
        dekId: string;
        dataType: string;
        resourceId?: string;
        wrappedKeys: Record<string, string>;
        createdBy: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<DataEncryptionKey>;
    getDEKForUser(organizationId: string, dekId: string, userId: string): Promise<{
        wrappedKey: string;
        dataType: string;
        resourceId?: string;
    } | null>;
    getDEKByResource(organizationId: string, dataType: string, resourceId: string, userId: string): Promise<{
        dekId: string;
        wrappedKey: string;
    } | null>;
    grantDEKAccess(input: {
        organizationId: string;
        dekId: string;
        targetUserId: string;
        wrappedKey: string;
        grantedBy: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void>;
    revokeDEKAccess(input: {
        organizationId: string;
        dekId: string;
        targetUserId: string;
        revokedBy: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void>;
    listDEKs(organizationId: string, dataType?: string, resourceId?: string, limit?: number, offset?: number): Promise<{
        deks: DataEncryptionKey[];
        total: number;
    }>;
    storeHybridEncryptedData(input: {
        organizationId: string;
        dekId: string;
        dataType: string;
        resourceId?: string;
        encryptedData: string;
        encryptionMetadata: EncryptionMetadata;
        createdBy: string;
        minSecurityLevel?: number;
        allowedRoles?: string[];
    }): Promise<EncryptedData>;
    getHybridEncryptedData(organizationId: string, dataId: string, userId: string, userSecurityLevel: number, userRole: string): Promise<{
        data: EncryptedData;
        wrappedKey: string;
        dekId: string;
    }>;
    listHybridEncryptedData(organizationId: string, userId: string, options?: {
        dataType?: string;
        resourceId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        items: EncryptedData[];
        total: number;
    }>;
    initiateMigration(organizationId: string, initiatedBy: string): Promise<{
        totalPending: number;
    }>;
    getMigrationCandidates(organizationId: string, userId: string, limit?: number, offset?: number): Promise<{
        items: EncryptedData[];
        total: number;
    }>;
    completeMigrationItem(input: {
        organizationId: string;
        dataId: string;
        dekId: string;
        encryptedData: string;
        encryptionMetadata: EncryptionMetadata;
        migratedBy: string;
    }): Promise<EncryptedData>;
    getMigrationProgress(organizationId: string): Promise<{
        totalItems: number;
        pendingItems: number;
        migratedItems: number;
        flatItems: number;
        percentComplete: number;
    }>;
    private verifyMembership;
    private logEvent;
}
//# sourceMappingURL=OrganizationEncryptionService.d.ts.map