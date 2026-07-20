import { type BaseMessageOptions, ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
type RepliableInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;
export declare function dmAwareReply(interaction: RepliableInteraction, payload: BaseMessageOptions & {
    content?: string;
}): Promise<void>;
export declare function dmAwareEditReply(interaction: RepliableInteraction, payload: BaseMessageOptions & {
    content?: string;
}): Promise<void>;
export {};
//# sourceMappingURL=dmAwareReply.d.ts.map