import { getCarrierCapability } from '@sc-fleet-manager/shared-types';
import {
  ActionRowBuilder,
  ButtonInteraction,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { AppDataSource } from '../../config/database';
import { ParticipantRole } from '../../models/Activity';
import { Ship } from '../../models/Ship';
import { UserShip } from '../../models/UserShip';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { getShipRoleEmoji } from '../constants/shipTaxonomy';

import { buildHangarGroups, MAX_HANGAR_OPTIONS } from './eventButtons.hangarGroups';
import {
  buildShipOptions,
  getHangarSuggestions,
  isBundledShipName,
  resolveShipTaxonomy,
} from './eventButtons.hangarSuggestions';
import { resolveInternalUserId } from './eventButtons.identity';
import { refreshEventEmbedFromChannel } from './eventButtons.refresh';
import { computeFilledCounts, parseRequiredShipTypes } from './eventButtons.requirements';
import { sanitizeDiscordInput, sanitizeErrorForUser } from './eventButtons.security';
import { getActivityService, getParticipantService } from './eventButtons.services';

const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

/** Maps ship-taxonomy role names to backend role enum values. */
const ROLE_MAP: Record<
  string,
  'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other'
> = {
  Combat: 'combat',
  'Combat Support': 'combat',
  Logistics: 'cargo',
  Support: 'support',
  Industrial: 'mining',
  Bespoke: 'other',
};

/** Select menu value for "skip suggestions, go to manual entry". */
const HANGAR_MANUAL_ENTRY = '__manual__';

/* ------------------------------------------------------------------ */
/*  "Bring Ship" → Step 1: hangar suggestions or role category select  */
/* ------------------------------------------------------------------ */

export async function handleBringShip(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Try to suggest ships from the user's hangar
  try {
    const activity = await getActivityService().getActivityById(activityId);
    const requirements = activity ? parseRequiredShipTypes(activity.requiredShipTypes) : [];

    // Compute already-filled counts so we only highlight ships that fill open slots
    if (requirements.length > 0 && activity) {
      const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
      if (allShips.length > 0) {
        computeFilledCounts(requirements, allShips);
      }
    }

    // Hangar is keyed by internal user UUID — translate from Discord ID first.
    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (!internalUserId) {
      await interaction.editReply({
        content:
          '🔗 **Link your account to use your hangar.**\nSign in to the web app with Discord to connect your hangar, then come back and click **Bring Ship** again.',
      });
      return;
    }

    const suggestions = await getHangarSuggestions(internalUserId, requirements);

    if (suggestions.length > 0) {
      // Ships fit in one menu — show them directly
      if (suggestions.length <= MAX_HANGAR_OPTIONS) {
        const options = buildShipOptions(suggestions);

        // Append "Manual entry" option
        options.push({
          label: 'Enter ship manually…',
          description: 'Type in ship details directly',
          value: HANGAR_MANUAL_ENTRY,
          emoji: '✏️',
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`event_hangarship_${activityId}`)
          .setPlaceholder('Select a ship from your hangar…')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const matchCount = suggestions.filter(s => s.matchesRequirement).length;
        const hasMatches = requirements.length > 0 && matchCount > 0;
        const pluralShips = matchCount === 1 ? '' : 's';
        const header = hasMatches
          ? `🚀 **${matchCount} ship${pluralShips} in your hangar match this event's requirements!**\nSelect one, or choose manual entry at the bottom.`
          : '🚀 **Select a ship from your hangar, or enter one manually:**';

        await interaction.editReply({ content: header, components: [row] });
      } else {
        // Too many ships for one menu — show a role/A→Z group picker. Each group
        // is menu-safe, so drilling in never yields a truncated partial list.
        const groups = buildHangarGroups(suggestions);

        const options = groups.slice(0, MAX_HANGAR_OPTIONS).map(g => ({
          label: g.label.slice(0, 100),
          description: `${g.ships.length} ship${g.ships.length === 1 ? '' : 's'}`,
          value: g.key,
          emoji: g.emoji,
        }));

        // Append "Manual entry" option
        options.push({
          label: 'Enter ship manually…',
          description: 'Type in ship details directly',
          value: HANGAR_MANUAL_ENTRY,
          emoji: '✏️',
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`event_hangarpage_${activityId}`)
          .setPlaceholder('Pick a group to browse your ships…')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        await interaction.editReply({
          content: `🚀 **You have ${suggestions.length} ships!** Pick a group to narrow down:`,
          components: [row],
        });
      }
      return;
    }
  } catch (error: unknown) {
    logger.warn('Failed to load hangar suggestions', {
      userId: interaction.user.id,
      activityId,
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Offer manual entry instead of a misleading "no ships" message
    try {
      const fallbackMenu = new StringSelectMenuBuilder()
        .setCustomId(`event_hangarship_${activityId}`)
        .setPlaceholder('Select an option…')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions({
          label: 'Enter ship manually…',
          description: 'Type in ship details directly',
          value: HANGAR_MANUAL_ENTRY,
          emoji: '✏️',
        });

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fallbackMenu);

      await interaction.editReply({
        content: '❌ **Could not load your hangar.** You can still enter your ship manually:',
        components: [row],
      });
      return;
    } catch {
      // Fall through to the "no ships" message below
    }
  }

  // No hangar ships found — tell the user
  await interaction.editReply({
    content:
      '⚠️ **No ships found in your hangar.**\nAdd ships to your hangar on the web app first, then come back and click **Bring Ship** again.',
  });
}

/* ------------------------------------------------------------------ */
/*  Hangar ship select → opens pre-filled modal (or manual entry)      */
/* ------------------------------------------------------------------ */

export async function handleHangarShipSelect(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  const selected = interaction.values[0];

  // "Enter ship manually…" → open a blank modal for direct entry
  if (selected === HANGAR_MANUAL_ENTRY) {
    try {
      const modal = new ModalBuilder()
        .setCustomId(`event_bringship_modal_${activityId}`)
        .setTitle('Register Your Ship');

      const shipNameInput = new TextInputBuilder({
        custom_id: 'ship_name',
        placeholder: 'e.g. "The Stargazer"',
        style: TextInputStyle.Short,
        required: true,
        max_length: 50,
      });

      const shipTypeInput = new TextInputBuilder({
        custom_id: 'ship_type',
        placeholder: 'e.g. "Cutlass Black"',
        style: TextInputStyle.Short,
        required: true,
        max_length: 60,
      });

      const shipRoleInput = new TextInputBuilder({
        custom_id: 'ship_role',
        placeholder: 'e.g. "Combat"',
        style: TextInputStyle.Short,
        required: true,
        max_length: 30,
      });

      const maxCrewInput = new TextInputBuilder({
        custom_id: 'max_crew',
        placeholder: 'e.g. 6',
        style: TextInputStyle.Short,
        required: true,
        max_length: 3,
      });

      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel('Ship Name (your custom name)')
          .setTextInputComponent(shipNameInput),
        new LabelBuilder()
          .setLabel('Ship Type (e.g. Cutlass Black)')
          .setTextInputComponent(shipTypeInput),
        new LabelBuilder().setLabel('Ship Role (Combat)').setTextInputComponent(shipRoleInput),
        new LabelBuilder()
          .setLabel('Max Crew Capacity (including you)')
          .setTextInputComponent(maxCrewInput)
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
    return;
  }

  // Look up the selected UserShip + catalogue entry
  try {
    if (!AppDataSource.isInitialized) {
      await interaction.reply({
        content: '⚠️ Database not ready. Try again shortly.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // UserShip.userId is the internal user UUID, not the Discord ID.
    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (!internalUserId) {
      await interaction.reply({
        content: '🔗 Link your account on the web app first to use ships from your hangar.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userShip = await AppDataSource.getRepository(UserShip).findOne({
      where: { id: selected, userId: internalUserId, isActive: true },
    });

    if (!userShip) {
      await interaction.reply({
        content: '⚠️ Ship not found in your hangar.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (isBundledShipName(userShip.shipName)) {
      await interaction.reply({
        content:
          '⚠️ This bundled ship variant is not selectable. Choose a different ship or enter one manually.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Resolve catalogue data for role / crew
    const catalogue = userShip.shipId
      ? ((await AppDataSource.getRepository(Ship).findOne({ where: { id: userShip.shipId } })) ??
        undefined)
      : undefined;

    const { roleCategory, shipType } = resolveShipTaxonomy(catalogue);

    const maxCrew = catalogue?.maxCrew ?? catalogue?.crew ?? 1;
    // Use || so empty-string customName/shipName fall through to the next fallback
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const displayName = userShip.customName?.trim() || userShip.shipName?.trim() || 'Unknown Ship';

    // Open the same "Register Your Ship" modal, pre-filled from the hangar
    const modal = new ModalBuilder()
      .setCustomId(`event_bringship_modal_${activityId}`)
      .setTitle('Register Your Ship');

    const shipNameInput = new TextInputBuilder({
      custom_id: 'ship_name',
      value: displayName,
      style: TextInputStyle.Short,
      required: true,
      max_length: 50,
    });

    const shipTypeInput = new TextInputBuilder({
      custom_id: 'ship_type',
      value: shipType ?? userShip.shipName,
      style: TextInputStyle.Short,
      required: true,
      max_length: 60,
    });

    const shipRoleInput = new TextInputBuilder({
      custom_id: 'ship_role',
      value: roleCategory ?? 'Bespoke',
      style: TextInputStyle.Short,
      required: true,
      max_length: 30,
    });

    const maxCrewInput = new TextInputBuilder({
      custom_id: 'max_crew',
      value: String(maxCrew),
      style: TextInputStyle.Short,
      required: true,
      max_length: 3,
    });

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel('Ship Name (your custom name)')
        .setTextInputComponent(shipNameInput),
      new LabelBuilder()
        .setLabel('Ship Type (e.g. Cutlass Black)')
        .setTextInputComponent(shipTypeInput),
      new LabelBuilder().setLabel('Ship Role (Combat)').setTextInputComponent(shipRoleInput),
      new LabelBuilder()
        .setLabel('Max Crew Capacity (including you)')
        .setTextInputComponent(maxCrewInput)
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

/* ------------------------------------------------------------------ */
/*  Hangar page select → show ships in the chosen letter group         */
/* ------------------------------------------------------------------ */

export async function handleHangarPageSelect(
  interaction: StringSelectMenuInteraction,
  activityId: string
): Promise<void> {
  const selected = interaction.values[0];

  // "Enter ship manually…" shortcut from the group picker
  if (selected === HANGAR_MANUAL_ENTRY) {
    return handleHangarShipSelect(interaction, activityId);
  }

  await interaction.deferUpdate();

  try {
    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (!internalUserId) {
      await interaction.editReply({
        content: '🔗 Link your account on the web app first.',
        components: [],
      });
      return;
    }

    const activity = await getActivityService().getActivityById(activityId);
    const requirements = activity ? parseRequiredShipTypes(activity.requiredShipTypes) : [];
    if (requirements.length > 0 && activity) {
      const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
      if (allShips.length > 0) {
        computeFilledCounts(requirements, allShips);
      }
    }

    const allSuggestions = await getHangarSuggestions(internalUserId, requirements);
    const group = buildHangarGroups(allSuggestions).find(g => g.key === selected);

    if (!group) {
      // The group list shifted (e.g. the hangar changed between clicks) — let
      // the user restart rather than showing a stale or empty menu.
      await interaction.editReply({
        content: '⚠️ That group is no longer available. Click **Bring Ship** again to refresh.',
        components: [],
      });
      return;
    }

    // group.ships already fits one menu (≤ MAX_HANGAR_OPTIONS), so there is no
    // slice here — the whole group is shown and nothing is dropped.
    const options = buildShipOptions(group.ships);

    // Append "Manual entry" option
    options.push({
      label: 'Enter ship manually…',
      description: 'Type in ship details directly',
      value: HANGAR_MANUAL_ENTRY,
      emoji: '✏️',
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_hangarship_${activityId}`)
      .setPlaceholder('Select a ship…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({
      content: `🚀 **${group.ships.length} ship${group.ships.length === 1 ? '' : 's'} — ${group.label}:**`,
      components: [row],
    });
  } catch (error: unknown) {
    logger.warn('Failed to load hangar page', {
      userId: interaction.user.id,
      activityId,
      rangeKey: selected,
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Offer manual entry as a fallback so the user isn't stuck
    try {
      const fallbackMenu = new StringSelectMenuBuilder()
        .setCustomId(`event_hangarship_${activityId}`)
        .setPlaceholder('Select an option…')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions({
          label: 'Enter ship manually…',
          description: 'Type in ship details directly',
          value: HANGAR_MANUAL_ENTRY,
          emoji: '✏️',
        });

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fallbackMenu);

      await interaction.editReply({
        content:
          '❌ **Failed to load ships from your hangar.** You can still enter your ship manually:',
        components: [row],
      });
    } catch {
      // Last resort — clear components so the user isn't left with a stale menu
      await interaction.editReply({
        content: '❌ Failed to load ships. Click **Bring Ship** on the event to try again.',
        components: [],
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Nest ship select → dock a ship inside a carrier                    */
/* ------------------------------------------------------------------ */

export async function handleNestShipSelect(
  interaction: StringSelectMenuInteraction,
  activityId: string,
  childShipKey: string
): Promise<void> {
  const selected = interaction.values[0];

  if (selected === '__none__') {
    await interaction.update({
      content: '✈️ Ship kept as independent — no docking.',
      components: [],
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Parse carrier selection: "carrierId__transportType"
    const separatorIdx = selected.lastIndexOf('__');
    if (separatorIdx === -1) {
      await interaction.editReply({ content: '❌ Invalid selection.', components: [] });
      return;
    }
    const carrierKey = selected.slice(0, separatorIdx);
    const transportType = selected.slice(separatorIdx + 2) as 'hangar' | 'cargo';

    const decodedChildKey = decodeURIComponent(childShipKey);

    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND, components: [] });
      return;
    }

    const allShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];

    // Find the child ship
    const childShip = allShips.find(
      s => s.id === decodedChildKey || `${s.shipType}::${s.shipName}` === decodedChildKey
    );
    if (!childShip) {
      await interaction.editReply({ content: '⚠️ Ship no longer found in event.', components: [] });
      return;
    }

    // Find the carrier ship
    const carrier = allShips.find(s => s.id === carrierKey || s.shipType === carrierKey);
    if (!carrier) {
      await interaction.editReply({
        content: '⚠️ Carrier ship no longer found in event.',
        components: [],
      });
      return;
    }

    // Mark the child ship as transported
    childShip.parentShipId = carrier.id ?? carrier.shipType;
    childShip.isTransported = true;
    childShip.transportType = transportType;

    await getActivityService().updateActivity(activityId, {
      shipAssignments: activity.shipAssignments,
      ships: activity.ships,
    });

    await refreshEventEmbedFromChannel(interaction, activityId);

    const carrierName = carrier.shipName ?? carrier.shipType;
    const childName = childShip.shipName ?? childShip.shipType;
    const typeLabel = transportType === 'hangar' ? 'hangar bay' : 'cargo bay';
    await interaction.editReply({
      content: `🚢 **${childName}** docked in **${carrierName}**'s ${typeLabel}!`,
      components: [],
    });
  } catch (error: unknown) {
    logger.warn('Failed to nest ship', {
      activityId,
      childShipKey,
      error: getErrorMessage(error),
    });
    await interaction.editReply({
      content: '❌ Failed to dock ship. Try again.',
      components: [],
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Modal submit handler: "Bring Ship" modal (role + type pre-set)     */
/* ------------------------------------------------------------------ */

export async function handleBringShipModal(
  interaction: ModalSubmitInteraction,
  activityId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const shipName = interaction.fields.getTextInputValue('ship_name');
  const shipType = interaction.fields.getTextInputValue('ship_type'); // e.g. "Light Fighter"
  const shipRole = interaction.fields.getTextInputValue('ship_role'); // e.g. "Combat"
  const maxCrewRaw = interaction.fields.getTextInputValue('max_crew');

  const maxCrew = Number.parseInt(maxCrewRaw, 10);
  if (Number.isNaN(maxCrew) || maxCrew < 1 || maxCrew > 100) {
    await interaction.editReply({
      content: '❌ Max crew must be a number between 1 and 100.',
    });
    return;
  }

  const backendRole = ROLE_MAP[shipRole] ?? 'other';

  try {
    // Ensure user is a participant first
    const activity = await getActivityService().getActivityById(activityId);
    if (!activity) {
      await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
      return;
    }

    const userId = await resolveInternalUserId(interaction.user.id);
    if (!userId) {
      await interaction.editReply({
        content: '❌ Please link your Discord account on the web app first, then try again.',
      });
      return;
    }
    const userName = interaction.user.username;

    const isParticipant = await getParticipantService().isParticipant(activityId, userId);
    if (!isParticipant) {
      // Auto-join as member first
      await getActivityService().joinActivity(activityId, {
        userId,
        userName,
        role: ParticipantRole.PILOT,
        shipType: `${shipType} (${shipRole})`,
        shipName,
      });
    }

    // Check if the user already has a crewed (non-loaner) ship in this event.
    // If so, add the new ship as a loaner — a pilot can only fly one ship.
    const existingShips = [...(activity.ships ?? []), ...(activity.shipAssignments ?? [])];
    const hasCrewedShip = existingShips.some(
      s => s.ownerId === userId && !s.isLoaner && (s.crewAssigned ?? 0) > 0
    );

    const roleEmoji = getShipRoleEmoji(shipRole);
    const safeName = sanitizeDiscordInput(shipName);
    const safeType = sanitizeDiscordInput(shipType);
    const safeRole = sanitizeDiscordInput(shipRole);

    if (hasCrewedShip) {
      // Add as loaner — the user is already piloting another ship
      await getActivityService().loanShips(activityId, userId, userName, [
        {
          shipType: `${shipType} (${shipRole})`,
          shipName,
          crewCapacity: maxCrew,
        },
      ]);

      await interaction.editReply({
        content:
          `${roleEmoji} **${safeName}** added as a **loaned ship** (${safeType} / ${safeRole}) with ${maxCrew} crew slots!\n` +
          `You're already piloting another ship, so this one is available for other members to crew.`,
      });
    } else {
      // First ship — add normally with the user as pilot
      await getActivityService().addShip(activityId, userId, {
        shipType: `${shipType} (${shipRole})`,
        shipName,
        role: backendRole,
        crewCapacity: maxCrew,
        capabilities: [],
      });

      await interaction.editReply({
        content: `${roleEmoji} **${safeName}** registered as **${safeType}** (${safeRole}) with ${maxCrew} crew slots!\nOther members can click **Join Crew** to sign up.`,
      });
    }

    // Refresh the embed on the original event message
    await refreshEventEmbedFromChannel(interaction, activityId);

    // Check if any ships in the event can carry the newly added ship.
    // Uses a curated carrier list — the DB hangarSize field stores pad size, not internal hangar.
    const updatedActivity = await getActivityService().getActivityById(activityId);
    const allAssignments = [
      ...(updatedActivity?.ships ?? []),
      ...(updatedActivity?.shipAssignments ?? []),
    ];
    const carriers = allAssignments
      .filter(s => !s.isTransported)
      .map(s => ({ ship: s, cap: getCarrierCapability(s.shipType) }))
      .filter(
        (entry): entry is { ship: typeof entry.ship; cap: NonNullable<typeof entry.cap> } =>
          !!entry.cap
      );

    if (carriers.length > 0) {
      // Find the ship we just added (last assignment by this user with matching name)
      const justAdded = [...allAssignments]
        .reverse()
        .find(s => s.ownerId === userId && s.shipName === shipName && !s.isTransported);

      if (justAdded) {
        const shipKey = justAdded.id ?? `${justAdded.shipType}::${justAdded.shipName}`;
        const options = carriers.slice(0, 24).map(({ ship: carrier, cap }) => {
          const types: string[] = [];
          if (cap.hangar) {
            types.push(`hangar: ${cap.hangar}`);
          }
          if (cap.vehicleBay) {
            types.push('vehicle bay');
          }
          const carrierKey = carrier.id ?? carrier.shipType;
          const transportType = cap.hangar ? 'hangar' : 'cargo';
          return {
            label: (carrier.shipName ?? carrier.shipType).slice(0, 100),
            description: `${carrier.ownerName} • ${types.join(', ')}`.slice(0, 100),
            value: `${carrierKey}__${transportType}`,
            emoji: '🚢',
          };
        });

        options.push({
          label: 'No — keep it independent',
          description: 'This ship flies on its own',
          value: '__none__',
          emoji: '✈️',
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`event_nestship_${activityId}_${encodeURIComponent(shipKey)}`)
          .setPlaceholder('Dock this ship inside a carrier?')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        await interaction.followUp({
          content: `🚢 **${safeName}** can be transported inside a carrier ship. Want to dock it?`,
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId,
      username: userName,
      resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
      action: 'EVENT_SHIP_ADDED',
      message: `Ship ${shipName} (${shipType}/${shipRole}) added to event ${activityId}${hasCrewedShip ? ' (loaned)' : ''}`,
      metadata: { activityId, shipName, shipType, shipRole, maxCrew, isLoaner: hasCrewedShip },
    });
  } catch (error: unknown) {
    await interaction.editReply({
      content: `❌ Error: ${sanitizeErrorForUser(getErrorMessage(error))}`,
    });
  }
}
