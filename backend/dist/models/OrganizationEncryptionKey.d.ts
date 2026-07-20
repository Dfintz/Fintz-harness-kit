import { Organization } from './Organization';
export declare class OrganizationEncryptionKey {
    id: string;
    organizationId: string;
    organization: Organization;
    keyId: string;
    algorithm: string;
    version: number;
    keyWrappers: Record<string, string>;
    recoveryHint?: string;
    requiresRecoveryPhrase: boolean;
    createdBy: string;
    createdAt: Date;
    rotatedAt?: Date;
    isActive: boolean;
    lastUsedAt?: Date;
    usageCount: number;
    hasUserAccess(userId: string): boolean;
    getKeyWrapperForUser(userId: string): string | null;
    addKeyWrapperForUser(userId: string, wrappedKey: string): void;
    removeKeyWrapperForUser(userId: string): void;
    getUsersWithAccess(): string[];
}
//# sourceMappingURL=OrganizationEncryptionKey.d.ts.map