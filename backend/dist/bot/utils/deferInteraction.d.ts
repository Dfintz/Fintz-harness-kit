import { ButtonInteraction, ChannelSelectMenuInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export type DeferrableInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction;
export type InteractionDeferMode = 'reply' | 'ephemeral' | 'update';
export declare function deferInteraction(interaction: DeferrableInteraction, mode?: InteractionDeferMode): Promise<boolean>;
//# sourceMappingURL=deferInteraction.d.ts.map