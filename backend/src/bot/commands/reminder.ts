import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
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

import { ReminderChannel, ReminderType } from '../../models/ActivityReminder';
import { ActivityReminderService, ActivityService } from '../../services/activity';
import { NotificationService } from '../../services/communication';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { buildCustomId, parseCustomId } from '../utils/customId';

import { BotCommand } from './types';

let _services: {
  notificationService: NotificationService;
  reminderService: ActivityReminderService;
} | null = null;

const REMINDER_PREFIX = 'reminder';

function buildReminderTypeSelectCustomId(eventId: string): string {
  return buildCustomId(REMINDER_PREFIX, 'type', 'select', eventId);
}

export function parseReminderTypeSelectEventId(customId: string): string | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== REMINDER_PREFIX || parsed.action !== 'type') {
    return null;
  }

  const [kind = '', eventId = ''] = parsed.params;
  if (kind !== 'select' || eventId.length === 0) {
    return null;
  }

  return eventId;
}

function getServices() {
  // Cannot use ??= here because ActivityReminderService requires notificationService as a constructor arg
  if (!_services) {
    const notificationService = new NotificationService();
    _services = {
      notificationService,
      reminderService: new ActivityReminderService(notificationService),
    };
  }
  return _services;
}

export const reminder: BotCommand = {
  data: new SlashCommandBuilder().setName('reminder').setDescription('Manage event reminders'),

  category: 'events',

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'reminder');
    if (!sub) {
      return;
    }

    if (sub === 'create' || sub === 'list') {
      // Try to populate event select from upcoming events
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guildOrgService = GuildOrganizationService.getInstance();
        const orgId = await guildOrgService.resolveOrganization(interaction.guildId || '');
        if (!orgId) {
          await interaction.editReply(
            'Γ¥î This server is not linked to an organization. Use `/guild setup` first.'
          );
          return;
        }
        const activityService = new ActivityService();
        const events = await activityService.getUpcomingActivities({
          organizationId: orgId,
          limit: 25,
        });

        if (events.length > 0) {
          const options = events.map(e => ({
            label: (e.title || 'Untitled Event').substring(0, 100),
            value: e.id,
            description: e.scheduledStartDate
              ? `Starts: ${new Date(e.scheduledStartDate).toLocaleDateString()}`
              : undefined,
          }));
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                sub === 'create' ? 'reminder_event_for_create' : 'reminder_event_for_list'
              )
              .setPlaceholder('Select an event...')
              .addOptions(options)
          );
          await interaction.editReply({
            content: `Select an event to ${sub === 'create' ? 'create a reminder for' : 'view reminders for'}:`,
            components: [row],
          });
          return;
        }
      } catch {
        // Fall through to modal
      }

      // Fallback: modal for manual ID entry
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: `No upcoming events found. Use \`/reminder ${sub} eventid:<id>\` with a specific event ID.`,
        });
      }
    } else if (sub === 'cancel') {
      // Modal for reminder ID (no good way to list all reminders without an event)
      const modal = new ModalBuilder()
        .setCustomId('reminder_cancel_modal')
        .setTitle('Cancel Reminder');

      const reminderIdInput = new TextInputBuilder()
        .setCustomId('reminderid')
        .setPlaceholder('Enter the reminder ID to cancel')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      modal.addLabelComponents(
        new LabelBuilder().setLabel('Reminder ID').setTextInputComponent(reminderIdInput)
      );
      await interaction.showModal(modal);
    }
  },

  handleSelectMenu: async (interaction: StringSelectMenuInteraction) => {
    const { customId } = interaction;

    if (customId === 'reminder_event_for_create') {
      const eventId = interaction.values[0];
      // Show reminder type select
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(buildReminderTypeSelectCustomId(eventId))
          .setPlaceholder('Select reminder timing...')
          .addOptions(
            { label: '1 Day Before', value: ReminderType.ONE_DAY_BEFORE },
            { label: '1 Hour Before', value: ReminderType.ONE_HOUR_BEFORE },
            { label: '30 Minutes Before', value: ReminderType.THIRTY_MINUTES_BEFORE }
          )
      );
      await interaction.reply({
        content: `**Step 2/3:** When should the reminder be sent?`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } else if (customId === 'reminder_event_for_list') {
      const eventId = interaction.values[0];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const { reminderService } = getServices();
        const reminders = await reminderService.getActivityReminders(eventId);

        if (reminders.length === 0) {
          await interaction.editReply(`\ud83d\udced No reminders found for this event.`);
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`\u23f0 Reminders for Event`)
          .setDescription(`Event ID: \`${eventId}\``)
          .setTimestamp();

        for (const r of reminders.slice(0, 10)) {
          embed.addFields({
            name: `${r.reminderType.replace(/_/g, ' ')}`,
            value: `ID: \`${r.id}\` | Channel: ${r.channel} | Status: ${r.deliveryStatus === 'sent' ? '\u2705 Sent' : '\u23f3 Pending'}`,
          });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply(`\u274c Failed to list reminders: ${getErrorMessage(error)}`);
      }
    } else if (customId.startsWith('reminder_channel_select_')) {
      const parts = customId.replace('reminder_channel_select_', '').split('_');
      const eventId = parts.slice(0, -1).join('_');
      const reminderType = parts[parts.length - 1] as ReminderType;
      const channel = interaction.values[0] as ReminderChannel;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const { reminderService } = getServices();
        await reminderService.createReminder({
          activityId: eventId,
          reminderType,
          channel,
        });
        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('\u2705 Reminder Created')
          .addFields(
            { name: 'Event', value: eventId, inline: true },
            { name: 'When', value: reminderType.replace(/_/g, ' '), inline: true },
            { name: 'Channel', value: channel, inline: true }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply(`\u274c Failed to create reminder: ${getErrorMessage(error)}`);
      }
    } else {
      const eventId = parseReminderTypeSelectEventId(customId);
      if (!eventId) {
        return;
      }
      const reminderType = interaction.values[0] as ReminderType;

      // Show channel select
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`reminder_channel_select_${eventId}_${reminderType}`)
          .setPlaceholder('Select delivery channel...')
          .addOptions(
            {
              label: 'Discord',
              value: ReminderChannel.DISCORD,
              description: 'Discord DM notification',
            },
            { label: 'Email', value: ReminderChannel.EMAIL, description: 'Email notification' },
            {
              label: 'Both',
              value: ReminderChannel.BOTH,
              description: 'Discord DM + Email',
              default: true,
            }
          )
      );
      await interaction.reply({
        content: '**Step 2/2:** Select how to receive the reminder:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    const { customId } = interaction;

    if (customId === 'reminder_create_modal') {
      const eventId = interaction.fields.getTextInputValue('eventid').trim();
      // Show reminder type select menu
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(buildReminderTypeSelectCustomId(eventId))
          .setPlaceholder('Select reminder timing...')
          .addOptions(
            { label: '1 Day Before', value: ReminderType.ONE_DAY_BEFORE },
            { label: '1 Hour Before', value: ReminderType.ONE_HOUR_BEFORE },
            { label: '30 Minutes Before', value: ReminderType.THIRTY_MINUTES_BEFORE }
          )
      );
      await interaction.reply({
        content: `**Step 1/2:** When should the reminder for event \`${eventId}\` be sent?`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } else if (customId === 'reminder_list_modal') {
      const eventId = interaction.fields.getTextInputValue('eventid').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const { reminderService } = getServices();
        const reminders = await reminderService.getActivityReminders(eventId);

        if (reminders.length === 0) {
          await interaction.editReply(`\ud83d\udced No reminders found for event \`${eventId}\`.`);
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`\u23f0 Reminders for Event`)
          .setDescription(`Event ID: \`${eventId}\``)
          .setTimestamp();

        for (const r of reminders.slice(0, 10)) {
          embed.addFields({
            name: `${r.reminderType.replace(/_/g, ' ')}`,
            value: `ID: \`${r.id}\` | Channel: ${r.channel} | Status: ${r.deliveryStatus === 'sent' ? '\u2705 Sent' : '\u23f3 Pending'}`,
          });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply(`\u274c Failed to list reminders: ${getErrorMessage(error)}`);
      }
    } else if (customId === 'reminder_cancel_modal') {
      const reminderId = interaction.fields.getTextInputValue('reminderid').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const { reminderService } = getServices();
        await reminderService.cancelReminder(reminderId);
        await interaction.editReply(`\u2705 Reminder \`${reminderId}\` has been cancelled.`);
      } catch (error: unknown) {
        await interaction.editReply(`\u274c Failed to cancel reminder: ${getErrorMessage(error)}`);
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
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
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};
