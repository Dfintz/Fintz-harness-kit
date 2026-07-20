export declare class PasswordResetService {
    private readonly tokenRepository;
    private readonly userRepository;
    private readonly TOKEN_EXPIRATION_HOURS;
    private readonly MAX_ACTIVE_TOKENS;
    requestPasswordReset(email: string): Promise<{
        message: string;
    }>;
    verifyResetToken(token: string): Promise<{
        valid: boolean;
        userId: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    private generateSecureToken;
    private hashToken;
    private invalidateUserTokens;
    cleanupExpiredTokens(): Promise<number>;
    getActiveTokenCount(userId: string): Promise<number>;
    private sendPasswordResetEmail;
    private sendPasswordResetConfirmationEmail;
}
//# sourceMappingURL=PasswordResetService.d.ts.map