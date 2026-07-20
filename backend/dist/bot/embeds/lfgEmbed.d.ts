import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { LFGPost } from '../../types';
export declare function buildLfgEmbed(post: LFGPost): EmbedBuilder;
export declare function buildLfgButtons(postId: string, isClosed?: boolean): ActionRowBuilder<ButtonBuilder>;
export declare function parseLfgButtonId(customId: string): {
    action: 'join' | 'leave' | 'close';
    postId: string;
} | null;
declare const STAR_LABELS: Record<number, string>;
declare const THUMB_LABELS: Record<string, string>;
declare const THUMB_TO_RATING: Record<string, number>;
export declare function buildLfgDmRatingEmbed(post: LFGPost, sessionId: string): EmbedBuilder;
export declare function buildLfgDmRatingRows(sessionId: string, targets: Array<{
    userId: string;
    displayName: string;
}>): ActionRowBuilder<ButtonBuilder>[];
export declare function buildLfgDmDoneButton(sessionId: string): ActionRowBuilder<ButtonBuilder>;
export declare function buildLfgRatingStarButtons(sessionId: string, targetUserId: string): ActionRowBuilder<ButtonBuilder>;
export declare function buildLfgRatingDetailButton(sessionId: string, targetUserId: string, stars: number): ActionRowBuilder<ButtonBuilder>;
export declare function parseLfgRatingId(customId: string): {
    type: 'star' | 'detail' | 'done' | 'select' | 'thumb' | 'comment';
    sessionId: string;
    targetUserId?: string;
    stars?: number;
    thumbType?: 'up' | 'neutral' | 'down';
} | null;
export declare function buildTeamSuggestionEmbed(matchedUsers: Array<{
    userId: string;
    sharedSessionCount: number;
}>): EmbedBuilder;
export declare function buildTeamSuggestionButtons(guildId: string, matchedUserIds: string[]): ActionRowBuilder<ButtonBuilder>;
export { STAR_LABELS, THUMB_LABELS, THUMB_TO_RATING };
//# sourceMappingURL=lfgEmbed.d.ts.map