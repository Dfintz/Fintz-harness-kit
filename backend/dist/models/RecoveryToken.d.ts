export declare class RecoveryToken {
    id: number;
    userId: string;
    tokenHash: string;
    token?: string;
    type: 'email' | 'recovery_code' | 'admin';
    expiresAt: Date;
    used: boolean;
    isUsed: boolean;
    usedAt?: Date;
    ipAddress?: string;
    userAgent?: string;
    adminUserId?: string;
    reason?: string;
    createdAt: Date;
}
//# sourceMappingURL=RecoveryToken.d.ts.map