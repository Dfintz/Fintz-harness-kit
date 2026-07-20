import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { LFGPost } from '../../types';
import { BotCommand } from './types';
export declare const JOIN_LIMIT_PER_HOUR = 15;
export declare function lfgPostRateLimitKey(guildId: string | null | undefined, userId: string): string;
export declare function lfgJoinRateLimitKey(guildId: string | null | undefined, userId: string): string;
export declare function _resolveLfgMentionRoleIdForGuild(guildId: string): Promise<string | undefined>;
export declare function _buildLfgListView(posts: LFGPost[], page: number): {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
};
export declare const lfg: BotCommand;
//# sourceMappingURL=lfg.d.ts.map