import { Organization } from './Organization';
import { User } from './User';
export type KeyClaimStatus = 'pending' | 'claimed' | 'expired' | 'revoked';
export declare class EncryptionKeyClaim {
    id: string;
    organizationId: string;
    organization: Organization;
    keyId: string;
    encryptedClaim: string;
    claimMetadata: {
        iv: string;
        salt: string;
        iterations: number;
        algorithm: string;
    };
    createdBy: string;
    creator: User;
    claimedBy?: string;
    claimant?: User;
    label?: string;
    status: KeyClaimStatus;
    expiresAt: Date;
    claimedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    get isExpired(): boolean;
    get isClaimable(): boolean;
    markClaimed(userId: string): void;
    markExpired(): void;
    markRevoked(): void;
}
//# sourceMappingURL=EncryptionKeyClaim.d.ts.map