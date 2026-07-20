import { EmbedBuilder } from 'discord.js';
interface BotAnalyticsSummaryEmbedInput {
    totalCommands: number;
    successRate: string;
    averageExecutionTime: number;
    uptimeHours: number;
    uptimeMinutes: number;
    uniqueUsers: number;
    wsPing: number;
    uniqueGuilds: number;
    topList: string;
}
export declare function buildBotAnalyticsSummaryEmbed(input: Readonly<BotAnalyticsSummaryEmbedInput>): EmbedBuilder;
export {};
//# sourceMappingURL=analyticsEmbeds.d.ts.map