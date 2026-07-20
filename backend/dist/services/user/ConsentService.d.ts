import { ConsentType, UserConsent } from '../../models/UserConsent';
export declare class ConsentService {
    private readonly consentRepository;
    private readonly userRepository;
    private readonly userActivityRepository;
    private readonly userShipRepository;
    private readonly activityRepository;
    private readonly userOrganizationRepository;
    private readonly userSessionRepository;
    recordConsent(userId: string, consentType: ConsentType, granted: boolean, metadata?: {
        purpose?: string;
        version?: string;
        ipAddress?: string;
        userAgent?: string;
        expiresAt?: Date;
    }): Promise<UserConsent>;
    getUserConsents(userId: string): Promise<UserConsent[]>;
    hasConsent(userId: string, consentType: ConsentType): Promise<boolean>;
    revokeAllConsents(userId: string): Promise<void>;
    exportUserData(userId: string): Promise<Record<string, unknown>>;
    deleteUserData(userId: string): Promise<number>;
    getConsentStatistics(): Promise<{
        type: ConsentType;
        granted: number;
        revoked: number;
        total: number;
    }[]>;
    getCurrentPolicyVersion(): string;
    checkConsentVersion(userId: string, consentType: ConsentType): Promise<{
        hasConsent: boolean;
        isCurrentVersion: boolean;
        consentedVersion?: string;
        currentVersion: string;
        requiresRenewal: boolean;
    }>;
    getUsersRequiringConsentRenewal(consentType: ConsentType): Promise<string[]>;
    recordConsentWithVersion(userId: string, consentType: ConsentType, granted: boolean, metadata?: {
        purpose?: string;
        ipAddress?: string;
        userAgent?: string;
        expiresAt?: Date;
    }): Promise<UserConsent>;
}
//# sourceMappingURL=ConsentService.d.ts.map