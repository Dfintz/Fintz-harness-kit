import type { VerificationMethod } from '../../models/RsiUserLink';
export interface CreateUserLinkInput {
    userId: string;
    organizationId: string;
    rsiHandle: string;
    verificationMethod: VerificationMethod;
    discordUserId?: string;
}
export interface VerificationResult {
    success: boolean;
    verified: boolean;
    error?: string;
    rank?: string;
    isAffiliate?: boolean;
}
export interface UserSyncResult {
    userId: string;
    rsiHandle: string;
    success: boolean;
    rolesAdded: string[];
    rolesRemoved: string[];
    newRank?: string;
    previousRank?: string;
    error?: string;
    isRemoved?: boolean;
}
export interface OrgSyncResult {
    organizationId: string;
    totalUsers: number;
    synced: number;
    failed: number;
    removed: number;
    errors: string[];
    duration: number;
    userResults: UserSyncResult[];
}
export declare enum AffiliateHandling {
    INCLUDE = "include",
    EXCLUDE = "exclude",
    SPECIAL_ROLE = "special_role"
}
export interface OrgSyncConfig {
    affiliateHandling: AffiliateHandling;
    affiliateRoleId?: string;
    removeRolesOnLeave: boolean;
    guildId: string;
    rsiOrgSid: string;
}
//# sourceMappingURL=RsiUserLinkService.types.d.ts.map