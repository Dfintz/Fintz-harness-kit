export interface LeaderboardEntry {
    userId: string;
    total: number;
}
export declare class MemberEngagementService {
    private static instance;
    private readonly repo;
    constructor();
    static getInstance(): MemberEngagementService;
    private today;
    incrementMessageCount(guildId: string, userId: string, count?: number): Promise<void>;
    addVoiceMinutes(guildId: string, userId: string, minutes: number): Promise<void>;
    getUserStats(guildId: string, userId: string, days?: number): Promise<{
        messageCount: number;
        voiceMinutes: number;
    }>;
    getLeaderboard(guildId: string, metric: 'messageCount' | 'voiceMinutes', days?: number, limit?: number): Promise<LeaderboardEntry[]>;
    getGuildAggregates(guildId: string, days: number): Promise<{
        userId: string;
        messageCount: number;
        voiceMinutes: number;
    }[]>;
    cleanupOldData(retentionDays: number): Promise<number>;
    private dateDaysAgo;
}
//# sourceMappingURL=MemberEngagementService.d.ts.map