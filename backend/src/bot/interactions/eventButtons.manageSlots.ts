import { ACTIVITY_CREW_POSITIONS, ACTIVITY_PASSENGER_ROLES } from '@sc-fleet-manager/shared-types';
import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputStyle,
} from 'discord.js';

import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { createModalLabelInput } from '../utils/modalLabelInput';

import {
  buildCrewSelectValue,
  getCrewShipIdentifier,
  parseCrewSelectValue,
} from './eventButtons.crewSelect';
import { resolveInternalUserId } from './eventButtons.identity';
import { refreshEventEmbedFromChannel } from './eventButtons.refresh';
import { sanitizeErrorForUser } from './eventButtons.security';
import { getActivityService } from './eventButtons.services';

/** Repeated user-facing message — SonarQube S1192 */
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

/** Parse "role:count, role2:count2" free-text into validated slot rows. */
function parseSlotSpec(
  raw: string,
  allowedRoles: readonly string[]
): { slots: Array<{ role: string; capacity: number }>; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { slots: [] };
  }
  const slots: Array<{ role: string; capacity: number }> = [];
  const seen = new Set<string>();
  for (const part of trimmed.split(',')) {
    const piece = part.trim();
    if (!piece) {
      continue;
    }
    const match = /^([a-zA-Z]+)\s*[:=]\s*(\d+)$/.exec(piece);
    if (!match) {
      return { slots: [], error: `Couldn't parse "${piece}". Use \`role:count\` (e.g. gunner:2).` };
    }
    const role = match[1].toLowerCase();
    const capacity = Number.parseInt(match[2], 10);
    if (!allowedRoles.includes(role)) {
      return {
        slots: [],
        error: `Unknown role "${role}". Allowed: ${allowedRoles.join(', ')}.`,
      };
    }
    if (seen.has(role)) {
      return { slots: [], error: `Duplicate role "${role}".` };
    }
    seen.add(role);
    slots.push({ role, capacity });
  }
  return { slots };
}

export async function handleManageSlots(
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

    const actorUserId = (await resolveInternalUserId(interaction.user.id)) ?? interaction.user.id;

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const shipsWithIdentifier = allShips.filter(ship => getCrewShipIdentifier(ship) !== null);
    if (shipsWithIdentifier.length === 0) {
      await interaction.editReply({
        content:
          '⚠️ No ships in this event yet. Add a ship first with **Bring Ship** or **Bring Fleet**.',
      });
      return;
    }

    const capabilities = await getActivityService().getShipManagementCapabilities(
      activityId,
      actorUserId
    );
    const manageableIds = new Set(capabilities.manageableShipIdentifiers);

    const selectableShips = shipsWithIdentifier.filter(ship => {
      const identifier = getCrewShipIdentifier(ship);
      return identifier ? manageableIds.has(identifier) : false;
    });
    if (selectableShips.length === 0) {
      await interaction.editReply({
        content:
          '⚠️ You can view ships in this event, but cannot manage their slots. Only the ship owner, contributor, event organiser, or a leader can manage slots.',
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_manageslotsselect_${activityId}`)
      .setPlaceholder('Select a ship to edit slots…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        selectableShips.slice(0, 25).map((ship, index) => {
          const name = ship.shipName?.trim();
          const type = ship.shipType ?? 'Unknown';
          const label = name ? `${name} (${type})` : type;
          const identifier = getCrewShipIdentifier(ship) ?? `unknown-${index}`;
          return {
            label: (label || 'Unknown Ship').slice(0, 100),
            description: `Crew ${ship.crewAssigned ?? 0}/${ship.crewCapacity ?? 0}`.slice(0, 100),
            value: buildCrewSelectValue(identifier, index),
          };
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await interaction.editReply({
      content: '🪑 **Select a ship to edit its crew & passenger slots:**',
      components: [row],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}

/** Select a ship → open the crew/passenger slot modal, prefilled from current slots. */
export async function handleManageSlotsShipSelect(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  const selection = parseCrewSelectValue(interaction.values[0]);
  const shipIdentifier = selection.shipIdentifier;

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.reply({ content: MSG_ACTIVITY_NOT_FOUND, flags: MessageFlags.Ephemeral });
      return;
    }

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const ship = allShips.find(
      s =>
        getCrewShipIdentifier(s) === shipIdentifier ||
        s.id === shipIdentifier ||
        s.shipId === shipIdentifier ||
        s.ownerId === shipIdentifier
    );
    if (!ship) {
      await interaction.reply({
        content: '⚠️ Ship no longer available. Click **Manage Slots** and try again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const actorUserId = (await resolveInternalUserId(interaction.user.id)) ?? interaction.user.id;
    const capabilities = await getActivityService().getShipManagementCapabilities(
      activityId,
      actorUserId
    );
    if (!capabilities.manageableShipIdentifiers.includes(shipIdentifier)) {
      await interaction.reply({
        content:
          '⚠️ You cannot manage this ship. Only the ship owner, contributor, event organiser, or a leader can edit its slots.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const crewSpec = (ship.crewSlots ?? []).map(slot => `${slot.role}:${slot.capacity}`).join(', ');
    const passengerSpec = (ship.passengers ?? [])
      .map(slot => `${slot.role}:${slot.capacity}`)
      .join(', ');

    const modal = new ModalBuilder()
      .setCustomId(`event_manageslots_modal_${activityId}__${encodeURIComponent(shipIdentifier)}`)
      .setTitle('Edit Ship Slots');

    modal.addLabelComponents(
      createModalLabelInput({
        customId: 'slots_crew',
        label: 'Crew slots (role:count)',
        placeholder: 'pilot:1, gunner:2, engineer:1',
        value: crewSpec,
        style: TextInputStyle.Paragraph,
        required: false,
        maxLength: 200,
      }),
      createModalLabelInput({
        customId: 'slots_passenger',
        label: 'Passenger slots (role:count)',
        placeholder: 'marine:4, medic:1',
        value: passengerSpec,
        style: TextInputStyle.Paragraph,
        required: false,
        maxLength: 200,
      })
    );

    await interaction.showModal(modal);
  } catch (error: unknown) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

/** Modal submit → validate + persist crew and passenger slots for the ship. */
export async function handleManageSlotsModal(
  interaction: ModalSubmitInteraction,
  activityId: string,
  shipIdentifier: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = await resolveInternalUserId(interaction.user.id);
  if (!userId) {
    await interaction.editReply({
      content: '❌ Please link your Discord account on the web app first, then try again.',
    });
    return;
  }

  const crewRaw = interaction.fields.getTextInputValue('slots_crew');
  const passengerRaw = interaction.fields.getTextInputValue('slots_passenger');

  const crewParsed = parseSlotSpec(crewRaw, ACTIVITY_CREW_POSITIONS);
  if (crewParsed.error) {
    await interaction.editReply({ content: `❌ Crew slots: ${crewParsed.error}` });
    return;
  }
  const passengerParsed = parseSlotSpec(passengerRaw, ACTIVITY_PASSENGER_ROLES);
  if (passengerParsed.error) {
    await interaction.editReply({ content: `❌ Passenger slots: ${passengerParsed.error}` });
    return;
  }

  try {
    if (crewParsed.slots.length > 0) {
      await getActivityService().setCrewSlots(activityId, userId, shipIdentifier, crewParsed.slots);
    }
    // Always apply passengers (empty array clears them) so an organizer can
    // remove all passenger seats by submitting a blank passenger field.
    await getActivityService().setPassengerSlots(
      activityId,
      userId,
      shipIdentifier,
      passengerParsed.slots
    );

    await interaction.editReply({ content: '🪑 Slots updated.' });
    await refreshEventEmbedFromChannel(interaction, activityId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: interaction.user.username,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_SLOTS_UPDATED',
      message: `Updated crew/passenger slots for ship ${shipIdentifier} in event ${activityId}`,
      metadata: {
        activityId,
        shipIdentifier,
        crewSlots: crewParsed.slots.length,
        passengerSlots: passengerParsed.slots.length,
      },
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}
