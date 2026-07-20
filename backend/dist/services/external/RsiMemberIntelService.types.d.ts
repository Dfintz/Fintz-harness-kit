export interface MemberIntelCard {
    rsiHandle: string;
    displayName?: string;
    rsiRank?: string;
    rsiStars: number;
    rsiRoles?: string[];
    isMainOrg: boolean;
    isAffiliate: boolean;
    isHidden: boolean;
    isRedacted: boolean;
    avatar?: string;
    enlisted?: string;
    lastCrawledAt?: Date;
    otherOrgs: Array<{
        sid: string;
        name: string;
        rank?: string;
        stars?: number;
        isMain: boolean;
    }>;
    webAppStatus: {
        isLinked: boolean;
        syncStatus?: string;
        userId?: string;
        membershipRole?: string;
        isActiveMember: boolean;
    };
    discordStatus: {
        isInGuild: boolean;
        discordUserId?: string;
        discordRoles: Array<{
            id: string;
            name: string;
        }>;
        expectedDiscordRoleId?: string;
        expectedDiscordRoleName?: string;
        hasCorrectRole: boolean;
    };
    activeFlags: Array<{
        id: string;
        flagType: string;
        severity: string;
        description: string;
        createdAt: Date;
    }>;
    roleMappingStatus: {
        expectedMapping?: {
            rsiRank: string;
            discordRoleId?: string;
            internalRoleId?: string;
        };
        isRankMatchingMapping: boolean;
        isDiscordRoleCorrect: boolean;
        isInternalRoleCorrect: boolean;
        mismatches: string[];
    };
}
export interface MemberIntelSummary {
    rsiHandle: string;
    displayName?: string;
    rsiRank?: string;
    rsiStars: number;
    isMainOrg: boolean;
    isAffiliate: boolean;
    isHidden: boolean;
    isRedacted: boolean;
    isLinked: boolean;
    isInDiscord: boolean;
    activeFlagCount: number;
    hasMismatch: boolean;
}
export interface EnrichmentResult {
    rsiHandle: string;
    orgsFound: number;
    success: boolean;
    error?: string;
}
export interface BatchEnrichmentResult {
    total: number;
    enriched: number;
    failed: number;
    results: EnrichmentResult[];
}
export interface AuditRunResult {
    organizationId: string;
    totalChecked: number;
    flagsCreated: number;
    flagsSkipped: number;
    errors: string[];
    flagsByType: Record<string, number>;
}
export interface RoleMappingMismatch {
    rsiHandle: string;
    userId?: string;
    rsiRank: string;
    expectedMapping: {
        discordRoleId?: string;
        internalRoleId?: string;
    };
    actual: {
        discordRoles: string[];
        internalRoleId?: string;
    };
    issues: string[];
}
export interface RoleMappingValidationResult {
    organizationId: string;
    totalMembers: number;
    validatedMembers: number;
    mismatches: RoleMappingMismatch[];
    unmappedRanks: string[];
    summary: {
        correctDiscordRoles: number;
        incorrectDiscordRoles: number;
        correctInternalRoles: number;
        incorrectInternalRoles: number;
        noMappingDefined: number;
        notInDiscord: number;
    };
}
export interface LinkCandidate {
    userId: string;
    username: string;
    discordId?: string;
    isAlreadyLinked: boolean;
    existingRsiHandle?: string;
}
export interface ManualLinkInput {
    userId: string;
    discordUserId?: string;
}
export interface ManualLinkResult {
    success: boolean;
    linkId: string;
    rsiHandle: string;
    userId: string;
}
export interface ClearCacheResult {
    crawledMembers: number;
    citizenOrgs: number;
    memberCache: number;
}
//# sourceMappingURL=RsiMemberIntelService.types.d.ts.map