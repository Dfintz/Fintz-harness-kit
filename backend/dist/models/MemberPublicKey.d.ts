import { Organization } from './Organization';
export declare class MemberPublicKey {
    id: string;
    organizationId: string;
    organization: Organization;
    userId: string;
    publicKey: string;
    keyFingerprint: string;
    keySize: number;
    algorithm: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt?: Date;
}
//# sourceMappingURL=MemberPublicKey.d.ts.map