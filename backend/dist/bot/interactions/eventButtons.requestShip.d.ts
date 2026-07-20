import { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export declare function handleRequestShip(interaction: ButtonInteraction, activityId: string): Promise<void>;
export declare function handleReqShipRoleSelect(interaction: StringSelectMenuInteraction, activityId: string): Promise<void>;
export declare function handleReqShipTypeSelect(interaction: StringSelectMenuInteraction, activityId: string, shipRole: string): Promise<void>;
export declare function handleReqShipModal(interaction: ModalSubmitInteraction, activityId: string): Promise<void>;
//# sourceMappingURL=eventButtons.requestShip.d.ts.map