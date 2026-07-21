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

import { resolveInternalUserId } from './eventButtons.identity';
import { refreshEventEmbedFromChannel } from './eventButtons.refresh';
import { sanitizeErrorForUser } from './eventButtons.security';
import { getActivityService, getParticipantService } from './eventButtons.services';

const PASSENGER_SELECT_PREFIX = 'psg:';

/** Encode a passenger-slot choice as "<shipIdentifier>::<role>" for the select value. */
function buildPassengerSelectValue(shipIdentifier: string, role: string): string {
  return `${PASSENGER_SELECT_PREFIX}${encodeURIComponent(shipIdentifier)}::${encodeURIComponent(role)}`;
}

function parsePassengerSelectValue(value: string): { shipIdentifier: string; role: string } | null {
  if (!value.startsWith(PASSENGER_SELECT_PREFIX)) {
    return null;
  }
  const body = value.slice(PASSENGER_SELECT_PREFIX.length);
  const sep = body.indexOf('::');
  if (sep === -1) {
    return null;
  }
  try {
    return {
      shipIdentifier: decodeURIComponent(body.slice(0, sep)),
      role: decodeURIComponent(body.slice(sep + 2)),
    };
  } catch {
    return null;
  }
}

export async function handleJoinPassenger(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const slots = await getActivityService().getAvailablePassengerSlots(activityId);
    if (slots.length === 0) {
      await interaction.editReply({
        content:
          '⚠️ No open passenger seats. A ship owner or organizer can add passenger slots first.',
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_passengerselect_${activityId}`)
      .setPlaceholder('Select a passenger seat…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        slots.slice(0, 25).map(slot => {
          const identifier = slot.shipId ?? `${slot.shipType}::${slot.shipName ?? ''}`;
          const shipLabel = slot.shipName?.trim() ?? slot.shipType;
          const roleLabel = slot.role.charAt(0).toUpperCase() + slot.role.slice(1);
          return {
            label: `${roleLabel} — ${shipLabel}`.slice(0, 100),
            description: `${slot.availableSlots} open · ${slot.ownerName}`.slice(0, 100),
            value: buildPassengerSelectValue(identifier, slot.role),
          };
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({
      content: '🎖️ **Select a passenger seat to join:**',
      components: [row],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}

export async function handlePassengerSelectMenu(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferUpdate();

  const choice = parsePassengerSelectValue(interaction.values[0]);
  if (!choice) {
    await interaction.followUp({
      content: '⚠️ Selection is no longer valid. Click **Join as Passenger** and try again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

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
    const isParticipant = await getParticipantService().isParticipant(activityId, userId);
    if (!isParticipant) {
      await getActivityService().joinActivity(activityId, {
        userId,
        userName,
        role: ParticipantRole.MEMBER,
      });
    }

    await getActivityService().joinShipAsPassenger(
      activityId,
      userId,
      userName,
      choice.shipIdentifier,
      choice.role
    );

    const roleLabel = choice.role.charAt(0).toUpperCase() + choice.role.slice(1);
    await interaction.followUp({
      content: `🎖️ Joined as **${roleLabel}**!`,
      flags: MessageFlags.Ephemeral,
    });

    await refreshEventEmbedFromChannel(interaction, activityId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: userName,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_PASSENGER_JOINED',
      message: `Joined as ${choice.role} passenger in event ${activityId}`,
      metadata: { activityId, shipIdentifier: choice.shipIdentifier, role: choice.role },
    });
  } catch (error: unknown) {
    const errorMsg = sanitizeErrorForUser(getErrorMessage(error));

    if (/already.*passenger/i.test(errorMsg)) {
      await interaction.followUp({
        content: '⚠️ You already hold a passenger seat in this event.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (/full/i.test(errorMsg)) {
      await interaction.followUp({
        content: '❌ That seat just filled up. Try another!',
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
