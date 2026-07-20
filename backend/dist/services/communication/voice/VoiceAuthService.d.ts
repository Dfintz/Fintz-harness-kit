interface VoiceAuthToken {
    token: string;
    expiresAt: string;
    connectUrl: string;
    username: string;
}
interface VoiceAuthValidation {
    valid: boolean;
    userId?: string;
    username?: string;
    organizationId?: string;
    organizationName?: string;
    role?: string;
    groups?: string[];
}
export declare class VoiceAuthService {
    private static instance;
    private readonly membershipRepo;
    private readonly orgRepo;
    private constructor();
    static getInstance(): VoiceAuthService;
    generateToken(userId: string, username: string, connectUrl: string, serverScope?: string): Promise<VoiceAuthToken>;
    validateToken(token: string, mumbleUsername: string): Promise<VoiceAuthValidation>;
    revokeToken(token: string): Promise<void>;
    revokeUserTokens(userId: string, serverScope?: string): Promise<number>;
    revokeServerTokens(serverScope: string): Promise<number>;
    private mapRoleToGroups;
    private getTokenSecret;
}
export {};
//# sourceMappingURL=VoiceAuthService.d.ts.map