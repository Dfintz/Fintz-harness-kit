import { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export declare function parseLfgCommentModalCustomId(customId: string): {
    sessionId: string;
    targetUserId: string;
} | null;
export declare function parseLfgTeamSuggestionCustomId(customId: string): {
    action: 'dismiss' | 'later';
    guildId: string;
} | {
    action: 'create';
    guildId: string;
    memberIds: string[];
} | null;
export declare function handleLfgButton(interaction: ButtonInteraction): Promise<void>;
export declare function handleLfgRatingButton(interaction: ButtonInteraction): Promise<void>;
export declare function handleLfgRatingSelect(interaction: StringSelectMenuInteraction): Promise<void>;
export declare function handleLfgRatingModal(interaction: ModalSubmitInteraction): Promise<void>;
export declare function handleLfgCommentModal(interaction: ModalSubmitInteraction): Promise<void>;
export declare function handleTeamSuggestionButton(interaction: ButtonInteraction): Promise<void>;
//# sourceMappingURL=lfgButtons.d.ts.map