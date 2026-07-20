export interface PasswordlessConfig {
    tokenExpirationMinutes: number;
    codeExpirationMinutes: number;
    maxAttempts: number;
    frontendUrl: string;
    rateLimitPerHour: number;
}
export interface SendMagicLinkResult {
    success: boolean;
    message: string;
    expiresAt: Date;
    tokenId: string;
}
export interface SendCodeResult {
    success: boolean;
    message: string;
    expiresAt: Date;
    tokenId: string;
}
export interface VerifyTokenResult {
    valid: boolean;
    userId?: string;
    email: string;
    purpose: string;
    isNewUser: boolean;
}
export interface PasswordlessSessionMetadata {
    ipAddress?: string;
    userAgent?: string;
}
export declare class PasswordlessService {
    private readonly tokenRepository;
    private readonly userRepository;
    private readonly config;
    constructor();
    sendMagicLink(email: string, purpose?: 'login' | 'register' | 'link_account' | 'verify_email', metadata?: PasswordlessSessionMetadata): Promise<SendMagicLinkResult>;
    verifyMagicLink(token: string, metadata?: PasswordlessSessionMetadata): Promise<VerifyTokenResult>;
    sendLoginCode(email: string, purpose?: 'login' | 'register' | 'link_account' | 'verify_email', metadata?: PasswordlessSessionMetadata): Promise<SendCodeResult>;
    verifyCode(email: string, code: string, metadata?: PasswordlessSessionMetadata): Promise<VerifyTokenResult>;
    private invalidateTokens;
    cleanupExpiredTokens(): Promise<number>;
    private checkRateLimit;
    private sendMagicLinkEmail;
    private sendCodeEmail;
    private generateCode;
    private hashToken;
    getStats(): Promise<{
        activeTokens: number;
        usedTokens24h: number;
        expiredTokens: number;
    }>;
}
//# sourceMappingURL=PasswordlessService.d.ts.map