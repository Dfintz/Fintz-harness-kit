import type { ButtonInteraction } from 'discord.js';
import type { AdvancedEventSettings } from '../../models/DiscordGuildSettings';
export declare const DISCORD_GUEST_NAMESPACE = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
export interface GuestContext {
    guestId: string;
    guestMemberRoleIds: string[];
    advancedEventSettings: AdvancedEventSettings;
}
export declare function resolveGuestContext(interaction: ButtonInteraction): Promise<GuestContext | null>;
export declare function checkGuestVisibility(interaction: ButtonInteraction, activity: {
    visibility: string;
}, guestMemberRoleIds: string[]): {
    allowed: boolean;
    reason?: string;
};
//# sourceMappingURL=eventButtons.guestContext.d.ts.map