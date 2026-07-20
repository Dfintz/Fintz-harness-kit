import { EmbedBuilder } from 'discord.js';
interface DiscoverPaginationInput {
    total: number;
    page: number;
    totalPages: number;
}
interface LfgUserStatsInput {
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    successRate: number;
    averageDuration?: number | null;
    favoriteActivity?: string | null;
    totalPlayersEncountered: number;
}
export declare function buildNoOpportunitiesEmbed(): EmbedBuilder;
export declare function buildDiscoveredOpportunitiesEmbed(lines: string[], pagination: Readonly<DiscoverPaginationInput>): EmbedBuilder;
export declare function buildNoGroupsFoundEmbed(description: string): EmbedBuilder;
export declare function buildActiveLfgGroupsEmbed(lines: string[], totalFound: number): EmbedBuilder;
export declare function buildLfgStatsEmbed(displayName: string, avatarUrl: string, stats: Readonly<LfgUserStatsInput>): EmbedBuilder;
export {};
//# sourceMappingURL=discoverEmbeds.d.ts.map