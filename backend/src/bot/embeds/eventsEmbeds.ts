import { EmbedBuilder } from 'discord.js';

/** Build the `/events` mirror sub-panel embed (create vs post mirror actions). */
export function buildEventMirrorSubPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🪞 Event Mirroring')
    .setDescription(
      '**Create Mirror** — Select one of your events and generate an invite code that others can use to mirror it.\n\n' +
        '**Post Mirror** — Enter an invite code (and password if needed) to post a mirrored event in this channel.'
    );
}
