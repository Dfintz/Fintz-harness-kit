"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceCommand = void 0;
const discord_js_1 = require("discord.js");
const activity_1 = require("../../services/activity");
const attendanceMilestones_1 = require("../../services/activity/attendanceMilestones");
const communication_1 = require("../../services/communication");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const UserService_1 = require("../../services/user/UserService");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const guildContext_1 = require("../utils/guildContext");
const realtimeEmit_1 = require("../utils/realtimeEmit");
function getMedalForRank(index) {
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
let notificationService;
let attendanceService;
function getAttendanceService() {
    if (!attendanceService) {
        notificationService = new communication_1.NotificationService();
        attendanceService = new activity_1.ActivityAttendanceService(notificationService);
    }
    return attendanceService;
}
let _userService = null;
function getUserService() {
    _userService ??= new UserService_1.UserService();
    return _userService;
}
async function resolveInternalUserId(discordId) {
    try {
        const user = await getUserService().getUserByDiscordId(discordId);
        return user?.id ?? null;
    }
    catch {
        return null;
    }
}
async function buildAttendanceMilestoneLine(organizationId, internalUserId) {
    try {
        const attended = await getAttendanceService().getAttendedEventCount(organizationId, internalUserId);
        return (0, attendanceMilestones_1.formatAttendanceMilestoneReached)(attended);
    }
    catch {
        return null;
    }
}
const data = new discord_js_1.SlashCommandBuilder()
    .setName('attend')
    .setDescription('Manage attendance confirmation for events');
async function execute(interaction) {
    const panelConfig = {
        prefix: 'attend',
        title: '\ud83d\udccb Attendance Manager',
        description: 'Manage event attendance and view your history.',
        buttons: [
            {
                subcommand: 'history',
                label: 'My History',
                emoji: '\ud83d\udcc5',
                style: discord_js_1.ButtonStyle.Primary,
            },
            { subcommand: 'leaderboard', label: 'Leaderboard', emoji: '\ud83c\udfc6' },
            {
                subcommand: 'confirm',
                label: 'Confirm Attendance',
                emoji: '\u2705',
                style: discord_js_1.ButtonStyle.Success,
            },
            { subcommand: 'stats', label: 'Event Stats', emoji: '\ud83d\udcca' },
            { subcommand: 'report', label: 'Event Report', emoji: '\ud83d\udccb' },
        ],
    };
    await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
}
async function _handleNoShow(interaction) {
    const activityIdOpt = interaction.options.data.find((opt) => opt.name === 'activity_id');
    const userOpt = interaction.options.data.find((opt) => opt.name === 'user');
    const excusedOpt = interaction.options.data.find((opt) => opt.name === 'excused');
    const reasonOpt = interaction.options.data.find((opt) => opt.name === 'reason');
    const activityId = activityIdOpt?.value;
    const targetUserValue = userOpt?.user || userOpt?.value;
    const excused = excusedOpt?.value || false;
    const reason = reasonOpt?.value || undefined;
    if (!targetUserValue || !activityId) {
        await interaction.reply({
            content: '\u274c Missing required parameters',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const userId = typeof targetUserValue === 'object' && targetUserValue && 'id' in targetUserValue
        ? targetUserValue.id
        : String(targetUserValue);
    const _confirmation = await getAttendanceService().markNoShow(activityId, userId, excused, reason, interaction.user.id);
    const username = typeof targetUserValue === 'object' && targetUserValue && 'username' in targetUserValue
        ? targetUserValue.username
        : `User ${userId}`;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(excused ? '#FFA500' : '#FF0000')
        .setTitle(excused ? '⚠️ Excused Absence' : '❌ No-Show Recorded')
        .setDescription(`Marked ${username} as ${excused ? 'excused absence' : 'no-show'}`)
        .addFields({ name: 'User', value: `<@${userId}>`, inline: true }, { name: 'Excused', value: excused ? 'Yes' : 'No', inline: true })
        .setTimestamp();
    if (reason) {
        embed.addFields({ name: 'Reason', value: reason });
    }
    await interaction.editReply({ embeds: [embed] });
}
async function _handleConfirm(interaction) {
    const activityIdOpt = interaction.options.data.find((opt) => opt.name === 'activity_id');
    const roleOpt = interaction.options.data.find((opt) => opt.name === 'role');
    const activityId = activityIdOpt?.value;
    const role = roleOpt?.value || undefined;
    const userId = interaction.user.id;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const confirmation = await getAttendanceService().confirmAttendance(activityId, userId, role, userId);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Attendance Confirmed')
        .setDescription(`Your attendance has been confirmed!`)
        .addFields({ name: 'Status', value: confirmation.status, inline: true }, {
        name: 'Role',
        value: confirmation.actualRole || confirmation.rsvpRole || 'N/A',
        inline: true,
    })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
async function _handleLate(interaction) {
    const activityIdOpt = interaction.options.data.find((opt) => opt.name === 'activity_id');
    const userOpt = interaction.options.data.find((opt) => opt.name === 'user');
    const minutesOpt = interaction.options.data.find((opt) => opt.name === 'minutes');
    const reasonOpt = interaction.options.data.find((opt) => opt.name === 'reason');
    const activityId = activityIdOpt?.value;
    const targetUserValue = userOpt?.user || userOpt?.value;
    const minutes = minutesOpt?.value || 0;
    const reason = reasonOpt?.value || undefined;
    if (!targetUserValue || !activityId) {
        await interaction.reply({
            content: '\u274c Missing required parameters',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const userId = typeof targetUserValue === 'object' && targetUserValue && 'id' in targetUserValue
        ? targetUserValue.id
        : String(targetUserValue);
    const _confirmation = await getAttendanceService().confirmAttendance(activityId, userId, undefined, interaction.user.id);
    const username = typeof targetUserValue === 'object' && targetUserValue && 'username' in targetUserValue
        ? targetUserValue.username
        : `User ${userId}`;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏰ Late Arrival Recorded')
        .setDescription(`Marked ${username} as ${minutes} minutes late`)
        .addFields({ name: 'User', value: `<@${userId}>`, inline: true }, { name: 'Minutes Late', value: minutes.toString(), inline: true })
        .setTimestamp();
    if (reason) {
        embed.addFields({ name: 'Reason', value: reason });
    }
    await interaction.editReply({ embeds: [embed] });
}
async function _handleStats(interaction) {
    const activityIdOpt = interaction.options.data.find((opt) => opt.name === 'activity_id');
    const activityId = activityIdOpt?.value;
    await interaction.deferReply();
    const stats = await getAttendanceService().getActivityAttendanceStats(activityId);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📊 Attendance Statistics')
        .addFields({ name: 'Total Participants', value: stats.total.toString(), inline: true }, { name: 'Attended', value: stats.attended.toString(), inline: true }, { name: 'No-Shows', value: stats.noShow.toString(), inline: true }, { name: 'Late', value: stats.late.toString(), inline: true }, { name: 'Early Departure', value: stats.earlyDeparture.toString(), inline: true }, { name: 'Pending', value: stats.pending.toString(), inline: true }, { name: 'Attendance Rate', value: `${stats.attendanceRate}%`, inline: false })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
async function _handleHistory(interaction) {
    const months = interaction.isChatInputCommand()
        ? interaction.options.data?.find((opt) => opt.name === 'months')?.value || 6
        : 6;
    const userId = interaction.user.id;
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    }
    const internalUserId = await resolveInternalUserId(userId);
    const lookupId = internalUserId || userId;
    const history = await getAttendanceService().getUserAttendanceHistory(lookupId, months);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📜 Your Attendance History')
        .setDescription(`Last ${months} months`)
        .addFields({ name: 'Total Events', value: history.totalEvents.toString(), inline: true }, { name: 'Attended', value: history.attended.toString(), inline: true }, { name: 'No-Shows', value: history.noShows.toString(), inline: true }, { name: 'Late', value: history.late.toString(), inline: true }, { name: 'Excused Absences', value: history.excusedAbsences.toString(), inline: true }, { name: 'Reliability Score', value: `${history.reliabilityScore}%`, inline: true })
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
async function _handleLeaderboard(interaction) {
    let explicitOrgId;
    let months = 3;
    let limit = 10;
    if (interaction.isChatInputCommand()) {
        const orgIdOpt = interaction.options.data?.find((opt) => opt.name === 'organization_id');
        explicitOrgId = orgIdOpt?.value;
        months = interaction.options.get('months')?.value || 3;
        limit = interaction.options.get('limit')?.value || 10;
    }
    const context = await (0, guildContext_1.resolveGuildContext)(interaction, explicitOrgId ?? null);
    if (!context) {
        return;
    }
    const organizationId = context.organizationId;
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    }
    const leaderboard = await getAttendanceService().getAttendanceLeaderboard(organizationId, months, limit);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Attendance Leaderboard')
        .setDescription(`Top ${limit} members (Last ${months} months)`);
    if (leaderboard.length === 0) {
        embed.addFields({ name: 'No Data', value: 'No attendance records found' });
    }
    else {
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
async function _handleReport(interaction) {
    const activityIdOpt = interaction.options.data.find((opt) => opt.name === 'activity_id');
    const activityId = activityIdOpt?.value;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const report = await getAttendanceService().generateAttendanceReport(activityId);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Attendance Report')
        .setDescription(`**${report.activity.title}**`)
        .addFields({ name: 'Total Participants', value: report.stats.total.toString(), inline: true }, { name: 'Attendance Rate', value: `${report.stats.attendanceRate}%`, inline: true }, { name: 'No-Shows', value: report.stats.noShow.toString(), inline: true });
    const statusBreakdown = report.attendees.reduce((acc, attendee) => {
        acc[attendee.status] = (acc[attendee.status] || 0) + 1;
        return acc;
    }, {});
    const breakdownText = Object.entries(statusBreakdown)
        .map(([status, count]) => `${status}: ${count}`)
        .join('\n');
    embed.addFields({ name: 'Status Breakdown', value: breakdownText || 'N/A' });
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
exports.attendanceCommand = {
    data,
    execute,
    cooldown: 5,
    category: 'events',
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'attend');
        if (!sub) {
            return;
        }
        if (sub === 'history') {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                await _handleHistory(interaction);
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'An error occurred';
                await interaction.editReply({ content: `\u274c ${msg}` });
            }
        }
        else if (sub === 'leaderboard') {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                await _handleLeaderboard(interaction);
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'An error occurred';
                await interaction.editReply({ content: `\u274c ${msg}` });
            }
        }
        else if (sub === 'confirm' || sub === 'stats' || sub === 'report') {
            try {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
                const orgId = await guildOrgService.resolveOrganization(interaction.guildId || '');
                if (!orgId) {
                    await interaction.editReply('❌ This server is not linked to an organization. Use `/guild setup` first.');
                    return;
                }
                const activityService = new activity_1.ActivityService();
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
                    const labels = {
                        confirm: 'Select an event to confirm attendance:',
                        stats: 'Select an event to view stats:',
                        report: 'Select an event to generate a report:',
                    };
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId(`attend_${sub}_select`)
                        .setPlaceholder('Select an event...')
                        .addOptions(options));
                    await interaction.editReply({
                        content: labels[sub] || 'Select an event:',
                        components: [row],
                    });
                    return;
                }
                await interaction.editReply('No upcoming events found. Use the slash command with a specific event ID.');
            }
            catch {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply(`Could not load events. Use \`/attend ${sub} activity_id:<id>\` instead.`);
                }
            }
        }
    },
    handleSelectMenu: async (interaction) => {
        const { customId } = interaction;
        const activityId = interaction.values[0];
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const service = getAttendanceService();
            if (customId === 'attend_confirm_select') {
                const orgId = await GuildOrganizationService_1.GuildOrganizationService.getInstance().resolveOrganization(interaction.guildId || '');
                if (!orgId) {
                    await interaction.editReply('❌ This server is not linked to an organization. Use `/guild setup` first.');
                    return;
                }
                const activity = await new activity_1.ActivityService().getActivityById(activityId);
                if (activity?.organizationId !== orgId) {
                    await interaction.editReply('❌ Event not found in this server.');
                    return;
                }
                const internalUserId = await resolveInternalUserId(interaction.user.id);
                if (!internalUserId) {
                    await interaction.editReply('\u274c Your Discord account is not linked. Please link your account on the web app first.');
                    return;
                }
                await service.confirmAttendance(activityId, internalUserId);
                (0, realtimeEmit_1.emitRealtimeToOrg)(orgId, 'activity:attendance_confirmed', {
                    activityId,
                    userId: internalUserId,
                    discordUserId: interaction.user.id,
                });
                const milestoneLine = await buildAttendanceMilestoneLine(orgId, internalUserId);
                const confirmMessage = '\u2705 Your attendance has been confirmed.';
                await interaction.editReply(milestoneLine ? `${confirmMessage}\n\n${milestoneLine}` : confirmMessage);
            }
            else if (customId === 'attend_stats_select') {
                await handleStats_fromModal(interaction, activityId);
            }
            else if (customId === 'attend_report_select') {
                await handleReport_fromModal(interaction, activityId);
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An error occurred';
            await interaction.editReply({ content: `\u274c ${msg}` });
        }
    },
    handleModal: async (interaction) => {
        const { customId } = interaction;
        const activityId = interaction.fields.getTextInputValue('activity_id').trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const service = getAttendanceService();
            if (customId === 'attend_confirm_modal') {
                const orgId = await GuildOrganizationService_1.GuildOrganizationService.getInstance().resolveOrganization(interaction.guildId || '');
                if (!orgId) {
                    await interaction.editReply('❌ This server is not linked to an organization. Use `/guild setup` first.');
                    return;
                }
                const activity = await new activity_1.ActivityService().getActivityById(activityId);
                if (activity?.organizationId !== orgId) {
                    await interaction.editReply('❌ Event not found in this server.');
                    return;
                }
                const internalUserId = await resolveInternalUserId(interaction.user.id);
                if (!internalUserId) {
                    await interaction.editReply('\u274c Your Discord account is not linked. Please link your account on the web app first.');
                    return;
                }
                await service.confirmAttendance(activityId, internalUserId);
                (0, realtimeEmit_1.emitRealtimeToOrg)(orgId, 'activity:attendance_confirmed', {
                    activityId,
                    userId: internalUserId,
                    discordUserId: interaction.user.id,
                });
                const milestoneLine = await buildAttendanceMilestoneLine(orgId, internalUserId);
                const confirmMessage = `\u2705 Your attendance for event \`${activityId}\` has been confirmed.`;
                await interaction.editReply(milestoneLine ? `${confirmMessage}\n\n${milestoneLine}` : confirmMessage);
            }
            else if (customId === 'attend_stats_modal') {
                await handleStats_fromModal(interaction, activityId);
            }
            else if (customId === 'attend_report_modal') {
                await handleReport_fromModal(interaction, activityId);
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'An error occurred';
            await interaction.editReply({ content: `\u274c ${msg}` });
        }
    },
};
async function handleStats_fromModal(interaction, activityId) {
    const service = getAttendanceService();
    const stats = await service.getActivityAttendanceStats(activityId);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`\ud83d\udcca Attendance Stats`)
        .setDescription(`Event ID: \`${activityId}\``)
        .addFields({ name: '\u2705 Attended', value: `${stats.attended || 0}`, inline: true }, { name: '\u274c No-Show', value: `${stats.noShow || 0}`, inline: true }, { name: '\ud83d\udcca Total', value: `${stats.total || 0}`, inline: true })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
async function handleReport_fromModal(interaction, activityId) {
    const service = getAttendanceService();
    const report = await service.generateAttendanceReport(activityId);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`\ud83d\udccb Attendance Report`)
        .setDescription(`Event ID: \`${activityId}\``)
        .setTimestamp();
    if (report.attendees && report.attendees.length > 0) {
        const attended = report.attendees
            .filter((a) => a.status === 'attended')
            .slice(0, 10)
            .map((c) => c.userName || c.userId || 'Unknown')
            .join(', ');
        if (attended) {
            embed.addFields({ name: `\u2705 Attended`, value: attended });
        }
        const noShows = report.attendees
            .filter((a) => a.status === 'no_show')
            .slice(0, 10)
            .map((n) => n.userName || n.userId || 'Unknown')
            .join(', ');
        if (noShows) {
            embed.addFields({ name: `\u274c No-Shows`, value: noShows });
        }
    }
    await interaction.editReply({ embeds: [embed] });
}
//# sourceMappingURL=attend.js.map