import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
export declare function handleBringFleet(interaction: ButtonInteraction, activityId: string): Promise<void>;
export declare function handleBringFleetSelect(interaction: StringSelectMenuInteraction, activityId: string): Promise<void>;
export declare function handleFleetInviteResponse(interaction: ButtonInteraction, action: 'joinship' | 'joinonly' | 'decline', activityId: string, fleetId: string): Promise<void>;
//# sourceMappingURL=eventButtons.bringFleet.d.ts.map