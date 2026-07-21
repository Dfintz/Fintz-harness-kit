import { ButtonInteraction, MessageFlags } from 'discord.js';

import { resolveGuestContext, type GuestContext } from './eventButtons.guestContext';
import { resolveInternalUserId } from './eventButtons.identity';

const LINK_ACCOUNT_MESSAGE =
  '❌ Please link your Discord account on the web app first, then try again.';

export interface ResolvedActorContext {
  userId: string;
  isDiscordGuest: boolean;
  guestContext: GuestContext | null;
}

export async function resolveActionActorContext(
  interaction: ButtonInteraction
): Promise<ResolvedActorContext | null> {
  const internalUserId = await resolveInternalUserId(interaction.user.id);
  if (internalUserId) {
    return {
      userId: internalUserId,
      isDiscordGuest: false,
      guestContext: null,
    };
  }

  const guestContext = await resolveGuestContext(interaction);
  if (!guestContext) {
    await interaction.reply({
      content: LINK_ACCOUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return {
    userId: guestContext.guestId,
    isDiscordGuest: true,
    guestContext,
  };
}
