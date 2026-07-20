import { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export declare function handleManageSlots(interaction: ButtonInteraction, activityId: string): Promise<void>;
export declare function handleManageSlotsShipSelect(interaction: StringSelectMenuInteraction, activityId: string): Promise<void>;
export declare function handleManageSlotsModal(interaction: ModalSubmitInteraction, activityId: string, shipIdentifier: string): Promise<void>;
//# sourceMappingURL=eventButtons.manageSlots.d.ts.map