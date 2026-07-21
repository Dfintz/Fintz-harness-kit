import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChatInputCommandInteraction,
  CommandInteractionOption,
  EmbedBuilder,
  MessageFlags,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import { AttendanceStatus } from '../../models/EventAttendanceConfirmation';
import {
  ActivityService,
  ActivityAttendanceService as AttendanceConfirmationService,
} from '../../services/activity';
import { formatAttendanceMilestoneReached } from '../../services/activity/attendanceMilestones';
import { NotificationService } from '../../services/communication';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { UserService } from '../../services/user/UserService';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { resolveGuildContext } from '../utils/guildContext';
import { emitRealtimeToOrg } from '../utils/realtimeEmit';

import { BotCommand } from './types';

function getMedalForRank(index: number): string {
  if (index === 0) {
    return '🥇';
  }
  if (index === 1) {
    return '🥈';
  }
  if (index === 2) {
    return '🥉';
  }
  return `${index + 1}.`;
}

// Lazy-initialise services to avoid import-time database metadata access
let notificationService: NotificationService;
let attendanceService: AttendanceConfirmationService;

function getAttendanceService(): AttendanceConfirmationService {
  if (!attendanceService) {
    notificationService = new NotificationService();
    attendanceService = new AttendanceConfirmationService(notificationService);
  }
  return attendanceService;
}

let _userService: UserService | null = null;
function getUserService(): UserService {
  _userService ??= new UserService();
  return _userService;
}

/**
 * Resolve a Discord snowflake to the internal platform user UUID.
 * Returns null if the user hasn't linked their account.
 */
async function resolveInternalUserId(discordId: string): Promise<string | null> {
  try {
    const user = await getUserService().getUserByDiscordId(discordId);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a celebratory milestone line for a just-confirmed attendance, or `null`
 * when the user's lifetime attended count is not exactly a milestone. Best-effort:
 * never throws, so a milestone-count failure cannot break the confirmation reply.
 */
async function buildAttendanceMilestoneLine(
  organizationId: string,
  internalUserId: string
): Promise<string | null> {
  try {
    const attended = await getAttendanceService().getAttendedEventCount(
      organizationId,
      internalUserId
    );
    return formatAttendanceMilestoneReached(attended);
  } catch {
    return null;
  }
}

const data = new SlashCommandBuilder()
  .setName('attend')
  .setDescription('Manage attendance confirmation for events');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const panelConfig: CommandPanelConfig = {
    prefix: 'attend',
    title: '\ud83d\udccb Attendance Manager',
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
  };
  await replyWithCommandPanel(interaction, panelConfig);
}

async function _handleNoShow(interaction: ChatInputCommandInteraction): Promise<void> {
  // Extract options using data array (Discord.js v14)
  const activityIdOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'activity_id'
  );
  const userOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'user'
  );
  const excusedOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'excused'
  );
  const reasonOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'reason'
  );

  const activityId = activityIdOpt?.value as string;
  const targetUserValue = userOpt?.user || userOpt?.value; // Get User object or ID
  const excused = (excusedOpt?.value as boolean) || false;
  const reason = (reasonOpt?.value as string) || undefined;

  if (!targetUserValue || !activityId) {
    await interaction.reply({
      content: '\u274c Missing required parameters',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Extract user ID - targetUserValue could be a User object or a string ID
  const userId =
    typeof targetUserValue === 'object' && targetUserValue && 'id' in targetUserValue
      ? targetUserValue.id
      : String(targetUserValue);

  // Use markNoShow instead of recordNoShow
  const _confirmation = await getAttendanceService().markNoShow(
    activityId,
    userId,
    excused,
    reason,
    interaction.user.id
  );

  const username =
    typeof targetUserValue === 'object' && targetUserValue && 'username' in targetUserValue
      ? targetUserValue.username
      : `User ${userId}`;

  const embed = new EmbedBuilder()
    .setColor(excused ? '#FFA500' : '#FF0000')
    .setTitle(excused ? '⚠️ Excused Absence' : '❌ No-Show Recorded')
    .setDescription(`Marked ${username} as ${excused ? 'excused absence' : 'no-show'}`)
    .addFields(
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Excused', value: excused ? 'Yes' : 'No', inline: true }
    )
    .setTimestamp();

  if (reason) {
    embed.addFields({ name: 'Reason', value: reason });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function _handleConfirm(interaction: ChatInputCommandInteraction): Promise<void> {
  // Extract options using data array (Discord.js v14)
  const activityIdOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'activity_id'
  );
  const roleOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'role'
  );

  const activityId = activityIdOpt?.value as string;
  const role = (roleOpt?.value as string) || undefined;
  const userId = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const confirmation = await getAttendanceService().confirmAttendance(
    activityId,
    userId,
    role,
    userId
  );

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Attendance Confirmed')
    .setDescription(`Your attendance has been confirmed!`)
    .addFields(
      { name: 'Status', value: confirmation.status, inline: true },
      {
        name: 'Role',
        value: confirmation.actualRole || confirmation.rsvpRole || 'N/A',
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function _handleLate(interaction: ChatInputCommandInteraction): Promise<void> {
  // Extract options using data array (Discord.js v14)
  const activityIdOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'activity_id'
  );
  const userOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'user'
  );
  const minutesOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'minutes'
  );
  const reasonOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'reason'
  );

  const activityId = activityIdOpt?.value as string;
  const targetUserValue = userOpt?.user || userOpt?.value;
  const minutes = (minutesOpt?.value as number) || 0;
  const reason = (reasonOpt?.value as string) || undefined;

  if (!targetUserValue || !activityId) {
    await interaction.reply({
      content: '\u274c Missing required parameters',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Extract user ID - targetUserValue could be a User object or a string ID
  const userId =
    typeof targetUserValue === 'object' && targetUserValue && 'id' in targetUserValue
      ? targetUserValue.id
      : String(targetUserValue);

  // Mark as late with reason
  const _confirmation = await getAttendanceService().confirmAttendance(
    activityId,
    userId,
    undefined,
    interaction.user.id
  );

  const username =
    typeof targetUserValue === 'object' && targetUserValue && 'username' in targetUserValue
      ? targetUserValue.username
      : `User ${userId}`;

  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('⏰ Late Arrival Recorded')
    .setDescription(`Marked ${username} as ${minutes} minutes late`)
    .addFields(
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Minutes Late', value: minutes.toString(), inline: true }
    )
    .setTimestamp();

  if (reason) {
    embed.addFields({ name: 'Reason', value: reason });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function _handleStats(interaction: ChatInputCommandInteraction): Promise<void> {
  // Extract options using data array (Discord.js v14)
  const activityIdOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'activity_id'
  );
  const activityId = activityIdOpt?.value as string;

  await interaction.deferReply();

  const stats = await getAttendanceService().getActivityAttendanceStats(activityId);

  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('📊 Attendance Statistics')
    .addFields(
      { name: 'Total Participants', value: stats.total.toString(), inline: true },
      { name: 'Attended', value: stats.attended.toString(), inline: true },
      { name: 'No-Shows', value: stats.noShow.toString(), inline: true },
      { name: 'Late', value: stats.late.toString(), inline: true },
      { name: 'Early Departure', value: stats.earlyDeparture.toString(), inline: true },
      { name: 'Pending', value: stats.pending.toString(), inline: true },
      { name: 'Attendance Rate', value: `${stats.attendanceRate}%`, inline: false }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function _handleHistory(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  // Extract options — only available from slash command, buttons default to 6 months
  const months = interaction.isChatInputCommand()
    ? (interaction.options.data?.find(
        (opt: CommandInteractionOption<CacheType>) => opt.name === 'months'
      )?.value as number) || 6
    : 6;
  const userId = interaction.user.id;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const internalUserId = await resolveInternalUserId(userId);
  const lookupId = internalUserId || userId;

  const history = await getAttendanceService().getUserAttendanceHistory(lookupId, months);

  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('📜 Your Attendance History')
    .setDescription(`Last ${months} months`)
    .addFields(
      { name: 'Total Events', value: history.totalEvents.toString(), inline: true },
      { name: 'Attended', value: history.attended.toString(), inline: true },
      { name: 'No-Shows', value: history.noShows.toString(), inline: true },
      { name: 'Late', value: history.late.toString(), inline: true },
      { name: 'Excused Absences', value: history.excusedAbsences.toString(), inline: true },
      { name: 'Reliability Score', value: `${history.reliabilityScore}%`, inline: true }
    )
    .setTimestamp();

  if (history.averageRating) {
    embed.addFields({
      name: 'Average Rating',
      value: `${history.averageRating.toFixed(1)}/5.0`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function _handleLeaderboard(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  // Extract options — only available from slash command, buttons use defaults
  let explicitOrgId: string | undefined;
  let months = 3;
  let limit = 10;
  if (interaction.isChatInputCommand()) {
    const orgIdOpt = interaction.options.data?.find(
      (opt: CommandInteractionOption<CacheType>) => opt.name === 'organization_id'
    );
    explicitOrgId = orgIdOpt?.value as string | undefined;
    months = (interaction.options.get('months')?.value as number) || 3;
    limit = (interaction.options.get('limit')?.value as number) || 10;
  }
  const context = await resolveGuildContext(interaction, explicitOrgId ?? null);
  if (!context) {
    return;
  }
  const organizationId = context.organizationId;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const leaderboard = await getAttendanceService().getAttendanceLeaderboard(
    organizationId,
    months,
    limit
  );

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 Attendance Leaderboard')
    .setDescription(`Top ${limit} members (Last ${months} months)`);

  if (leaderboard.length === 0) {
    embed.addFields({ name: 'No Data', value: 'No attendance records found' });
  } else {
    const leaderboardText = leaderboard
      .map((user, index) => {
        const medal = getMedalForRank(index);
        return `${medal} <@${user.userId}> - ${user.reliabilityScore}% (${user.attended}/${user.totalEvents})`;
      })
      .join('\n');

    embed.addFields({ name: 'Rankings', value: leaderboardText });
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function _handleReport(interaction: ChatInputCommandInteraction): Promise<void> {
  // Extract options using data array (Discord.js v14)
  const activityIdOpt = interaction.options.data.find(
    (opt: CommandInteractionOption<CacheType>) => opt.name === 'activity_id'
  );
  const activityId = activityIdOpt?.value as string;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const report = await getAttendanceService().generateAttendanceReport(activityId);

  const embed = new EmbedBuilder()
    .setColor('#0099FF')
    .setTitle('📋 Attendance Report')
    .setDescription(`**${report.activity.title}**`)
    .addFields(
      { name: 'Total Participants', value: report.stats.total.toString(), inline: true },
      { name: 'Attendance Rate', value: `${report.stats.attendanceRate}%`, inline: true },
      { name: 'No-Shows', value: report.stats.noShow.toString(), inline: true }
    );

  // Add breakdown
  const statusBreakdown = report.attendees.reduce(
    (acc, attendee) => {
      acc[attendee.status] = (acc[attendee.status] || 0) + 1;
      return acc;
    },
    {} as Record<AttendanceStatus, number>
  );

  const breakdownText = Object.entries(statusBreakdown)
    .map(([status, count]) => `${status}: ${count}`)
    .join('\n');

  embed.addFields({ name: 'Status Breakdown', value: breakdownText || 'N/A' });

  // Add attendee list (limited to first 10)
  if (report.attendees.length > 0) {
    const attendeeList = report.attendees
      .slice(0, 10)
      .map(a => `<@${a.userId}>: ${a.status} (${a.attendanceScore}%)`)
      .join('\n');

    embed.addFields({
      name: `Attendees (${Math.min(10, report.attendees.length)}/${report.attendees.length})`,
      value: attendeeList,
    });

    if (report.attendees.length > 10) {
      embed.setFooter({ text: `... and ${report.attendees.length - 10} more` });
    }
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export const attendanceCommand: BotCommand = {
  data,
  execute,
  cooldown: 5,
  category: 'events',

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'attend');
    if (!sub) {
      return;
    }

    if (sub === 'history') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await _handleHistory(interaction);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An error occurred';
        await interaction.editReply({ content: `\u274c ${msg}` });
      }
    } else if (sub === 'leaderboard') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await _handleLeaderboard(interaction);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An error occurred';
        await interaction.editReply({ content: `\u274c ${msg}` });
      }
    } else if (sub === 'confirm' || sub === 'stats' || sub === 'report') {
      // Try to populate event select from recent/upcoming events
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guildOrgService = GuildOrganizationService.getInstance();
        const orgId = await guildOrgService.resolveOrganization(interaction.guildId || '');
        if (!orgId) {
          await interaction.editReply(
            '❌ This server is not linked to an organization. Use `/guild setup` first.'
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
          const labels: Record<string, string> = {
            confirm: 'Select an event to confirm attendance:',
            stats: 'Select an event to view stats:',
            report: 'Select an event to generate a report:',
          };
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`attend_${sub}_select`)
              .setPlaceholder('Select an event...')
              .addOptions(options)
          );
          await interaction.editReply({
            content: labels[sub] || 'Select an event:',
            components: [row],
          });
          return;
        }
        await interaction.editReply(
          'No upcoming events found. Use the slash command with a specific event ID.'
        );
      } catch {
        // Fallback
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(
            `Could not load events. Use \`/attend ${sub} activity_id:<id>\` instead.`
          );
        }
      }
    }
  },

  handleSelectMenu: async (interaction: StringSelectMenuInteraction) => {
    const { customId } = interaction;
    const activityId = interaction.values[0];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const service = getAttendanceService();

      if (customId === 'attend_confirm_select') {
        const orgId = await GuildOrganizationService.getInstance().resolveOrganization(
          interaction.guildId || ''
        );
        if (!orgId) {
          await interaction.editReply(
            '❌ This server is not linked to an organization. Use `/guild setup` first.'
          );
          return;
        }
        const activity = await new ActivityService().getActivityById(activityId);
        if (activity?.organizationId !== orgId) {
          await interaction.editReply('❌ Event not found in this server.');
          return;
        }
        const internalUserId = await resolveInternalUserId(interaction.user.id);
        if (!internalUserId) {
          await interaction.editReply(
            '\u274c Your Discord account is not linked. Please link your account on the web app first.'
          );
          return;
        }
        await service.confirmAttendance(activityId, internalUserId);
        emitRealtimeToOrg(orgId, 'activity:attendance_confirmed', {
          activityId,
          userId: internalUserId,
          discordUserId: interaction.user.id,
        });
        const milestoneLine = await buildAttendanceMilestoneLine(orgId, internalUserId);
        const confirmMessage = '\u2705 Your attendance has been confirmed.';
        await interaction.editReply(
          milestoneLine ? `${confirmMessage}\n\n${milestoneLine}` : confirmMessage
        );
      } else if (customId === 'attend_stats_select') {
        await handleStats_fromModal(interaction as unknown as ModalSubmitInteraction, activityId);
      } else if (customId === 'attend_report_select') {
        await handleReport_fromModal(interaction as unknown as ModalSubmitInteraction, activityId);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      await interaction.editReply({ content: `\u274c ${msg}` });
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    const { customId } = interaction;
    const activityId = interaction.fields.getTextInputValue('activity_id').trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const service = getAttendanceService();

      if (customId === 'attend_confirm_modal') {
        const orgId = await GuildOrganizationService.getInstance().resolveOrganization(
          interaction.guildId || ''
        );
        if (!orgId) {
          await interaction.editReply(
            '❌ This server is not linked to an organization. Use `/guild setup` first.'
          );
          return;
        }
        const activity = await new ActivityService().getActivityById(activityId);
        if (activity?.organizationId !== orgId) {
          await interaction.editReply('❌ Event not found in this server.');
          return;
        }
        const internalUserId = await resolveInternalUserId(interaction.user.id);
        if (!internalUserId) {
          await interaction.editReply(
            '\u274c Your Discord account is not linked. Please link your account on the web app first.'
          );
          return;
        }
        await service.confirmAttendance(activityId, internalUserId);
        emitRealtimeToOrg(orgId, 'activity:attendance_confirmed', {
          activityId,
          userId: internalUserId,
          discordUserId: interaction.user.id,
        });
        const milestoneLine = await buildAttendanceMilestoneLine(orgId, internalUserId);
        const confirmMessage = `\u2705 Your attendance for event \`${activityId}\` has been confirmed.`;
        await interaction.editReply(
          milestoneLine ? `${confirmMessage}\n\n${milestoneLine}` : confirmMessage
        );
      } else if (customId === 'attend_stats_modal') {
        await handleStats_fromModal(interaction, activityId);
      } else if (customId === 'attend_report_modal') {
        await handleReport_fromModal(interaction, activityId);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      await interaction.editReply({ content: `\u274c ${msg}` });
    }
  },
};

async function handleStats_fromModal(
  interaction: ModalSubmitInteraction,
  activityId: string
): Promise<void> {
  const service = getAttendanceService();
  const stats = await service.getActivityAttendanceStats(activityId);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`\ud83d\udcca Attendance Stats`)
    .setDescription(`Event ID: \`${activityId}\``)
    .addFields(
      { name: '\u2705 Attended', value: `${stats.attended || 0}`, inline: true },
      { name: '\u274c No-Show', value: `${stats.noShow || 0}`, inline: true },
      { name: '\ud83d\udcca Total', value: `${stats.total || 0}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleReport_fromModal(
  interaction: ModalSubmitInteraction,
  activityId: string
): Promise<void> {
  const service = getAttendanceService();
  const report = await service.generateAttendanceReport(activityId);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`\ud83d\udccb Attendance Report`)
    .setDescription(`Event ID: \`${activityId}\``)
    .setTimestamp();

  if (report.attendees && report.attendees.length > 0) {
    const attended = report.attendees
      .filter((a: { status: string }) => a.status === 'attended')
      .slice(0, 10)
      .map((c: { userName?: string; userId?: string }) => c.userName || c.userId || 'Unknown')
      .join(', ');
    if (attended) {
      embed.addFields({ name: `\u2705 Attended`, value: attended });
    }

    const noShows = report.attendees
      .filter((a: { status: string }) => a.status === 'no_show')
      .slice(0, 10)
      .map((n: { userName?: string; userId?: string }) => n.userName || n.userId || 'Unknown')
      .join(', ');
    if (noShows) {
      embed.addFields({ name: `\u274c No-Shows`, value: noShows });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
