import { Organization } from './Organization';
export declare class DataEncryptionKey {
    id: string;
    organizationId: string;
    organization: Organization;
    dekId: string;
    dataType: string;
    resourceId?: string;
    algorithm: string;
    wrappedKeys: Record<string, string>;
    version: number;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    hasUserAccess(userId: string): boolean;
    getWrappedKeyForUser(userId: string): string | null;
    addWrappedKeyForUser(userId: string, wrappedDEK: string): void;
    removeWrappedKeyForUser(userId: string): void;
    getUsersWithAccess(): string[];
}
//# sourceMappingURL=DataEncryptionKey.d.ts.map