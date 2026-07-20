import { EmbedBuilder } from 'discord.js';
interface BriefingUsageStatsInput {
    requestCount: number;
    dailyLimit: number;
    remaining: number;
    totalTokens: number;
}
interface GeneratedMissionBriefingEmbedInput {
    missionTitle: string;
    briefingText: string;
    modelUsed: string;
    tokensUsed: number;
    missionId: string;
}
interface QuickMissionBriefingEmbedInput {
    missionTypeLabel: string;
    briefingText: string;
    modelUsed: string;
    tokensUsed: number;
}
export declare function buildBriefingUsageEmbed(stats: Readonly<BriefingUsageStatsInput>): EmbedBuilder;
export declare function buildGeneratedMissionBriefingEmbed(input: Readonly<GeneratedMissionBriefingEmbedInput>): EmbedBuilder;
export declare function buildQuickMissionBriefingEmbed(input: Readonly<QuickMissionBriefingEmbedInput>): EmbedBuilder;
export {};
//# sourceMappingURL=briefingEmbeds.d.ts.map