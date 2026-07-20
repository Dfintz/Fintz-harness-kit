import { EmbedBuilder } from 'discord.js';
export declare function buildUserStatsEmbed(stats: {
    messageCount: number;
    voiceMinutes: number;
}): EmbedBuilder;
export declare function buildInviteLeaderboardEmbed(topInviters: {
    inviterUserId: string;
    count: number;
}[]): EmbedBuilder;
export declare function buildEngagementLeaderboardEmbed(entries: {
    userId: string;
    total: number;
}[], metric: 'messageCount' | 'voiceMinutes'): EmbedBuilder;
//# sourceMappingURL=statsEmbeds.d.ts.map