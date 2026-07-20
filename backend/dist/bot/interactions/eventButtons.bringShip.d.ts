import { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export declare function handleBringShip(interaction: ButtonInteraction, activityId: string): Promise<void>;
export declare function handleHangarShipSelect(interaction: StringSelectMenuInteraction, activityId: string): Promise<void>;
export declare function handleHangarPageSelect(interaction: StringSelectMenuInteraction, activityId: string): Promise<void>;
export declare function handleNestShipSelect(interaction: StringSelectMenuInteraction, activityId: string, childShipKey: string): Promise<void>;
export declare function handleBringShipModal(interaction: ModalSubmitInteraction, activityId: string): Promise<void>;
//# sourceMappingURL=eventButtons.bringShip.d.ts.map