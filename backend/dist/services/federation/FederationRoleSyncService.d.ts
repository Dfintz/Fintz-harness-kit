import type { Guild, GuildMember } from 'discord.js';
import { Federation } from '../../models/Federation';
export declare class FederationRoleSyncService {
    private static instance;
    static getInstance(): FederationRoleSyncService;
    evaluateNewMember(federationId: string, member: GuildMember): Promise<void>;
    onOrgJoined(federationId: string, orgId: string, orgName: string): Promise<void>;
    onOrgLeft(federationId: string, orgId: string): Promise<void>;
    private processOrgLeftMember;
    private cleanupOrgRole;
    ensureStructuralRoles(guild: Guild, federation: Federation): Promise<void>;
    private ensureSingleRole;
    private handleNonMember;
    private assignMemberRole;
    private stripFederationRoles;
    private collectManagedRoleIds;
    private safeAddRole;
    private getGuild;
    private loadFederation;
    syncOrgRoles(guild: Guild, federation: Federation): Promise<number>;
    findFederationByGuildId(guildId: string): Promise<Federation | null>;
    private hashOrgColor;
}
//# sourceMappingURL=FederationRoleSyncService.d.ts.map