import { InviteTracking } from '../../models/MemberEngagement';
export declare class InviteTrackingService {
    private static instance;
    private readonly repo;
    private readonly inviteCache;
    constructor();
    static getInstance(): InviteTrackingService;
    cacheGuildInvites(guild: import('discord.js').Guild): Promise<void>;
    handleMemberJoin(member: import('discord.js').GuildMember): Promise<void>;
    getInviterStats(guildId: string, inviterUserId: string): Promise<{
        totalInvites: number;
    }>;
    getInviterOf(guildId: string, invitedUserId: string): Promise<InviteTracking | null>;
    getTopInviters(guildId: string, limit?: number): Promise<{
        inviterUserId: string;
        count: number;
    }[]>;
}
//# sourceMappingURL=InviteTrackingService.d.ts.map