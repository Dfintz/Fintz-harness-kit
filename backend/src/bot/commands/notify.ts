import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  LabelBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { DiscordUserPreferenceService } from '../../services/discord/DiscordUserPreferenceService';
import { logger } from '../../utils/logger';
import {
  buildDmNotificationStatusEmbed,
  buildLfgPingStatusEmbed,
  buildMyNotificationPreferencesEmbed,
} from '../embeds/notifyEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';

import { BotCommand } from './types';

/**
 * Personal-scope notification controls operate only on the invoking user's own
 * preferences and are safe for any member. Everything else reads or mutates
 * guild-wide settings and requires Manage Server. Allowlists are per interaction
 * kind and treated as deny-by-default: an action not listed here is gated.
 */
const PERSONAL_NOTIFY_BUTTON_SUBS = new Set(['my_status', 'my_toggle']);
const PERSONAL_NOTIFY_SELECT_IDS = new Set(['notify_my_toggle_select']);

type NotifyGuildInteraction =
  ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

function memberHasManageGuild(interaction: NotifyGuildInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

/**
 * Enforce Manage Server for guild-scoped notification controls.
 *
 * Button/select/modal interactions are routed by customId prefix, bypassing the
 * slash command's setDefaultMemberPermissions gate, so each handler must re-check
 * permissions. Personal controls pass `isPersonal = true` and are exempt.
 *
 * @returns `true` if the interaction was denied ΓÇö the caller must return early.
 */
async function denyGuildNotifyControlWithoutPermission(
  interaction: NotifyGuildInteraction,
  isPersonal: boolean
): Promise<boolean> {
  if (isPersonal || memberHasManageGuild(interaction)) {
    return false;
  }
  await interaction.reply({
    content: '\u274c You need the **Manage Server** permission to use guild notification controls.',
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

/**
 * Dispatch a read-only notification status sub to its handler. Extracted from
 * handleButton to flatten a nested ternary and keep the button router lean.
 */
async function handleNotifyStatusButton(
  interaction: ButtonInteraction,
  sub: string,
  guildId: string
): Promise<void> {
  try {
    if (sub === 'dm_status') {
      await handleDmStatus(interaction, guildId);
    } else if (sub === 'lfg_status') {
      await handleLfgPingStatus(interaction, guildId);
    } else {
      await handleMyStatus(interaction, guildId);
    }
  } catch (error: unknown) {
    logger.error(
      'notify.handleNotifyStatusButton failed',
      error instanceof Error ? error : new Error(String(error))
    );
    await interaction.reply({
      content: '\u274c An error occurred.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Flip the guild's smart-LFG-ping enabled flag. Guarded by the Manage Server
 * check in handleButton.
 */
async function handleLfgToggle(interaction: ButtonInteraction, guildId: string): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const allSettings = await discordSettingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    if (!settings) {
      await interaction.editReply('\u274c No guild settings found. Set up the bot first.');
      return;
    }
    const lfg = settings.smartLfgPingSettings ?? { enabled: false };
    const newValue = !lfg.enabled;
    lfg.enabled = newValue;
    settings.smartLfgPingSettings = lfg;
    await discordSettingsService.saveSettings(settings);
    const emoji = newValue ? '\u2705' : '\u274c';
    await interaction.editReply(
      `${emoji} Smart LFG pings **${newValue ? 'enabled' : 'disabled'}**.`
    );
  } catch (error: unknown) {
    logger.error(
      'notify.handleLfgToggle failed',
      error instanceof Error ? error : new Error(String(error))
    );
    await interaction.editReply('\u274c Failed to toggle LFG pings.');
  }
}

/**
 * Apply the smart-LFG-ping config modal (cooldown + max pings). Guild-scoped;
 * the Manage Server gate runs in handleModal before dispatch.
 */
async function handleLfgConfigModal(
  interaction: ModalSubmitInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const cooldownStr = interaction.fields.getTextInputValue('cooldown').trim();
    const maxPingsStr = interaction.fields.getTextInputValue('max_pings').trim();

    const allSettings = await discordSettingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    if (!settings) {
      await interaction.editReply('\u274c No guild settings found.');
      return;
    }

    const lfg = settings.smartLfgPingSettings ?? { enabled: false };
    if (cooldownStr) {
      const cooldown = Number.parseInt(cooldownStr, 10);
      if (Number.isNaN(cooldown) || cooldown < 1 || cooldown > 72) {
        await interaction.editReply('\u274c Cooldown must be 1-72 hours.');
        return;
      }
      (lfg as unknown as Record<string, number>).cooldownHours = cooldown;
    }
    if (maxPingsStr) {
      const maxPings = Number.parseInt(maxPingsStr, 10);
      if (Number.isNaN(maxPings) || maxPings < 1 || maxPings > 25) {
        await interaction.editReply('\u274c Max pings must be 1-25.');
        return;
      }
      (lfg as unknown as Record<string, number>).maxPingsPerPost = maxPings;
    }

    settings.smartLfgPingSettings = lfg;
    await discordSettingsService.saveSettings(settings);

    const parts: string[] = [];
    if (cooldownStr) {
      parts.push(`Cooldown: **${cooldownStr}h**`);
    }
    if (maxPingsStr) {
      parts.push(`Max pings: **${maxPingsStr}**`);
    }

    await interaction.editReply(
      `\u2705 LFG ping config updated:\n${parts.join('\n') || 'No changes made.'}`
    );
  } catch (error: unknown) {
    logger.error(
      'notify.handleLfgConfigModal failed',
      error instanceof Error ? error : new Error(String(error))
    );
    await interaction.editReply('\u274c Failed to update LFG config.');
  }
}

/**
 * Apply the LFG mention-role modal. Guild-scoped; the Manage Server gate runs in
 * handleModal before dispatch.
 */
async function handleLfgMentionModal(
  interaction: ModalSubmitInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const roleIdStr = interaction.fields.getTextInputValue('role_id').trim();

    const allSettings = await discordSettingsService.getSettingsByGuildId(guildId);
    const settings = allSettings?.[0];
    if (!settings) {
      await interaction.editReply('\u274c No guild settings found.');
      return;
    }

    const lfgSettings = settings.lfgSettings ?? {};

    if (!roleIdStr) {
      lfgSettings.lfgMentionRoleId = undefined;
      settings.lfgSettings = lfgSettings;
      await discordSettingsService.saveSettings(settings);
      await interaction.editReply(
        '\u2705 LFG mention role **cleared** ΓÇö no role will be pinged on new posts.'
      );
      return;
    }

    if (!/^\d{17,20}$/.test(roleIdStr)) {
      await interaction.editReply('\u274c Invalid role ID. Right-click a role and copy its ID.');
      return;
    }

    lfgSettings.lfgMentionRoleId = roleIdStr;
    settings.lfgSettings = lfgSettings;
    await discordSettingsService.saveSettings(settings);
    await interaction.editReply(
      `\u2705 LFG mention role set to <@&${roleIdStr}>. This role will be @mentioned when new LFG posts are created.`
    );
  } catch (error: unknown) {
    logger.error(
      'notify.handleLfgMentionModal failed',
      error instanceof Error ? error : new Error(String(error))
    );
    await interaction.editReply('\u274c Failed to update LFG mention role.');
  }
}

export const notify: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Configure DM notifications and smart LFG pings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 5,
  category: 'utility',

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'notify');
    if (!sub || !interaction.guildId) {
      return;
    }

    // Button routing bypasses the slash-level setDefaultMemberPermissions gate,
    // so re-check Manage Server for guild-scoped controls (deny-by-default).
    if (
      await denyGuildNotifyControlWithoutPermission(
        interaction,
        PERSONAL_NOTIFY_BUTTON_SUBS.has(sub)
      )
    ) {
      return;
    }

    if (sub === 'dm_status' || sub === 'lfg_status' || sub === 'my_status') {
      await handleNotifyStatusButton(interaction, sub, interaction.guildId);
    } else if (sub === 'dm_toggle') {
      // Show select menu to pick which DM notification to toggle
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('notify_dm_toggle_select')
          .setPlaceholder('Select notification type to toggle...')
          .addOptions(
            { label: 'All DM Notifications', value: 'enabled', emoji: '\ud83d\udd14' },
            { label: 'Ticket Created', value: 'ticketCreated', emoji: '\ud83c\udfab' },
            { label: 'Ticket Assigned', value: 'ticketAssigned', emoji: '\ud83c\udfab' },
            { label: 'Ticket Replied', value: 'ticketReplied', emoji: '\ud83c\udfab' },
            { label: 'Ticket Closed', value: 'ticketClosed', emoji: '\ud83c\udfab' },
            { label: 'Ticket Escalated', value: 'ticketEscalated', emoji: '\ud83c\udfab' },
            { label: 'Recruitment Received', value: 'recruitmentReceived', emoji: '\ud83d\udccb' },
            { label: 'Recruitment Accepted', value: 'recruitmentAccepted', emoji: '\ud83d\udccb' },
            { label: 'Recruitment Denied', value: 'recruitmentDenied', emoji: '\ud83d\udccb' },
            { label: 'Event Reminder', value: 'eventReminder', emoji: '\ud83d\udcc5' },
            { label: 'Event Cancelled', value: 'eventCancelled', emoji: '\ud83d\udcc5' },
            { label: 'LFG Player Joined', value: 'lfgPlayerJoined', emoji: '\ud83c\udfae' }
          )
      );
      await interaction.reply({
        content: 'Select a DM notification type to toggle:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } else if (sub === 'lfg_toggle') {
      await handleLfgToggle(interaction, interaction.guildId);
    } else if (sub === 'lfg_config') {
      // Show modal for LFG config
      const modal = new ModalBuilder()
        .setCustomId('notify_lfg_config_modal')
        .setTitle('Smart LFG Ping Config');

      const cooldownInput = new TextInputBuilder()
        .setCustomId('cooldown')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('8')
        .setMaxLength(2);

      const maxPingsInput = new TextInputBuilder()
        .setCustomId('max_pings')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('5')
        .setMaxLength(2);

      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel('Hours between pings (1-72, default: 8)')
          .setTextInputComponent(cooldownInput),
        new LabelBuilder()
          .setLabel('Max members to ping per post (1-25, default: 5)')
          .setTextInputComponent(maxPingsInput)
      );
      await interaction.showModal(modal);
    } else if (sub === 'lfg_mention') {
      // Show modal to set the LFG mention role ID
      const modal = new ModalBuilder()
        .setCustomId('notify_lfg_mention_modal')
        .setTitle('LFG Mention Role');

      const roleInput = new TextInputBuilder()
        .setCustomId('role_id')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Paste a role ID or leave empty to disable')
        .setMaxLength(20);

      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel('Role ID to @mention on new LFG posts (empty = none)')
          .setTextInputComponent(roleInput)
      );
      await interaction.showModal(modal);
    } else if (sub === 'my_toggle') {
      // Show select menu for personal notification preferences
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('notify_my_toggle_select')
          .setPlaceholder('Select preference to toggle...')
          .addOptions(
            { label: 'All DMs', value: 'dmEnabled', description: 'Master DM toggle' },
            {
              label: 'LFG Pings',
              value: 'lfgPingOptIn',
              description: 'Smart LFG ping notifications',
            },
            {
              label: 'Event Reminders',
              value: 'eventReminderOptIn',
              description: 'Event reminder DMs',
            },
            { label: 'Ticket DMs', value: 'ticketDmOptIn', description: 'Ticket notification DMs' },
            {
              label: 'Recruitment DMs',
              value: 'recruitmentDmOptIn',
              description: 'Recruitment notification DMs',
            },
            {
              label: 'Moderation Alerts',
              value: 'moderationAlertOptIn',
              description: 'Moderation alert DMs',
            },
            {
              label: 'Bot Responses via DM',
              value: 'botResponseViaDm',
              description: 'Receive command results in DMs instead of channel',
              emoji: '≡ƒô¼',
            }
          )
      );
      await interaction.reply({
        content: 'Select a personal notification preference to toggle:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  handleSelectMenu: async (interaction: StringSelectMenuInteraction) => {
    const { customId, guildId } = interaction;
    if (!guildId) {
      return;
    }

    if (
      await denyGuildNotifyControlWithoutPermission(
        interaction,
        PERSONAL_NOTIFY_SELECT_IDS.has(customId)
      )
    ) {
      return;
    }

    if (customId === 'notify_dm_toggle_select') {
      const event = interaction.values[0];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const settingsService = discordSettingsService;
        const allSettings = await settingsService.getSettingsByGuildId(guildId);
        const settings = allSettings?.[0];
        if (!settings) {
          await interaction.editReply('\u274c No guild settings found. Set up the bot first.');
          return;
        }
        const dm = settings.dmNotificationSettings ?? { enabled: false };
        const current = (dm as unknown as Record<string, boolean>)[event] ?? false;
        const newValue = !current;
        (dm as unknown as Record<string, boolean>)[event] = newValue;
        settings.dmNotificationSettings = dm;
        await settingsService.saveSettings(settings);
        const emoji = newValue ? '\u2705' : '\u274c';
        await interaction.editReply(
          `${emoji} DM notification **${event}** set to **${newValue}**.`
        );
      } catch {
        await interaction.editReply('\u274c Failed to toggle DM notification.');
      }
    } else if (customId === 'notify_my_toggle_select') {
      const setting = interaction.values[0];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const prefService = DiscordUserPreferenceService.getInstance();
        const prefs = await prefService.getOrCreate(interaction.user.id, guildId);
        const current = (prefs as unknown as Record<string, boolean>)[setting] ?? true;
        const newValue = !current;
        await prefService.update(interaction.user.id, guildId, { [setting]: newValue });
        const emoji = newValue ? '\u2705' : '\u274c';
        await interaction.editReply(`${emoji} **${setting}** set to **${newValue}**.`);
      } catch {
        await interaction.editReply('\u274c Failed to toggle preference.');
      }
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    const { customId, guildId } = interaction;
    if (!guildId) {
      return;
    }

    // Modal routing bypasses the slash-level setDefaultMemberPermissions gate.
    // Every notify modal mutates guild settings (none are personal-scope), so
    // all require Manage Server.
    if (await denyGuildNotifyControlWithoutPermission(interaction, false)) {
      return;
    }

    if (customId === 'notify_lfg_config_modal') {
      await handleLfgConfigModal(interaction, guildId);
    } else if (customId === 'notify_lfg_mention_modal') {
      await handleLfgMentionModal(interaction, guildId);
    }
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '\u274c This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const panelConfig: CommandPanelConfig = {
      prefix: 'notify',
      title: '\ud83d\udd14 Notification Settings',
      description: 'Configure DM notifications and LFG ping settings.',
      buttons: [
        {
          subcommand: 'dm_status',
          label: 'DM Status',
          emoji: '\ud83d\udce8',
          style: ButtonStyle.Primary,
        },
        { subcommand: 'lfg_status', label: 'LFG Ping Status', emoji: '\ud83d\udce2' },
        { subcommand: 'my_status', label: 'My Preferences', emoji: '\ud83d\udc64' },
        { subcommand: 'dm_toggle', label: 'DM Toggle', emoji: '\ud83d\udd00' },
        { subcommand: 'lfg_toggle', label: 'LFG Toggle', emoji: '\ud83d\udd00' },
        { subcommand: 'lfg_config', label: 'LFG Config', emoji: '\u2699\ufe0f' },
        { subcommand: 'lfg_mention', label: 'LFG Mention Role', emoji: '\ud83d\udce3' },
        { subcommand: 'my_toggle', label: 'My Toggle', emoji: '\ud83d\udd00' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};

// ==================== DM Notification Handlers ====================

async function handleDmStatus(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const settingsService = discordSettingsService;
  const allSettings = await settingsService.getSettingsByGuildId(guildId);
  const settings = allSettings?.[0];
  const dm = settings?.dmNotificationSettings;

  const embed = buildDmNotificationStatusEmbed(dm, formatBool);

  await interaction.editReply({ embeds: [embed] });
}

async function _handleDmToggle(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const event = interaction.options.getString('event', true);
  const value = interaction.options.getBoolean('value', true);

  const settingsService = discordSettingsService;
  const allSettings = await settingsService.getSettingsByGuildId(guildId);
  const settings = allSettings?.[0];

  if (!settings) {
    await interaction.editReply('Γ¥î No guild settings found. Set up the bot first.');
    return;
  }

  const dm = settings.dmNotificationSettings ?? { enabled: false };
  (dm as unknown as Record<string, boolean>)[event] = value;
  settings.dmNotificationSettings = dm;

  await settingsService.saveSettings(settings);

  const emoji = value ? 'Γ£à' : 'Γ¥î';
  await interaction.editReply(`${emoji} DM notification **${event}** set to **${value}**.`);
}

// ==================== Smart LFG Ping Handlers ====================

async function handleLfgPingStatus(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const settingsService = discordSettingsService;
  const allSettings = await settingsService.getSettingsByGuildId(guildId);
  const settings = allSettings?.[0];
  const ping = settings?.smartLfgPingSettings;

  const embed = buildLfgPingStatusEmbed(ping);

  await interaction.editReply({ embeds: [embed] });
}

async function _handleLfgPingToggle(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const enabled = interaction.options.getBoolean('enabled', true);

  const settingsService = discordSettingsService;
  const allSettings = await settingsService.getSettingsByGuildId(guildId);
  const settings = allSettings?.[0];

  if (!settings) {
    await interaction.editReply('Γ¥î No guild settings found. Set up the bot first.');
    return;
  }

  const ping = settings.smartLfgPingSettings ?? { enabled: false };
  ping.enabled = enabled;
  settings.smartLfgPingSettings = ping;

  await settingsService.saveSettings(settings);

  const emoji = enabled ? 'Γ£à' : 'Γ¥î';
  await interaction.editReply(
    `${emoji} Smart LFG pings are now **${enabled ? 'enabled' : 'disabled'}**.`
  );
}

async function _handleLfgPingConfig(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const cooldown = interaction.options.getInteger('cooldown');
  const maxPings = interaction.options.getInteger('max-pings');
  const optInRole = interaction.options.getRole('opt-in-role');

  const settingsService = discordSettingsService;
  const allSettings = await settingsService.getSettingsByGuildId(guildId);
  const settings = allSettings?.[0];

  if (!settings) {
    await interaction.editReply('Γ¥î No guild settings found. Set up the bot first.');
    return;
  }

  const ping = settings.smartLfgPingSettings ?? { enabled: false };
  const changes: string[] = [];

  if (cooldown !== null) {
    ping.cooldownHours = cooldown;
    changes.push(`Cooldown ΓåÆ **${cooldown}h**`);
  }
  if (maxPings !== null) {
    ping.maxPingsPerPost = maxPings;
    changes.push(`Max Pings ΓåÆ **${maxPings}**`);
  }
  if (optInRole !== null) {
    ping.optInRoleId = optInRole.id;
    changes.push(`Opt-In Role ΓåÆ <@&${optInRole.id}>`);
  }

  settings.smartLfgPingSettings = ping;
  await settingsService.saveSettings(settings);

  if (changes.length === 0) {
    await interaction.editReply('ΓÜá∩╕Å No changes specified. Use at least one option.');
    return;
  }

  await interaction.editReply(`Γ£à Smart LFG ping settings updated:\n${changes.join('\n')}`);
}

// ==================== Personal Preference Handlers ====================

async function handleMyStatus(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prefService = DiscordUserPreferenceService.getInstance();
  const pref = await prefService.getOrCreate(interaction.user.id, guildId);

  const embed = buildMyNotificationPreferencesEmbed(pref, formatBool);

  await interaction.editReply({ embeds: [embed] });
}

async function _handleMyToggle(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const setting = interaction.options.getString('setting', true);
  const value = interaction.options.getBoolean('value', true);

  const allowedSettings = [
    'dmEnabled',
    'lfgPingOptIn',
    'eventReminderOptIn',
    'ticketDmOptIn',
    'recruitmentDmOptIn',
    'moderationAlertOptIn',
    'botResponseViaDm',
  ];

  if (!allowedSettings.includes(setting)) {
    await interaction.editReply('Γ¥î Invalid setting.');
    return;
  }

  const prefService = DiscordUserPreferenceService.getInstance();
  await prefService.update(interaction.user.id, guildId, { [setting]: value });

  const emoji = value ? 'Γ£à' : 'Γ¥î';
  const labels: Record<string, string> = {
    dmEnabled: 'All DMs',
    lfgPingOptIn: 'LFG Pings',
    eventReminderOptIn: 'Event Reminders',
    ticketDmOptIn: 'Ticket DMs',
    recruitmentDmOptIn: 'Recruitment DMs',
    moderationAlertOptIn: 'Moderation Alerts',
    botResponseViaDm: 'Bot Responses via DM',
  };

  await interaction.editReply(
    `${emoji} **${labels[setting] ?? setting}** is now **${value ? 'enabled' : 'disabled'}** for you on this server.`
  );
}

// ==================== Helpers ====================

function formatBool(value?: boolean): string {
  if (value === undefined || value === null) {
    return 'Γ¼£ Not set';
  }
  return value ? 'Γ£à On' : 'Γ¥î Off';
}
