import { Repository } from 'typeorm';
import { Organization } from '../../models/Organization';
import { User } from '../../models/User';
import { RsiApiService, type RsiVerificationResult } from '../external/RSIApiService';
import { RsiNotificationService } from './RsiNotificationService';
export interface InitiateVerificationResult {
    success: boolean;
    verificationCode?: string;
    verificationUrl?: string;
    expiresAt?: Date;
    rsiHandle?: string;
    error?: string;
    isExternalError?: boolean;
}
export interface CompleteVerificationResult {
    success: boolean;
    verified: boolean;
    rsiHandle?: string;
    displayName?: string;
    error?: string;
}
export interface VerificationStatusResult {
    rsiHandle?: string;
    rsiCitizenRecord?: string;
    verified: boolean;
    verifiedAt?: Date;
    pendingVerification: boolean;
    verificationCodeExpiresAt?: Date;
}
export interface OrgOwnershipVerificationResult {
    success: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    orgSid?: string;
    orgName?: string;
    userRank?: string;
    error?: string;
    rsiOrgData?: {
        description?: string;
        logo?: string;
        banner?: string;
        archetype?: string;
        commitment?: string;
        memberCount?: number;
        focus?: {
            primary?: string;
            secondary?: string;
        };
        recruiting?: string;
        language?: string;
        links?: Record<string, string>;
    };
}
export declare class RsiVerificationService {
    private readonly userRepository;
    private readonly organizationRepository;
    private readonly membershipRepository;
    private readonly rsiApiService;
    private readonly notificationService;
    private readonly VERIFICATION_CODE_VALIDITY_HOURS;
    private static readonly MIN_ADMIN_STARS;
    private static readonly OWNER_RANKS;
    private static readonly ADMIN_RANKS;
    private readonly VERIFICATION_CODE_PREFIX;
    constructor(userRepository?: Repository<User>, organizationRepository?: Repository<Organization>, rsiApiService?: RsiApiService, notificationService?: RsiNotificationService);
    private generateVerificationCode;
    private hashVerificationCode;
    private verifyCodeHash;
    initiateVerification(userId: string, rsiHandle: string): Promise<InitiateVerificationResult>;
    private setPublicProfileVerified;
    private sendFailureNotification;
    private getCompletionContext;
    private fetchVerificationProfileData;
    private getCitizenRecordToPersist;
    private isCitizenRecordAlreadyVerifiedByAnotherUser;
    private toOptionalString;
    completeVerification(userId: string): Promise<CompleteVerificationResult>;
    autoDetectUserVerifications(limit?: number): Promise<{
        checked: number;
        verified: number;
    }>;
    autoDetectOrganizationVerifications(limit?: number): Promise<{
        checked: number;
        verified: number;
    }>;
    getVerificationStatus(userId: string): Promise<VerificationStatusResult>;
    removeVerification(userId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    private resolveRsiOrgSid;
    private verifyRsiOrgMembership;
    private fetchRsiOrgContent;
    private getRsiMembershipError;
    private checkWebAppOrgPermission;
    initiateOrganizationVerification(userId: string, orgId: string, rsiOrgSid: string): Promise<InitiateVerificationResult>;
    completeOrganizationVerification(userId: string, orgId: string): Promise<CompleteVerificationResult>;
    verifyOrganizationByRank(userId: string, orgId: string, rsiOrgSid: string): Promise<CompleteVerificationResult>;
    verifyOrganizationOwnership(userId: string, orgSid: string): Promise<OrgOwnershipVerificationResult>;
    lookupRsiUser(handle: string): Promise<RsiVerificationResult>;
    lookupRsiOrganization(sid: string): Promise<{
        found: boolean;
        data?: {
            sid?: string;
            name?: string;
            description?: string;
            logo?: string;
            banner?: string;
            memberCount?: number;
            focus?: {
                primary?: string;
                secondary?: string;
            };
            archetype?: string;
            commitment?: string;
            recruiting?: string;
            language?: string;
            links?: Record<string, string>;
            [key: string]: unknown;
        };
        error?: string;
    }>;
    requestManualVerification(userId: string, rsiHandle: string, reason?: string): Promise<{
        success: boolean;
        requestId?: string;
        error?: string;
    }>;
    processManualVerification(userId: string, adminId: string, approved: boolean, notes?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getPendingManualVerifications(): Promise<{
        users: {
            id: string;
            rsiHandle: string;
            requestedAt: Date;
            reason?: string;
        }[];
        error?: string;
    }>;
    private syncVerificationToUserLinks;
    private clearUserLinksOnRemoval;
    private syncVerifiedDiscordRole;
    private removeVerifiedDiscordRole;
    private getUserOrgIds;
}
//# sourceMappingURL=RsiVerificationService.d.ts.map