/**
 * /schedule — Discord Schedule & Availability Command
 *
 * Subcommands:
 *   /schedule set        — Link to the web UI for setting availability
 *   /schedule best       — Show top 5 scheduling windows
 *   /schedule view       — Show org availability heatmap summary
 *   /schedule conflicts  — Check for conflicts in a date range
 *   /schedule my         — Show your upcoming event conflicts
 *
 * Wave 2.4 — Group Scheduling & Availability
 *
 * @module bot/commands/schedule
 */

import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
} from 'discord.js';

import { AvailabilityService } from '../../services/calendar/AvailabilityService';
import { EventConflictService } from '../../services/event/EventConflictService';
import {
  buildAvailabilityHeatmapEmbed,
  buildBestTimesEmbed,
  buildConflictsListEmbed,
  buildMyConflictsEmbed,
  buildNoAvailabilityEmbed,
  buildNoConflictsEmbed,
  buildNoTimeWindowsEmbed,
  buildSetAvailabilityEmbed,
} from '../embeds/scheduleEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { resolveOrgIdForGuild } from '../utils/guildContext';

import { BotCommand } from './types';

let _conflictService: EventConflictService | null = null;

function getConflictService() {
  _conflictService ??= new EventConflictService();
  return _conflictService;
}

export const schedule: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Group scheduling and availability tools'),

  category: 'events',
  cooldown: 5,
  examples: [
    '/schedule set',
    '/schedule best duration:120 min_attendees:5',
    '/schedule view',
    '/schedule conflicts start:2026-04-10 end:2026-04-15',
    '/schedule my',
  ],

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'schedule');
    if (!sub) {
      return;
    }

    if (sub === 'set' || sub === 'view' || sub === 'my') {
      try {
        const handler = sub === 'set' ? handleSet : sub === 'view' ? handleView : handleMyConflicts;
        await handler(interaction);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: `\u274c Error: ${msg}` });
        } else {
          await interaction.reply({
            content: `\u274c Error: ${msg}`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } else if (sub === 'best') {
      const modal = new ModalBuilder()
        .setCustomId('schedule_best_modal')
        .setTitle('Find Best Time');

      const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setPlaceholder('e.g. 120 for 2 hours')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      const minAttendeesInput = new TextInputBuilder()
        .setCustomId('min_attendees')
        .setPlaceholder('e.g. 5')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel('Event duration in minutes (30-480)')
          .setTextInputComponent(durationInput),
        new LabelBuilder()
          .setLabel('Minimum attendees required (1-500)')
          .setTextInputComponent(minAttendeesInput)
      );
      await interaction.showModal(modal);
    } else if (sub === 'conflicts') {
      const modal = new ModalBuilder()
        .setCustomId('schedule_conflicts_modal')
        .setTitle('Check Conflicts');

      const startInput = new TextInputBuilder()
        .setCustomId('start')
        .setPlaceholder('e.g. 2026-04-20')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(16);

      const endInput = new TextInputBuilder()
        .setCustomId('end')
        .setPlaceholder('e.g. 2026-04-25')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(16);

      modal.addLabelComponents(
        new LabelBuilder().setLabel('Start date (YYYY-MM-DD)').setTextInputComponent(startInput),
        new LabelBuilder().setLabel('End date (YYYY-MM-DD)').setTextInputComponent(endInput)
      );
      await interaction.showModal(modal);
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    const { customId } = interaction;

    if (customId === 'schedule_best_modal') {
      const durationStr = interaction.fields.getTextInputValue('duration').trim();
      const minAttendeesStr = interaction.fields.getTextInputValue('min_attendees').trim();

      const duration = parseInt(durationStr, 10);
      const minAttendees = parseInt(minAttendeesStr, 10);

      if (isNaN(duration) || duration < 30 || duration > 480) {
        await interaction.reply({
          content: '\u274c Duration must be 30-480 minutes.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (isNaN(minAttendees) || minAttendees < 1 || minAttendees > 500) {
        await interaction.reply({
          content: '\u274c Min attendees must be 1-500.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply('This command must be used in a server.');
        return;
      }

      try {
        const orgId = await resolveOrgIdForGuild(guildId);
        if (!orgId) {
          await interaction.editReply(
            '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.'
          );
          return;
        }
        const service = new AvailabilityService();
        const windows = await service.findBestTimes(orgId, duration, minAttendees);

        if (windows.length === 0) {
          await interaction.editReply({
            embeds: [buildNoTimeWindowsEmbed(duration, minAttendees)],
          });
          return;
        }

        await interaction.editReply({
          embeds: [buildBestTimesEmbed(windows, duration, minAttendees)],
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        await interaction.editReply(`\u274c Error: ${msg}`);
      }
    } else if (customId === 'schedule_conflicts_modal') {
      const startStr = interaction.fields.getTextInputValue('start').trim();
      const endStr = interaction.fields.getTextInputValue('end').trim();

      const startDate = new Date(startStr);
      const endDate = new Date(endStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        await interaction.reply({
          content: '\u274c Invalid date format. Use YYYY-MM-DD.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (endDate <= startDate) {
        await interaction.reply({
          content: '\u274c End date must be after start date.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply('This command must be used in a server.');
        return;
      }

      try {
        const orgId = await resolveOrgIdForGuild(guildId);
        if (!orgId) {
          await interaction.editReply(
            '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.'
          );
          return;
        }
        const conflictService = getConflictService();
        const result = await conflictService.checkConflicts(orgId, startDate, endDate);

        if (!result.hasConflicts || result.conflicts.length === 0) {
          await interaction.editReply({
            embeds: [buildNoConflictsEmbed(startStr, endStr)],
          });
          return;
        }

        await interaction.editReply({
          embeds: [
            buildConflictsListEmbed(result.conflicts, result.totalConflicts, startStr, endStr),
          ],
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        await interaction.editReply(`\u274c Error: ${msg}`);
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const panelConfig: CommandPanelConfig = {
      prefix: 'schedule',
      title: '\ud83d\udcc5 Schedule & Availability',
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
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};

/** /schedule set — direct users to the web UI */
async function handleSet(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  await interaction.reply({
    embeds: [buildSetAvailabilityEmbed()],
    flags: MessageFlags.Ephemeral,
  });
}

/** /schedule view — show heatmap summary */
async function handleView(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply('This command must be used in a server.');
    return;
  }

  const orgId = await resolveOrgIdForGuild(guildId);
  if (!orgId) {
    await interaction.editReply(
      '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.'
    );
    return;
  }

  const service = new AvailabilityService();
  const heatmap = await service.getGroupAvailability(orgId);

  if (heatmap.totalMembers === 0) {
    await interaction.editReply({ embeds: [buildNoAvailabilityEmbed()] });
    return;
  }

  await interaction.editReply({ embeds: [buildAvailabilityHeatmapEmbed(heatmap)] });
}

// ========================================================================
// Conflict subcommands (merged from conflicts.ts)
// ========================================================================

/** /schedule my — show your upcoming event conflicts */
async function handleMyConflicts(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({
      content: '❌ This command can only be used in an organization Discord server.',
    });
    return;
  }

  const organizationId = await resolveOrgIdForGuild(guildId);
  if (!organizationId) {
    await interaction.editReply({
      content:
        '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.',
    });
    return;
  }

  const userId = interaction.user.id;
  const result = await getConflictService().getUserConflicts(organizationId, userId);

  await interaction.editReply({
    embeds: [buildMyConflictsEmbed(result.conflicts, result.totalConflicts)],
  });
}
