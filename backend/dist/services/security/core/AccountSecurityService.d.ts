import { RecoveryToken } from '../../../models/RecoveryToken';
import { User } from '../../../models/User';
import { AuditEventType } from '../../../utils/auditLogger';
export type RecoveryType = 'email' | 'recovery_code' | 'admin';
export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'fair' | 'good' | 'strong';
    score: number;
}
export interface PasswordPolicy {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    disallowCommonPasswords: boolean;
    disallowUserInfo: boolean;
}
export interface LockoutStatus {
    isLocked: boolean;
    failedAttempts: number;
    attemptsRemaining: number;
    lockedUntil?: Date;
    lockoutExpiresIn?: number;
}
export interface SecurityStats {
    lockedAccounts: number;
    recentFailedAttempts: number;
    activeRecoveryTokens: number;
}
export declare class AccountSecurityService {
    private static instance;
    private readonly userRepository;
    private readonly recoveryTokenRepository;
    private readonly passwordHistoryRepository;
    private readonly encryptionService;
    private static readonly MAX_FAILED_ATTEMPTS;
    private static readonly LOCKOUT_DURATION_MS;
    private static readonly RECOVERY_TOKEN_EXPIRY_HOURS;
    private static readonly PASSWORD_HISTORY_COUNT;
    private static readonly CLEANUP_FETCH_MULTIPLIER;
    static readonly PASSWORD_REUSE_ERROR = "Password has been used recently. Please choose a different password.";
    private static readonly DEFAULT_PASSWORD_POLICY;
    private static readonly COMMON_PASSWORDS;
    private constructor();
    static getInstance(): AccountSecurityService;
    isAccountLocked(user: User): boolean;
    recordFailedAttempt(userId: string): Promise<{
        isLocked: boolean;
        attemptsRemaining: number;
        lockedUntil?: Date;
    }>;
    resetFailedAttempts(userId: string): Promise<void>;
    getLockoutStatus(userId: string): Promise<LockoutStatus>;
    unlockAccount(userId: string): Promise<void>;
    generateRecoveryCodes(count?: number): string[];
    hashRecoveryCodes(codes: string[]): string[];
    initiateEmailRecovery(email: string, recoveryType?: RecoveryType): Promise<{
        token: string;
        expiresAt: Date;
    }>;
    verifyRecoveryToken(token: string): Promise<RecoveryToken | null>;
    markTokenUsed(tokenId: number): Promise<void>;
    disable2FAWithRecovery(userId: string, recoveryMethod: RecoveryType, recoveryTokenId: number): Promise<void>;
    cleanupExpiredTokens(): Promise<number>;
    logSecurityEvent(eventType: AuditEventType, data: Record<string, unknown>, userId?: string, ipAddress?: string): Promise<void>;
    getSecurityStats(): Promise<SecurityStats>;
    getPasswordPolicy(): PasswordPolicy;
    validatePassword(password: string, userInfo?: {
        username?: string;
        email?: string;
    }): PasswordValidationResult;
    private hasSequentialChars;
    private hasRepeatedChars;
    checkPasswordHistory(userId: string, newPassword: string, historyCount?: number): Promise<boolean>;
    addPasswordToHistory(userId: string, passwordHash: string): Promise<void>;
    private cleanupOldPasswordHistory;
}
//# sourceMappingURL=AccountSecurityService.d.ts.map