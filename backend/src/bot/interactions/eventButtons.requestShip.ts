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
import {
  getShipRoleEmoji,
  SHIP_ROLE_TYPES,
  SHIP_ROLES,
  type ShipRequirement,
  type ShipRoleCategory,
} from '../constants/shipTaxonomy';
import { createModalLabelInput } from '../utils/modalLabelInput';

import { resolveInternalUserId } from './eventButtons.identity';
import { refreshEventEmbedFromChannel } from './eventButtons.refresh';
import { parseRequiredShipTypes } from './eventButtons.requirements';
import { sanitizeErrorForUser } from './eventButtons.security';
import { getActivityService } from './eventButtons.services';

/** Repeated user-facing message — SonarQube S1192 */
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

export async function handleRequestShip(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Check the user is the event creator
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
      return;
    }

    // Resolve Discord ID to internal UUID since creatorId stores the internal user UUID.
    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (activity.creatorId !== internalUserId && activity.creatorId !== interaction.user.id) {
      await interaction.editReply({
        content: '⚠️ Only the event organiser can request ships.',
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_reqshiprole_${activityId}`)
      .setPlaceholder('Select ship role to request…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        SHIP_ROLES.map(role => ({
          label: role,
          description: `${SHIP_ROLE_TYPES[role].length} types`,
          value: role,
          emoji: getShipRoleEmoji(role),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({
      content: '📋 **What role of ship do you need?**',
      components: [row],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}

export async function handleReqShipRoleSelect(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const selectedRole = interaction.values[0] as ShipRoleCategory;
    const types = SHIP_ROLE_TYPES[selectedRole];

    const emoji = getShipRoleEmoji(selectedRole);

    // Provide "Any <Role>" as the first option, then specific types
    const options = [
      {
        label: `Any ${selectedRole}`,
        description: 'No specific type required',
        value: `__any__`,
        emoji,
      },
      ...types.map(t => ({
        label: t,
        value: t,
        emoji,
      })),
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_reqshiptype_${activityId}_${selectedRole}`)
      .setPlaceholder(`Select type (or any ${selectedRole})…`)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({
      content: `${emoji} **Select the specific type you need (or any ${selectedRole}):**`,
      components: [row],
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}

export async function handleReqShipTypeSelect(
  interaction: StringSelectMenuInteraction,
  activityId: string,
  shipRole: string
): Promise<void> {
  // Validate role is a known taxonomy category
  if (!SHIP_ROLES.includes(shipRole as ShipRoleCategory)) {
    await interaction.reply({ content: '⚠️ Unknown ship role.', flags: MessageFlags.Ephemeral });
    return;
  }

  const selectedType = interaction.values[0];
  const isAny = selectedType === '__any__';

  try {
    const modal = new ModalBuilder()
      .setCustomId(`event_reqship_modal_${activityId}`)
      .setTitle('Ship Request Details');

    modal.addLabelComponents(
      createModalLabelInput({
        customId: 'req_role',
        label: 'Role',
        value: shipRole,
        style: TextInputStyle.Short,
        required: true,
        maxLength: 30,
      }),
      createModalLabelInput({
        customId: 'req_type',
        label: 'Type (or "any")',
        value: isAny ? 'any' : selectedType,
        style: TextInputStyle.Short,
        required: true,
        maxLength: 40,
      }),
      createModalLabelInput({
        customId: 'req_count',
        label: 'How many ships needed?',
        placeholder: 'e.g. 2',
        value: '1',
        style: TextInputStyle.Short,
        required: true,
        maxLength: 2,
      }),
      createModalLabelInput({
        customId: 'req_strict',
        label: 'Strictness: required / preferred / flexible',
        placeholder: 'required, preferred, or flexible',
        value: 'preferred',
        style: TextInputStyle.Short,
        required: true,
        maxLength: 10,
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

export async function handleReqShipModal(
  interaction: ModalSubmitInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const role = interaction.fields.getTextInputValue('req_role');
  const rawType = interaction.fields.getTextInputValue('req_type');
  const countRaw = interaction.fields.getTextInputValue('req_count');
  const strictRaw = interaction.fields.getTextInputValue('req_strict').toLowerCase().trim();

  const count = Number.parseInt(countRaw, 10);
  if (Number.isNaN(count) || count < 1 || count > 25) {
    await interaction.editReply({ content: '❌ Count must be between 1 and 25.' });
    return;
  }

  const validStrict = ['required', 'preferred', 'flexible'];
  const strictness = validStrict.includes(strictRaw)
    ? (strictRaw as 'required' | 'preferred' | 'flexible')
    : 'preferred';

  const type = rawType === 'any' ? undefined : rawType;

  try {
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
      return;
    }

    // Parse existing requirements (handle all legacy formats)
    const existing = parseRequiredShipTypes(activity.requiredShipTypes);

    // Add the new requirement
    const newReq: ShipRequirement = {
      role: role as ShipRoleCategory,
      type,
      count,
      filled: 0,
      strictness,
    };
    existing.push(newReq);

    // Persist via activity update
    await getActivityService().updateActivity(activityId, {
      requiredShipTypes: JSON.stringify(existing),
    });

    const emoji = getShipRoleEmoji(role);
    const label = type ? `**${type}** (${role})` : `**Any ${role}**`;
    await interaction.editReply({
      content: `${emoji} Ship request added: ${count}× ${label} [${strictness}]`,
    });

    await refreshEventEmbedFromChannel(interaction, activityId);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: interaction.user.id,
      username: interaction.user.username,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_SHIP_REQUESTED',
      message: `Requested ${count}x ${type ?? 'any'} (${role}) for event ${activityId}`,
      metadata: { activityId, ...newReq },
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}
