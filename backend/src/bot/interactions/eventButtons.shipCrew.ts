import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import { ParticipantRole } from '../../models/Activity';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';

import {
  buildCrewSelectValue,
  getCrewShipIdentifier,
  parseCrewSelectValue,
} from './eventButtons.crewSelect';
import { resolveInternalUserId } from './eventButtons.identity';
import { getUserFriendlyError } from './eventButtons.messages';
import { refreshEventEmbedFromChannel } from './eventButtons.refresh';
import { sanitizeDiscordInput, sanitizeErrorForUser, truncate } from './eventButtons.security';
import { getActivityService, getParticipantService } from './eventButtons.services';

/** Repeated user-facing message — SonarQube S1192 */
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

export async function handleRemoveShip(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const userId = await resolveInternalUserId(interaction.user.id);
    if (!userId) {
      await interaction.editReply({
        content: '❌ Please link your Discord account on the web app first, then try again.',
      });
      return;
    }

    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
      return;
    }

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const ownedShips = allShips.filter(
      ship => ship.ownerId === userId || ship.contributedByUserId === userId
    );

    if (ownedShips.length === 0) {
      await interaction.editReply({
        content: '⚠️ You have not brought any ships to this event yet.',
      });
      return;
    }

    const options = ownedShips.slice(0, 25).map((ship, index) => {
      const shipIdentifier =
        getCrewShipIdentifier(ship) ?? `${ship.shipType}::${ship.shipName ?? ''}`;
      const crewMembers = ship.crewMembers ?? ship.crew ?? [];
      const crewAssigned = ship.crewAssigned ?? ship.currentCrew ?? crewMembers.length;
      const crewCapacity = ship.crewCapacity ?? ship.maxCrew ?? crewAssigned;
      const shipLabel = ship.shipName?.trim()
        ? `${ship.shipName} (${ship.shipType})`
        : ship.shipType;
      const loanerTag = ship.isLoaner ? ' • loaner' : '';

      return {
        label: truncate(shipLabel || 'Unknown Ship', 100),
        description: truncate(`Crew ${crewAssigned}/${crewCapacity}${loanerTag}`, 100),
        value: buildCrewSelectValue(shipIdentifier, index),
        emoji: ship.isLoaner ? '🏷️' : '🚀',
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_removeshipselect_${activityId}`)
      .setPlaceholder('Select a ship to remove…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const overflowNote =
      ownedShips.length > 25 ? `\nShowing the first 25 of ${ownedShips.length} ships.` : '';

    await interaction.editReply({
      content: `🗑️ **Select a ship to remove from this event:**${overflowNote}`,
      components: [row],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
    });
  }
}

export async function handleRemoveShipSelectMenu(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferUpdate();

  const selection = parseCrewSelectValue(interaction.values[0]);
  const userId = await resolveInternalUserId(interaction.user.id);
  if (!userId) {
    await interaction.followUp({
      content: '❌ Please link your Discord account on the web app first, then try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userName = interaction.user.username;

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.followUp({
        content: MSG_ACTIVITY_NOT_FOUND,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const ownedShips = allShips.filter(
      ship => ship.ownerId === userId || ship.contributedByUserId === userId
    );

    const selectedShip =
      ownedShips.find((ship, index) => {
        const shipIdentifier =
          getCrewShipIdentifier(ship) ?? `${ship.shipType}::${ship.shipName ?? ''}`;
        if (selection.shipIndex !== undefined && selection.shipIndex === index) {
          return shipIdentifier === selection.shipIdentifier;
        }
        return shipIdentifier === selection.shipIdentifier;
      }) ??
      (selection.shipIndex !== undefined && selection.shipIndex >= 0
        ? ownedShips[selection.shipIndex]
        : undefined);

    if (!selectedShip) {
      await interaction.followUp({
        content: '⚠️ Selected ship is no longer available. Click **Remove Ship** and try again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const shipLabel = sanitizeDiscordInput(selectedShip.shipName ?? selectedShip.shipType);
    const hadCrew = (selectedShip.crewMembers ?? selectedShip.crew ?? []).length > 0;

    await getActivityService().removeOwnedShip(
      activityId,
      userId,
      selection.shipIdentifier,
      selection.shipIndex
    );

    await interaction.followUp({
      content: hadCrew
        ? `🗑️ Removed **${shipLabel}** from this event. Crew assignments on that ship were cleared.`
        : `🗑️ Removed **${shipLabel}** from this event.`,
      flags: MessageFlags.Ephemeral,
    });

    await refreshEventEmbedFromChannel(interaction, activityId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: userName,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_SHIP_REMOVED',
      message: `Removed ship ${shipLabel} from event ${activityId}`,
      metadata: { activityId, shipIdentifier: selection.shipIdentifier },
    });
  } catch (error: unknown) {
    await interaction.followUp({
      content: getUserFriendlyError(sanitizeErrorForUser(getErrorMessage(error))),
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleJoinCrew(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
      return;
    }

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const openShips = allShips.filter(
      s => (s.currentCrew ?? s.crewAssigned ?? 0) < (s.maxCrew ?? s.crewCapacity ?? 0)
    );

    const selectableShips = openShips.filter(ship => getCrewShipIdentifier(ship) !== null);

    if (selectableShips.length === 0) {
      await interaction.editReply({
        content: '⚠️ No ships with open crew positions. Ask someone to **Bring Ship** first!',
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_crewselect_${activityId}`)
      .setPlaceholder('Select a ship to join as crew…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        selectableShips.slice(0, 25).map((ship, index) => {
          const current = ship.currentCrew ?? ship.crewAssigned ?? 0;
          const max = ship.maxCrew ?? ship.crewCapacity ?? 0;
          const name = ship.shipName?.trim();
          const type = ship.shipType ?? 'Unknown';
          const label = name ? `${name} (${type})` : type;
          const identifier = getCrewShipIdentifier(ship) ?? `unknown-${index}`;
          return {
            label: (label ?? 'Unknown Ship').slice(0, 100),
            description: `Owner: ${ship.ownerName ?? ship.captainName ?? 'Unknown'} — ${current}/${max} crew`,
            value: buildCrewSelectValue(identifier, index),
          };
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({
      content: '🚀 **Select a ship to join as crew:**',
      components: [row],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}

export async function handleCrewSelectMenu(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferUpdate();

  const selection = parseCrewSelectValue(interaction.values[0]);
  const selectedIdentifier = selection.shipIdentifier;
  const selectedIndex = selection.shipIndex;
  const userId = await resolveInternalUserId(interaction.user.id);
  if (!userId) {
    await interaction.followUp({
      content: '❌ Please link your Discord account on the web app first, then try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const userName = interaction.user.username;

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.followUp({
        content: MSG_ACTIVITY_NOT_FOUND,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const isParticipant = await getParticipantService().isParticipant(activityId, userId);
    if (!isParticipant) {
      await getActivityService().joinActivity(activityId, {
        userId,
        userName,
        role: ParticipantRole.MEMBER,
      });
    }

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const openShips = allShips.filter(
      ship =>
        (ship.currentCrew ?? ship.crewAssigned ?? 0) < (ship.maxCrew ?? ship.crewCapacity ?? 0)
    );
    const selectableShips = openShips.filter(ship => getCrewShipIdentifier(ship) !== null);

    const ship =
      selectableShips.find(
        candidate =>
          getCrewShipIdentifier(candidate) === selectedIdentifier ||
          candidate.id === selectedIdentifier ||
          candidate.shipId === selectedIdentifier ||
          candidate.ownerId === selectedIdentifier
      ) ??
      (selectedIndex !== undefined && selectedIndex >= 0
        ? selectableShips.slice(0, 25)[selectedIndex]
        : undefined);

    const shipIdentifier = ship ? getCrewShipIdentifier(ship) : null;
    if (!ship || !shipIdentifier) {
      await interaction.followUp({
        content: '⚠️ Selected ship is no longer available. Click **Join Crew** and try again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existingPositions = (ship?.crew ?? ship?.crewMembers ?? []).map(c => c.position);
    const commonPositions = [
      'Pilot',
      'Co-pilot',
      'Gunner',
      'Engineer',
      'Navigator',
      'Cargo',
      'Medical',
    ];
    const suggestedCommonPosition = commonPositions.find(pos => !existingPositions.includes(pos));
    const suggestedPosition =
      suggestedCommonPosition ?? `Crew Member ${existingPositions.length + 1}`;

    await getActivityService().joinShipAsCrew(
      activityId,
      userId,
      userName,
      shipIdentifier,
      suggestedPosition
    );

    await interaction.followUp({
      content: `⚙️ Joined **${ship?.shipName ?? ship?.shipType ?? 'ship'}** as **${suggestedPosition}**!`,
      flags: MessageFlags.Ephemeral,
    });

    await refreshEventEmbedFromChannel(interaction, activityId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: userName,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_CREW_JOINED',
      message: `Joined ship ${shipIdentifier} crew in event ${activityId} as ${suggestedPosition}`,
      metadata: { activityId, shipOwnerId: shipIdentifier, position: suggestedPosition },
    });
  } catch (error: unknown) {
    const errorMsg = sanitizeErrorForUser(getErrorMessage(error));

    if (errorMsg.includes('already crew')) {
      await interaction.followUp({
        content: '⚠️ You are already crew on this ship.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (errorMsg.includes('crew is full')) {
      await interaction.followUp({
        content: '❌ Ship crew is full. Try another ship!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.followUp({
      content: `❌ Error: ${errorMsg}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
