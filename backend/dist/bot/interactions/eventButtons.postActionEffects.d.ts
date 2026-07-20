import type { ButtonInteraction } from 'discord.js';
export interface RunPostActionEffectsParams {
    interaction: ButtonInteraction;
    action: string;
    activityId: string;
    userId: string;
    userName: string;
    isDiscordGuest: boolean;
    isEphemeralSource: boolean;
}
export declare function runPostActionEffects({ interaction, action, activityId, userId, userName, isDiscordGuest, isEphemeralSource, }: RunPostActionEffectsParams): Promise<void>;
//# sourceMappingURL=eventButtons.postActionEffects.d.ts.map