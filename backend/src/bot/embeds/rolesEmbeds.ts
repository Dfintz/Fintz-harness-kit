import { EmbedBuilder } from 'discord.js';

import type { ReactionRolePanel } from '../../services/discord/ReactionRoleService';

/** Build the /roles panel-list embed from configured reaction-role panels. */
export function buildReactionRolePanelsListEmbed(
  panels: ReadonlyArray<ReactionRolePanel>
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x00d9ff)
    .setTitle('🎭 Reaction Role Panels')
    .setDescription(`${panels.length} panel(s) configured`)
    .setTimestamp();

  for (const panel of panels.slice(0, 10)) {
    const rolesList = panel.roles.map(role => `<@&${role.roleId}>`).join(', ') || 'No roles added';

    embed.addFields({
      name: panel.title,
      value: [
        `Mode: ${panel.exclusive ? 'Exclusive' : 'Multi-select'}`,
        `Roles: ${rolesList}`,
        `ID: \`${panel.id}\``,
      ].join('\n'),
      inline: false,
    });
  }

  return embed;
}
