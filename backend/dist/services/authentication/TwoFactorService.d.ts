export interface TwoFactorSetup {
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
}
export interface LockoutStatus {
    isLocked: boolean;
    lockedUntil?: Date;
    remainingAttempts: number;
    attemptCount: number;
}
export declare class TwoFactorService {
    private readonly userService;
    private readonly bcryptCost;
    private static readonly usedTotpTokens;
    private static readonly tokenReuseCleanupTimer;
    private static readonly tokenValidityWindow;
    constructor();
    private getBcryptCost;
    private isBcryptHash;
    private getReplayTtlSeconds;
    private getTokenReplayKey;
    private isTokenReplayed;
    private markTokenAsUsed;
    generateSecret(username: string, issuer?: string): Promise<TwoFactorSetup>;
    verifyToken(secret: string, token: string, userId?: string): Promise<boolean>;
    generateBackupCodes(count?: number): string[];
    hashBackupCodes(codes: string[]): Promise<string[]>;
    verifyBackupCode(code: string, hashedCodes: string[]): Promise<boolean>;
    removeBackupCode(code: string, hashedCodes: string[]): Promise<string[]>;
    trackFailedAttempt(userId: string): Promise<void>;
    checkLockout(userId: string): Promise<LockoutStatus>;
    resetFailedAttempts(userId: string): Promise<void>;
    calculateLockoutDuration(attempts: number): number;
}
//# sourceMappingURL=TwoFactorService.d.ts.map