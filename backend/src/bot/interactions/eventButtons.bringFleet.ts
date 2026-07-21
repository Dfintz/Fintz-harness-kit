import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import { AppDataSource } from '../../config/database';
import { ParticipantRole } from '../../models/Activity';
import { FleetShip } from '../../models/FleetShip';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { buildCustomId } from '../utils/customId';

import { resolveDiscordIdMap } from './eventButtons.embedData';
import { resolveInternalUserId } from './eventButtons.identity';
import { refreshEventEmbedFromChannel } from './eventButtons.refresh';
import { sanitizeErrorForUser } from './eventButtons.security';
import {
  getActivityService,
  getFleetService,
  getParticipantService,
} from './eventButtons.services';

/**
 * Batch-count ships per fleet from the FleetShip join table — the canonical
 * fleet→ship store. Returns a map of fleetId → ship count; fleets with no join
 * rows are simply absent.
 */
async function getFleetShipCounts(fleetIds: string[]): Promise<Map<string, number>> {
  if (fleetIds.length === 0 || !AppDataSource.isInitialized) {
    return new Map();
  }
  const rows = await AppDataSource.getRepository(FleetShip)
    .createQueryBuilder('fs')
    .select('fs.fleetId', 'fleetId')
    .addSelect('COUNT(*)', 'count')
    .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
    .groupBy('fs.fleetId')
    .getRawMany<{ fleetId: string; count: string }>();
  return new Map(rows.map(r => [r.fleetId, Number(r.count)]));
}

/**
 * Build the DM embed sent to each fleet member when a fleet is brought to an event.
 */
function buildFleetInviteEmbed(
  activityTitle: string,
  fleetName: string,
  bringerName: string,
  ships: Array<{ shipName: string }>
): EmbedBuilder {
  const lines = [
    `**${bringerName}** brought the fleet **${fleetName}** to this event and invited you.`,
  ];
  if (ships.length > 0) {
    const shipList = ships.map(ship => ship.shipName).join(', ');
    lines.push(
      '',
      `Your ship${ships.length > 1 ? 's' : ''} in this fleet: **${shipList}**`,
      'Join and loan your ship, join without it, or decline.'
    );
  } else {
    lines.push('', 'Will you join?');
  }
  return new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle(`🛰️ Fleet event: ${activityTitle}`)
    .setDescription(lines.join('\n'));
}

/**
 * Build the DM action row.
 */
function buildFleetInviteButtons(
  activityId: string,
  fleetId: string,
  hasShips: boolean
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (hasShips) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('event', 'fleetjoinship', activityId, fleetId))
        .setLabel('Join with ship')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId(buildCustomId('event', 'fleetjoinonly', activityId, fleetId))
        .setLabel('Join without ship')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✅')
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('event', 'fleetjoinonly', activityId, fleetId))
        .setLabel('Join')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('event', 'fleetdecline', activityId, fleetId))
      .setLabel('Decline')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );
  return row;
}

export async function handleBringFleet(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (!internalUserId) {
      await interaction.editReply({
        content: '❌ Please link your Discord account on the web app first, then try again.',
      });
      return;
    }

    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: '⚠️ Activity no longer exists.' });
      return;
    }
    if (!activity.organizationId) {
      await interaction.editReply({
        content: '⚠️ This event is not tied to an organization, so fleets cannot be brought.',
      });
      return;
    }

    const isCreator =
      activity.creatorId === internalUserId || activity.creatorId === interaction.user.id;

    const fleets = await getFleetService().getAllFleets(activity.organizationId);
    const ledFleets = fleets.filter(
      f => f.leaderId === internalUserId || f.secondInCommandId === internalUserId
    );
    const selectableFleets = isCreator ? fleets : ledFleets;
    if (selectableFleets.length === 0) {
      await interaction.editReply({
        content: isCreator
          ? '⚠️ No fleets are available in this organization.'
          : '⚠️ You don’t lead any fleets in this org. Only a fleet leader or the event organiser can bring a fleet.',
      });
      return;
    }

    const visibleFleets = selectableFleets.slice(0, 25);
    const shipCounts = await getFleetShipCounts(visibleFleets.map(f => f.id));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_bringfleetselect_${activityId}`)
      .setPlaceholder('Select a fleet to bring…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        visibleFleets.map(fleet => {
          const shipCount = shipCounts.get(fleet.id) ?? fleet.shipIds?.length ?? 0;
          return {
            label: (fleet.name || 'Unnamed fleet').slice(0, 100),
            description: `${shipCount} ship(s) · ${fleet.members?.length ?? 0} member(s)`.slice(
              0,
              100
            ),
            value: fleet.id,
          };
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await interaction.editReply({
      content: isCreator
        ? '🛰️ **Select a fleet to bring.** As organiser, you can bring any org fleet.'
        : '🛰️ **Select a fleet to bring.** All its ships will be added and its members invited.',
      components: [row],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}

export async function handleBringFleetSelect(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferUpdate();

  const fleetId = interaction.values[0];
  const userId = await resolveInternalUserId(interaction.user.id);
  if (!userId) {
    await interaction.followUp({
      content: '❌ Please link your Discord account on the web app first, then try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.followUp({
        content: '⚠️ Activity no longer exists.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const plan = await getActivityService().getFleetBringPlan(fleetId);

    const actorShipIds = (plan.memberShips.get(userId) ?? []).map(ship => ship.shipId);
    const upfrontShipIds = Array.from(new Set([...plan.orphanShipIds, ...actorShipIds]));
    if (upfrontShipIds.length > 0) {
      await getActivityService().bringFleetToActivity(activityId, userId, fleetId, upfrontShipIds);
    }

    const inviteResult = await getActivityService().inviteFleetMembers(activityId, userId, fleetId);

    const discordIdMap = await resolveDiscordIdMap(inviteResult.invited);
    let dmCount = 0;
    for (const memberId of inviteResult.invited) {
      const discordId = discordIdMap.get(memberId);
      if (!discordId) {
        continue;
      }
      try {
        const user = await interaction.client.users.fetch(discordId);
        const memberShips = plan.memberShips.get(memberId) ?? [];
        await user.send({
          embeds: [
            buildFleetInviteEmbed(
              activity.title,
              plan.fleetName,
              interaction.user.username,
              memberShips
            ),
          ],
          components: [buildFleetInviteButtons(activityId, fleetId, memberShips.length > 0)],
        });
        dmCount++;
      } catch {
        // DMs closed or user fetch failed — they keep the on-card invite.
      }
    }

    const skippedNote =
      inviteResult.skipped.length > 0 ? ` (${inviteResult.skipped.length} already in)` : '';
    await interaction.followUp({
      content:
        `🛰️ Fleet **${plan.fleetName}** brought in. Added **${upfrontShipIds.length}** ship(s), ` +
        `invited **${inviteResult.invited.length}** member(s)${skippedNote}, and DM’d **${dmCount}** ` +
        `to bring their own ship.`,
      flags: MessageFlags.Ephemeral,
    });

    await refreshEventEmbedFromChannel(interaction, activityId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: interaction.user.username,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_FLEET_BROUGHT',
      message: `Brought fleet ${fleetId} to event ${activityId}; ships=${upfrontShipIds.length}; invited=${inviteResult.invited.length}; dmed=${dmCount}`,
      metadata: {
        activityId,
        fleetId,
        upfrontShips: upfrontShipIds.length,
        invited: inviteResult.invited.length,
        skipped: inviteResult.skipped.length,
        dmed: dmCount,
      },
    });
  } catch (error: unknown) {
    await interaction.followUp({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleFleetInviteResponse(
  interaction: ButtonInteraction,
  action: 'joinship' | 'joinonly' | 'decline',
  activityId: string,
  fleetId: string
): Promise<void> {
  await interaction.deferUpdate();

  const memberId = await resolveInternalUserId(interaction.user.id);
  if (!memberId) {
    await interaction.editReply({
      content: '❌ Please link your Discord account on the web app first, then try again.',
      embeds: [],
      components: [],
    });
    return;
  }

  try {
    if (action === 'decline') {
      await getActivityService().updateRSVPStatus(
        activityId,
        memberId,
        'declined',
        ParticipantRole.ANY
      );
      await interaction.editReply({
        content: '❌ You declined the fleet event. No worries — maybe next time!',
        embeds: [],
        components: [],
      });
      return;
    }

    await getActivityService().updateRSVPStatus(
      activityId,
      memberId,
      'accepted',
      ParticipantRole.MEMBER
    );

    let shipNote = '';
    if (action === 'joinship') {
      const { memberShips } = await getActivityService().getFleetBringPlan(fleetId);
      const ships = memberShips.get(memberId) ?? [];
      for (const ship of ships) {
        await getParticipantService().addShip(activityId, memberId, {
          shipType: ship.shipName,
          shipName: ship.shipName,
          captainId: memberId,
          captainName: interaction.user.username,
          maxCrew: ship.maxCrew,
        });
      }
      if (ships.length > 0) {
        shipNote = `\n🚀 Loaned **${ships.map(ship => ship.shipName).join(', ')}** to the event.`;
      }
    }

    await interaction.editReply({
      content: `✅ You’re in!${shipNote}`,
      embeds: [],
      components: [],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ ${sanitizeErrorForUser(getErrorMessage(error))}`,
      embeds: [],
      components: [],
    });
  }
}
