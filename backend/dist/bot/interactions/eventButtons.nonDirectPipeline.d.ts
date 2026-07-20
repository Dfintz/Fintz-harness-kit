import type { ButtonInteraction } from 'discord.js';
import type { GuestContext } from './eventButtons.guestContext';
export interface RunDeferredNonDirectPipelineParams {
    interaction: ButtonInteraction;
    action: string;
    activityId: string;
    userId: string;
    userName: string;
    isDiscordGuest: boolean;
    guestContext: GuestContext | null;
    isEphemeralSource: boolean;
}
export declare function runDeferredNonDirectPipeline({ interaction, action, activityId, userId, userName, isDiscordGuest, guestContext, isEphemeralSource, }: RunDeferredNonDirectPipelineParams): Promise<void>;
//# sourceMappingURL=eventButtons.nonDirectPipeline.d.ts.map