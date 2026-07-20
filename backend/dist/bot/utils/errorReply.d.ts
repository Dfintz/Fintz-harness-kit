import type { ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
type RepliableInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;
interface ReplyOptions {
    readonly context?: string;
    readonly logExtra?: Record<string, unknown>;
}
export declare function formatErrorForUser(error: unknown): string;
export declare function replyWithError(interaction: RepliableInteraction, error: unknown, options?: ReplyOptions): Promise<void>;
export {};
//# sourceMappingURL=errorReply.d.ts.map