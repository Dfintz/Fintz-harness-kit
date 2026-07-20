export declare class RefreshToken {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revoked: boolean;
    revokedAt?: Date;
    replacedByToken?: string;
    ipAddress?: string;
    userAgent?: string;
    tokenEncrypted?: string;
    encryptionIv?: string;
    encryptionAuthTag?: string;
    familyId?: string;
    parentTokenId?: string;
    lastUsedAt?: Date;
    location?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=RefreshToken.d.ts.map