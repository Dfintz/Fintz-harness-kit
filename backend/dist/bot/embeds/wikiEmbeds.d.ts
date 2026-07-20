import { EmbedBuilder } from 'discord.js';
export interface WikiPageInput {
    title: string;
    slug: string;
    content?: string | null;
    version: number;
    isLocked: boolean;
    updatedAt: string | Date;
}
export interface WikiSearchResultInput {
    title: string;
    slug: string;
    snippet?: string | null;
}
export declare function buildWikiNoResultsEmbed(query: string): EmbedBuilder;
export declare function buildWikiSearchEmbed(query: string, results: readonly WikiSearchResultInput[]): EmbedBuilder;
export declare function buildWikiPageEmbed(page: WikiPageInput): EmbedBuilder;
//# sourceMappingURL=wikiEmbeds.d.ts.map