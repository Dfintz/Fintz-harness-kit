export interface ReconciliationResult {
    guildId: string;
    organizationId: string;
    guildName?: string;
    rolesAssigned: number;
    rolesRemoved: number;
    nicknamesSynced: number;
    membersScanned: number;
    errors: string[];
    durationMs: number;
}
export interface ReconciliationPassResult {
    guildsProcessed: number;
    guildsSkipped: number;
    totalRolesAssigned: number;
    totalRolesRemoved: number;
    totalNicknamesSynced: number;
    totalMembersScanned: number;
    totalErrors: number;
    results: ReconciliationResult[];
    durationMs: number;
}
export declare class DiscordReconciliationService {
    private static instance;
    private readonly settingsService;
    private processing;
    private constructor();
    static getInstance(): DiscordReconciliationService;
    runPass(force?: boolean): Promise<ReconciliationPassResult>;
    private loadDueSettings;
    private processGuilds;
    private accumulateResult;
    private reconcileGuild;
    private buildOrgDiscordMap;
    private processGuildMembers;
    private reconcileMember;
    private reconcileOrgMember;
    private reconcileNonOrgMember;
    private syncNickname;
    private fetchAllGuildMembers;
    private collectManagedRoleIds;
    private formatNickname;
    private safeAddRole;
    private safeRemoveRole;
    private getClient;
    private emptyPassResult;
    private delay;
}
//# sourceMappingURL=DiscordReconciliationService.d.ts.map