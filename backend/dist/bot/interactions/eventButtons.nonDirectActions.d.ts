import { ButtonInteraction } from 'discord.js';
import type { GuestContext } from './eventButtons.guestContext';
export interface ExecuteNonDirectActionParams {
    interaction: ButtonInteraction;
    action: string;
    activityId: string;
    userId: string;
    userName: string;
    isDiscordGuest: boolean;
    guestContext: GuestContext | null;
}
export declare function executeNonDirectAction({ interaction, action, activityId, userId, userName, isDiscordGuest, guestContext, }: ExecuteNonDirectActionParams): Promise<boolean>;
//# sourceMappingURL=eventButtons.nonDirectActions.d.ts.map