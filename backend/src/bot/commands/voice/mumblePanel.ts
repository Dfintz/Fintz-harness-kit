import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Build the "Join Server" button row for the Mumble status embed.
 * Returns null if the server is offline or user doesn't have access.
 */
export function buildMumbleButtons(
  connectUrl: string | undefined,
  isOnline: boolean,
  hasAccess: boolean
): ActionRowBuilder<ButtonBuilder> | null {
  if (!connectUrl || !isOnline || !hasAccess) {
    return null;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Join Server')
      .setStyle(ButtonStyle.Link)
      .setURL(connectUrl)
      .setEmoji('🎧')
  );

  return row;
}
