import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { Poll, PollOption } from '../../models/Poll';
import { PollResults } from '../../services/poll/PollService';
export declare function buildPollEmbed(poll: Poll, results?: PollResults): EmbedBuilder;
export declare function buildPollButtons(pollId: string, options: PollOption[], isClosed?: boolean): ActionRowBuilder<ButtonBuilder>[];
export declare function parsePollButtonId(customId: string): {
    action: 'vote';
    optionIndex: number;
    pollId: string;
} | {
    action: 'results' | 'close';
    pollId: string;
} | {
    action: 'listpage';
    page: number;
} | null;
//# sourceMappingURL=pollEmbed.d.ts.map