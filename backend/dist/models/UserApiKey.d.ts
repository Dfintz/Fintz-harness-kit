export declare class UserApiKey {
    id: string;
    userId: string;
    name: string;
    prefix: string;
    tokenHash: string;
    scopes: string[];
    expiresAt?: Date;
    revoked: boolean;
    revokedAt?: Date;
    lastUsedAt?: Date;
    lastUsedIp?: string;
    createdByIp?: string;
    createdAt: Date;
    updatedAt: Date;
    isValid(): boolean;
    hasScope(scope: string): boolean;
}
//# sourceMappingURL=UserApiKey.d.ts.map