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
    constructor();
    generateSecret(username: string, issuer?: string): Promise<TwoFactorSetup>;
    verifyToken(secret: string, token: string): boolean;
    generateBackupCodes(count?: number): string[];
    hashBackupCodes(codes: string[]): string[];
    verifyBackupCode(code: string, hashedCodes: string[]): boolean;
    removeBackupCode(code: string, hashedCodes: string[]): string[];
    trackFailedAttempt(userId: string): Promise<void>;
    checkLockout(userId: string): Promise<LockoutStatus>;
    resetFailedAttempts(userId: string): Promise<void>;
    calculateLockoutDuration(attempts: number): number;
}
//# sourceMappingURL=TwoFactorService.d.ts.map