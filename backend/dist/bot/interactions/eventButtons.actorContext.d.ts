import { ButtonInteraction } from 'discord.js';
import { type GuestContext } from './eventButtons.guestContext';
export interface ResolvedActorContext {
    userId: string;
    isDiscordGuest: boolean;
    guestContext: GuestContext | null;
}
export declare function resolveActionActorContext(interaction: ButtonInteraction): Promise<ResolvedActorContext | null>;
//# sourceMappingURL=eventButtons.actorContext.d.ts.map