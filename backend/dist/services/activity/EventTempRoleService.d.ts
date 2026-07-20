import { Client, Guild } from 'discord.js';
import { Activity } from '../../models/Activity';
export declare class EventTempRoleService {
    private static instance;
    static getInstance(): EventTempRoleService;
    createTempRole(guild: Guild, activity: Activity, color?: number): Promise<string | null>;
    assignTempRole(guild: Guild, userId: string, roleId: string, activityId: string): Promise<boolean>;
    removeTempRole(guild: Guild, userId: string, roleId: string, activityId: string): Promise<boolean>;
    deleteTempRole(guild: Guild, roleId: string, activityId: string, reason: string): Promise<boolean>;
    syncTempRoleToParticipants(guild: Guild, activity: Activity, roleId: string): Promise<{
        assigned: number;
        failed: number;
    }>;
    resolveGuild(client: Client, guildId: string): Promise<Guild | null>;
    private buildRoleName;
    private fetchMember;
}
//# sourceMappingURL=EventTempRoleService.d.ts.map