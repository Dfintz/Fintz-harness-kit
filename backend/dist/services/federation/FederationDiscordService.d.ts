export interface DiscordConflict {
    discordUserId: string;
    discordUsername: string;
    conflictingOrgs: Array<{
        orgId: string;
        orgName: string;
    }>;
    flaggedAt: string;
}
export interface DiscordSyncStatus {
    enabled: boolean;
    centralGuildId: string | null;
    centralGuildName: string | null;
    orgRoleCount: number;
    hierarchyRoleCount: number;
    conflictCount: number;
}
export declare class FederationDiscordService {
    private static instance;
    private readonly federationRepository;
    private readonly memberRepository;
    private readonly membershipRepository;
    private readonly userRepository;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationDiscordService;
    setupCentralGuild(federationId: string, userId: string, guildId: string, guildName: string): Promise<DiscordSyncStatus>;
    unlinkCentralGuild(federationId: string, userId: string): Promise<DiscordSyncStatus>;
    getStatus(federationId: string): Promise<DiscordSyncStatus>;
    private static readonly ALLOWED_SETTING_KEYS;
    updateSetting(federationId: string, userId: string, key: string, value: boolean | string): Promise<void>;
    setOrgRoleMapping(federationId: string, userId: string, orgId: string, discordRoleId: string): Promise<void>;
    setHierarchyRoleMapping(federationId: string, userId: string, federationRole: string, discordRoleId: string): Promise<void>;
    resolveUserRoles(federationId: string, discordUserId: string): Promise<{
        orgRoleId: string | null;
        hierarchyRoleId: string | null;
        conflict: boolean;
        conflictingOrgs: Array<{
            orgId: string;
            orgName: string;
        }>;
    }>;
    getConflictQueue(federationId: string, userId: string): Promise<DiscordConflict[]>;
    resolveConflict(federationId: string, userId: string, discordUserId: string, chosenOrgId: string): Promise<{
        orgRoleId: string | null;
        hierarchyRoleId: string | null;
    }>;
}
//# sourceMappingURL=FederationDiscordService.d.ts.map