import type { ButtonInteraction } from 'discord.js';
import { type GuestContext } from './eventButtons.guestContext';
export declare function preJoinChecks(interaction: ButtonInteraction, activityId: string, userId: string, isDiscordGuest: boolean, guestContext: GuestContext | null): Promise<{
    allowed: boolean;
    reason?: string;
}>;
//# sourceMappingURL=eventButtons.preJoinChecks.d.ts.map