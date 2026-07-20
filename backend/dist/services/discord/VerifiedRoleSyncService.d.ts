import type { Guild, Role } from 'discord.js';
export declare class VerifiedRoleSyncService {
    private static instance;
    private readonly settingsService;
    private readonly guildOrgService;
    private constructor();
    static getInstance(): VerifiedRoleSyncService;
    assignVerifiedRole(discordId: string, orgIds: string[], rsiHandle?: string): Promise<void>;
    removeVerifiedRole(discordId: string, orgIds: string[]): Promise<void>;
    setupVerifiedRole(guild: Guild, orgId: string, roleId?: string): Promise<Role | null>;
    private assignInGuild;
    private syncNicknameInGuild;
    private removeInGuild;
    private ensureVerifiedRole;
    private createVerifiedRole;
    private persistVerifiedRoleId;
    private getClient;
}
//# sourceMappingURL=VerifiedRoleSyncService.d.ts.map