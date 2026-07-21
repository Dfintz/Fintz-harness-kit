import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  LabelBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { Activity } from '../../models/Activity';
import { ActivityService, EventMirrorService } from '../../services/activity';
import { UserService } from '../../services/user/UserService';
import { buildEventMirrorSubPanelEmbed } from '../embeds/eventsEmbeds';
import {
  buildMirroredEventComponents,
  buildMirroredEventEmbed,
} from '../embeds/mirroredEventMessage';
import {
  handleBringFleetSelect,
  handleBringShipModal,
  handleCrewSelectMenu,
  handleEditEventModal,
  handleEventButton,
  handleFleetInviteResponse,
  handleHangarPageSelect,
  handleHangarShipSelect,
  handleManageSlotsModal,
  handleManageSlotsShipSelect,
  handleNestShipSelect,
  handlePassengerSelectMenu,
  handleRemoveShipSelectMenu,
  handleReqShipModal,
  handleReqShipRoleSelect,
  handleReqShipTypeSelect,
} from '../interactions/eventButtons';
import {
  handleWizardButton,
  handleWizardModal,
  handleWizardSelectMenu,
  isWizardButtonId,
  isWizardModalId,
  isWizardSelectId,
} from '../interactions/eventCreationWizard';
import {
  handleEditWizardButton,
  handleEditWizardModal,
  isEditWizardButtonId,
  isEditWizardModalId,
} from '../interactions/eventEditWizard';
import { publishMirrorRefresh } from '../mirrorSyncPublisher';
import {
  buildCommandPanel,
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { parseCustomId } from '../utils/customId';
import { resolveOrgIdForGuild } from '../utils/guildContext';

import { handleEventCreate, handleEventList } from './eventHandlers';
import { BotCommand } from './types';

export const events: BotCommand = {
  data: new SlashCommandBuilder().setName('events').setDescription('Manage and view fleet events'),

  category: 'events',

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'event',
      title: '\ud83d\udcc5 Events',
      description: 'Create, manage, and join events.',
      buttons: [
        {
          subcommand: 'list',
          label: 'List Events',
          emoji: '\ud83d\udccb',
          style: ButtonStyle.Primary,
        },
        {
          subcommand: 'create',
          label: 'Create Event',
          emoji: '\u2795',
          style: ButtonStyle.Success,
        },
        { subcommand: 'my', label: 'My Events', emoji: '\ud83d\udc64' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },

  /**
   * Handles event button interactions.
   * Routes panel buttons first, then wizard buttons, then RSVP/ship buttons.
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    // 1. Panel buttons (event_panel_*)
    if (await tryHandleEventPanelButton(interaction)) {
      return;
    }

    // 2. Wizard buttons (event creation wizard)
    if (isWizardButtonId(interaction.customId)) {
      await handleWizardButton(interaction);
      return;
    }

    // 2b. Edit wizard buttons
    if (isEditWizardButtonId(interaction.customId)) {
      await handleEditWizardButton(interaction);
      return;
    }

    // 2c. "Mirror" button on an event message ΓÇö create/show the mirror invite
    // code for THIS event (skips the event picker since we know the activity).
    const mirrorCreateMatch = /^event_mirrorcreate_(.+)$/.exec(interaction.customId);
    if (mirrorCreateMatch) {
      await presentCreateMirrorForEvent(interaction, mirrorCreateMatch[1]);
      return;
    }

    // 2d. "Resync" button on an event message ΓÇö show mirror-sync visibility
    // and trigger an immediate manual re-render sweep.
    const mirrorResyncMatch = /^event_mirrorresync_(.+)$/.exec(interaction.customId);
    if (mirrorResyncMatch) {
      await presentManualMirrorResync(interaction, mirrorResyncMatch[1]);
      return;
    }

    // 2e. Fleet-bring DM invite responses (sent to each member when a fleet is
    // brought). customId: event_fleet{joinship|joinonly|decline}_{activityId}_{fleetId}
    if (await tryHandleFleetInviteButton(interaction)) {
      return;
    }

    // 3. RSVP / ship / crew buttons
    await handleEventButton(interaction);
  },

  /**
   * Handles modal submissions (e.g., "Bring Ship" modal).
   * Dispatched by the interaction router when a modal with prefix 'event' is submitted.
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const { customId } = interaction;

    // "Create Mirror" password modal ΓÇö sets password on the event
    // Format: event_mirror_setpass_{eventId}
    const setPassMatch = /^event_mirror_setpass_(.+)$/.exec(customId);
    if (setPassMatch) {
      await handleCreateMirrorPassModal(interaction, setPassMatch[1]);
      return;
    }

    // "Post Mirror" modal ΓÇö user enters invite code + optional password
    if (customId === 'event_mirror_post_modal') {
      await handlePostMirrorModal(interaction);
      return;
    }

    // Route wizard modals to the creation wizard
    if (isWizardModalId(customId)) {
      await handleWizardModal(interaction);
      return;
    }

    // Route edit-wizard modals
    if (isEditWizardModalId(customId)) {
      await handleEditWizardModal(interaction);
      return;
    }

    // event_bringship_modal_{activityId}
    const bringShipMatch = /^event_bringship_modal_(.+)$/.exec(customId);
    if (bringShipMatch) {
      await handleBringShipModal(interaction, bringShipMatch[1]);
      return;
    }

    // event_edit_modal_{activityId}
    const editMatch = /^event_edit_modal_(.+)$/.exec(customId);
    if (editMatch) {
      await handleEditEventModal(interaction, editMatch[1]);
      return;
    }

    // event_reqship_modal_{activityId}
    const reqShipMatch = /^event_reqship_modal_(.+)$/.exec(customId);
    if (reqShipMatch) {
      await handleReqShipModal(interaction, reqShipMatch[1]);
      return;
    }

    // event_manageslots_modal_{activityId}__{encodedShipIdentifier}
    const manageSlotsMatch = /^event_manageslots_modal_(.+?)__(.+)$/.exec(customId);
    if (manageSlotsMatch) {
      await handleManageSlotsModal(
        interaction,
        manageSlotsMatch[1],
        decodeURIComponent(manageSlotsMatch[2])
      );
      return;
    }

    await interaction.reply({
      content: 'Γ¥î Unknown modal submission.',
      flags: MessageFlags.Ephemeral,
    });
  },

  /**
   * Handles select menu interactions (e.g., crew ship selection).
   * Dispatched by the interaction router when a select menu with prefix 'event' is used.
   */
  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const { customId } = interaction;

    // Route wizard select menus to the creation wizard
    if (isWizardSelectId(customId)) {
      await handleWizardSelectMenu(interaction);
      return;
    }

    // "Create Mirror" ΓÇö user picks an event to generate invite code
    if (customId === 'event_mirror_create_select') {
      await handleCreateMirrorEventSelected(interaction);
      return;
    }

    // event_crewselect_{activityId}
    const crewSelectMatch = /^event_crewselect_(.+)$/.exec(customId);
    if (crewSelectMatch) {
      await handleCrewSelectMenu(interaction, crewSelectMatch[1]);
      return;
    }

    // event_passengerselect_{activityId}
    const passengerSelectMatch = /^event_passengerselect_(.+)$/.exec(customId);
    if (passengerSelectMatch) {
      await handlePassengerSelectMenu(interaction, passengerSelectMatch[1]);
      return;
    }

    // event_manageslotsselect_{activityId}
    const manageSlotsSelectMatch = /^event_manageslotsselect_(.+)$/.exec(customId);
    if (manageSlotsSelectMatch) {
      await handleManageSlotsShipSelect(interaction, manageSlotsSelectMatch[1]);
      return;
    }

    // event_bringfleetselect_{activityId}
    const bringFleetSelectMatch = /^event_bringfleetselect_(.+)$/.exec(customId);
    if (bringFleetSelectMatch) {
      await handleBringFleetSelect(interaction, bringFleetSelectMatch[1]);
      return;
    }

    // event_removeshipselect_{activityId}
    const removeShipSelectMatch = /^event_removeshipselect_(.+)$/.exec(customId);
    if (removeShipSelectMatch) {
      await handleRemoveShipSelectMenu(interaction, removeShipSelectMatch[1]);
      return;
    }

    // event_hangarpage_{activityId}  ΓÇö "Bring Ship" letter-group page select
    const hangarPageMatch = /^event_hangarpage_(.+)$/.exec(customId);
    if (hangarPageMatch) {
      await handleHangarPageSelect(interaction, hangarPageMatch[1]);
      return;
    }

    // event_nestship_{activityId}_{childShipKey}  ΓÇö dock ship inside carrier
    const nestShipMatch = /^event_nestship_([^_]+)_(.+)$/.exec(customId);
    if (nestShipMatch) {
      await handleNestShipSelect(interaction, nestShipMatch[1], nestShipMatch[2]);
      return;
    }

    // event_hangarship_{activityId}  ΓÇö "Bring Ship" hangar suggestion select
    const hangarShipMatch = /^event_hangarship_(.+)$/.exec(customId);
    if (hangarShipMatch) {
      await handleHangarShipSelect(interaction, hangarShipMatch[1]);
      return;
    }

    // event_reqshiprole_{activityId}  ΓÇö "Request Ship" role select
    const reqRoleMatch = /^event_reqshiprole_(.+)$/.exec(customId);
    if (reqRoleMatch) {
      await handleReqShipRoleSelect(interaction, reqRoleMatch[1]);
      return;
    }

    // event_reqshiptype_{activityId}_{role}  ΓÇö "Request Ship" type select ΓåÆ modal
    const reqTypeMatch = /^event_reqshiptype_([^_]+)_(.+)$/.exec(customId);
    if (reqTypeMatch) {
      await handleReqShipTypeSelect(interaction, reqTypeMatch[1], reqTypeMatch[2]);
      return;
    }

    await interaction.reply({
      content: 'Γ¥î Unknown select menu.',
      flags: MessageFlags.Ephemeral,
    });
  },
};

// ==================== Mirror helpers ====================

let _mirrorActivityService: ActivityService | null = null;
let _mirrorEventMirrorService: EventMirrorService | null = null;
let _mirrorUserService: UserService | null = null;

function getMirrorActivityService(): ActivityService {
  _mirrorActivityService ??= new ActivityService();
  return _mirrorActivityService;
}

function getMirrorService(): EventMirrorService {
  _mirrorEventMirrorService ??= EventMirrorService.getInstance();
  return _mirrorEventMirrorService;
}

function getMirrorUserService(): UserService {
  _mirrorUserService ??= new UserService();
  return _mirrorUserService;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}ΓÇª` : value;
}

async function canManageMirrorResync(
  interaction: ButtonInteraction,
  activity: Activity
): Promise<boolean> {
  if (activity.creatorId === interaction.user.id) {
    return true;
  }

  const internalUser = await getMirrorUserService().getUserByDiscordId(interaction.user.id);
  return Boolean(internalUser?.id && activity.creatorId === internalUser.id);
}

/**
 * Show mirror-sync visibility and trigger a manual refresh for a source event.
 * This is a lightweight "fix now" control for operators when mirror updates appear stale.
 */
async function presentManualMirrorResync(
  interaction: ButtonInteraction,
  eventId: string
): Promise<void> {
  if (!eventId) {
    await interaction.reply({ content: 'Γ¥î No event selected.', flags: MessageFlags.Ephemeral });
    return;
  }

  const activity = await getMirrorActivityService().getActivityById(eventId);
  if (!activity) {
    await interaction.reply({
      content: `Γ¥î Activity not found: \`${eventId}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const canManage = await canManageMirrorResync(interaction, activity);
  if (!canManage) {
    await interaction.reply({
      content: 'Γ¥î Only the event creator can trigger a manual mirror resync.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const mirrors = await getMirrorService().findRelatedMirrors(eventId);
  const totalMirrors = mirrors.length;
  const syncableMirrors = mirrors.filter(mirror => mirror.canSync()).length;
  const postedMirrors = mirrors.filter(
    mirror => mirror.canSync() && Boolean(mirror.mirrorMessageId)
  ).length;

  publishMirrorRefresh(eventId, interaction.user.id);

  const summary =
    totalMirrors > 0
      ? [
          `≡ƒ¬₧ **Mirror Sync Visibility** for **${activity.title}**`,
          `ΓÇó Related mirrors: **${totalMirrors}**`,
          `ΓÇó Syncable mirrors: **${syncableMirrors}**`,
          `ΓÇó Mirrors with posted messages: **${postedMirrors}**`,
          '',
          '≡ƒöä Manual resync signal sent. Mirrors and source message will refresh shortly.',
        ].join('\n')
      : [
          `≡ƒ¬₧ **Mirror Sync Visibility** for **${activity.title}**`,
          'ΓÇó Related mirrors: **0**',
          '',
          '≡ƒöä Manual resync signal sent. No mirrors are currently linked to this event.',
        ].join('\n');

  await interaction.reply({
    content: summary,
    flags: MessageFlags.Ephemeral,
  });
}

// -------------------- Mirror sub-panel --------------------

/**
 * Show the Mirror sub-panel with two options:
 * - "Create Mirror" (origin server) ΓÇö generate an invite code
 * - "Post Mirror" (target server)  ΓÇö use an invite code to mirror here
 */
async function showMirrorSubPanel(interaction: ButtonInteraction): Promise<void> {
  const embed = buildEventMirrorSubPanelEmbed();

  const createBtn = new ButtonBuilder()
    .setCustomId('event_panel_mirror_create')
    .setLabel('Create Mirror')
    .setEmoji('≡ƒôñ')
    .setStyle(ButtonStyle.Primary);

  const postBtn = new ButtonBuilder()
    .setCustomId('event_panel_mirror_post')
    .setLabel('Post Mirror')
    .setEmoji('≡ƒôÑ')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, postBtn);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

// -------------------- CREATE MIRROR flow --------------------

/**
 * Step 1 of "Create Mirror": show dropdown of events from the current server.
 * Only events that originated on this Discord server are listed.
 */
async function showCreateMirrorPicker(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'Γ¥î This can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const upcoming = await getMirrorActivityService().getUpcomingActivities({ limit: 50 });
  const candidates = upcoming.filter(a => a.metadata?.discordServerId === guildId);

  if (candidates.length === 0) {
    await interaction.reply({
      content:
        'Γ¥î No upcoming events found on this server. Create an event first, then generate a mirror invite.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const options = candidates.slice(0, 25).map(activity => {
    const dateStr = activity.scheduledStartDate
      ? new Date(activity.scheduledStartDate).toLocaleString()
      : 'Not scheduled';
    const hasCode = activity.metadata?.mirrorInviteCode ? ' (code exists)' : '';
    return {
      label: truncate(activity.title || 'Untitled event', 100),
      value: activity.id,
      description: truncate(`${dateStr}${hasCode}`, 100),
    };
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('event_mirror_create_select')
    .setPlaceholder('Select an event to share')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.reply({
    content: '≡ƒôñ **Create Mirror** ΓÇö Choose an event to generate an invite code for:',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Dispatch an event command-panel button (event_panel_*). Returns true when the
 * customId was a panel button and was handled (errors are reported ephemerally).
 */
async function tryHandleEventPanelButton(interaction: ButtonInteraction): Promise<boolean> {
  const panelSub = parsePanelCustomId(interaction.customId, 'event');
  if (!panelSub) {
    return false;
  }
  try {
    if (panelSub === 'list' || panelSub === 'my') {
      await handleEventList(interaction);
    } else if (panelSub === 'create') {
      await handleEventCreate(interaction);
    } else if (panelSub === 'schedule') {
      const { embed, components } = buildCommandPanel({
        prefix: 'schedule',
        title: '\ud83d\udcc6 Schedule & Availability',
        description: 'Manage your availability and find the best event times.',
        buttons: [
          {
            subcommand: 'set',
            label: 'Set Availability',
            emoji: '\ud83d\uddd3\ufe0f',
            style: ButtonStyle.Primary,
          },
          { subcommand: 'view', label: 'View Heatmap', emoji: '\ud83d\uddfa\ufe0f' },
          { subcommand: 'my', label: 'My Conflicts', emoji: '\ud83d\udc64' },
          { subcommand: 'best', label: 'Find Best Time', emoji: '\u2b50' },
          { subcommand: 'conflicts', label: 'Check Conflicts', emoji: '\u26a0\ufe0f' },
        ],
      });
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    } else if (panelSub === 'attendance') {
      const { embed, components } = buildCommandPanel({
        prefix: 'attend',
        title: '\u2705 Attendance',
        description: 'Manage event attendance and view your history.',
        buttons: [
          {
            subcommand: 'history',
            label: 'My History',
            emoji: '\ud83d\udcc5',
            style: ButtonStyle.Primary,
          },
          { subcommand: 'leaderboard', label: 'Leaderboard', emoji: '\ud83c\udfc6' },
          {
            subcommand: 'confirm',
            label: 'Confirm Attendance',
            emoji: '\u2705',
            style: ButtonStyle.Success,
          },
          { subcommand: 'stats', label: 'Event Stats', emoji: '\ud83d\udcca' },
          { subcommand: 'report', label: 'Event Report', emoji: '\ud83d\udccb' },
        ],
      });
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    } else if (panelSub === 'reminders') {
      const { embed, components } = buildCommandPanel({
        prefix: 'reminder',
        title: '\u23f0 Event Reminders',
        description: 'Manage reminders for events.',
        buttons: [
          {
            subcommand: 'create',
            label: 'Create Reminder',
            emoji: '\u2795',
            style: ButtonStyle.Success,
          },
          { subcommand: 'list', label: 'List Reminders', emoji: '\ud83d\udccb' },
          {
            subcommand: 'cancel',
            label: 'Cancel Reminder',
            emoji: '\u274c',
            style: ButtonStyle.Danger,
          },
        ],
      });
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    } else if (panelSub === 'mirror') {
      await showMirrorSubPanel(interaction);
    } else if (panelSub === 'mirror_create') {
      await showCreateMirrorPicker(interaction);
    } else if (panelSub === 'mirror_post') {
      await showPostMirrorModal(interaction);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An error occurred';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
    }
  }
  return true;
}

/**
 * Dispatch a fleet-bring DM invite button (event_fleet{joinship|joinonly|decline}_{activityId}_{fleetId}).
 * Returns true when the customId matched and was handled.
 */
async function tryHandleFleetInviteButton(interaction: ButtonInteraction): Promise<boolean> {
  const parsed = parseFleetInviteButtonId(interaction.customId);
  if (!parsed) {
    return false;
  }

  await handleFleetInviteResponse(interaction, parsed.action, parsed.activityId, parsed.fleetId);
  return true;
}

export function parseFleetInviteButtonId(
  customId: string
): { action: 'joinship' | 'joinonly' | 'decline'; activityId: string; fleetId: string } | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== 'event') {
    return null;
  }

  const actionByPrefix: Record<string, 'joinship' | 'joinonly' | 'decline'> = {
    fleetjoinship: 'joinship',
    fleetjoinonly: 'joinonly',
    fleetdecline: 'decline',
  };
  const action = actionByPrefix[parsed.action];
  const [activityId = '', fleetId = ''] = parsed.params;
  if (!action || !activityId || !fleetId) {
    return null;
  }

  return { action, activityId, fleetId };
}

/**
 * Present the "Create Mirror" step for a specific event: if an invite code
 * already exists, show it; otherwise open the optional-password modal that
 * generates one. Shared by the event picker (select menu) and the per-event
 * **Mirror** button on the organiser action row.
 */ async function presentCreateMirrorForEvent(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  eventId: string
): Promise<void> {
  if (!eventId) {
    await interaction.reply({ content: 'Γ¥î No event selected.', flags: MessageFlags.Ephemeral });
    return;
  }

  const activity = await getMirrorActivityService().getActivityById(eventId);
  if (!activity) {
    await interaction.reply({
      content: `Γ¥î Activity not found: \`${eventId}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // If invite code already exists, show it
  if (activity.metadata?.mirrorInviteCode) {
    const code = activity.metadata.mirrorInviteCode;
    const hasPass = activity.metadata.mirrorKeyHash
      ? '≡ƒöÉ Password protected'
      : '≡ƒöô No password';
    await interaction.reply({
      content:
        `≡ƒ¬₧ **${activity.title}** already has a mirror invite code:\n\n` +
        `\`\`\`\n${code}\n\`\`\`\n` +
        `${hasPass}\n\n` +
        `Share this code with other servers. They can use **Post Mirror** to mirror this event.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Show modal asking for optional password
  const modal = new ModalBuilder()
    .setCustomId(`event_mirror_setpass_${eventId}`)
    .setTitle('Create Mirror Invite');

  const passInput = new TextInputBuilder()
    .setCustomId('password')
    .setPlaceholder('Leave blank for an open invite')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Password (optional)').setTextInputComponent(passInput)
  );
  await interaction.showModal(modal);
}

/**
 * Step 2 of "Create Mirror": user selected an event.
 * Show two buttons: "Generate Code" (no password) or "Set Password + Generate".
 */
async function handleCreateMirrorEventSelected(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  await presentCreateMirrorForEvent(interaction, interaction.values[0]);
}

/**
 * Handle the "Create Mirror" password modal. Generates the invite code,
 * optionally sets a password, and kicks off federation auto-propagation.
 */
async function handleCreateMirrorPassModal(
  interaction: ModalSubmitInteraction,
  eventId: string
): Promise<void> {
  const password = interaction.fields.getTextInputValue('password').trim() || undefined;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await getMirrorService().generateInviteCode(eventId, password);
  if (!result.success || !result.inviteCode) {
    await interaction.editReply({ content: `Γ¥î ${result.message}` });
    return;
  }

  const activity = await getMirrorActivityService().getActivityById(eventId);
  const eventTitle = activity?.title ?? 'Untitled event';
  const hasPass = password ? '≡ƒöÉ Password protected' : '≡ƒöô No password';

  let federationNote = '';

  // Federation auto-propagation
  if (activity && interaction.client) {
    const propagated = await propagateToFederation(interaction.client, activity, eventId, password);
    if (propagated > 0) {
      federationNote = `\n\n≡ƒîÉ **Federation**: Auto-mirrored to **${propagated}** federated server${propagated === 1 ? '' : 's'} with event channels configured.`;
    }
  }

  await interaction.editReply({
    content:
      `Γ£à Mirror invite code created for **${eventTitle}**:\n\n` +
      `\`\`\`\n${result.inviteCode}\n\`\`\`\n` +
      `${hasPass}\n\n` +
      `Share this code with other servers. They can use the **Post Mirror** button to mirror this event in their channel.${federationNote}`,
  });
}

// -------------------- POST MIRROR flow --------------------

/**
 * Show the "Post Mirror" modal: enter invite code + optional password.
 * The mirror will be posted in the current channel.
 */
async function showPostMirrorModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId('event_mirror_post_modal').setTitle('Post Mirror');

  const codeInput = new TextInputBuilder()
    .setCustomId('invite_code')
    .setPlaceholder('e.g. FLEET-A7X3')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  const passInput = new TextInputBuilder()
    .setCustomId('password')
    .setPlaceholder('Leave blank if no password was set')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Invite code').setTextInputComponent(codeInput),
    new LabelBuilder().setLabel('Password (if required)').setTextInputComponent(passInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle the "Post Mirror" modal submission.
 * Looks up the event by invite code, validates password, and creates the mirror
 * in the current channel.
 */
async function handlePostMirrorModal(interaction: ModalSubmitInteraction): Promise<void> {
  const inviteCode = interaction.fields.getTextInputValue('invite_code').trim().toUpperCase();
  const password = interaction.fields.getTextInputValue('password').trim() || undefined;

  if (!inviteCode) {
    await interaction.reply({
      content: 'Γ¥î Invite code is required.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'Γ¥î This can only be used in a server channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Look up activity by invite code
  const activity = await getMirrorService().findActivityByInviteCode(inviteCode);
  if (!activity) {
    await interaction.editReply({
      content: `Γ¥î No event found for invite code \`${inviteCode}\`. Check the code and try again.`,
    });
    return;
  }

  await executeMirror(interaction, activity.id, password, guildId, channelId);
}

// -------------------- Execute mirror --------------------

/**
 * Execute the mirror operation. Posts the embed to the target channel and creates
 * the mirror record.
 */
async function executeMirror(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  eventId: string,
  mirrorKey: string | undefined,
  targetGuildId: string | undefined,
  targetChannelId: string | undefined
): Promise<void> {
  const guildId = targetGuildId || interaction.guildId;
  const channelId = targetChannelId || interaction.channelId;

  if (!guildId || !channelId) {
    await interaction.reply({
      content: 'Γ¥î Could not determine target server or channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.replied && !interaction.deferred) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const editOrReply = async (content: string): Promise<void> => {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    }
  };

  const sourceActivity = await getMirrorActivityService().getActivityById(eventId);
  if (!sourceActivity) {
    await editOrReply(`Γ¥î Activity not found with ID: \`${eventId}\``);
    return;
  }

  // Validate mirror key if required
  if (sourceActivity.metadata?.mirrorKeyHash) {
    if (!mirrorKey) {
      await editOrReply(
        '≡ƒöæ This event requires a password. Use **Post Mirror** and enter the password.'
      );
      return;
    }
    const isValidKey = await getMirrorService().validateMirrorKey(eventId, mirrorKey);
    if (!isValidKey) {
      await editOrReply('Γ¥î Invalid password.');
      return;
    }
  }

  const sourceGuildId = sourceActivity.metadata?.discordServerId;
  if (!sourceGuildId) {
    await editOrReply(
      'Γ¥î This event does not have a Discord server ID. It may have been created via the API.'
    );
    return;
  }

  if (guildId === sourceGuildId) {
    await editOrReply('Γ¥î You cannot mirror an event to its source server.');
    return;
  }

  const targetOrgId = await resolveOrgIdForGuild(guildId);
  if (!targetOrgId) {
    await editOrReply(
      'Γ¥î This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.'
    );
    return;
  }

  const mirrorResult = await getMirrorService().createMirror({
    sourceActivityId: eventId,
    sourceGuildId,
    sourceOrganizationId: sourceActivity.organizationId ?? '',
    mirrorGuildId: guildId,
    mirrorChannelId: channelId,
    mirrorKey,
    targetOrganizationId: targetOrgId,
  });

  if (!mirrorResult.success) {
    await editOrReply(`Γ¥î ${mirrorResult.message}`);
    return;
  }

  if (!mirrorResult.mirror) {
    await editOrReply('Γ¥î Mirror creation returned no mirror data.');
    return;
  }

  // Build and post the mirror embed
  const mirrorMessageId = await postMirrorEmbed(
    interaction.client,
    sourceActivity,
    mirrorResult.mirror.id,
    guildId,
    channelId
  );

  if (!mirrorMessageId) {
    await editOrReply(
      'Γ¥î Mirror record was created, but posting the mirrored event message failed. Check bot send/embed permissions in the target channel and try again.'
    );
    return;
  }

  await getMirrorService().setMirrorMessageId(mirrorResult.mirror.id, mirrorMessageId);

  const targetGuild = interaction.client.guilds.cache.get(guildId);
  const targetServerName = targetGuild?.name ?? 'this server';
  await editOrReply(
    `Γ£à Event **${sourceActivity.title}** mirrored to **${targetServerName}** successfully! RSVP changes will sync across servers.`
  );
}

// -------------------- Shared embed builder --------------------

/**
 * Build and post the mirrored event embed to a channel. Returns the message ID.
 */
async function postMirrorEmbed(
  client: ButtonInteraction['client'],
  sourceActivity: Activity,
  mirrorId: string,
  guildId: string,
  channelId: string
): Promise<string | undefined> {
  const embed = await buildMirroredEventEmbed(sourceActivity, mirrorId);
  const components = buildMirroredEventComponents(sourceActivity.id);

  const targetGuild = client.guilds.cache.get(guildId);
  const targetChannel = targetGuild?.channels.cache.get(channelId);

  if (targetChannel && targetChannel.isTextBased() && 'send' in targetChannel) {
    const msg = await targetChannel.send({ embeds: [embed], components });
    return msg.id;
  }

  return undefined;
}

// -------------------- Federation auto-propagation --------------------

/**
 * Auto-mirror an event to all federation member servers that have an event
 * announcement channel configured. Skips the source guild.
 *
 * Returns the number of servers successfully mirrored to.
 */
async function propagateToFederation(
  client: ButtonInteraction['client'],
  activity: Activity,
  activityId: string,
  mirrorKey: string | undefined
): Promise<number> {
  const sourceGuildId = activity.metadata?.discordServerId;
  const sourceOrgId = activity.organizationId;
  if (!sourceGuildId || !sourceOrgId) {
    return 0;
  }

  try {
    // Find federation membership for this org
    const { AppDataSource } = await import('../../data-source');
    const { FederationMember } = await import('../../models/FederationMember');
    const { DiscordGuildSettings } = await import('../../models/DiscordGuildSettings');

    const memberRepo = AppDataSource.getRepository(FederationMember);
    const settingsRepo = AppDataSource.getRepository(DiscordGuildSettings);

    // Find federation(s) the source org belongs to
    const sourceMembership = await memberRepo.findOne({
      where: { organizationId: sourceOrgId, status: 'active' as const },
    });

    if (!sourceMembership) {
      return 0;
    }

    const federationId = sourceMembership.federationId;

    // Get all active federation members (excluding source org)
    const members = await memberRepo.find({
      where: { federationId, status: 'active' as const },
    });

    const otherMembers = members.filter(m => m.organizationId !== sourceOrgId);
    if (otherMembers.length === 0) {
      return 0;
    }

    let propagated = 0;

    for (const member of otherMembers) {
      // Get guild settings for this member org
      const guildSettings = await settingsRepo.find({
        where: { organizationId: member.organizationId },
      });

      for (const gs of guildSettings) {
        const eventChannelId = gs.eventSettings?.eventAnnouncementChannelId;
        if (!eventChannelId) {
          continue;
        }
        if (gs.guildId === sourceGuildId) {
          continue;
        }

        // Check the bot is actually in this guild
        const guild = client.guilds.cache.get(gs.guildId);
        if (!guild) {
          continue;
        }

        const channel = guild.channels.cache.get(eventChannelId);
        if (!channel || !channel.isTextBased() || !('send' in channel)) {
          continue;
        }

        // Create the mirror record
        const mirrorResult = await getMirrorService().createMirror({
          sourceActivityId: activityId,
          sourceGuildId,
          sourceOrganizationId: sourceOrgId,
          mirrorGuildId: gs.guildId,
          mirrorChannelId: eventChannelId,
          mirrorKey,
          targetOrganizationId: member.organizationId,
        });

        if (!mirrorResult.success || !mirrorResult.mirror) {
          continue;
        }

        // Post the embed
        const msgId = await postMirrorEmbed(
          client,
          activity,
          mirrorResult.mirror.id,
          gs.guildId,
          eventChannelId
        );

        if (!msgId) {
          continue;
        }

        await getMirrorService().setMirrorMessageId(mirrorResult.mirror.id, msgId);

        propagated++;
      }
    }

    return propagated;
  } catch (err: unknown) {
    const { logger } = await import('../../utils/logger');
    logger.warn('Federation auto-propagation failed (non-critical)', {
      activityId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
