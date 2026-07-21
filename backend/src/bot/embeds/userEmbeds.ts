import { EmbedBuilder } from 'discord.js';

import { EmbedColors } from '../utils/embedBuilder';

interface UserPublicHangarSnapshotEmbedInput {
  displayName: string;
  totalShips: number;
  needsInsurance: number;
  totalValue: number;
  publicCount: number;
  orgCount: number;
  allianceCount: number;
  statusBreakdown: string;
  roleBreakdown: string;
  topShips: string;
  hangarUrl: string;
}

/**
 * Build the /user root hub embed shown above the category buttons.
 */
export function buildUserRootHubEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('🧑 User Command Hub')
    .setDescription(
      [
        'Quick access to personal panel tools.',
        '',
        '🚀 **Hangar** — Open user hangar subpanel',
        '🔐 **RSI Verification** — Open verify flow handoff',
        '🔔 **Notifications** — Open notify flow handoff',
        '📊 **SCStats** — Show SCStats summary panel',
        '👤 **Profile** — Open profile quick actions',
        '🛡️ **Security** — Open security quick actions',
        '🔒 **Privacy** — Open privacy quick actions',
        '⚙️ **Account Settings** — Open account quick actions',
        '❓ **Help** — Access help, FAQ, and setup guides',
      ].join('\n')
    )
    .setFooter({ text: 'User panel root' })
    .setTimestamp();
}

/**
 * Build the public hangar snapshot embed posted by the /user hangar panel.
 */
export function buildUserPublicHangarSnapshotEmbed(
  input: Readonly<UserPublicHangarSnapshotEmbedInput>
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`🚀 Hangar Summary — ${input.displayName}`)
    .setURL(input.hangarUrl)
    .setDescription('Snapshot shared from the SC Fleet Manager Discord panel.')
    .addFields(
      {
        name: 'Inventory',
        value:
          `Total ships: **${input.totalShips}**\n` +
          `Insurance due (30d): **${input.needsInsurance}**\n` +
          `Estimated value: **${Math.round(input.totalValue).toLocaleString()}**`,
        inline: true,
      },
      {
        name: 'Sharing',
        value:
          `Public: **${input.publicCount}**\n` +
          `Org: **${input.orgCount}**\n` +
          `Alliance: **${input.allianceCount}**`,
        inline: true,
      },
      {
        name: 'Status Breakdown',
        value: input.statusBreakdown,
        inline: true,
      },
      {
        name: 'Role Breakdown',
        value: input.roleBreakdown,
        inline: true,
      },
      {
        name: 'Top 3 Ships',
        value: input.topShips,
        inline: false,
      }
    )
    .setFooter({ text: 'Open full details in the web hangar' })
    .setTimestamp();
}
