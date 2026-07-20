import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export declare function refreshEventEmbed(interaction: ButtonInteraction, activityId: string): Promise<void>;
export declare function refreshEventEmbedFromChannel(interaction: ModalSubmitInteraction | StringSelectMenuInteraction | ButtonInteraction, activityId: string): Promise<void>;
//# sourceMappingURL=eventButtons.refresh.d.ts.map