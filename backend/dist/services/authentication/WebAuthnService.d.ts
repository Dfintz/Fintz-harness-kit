import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
export interface WebAuthnConfig {
    rpName: string;
    rpId: string;
    origin: string;
    timeout: number;
    challengeTTL: number;
}
export interface WebAuthnRegistrationResult {
    credentialId: string;
    verified: boolean;
    deviceName?: string;
}
export interface WebAuthnAuthenticationResult {
    userId: string;
    credentialId: string;
    verified: boolean;
    newCounter: number;
}
export interface WebAuthnSessionMetadata {
    ipAddress?: string;
    userAgent?: string;
}
export interface WebAuthnCredentialInfo {
    id: string;
    deviceName?: string;
    createdAt: Date;
    lastUsedAt?: Date;
    useCount: number;
    backedUp: boolean;
    transports?: string[];
}
export interface WebAuthnAuthenticationOptionsWithKey extends PublicKeyCredentialRequestOptionsJSON {
    _challengeKey?: string;
}
export declare class WebAuthnService {
    private readonly credentialRepository;
    private readonly userRepository;
    private readonly config;
    private static readonly CHALLENGE_KEY_PREFIX;
    private readonly fallbackChallenges;
    private challengeCleanupInterval;
    constructor();
    generateRegistrationOptions(userId: string, userName: string): Promise<PublicKeyCredentialCreationOptionsJSON>;
    verifyRegistration(userId: string, response: RegistrationResponseJSON, deviceName?: string, metadata?: WebAuthnSessionMetadata): Promise<WebAuthnRegistrationResult>;
    generateAuthenticationOptions(userId?: string): Promise<WebAuthnAuthenticationOptionsWithKey>;
    verifyAuthentication(response: AuthenticationResponseJSON, challengeKey: string): Promise<WebAuthnAuthenticationResult>;
    getUserCredentials(userId: string): Promise<WebAuthnCredentialInfo[]>;
    updateCredentialName(userId: string, credentialId: string, deviceName: string): Promise<void>;
    removeCredential(userId: string, credentialId: string): Promise<void>;
    removeAllCredentials(userId: string): Promise<number>;
    hasCredentials(userId: string): Promise<boolean>;
    private storeChallenge;
    private getChallenge;
    private clearChallenge;
    private cleanupExpiredFallbackChallenges;
    private guessDeviceName;
    getConfig(): Omit<WebAuthnConfig, 'challengeTTL'>;
    destroy(): void;
}
//# sourceMappingURL=WebAuthnService.d.ts.map