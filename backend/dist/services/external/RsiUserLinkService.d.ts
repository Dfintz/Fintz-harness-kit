import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';
import type { CreateUserLinkInput, OrgSyncConfig, OrgSyncResult, UserSyncResult, VerificationResult } from './RsiUserLinkService.types';
export { AffiliateHandling } from './RsiUserLinkService.types';
export type { CreateUserLinkInput, OrgSyncConfig, OrgSyncResult, UserSyncResult, VerificationResult, } from './RsiUserLinkService.types';
export declare class RsiUserLinkService {
    private userLinkRepository;
    private roleMappingRepository;
    private _teamService?;
    private get teamService();
    constructor();
    createLink(input: CreateUserLinkInput): Promise<RsiUserLink>;
    getLinkById(id: string): Promise<RsiUserLink | null>;
    getLinkByUserAndOrg(userId: string, organizationId: string): Promise<RsiUserLink | null>;
    getLinksByUser(userId: string): Promise<RsiUserLink[]>;
    getLinksByOrganization(organizationId: string, includeRemoved?: boolean): Promise<RsiUserLink[]>;
    getLinkByHandleAndOrg(rsiHandle: string, organizationId: string): Promise<RsiUserLink | null>;
    getLinkByDiscordAndOrg(discordUserId: string, organizationId: string): Promise<RsiUserLink | null>;
    updateLink(id: string, updates: Partial<Pick<RsiUserLink, 'rsiHandle' | 'discordUserId' | 'metadata' | 'lastKnownRank'>>): Promise<RsiUserLink | null>;
    deleteLink(id: string): Promise<boolean>;
    unlinkUser(userId: string, organizationId: string): Promise<boolean>;
    syncVerifiedUserAcrossOrganizations(userId: string, rsiHandle: string, organizationIds: string[], discordUserId?: string): Promise<void>;
    removeAllLinksForUser(userId: string): Promise<void>;
    verifyLink(linkId: string, rsiOrgSid: string): Promise<VerificationResult>;
    manuallyVerify(linkId: string): Promise<RsiUserLink | null>;
    bulkManuallyVerify(linkIds: string[]): Promise<{
        verified: number;
        failed: number;
        results: {
            linkId: string;
            success: boolean;
            rsiHandle?: string;
            error?: string;
        }[];
    }>;
    bulkCreateAndVerify(organizationId: string, entries: {
        userId: string;
        rsiHandle: string;
        discordUserId?: string;
    }[]): Promise<{
        created: number;
        skipped: number;
        failed: number;
        results: {
            userId: string;
            rsiHandle: string;
            success: boolean;
            linkId?: string;
            error?: string;
        }[];
    }>;
    private verifyBioCode;
    verifyBioCodeOnly(link: RsiUserLink): Promise<VerificationResult>;
    private hasCitizenRecordConflict;
    private syncVerificationToUser;
    private clearVerificationFromUser;
    private verifyDiscordMatch;
    regenerateVerificationCode(linkId: string): Promise<string | null>;
    syncUserRoles(linkId: string, config: OrgSyncConfig, discordService?: {
        assignRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
        removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
    }): Promise<UserSyncResult>;
    private syncInternalRole;
    private syncTeamAssignments;
    private handleDepartedMember;
    runOrganizationSync(organizationId: string, config: OrgSyncConfig, discordService?: {
        assignRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
        removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
    }): Promise<OrgSyncResult>;
    getUserLinkStatus(userId: string, organizationId: string): Promise<{
        linked: boolean;
        rsiHandle?: string;
        verified: boolean;
        syncStatus: SyncStatus;
        lastSynced?: Date;
        rank?: string;
        isAffiliate: boolean;
        verificationCode?: string;
    }>;
    getOrgSyncStats(organizationId: string): Promise<{
        totalLinks: number;
        verified: number;
        pending: number;
        synced: number;
        failed: number;
        removed: number;
        needsReview: number;
        affiliates: number;
    }>;
}
export declare const rsiUserLinkService: RsiUserLinkService;
//# sourceMappingURL=RsiUserLinkService.d.ts.map