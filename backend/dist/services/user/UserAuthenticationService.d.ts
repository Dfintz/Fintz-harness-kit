import { User } from '../../models/User';
export declare class UserAuthenticationService {
    private userRepository;
    validateCredentials(username: string, password: string): Promise<User | null>;
    validateCredentialsByEmail(email: string, password: string): Promise<User | null>;
    updatePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
    setPassword(userId: string, newPassword: string): Promise<void>;
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hash: string): Promise<boolean>;
    getUserWithPassword(userId: string): Promise<User | null>;
    hasPassword(userId: string): Promise<boolean>;
    getPasswordLastChanged(userId: string): Promise<Date | null>;
    updatePasswordChangedAt(userId: string): Promise<void>;
    passwordNeedsChange(userId: string, maxAgeInDays?: number): Promise<boolean>;
    recordLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void>;
    recordFailedLogin(usernameOrEmail: string, ipAddress?: string): Promise<void>;
    resetFailedLoginAttempts(userId: string): Promise<void>;
    isAccountLocked(userId: string, maxAttempts?: number, lockoutDurationMinutes?: number): Promise<boolean>;
    enableTwoFactorAuth(userId: string, secret: string): Promise<void>;
    disableTwoFactorAuth(userId: string): Promise<void>;
    hasTwoFactorAuth(userId: string): Promise<boolean>;
    getTwoFactorSecret(userId: string): Promise<string | null>;
}
//# sourceMappingURL=UserAuthenticationService.d.ts.map