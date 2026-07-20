import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
type RepliableInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;
export declare function safeReply(interaction: RepliableInteraction, options: {
    content: string;
    flags?: (typeof MessageFlags)['Ephemeral'];
}): Promise<void>;
export declare function handleCommandError(interaction: RepliableInteraction, error: unknown, context: string, guidance?: string): Promise<void>;
export {};
//# sourceMappingURL=commandErrorHandler.d.ts.map