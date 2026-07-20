"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedule = void 0;
const discord_js_1 = require("discord.js");
const AvailabilityService_1 = require("../../services/calendar/AvailabilityService");
const EventConflictService_1 = require("../../services/event/EventConflictService");
const scheduleEmbeds_1 = require("../embeds/scheduleEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const guildContext_1 = require("../utils/guildContext");
let _conflictService = null;
function getConflictService() {
    _conflictService ??= new EventConflictService_1.EventConflictService();
    return _conflictService;
}
exports.schedule = {
    data: new discord_js_1.SlashCommandBuilder()
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
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'schedule');
        if (!sub) {
            return;
        }
        if (sub === 'set' || sub === 'view' || sub === 'my') {
            try {
                const handler = sub === 'set' ? handleSet : sub === 'view' ? handleView : handleMyConflicts;
                await handler(interaction);
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: `\u274c Error: ${msg}` });
                }
                else {
                    await interaction.reply({
                        content: `\u274c Error: ${msg}`,
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                }
            }
        }
        else if (sub === 'best') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('schedule_best_modal')
                .setTitle('Find Best Time');
            const durationInput = new discord_js_1.TextInputBuilder()
                .setCustomId('duration')
                .setPlaceholder('e.g. 120 for 2 hours')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(3);
            const minAttendeesInput = new discord_js_1.TextInputBuilder()
                .setCustomId('min_attendees')
                .setPlaceholder('e.g. 5')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(3);
            modal.addLabelComponents(new discord_js_1.LabelBuilder()
                .setLabel('Event duration in minutes (30-480)')
                .setTextInputComponent(durationInput), new discord_js_1.LabelBuilder()
                .setLabel('Minimum attendees required (1-500)')
                .setTextInputComponent(minAttendeesInput));
            await interaction.showModal(modal);
        }
        else if (sub === 'conflicts') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('schedule_conflicts_modal')
                .setTitle('Check Conflicts');
            const startInput = new discord_js_1.TextInputBuilder()
                .setCustomId('start')
                .setPlaceholder('e.g. 2026-04-20')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(16);
            const endInput = new discord_js_1.TextInputBuilder()
                .setCustomId('end')
                .setPlaceholder('e.g. 2026-04-25')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(16);
            modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Start date (YYYY-MM-DD)').setTextInputComponent(startInput), new discord_js_1.LabelBuilder().setLabel('End date (YYYY-MM-DD)').setTextInputComponent(endInput));
            await interaction.showModal(modal);
        }
    },
    handleModal: async (interaction) => {
        const { customId } = interaction;
        if (customId === 'schedule_best_modal') {
            const durationStr = interaction.fields.getTextInputValue('duration').trim();
            const minAttendeesStr = interaction.fields.getTextInputValue('min_attendees').trim();
            const duration = parseInt(durationStr, 10);
            const minAttendees = parseInt(minAttendeesStr, 10);
            if (isNaN(duration) || duration < 30 || duration > 480) {
                await interaction.reply({
                    content: '\u274c Duration must be 30-480 minutes.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            if (isNaN(minAttendees) || minAttendees < 1 || minAttendees > 500) {
                await interaction.reply({
                    content: '\u274c Min attendees must be 1-500.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.editReply('This command must be used in a server.');
                return;
            }
            try {
                const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
                if (!orgId) {
                    await interaction.editReply('❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.');
                    return;
                }
                const service = new AvailabilityService_1.AvailabilityService();
                const windows = await service.findBestTimes(orgId, duration, minAttendees);
                if (windows.length === 0) {
                    await interaction.editReply({
                        embeds: [(0, scheduleEmbeds_1.buildNoTimeWindowsEmbed)(duration, minAttendees)],
                    });
                    return;
                }
                await interaction.editReply({
                    embeds: [(0, scheduleEmbeds_1.buildBestTimesEmbed)(windows, duration, minAttendees)],
                });
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                await interaction.editReply(`\u274c Error: ${msg}`);
            }
        }
        else if (customId === 'schedule_conflicts_modal') {
            const startStr = interaction.fields.getTextInputValue('start').trim();
            const endStr = interaction.fields.getTextInputValue('end').trim();
            const startDate = new Date(startStr);
            const endDate = new Date(endStr);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                await interaction.reply({
                    content: '\u274c Invalid date format. Use YYYY-MM-DD.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            if (endDate <= startDate) {
                await interaction.reply({
                    content: '\u274c End date must be after start date.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.editReply('This command must be used in a server.');
                return;
            }
            try {
                const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
                if (!orgId) {
                    await interaction.editReply('❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.');
                    return;
                }
                const conflictService = getConflictService();
                const result = await conflictService.checkConflicts(orgId, startDate, endDate);
                if (!result.hasConflicts || result.conflicts.length === 0) {
                    await interaction.editReply({
                        embeds: [(0, scheduleEmbeds_1.buildNoConflictsEmbed)(startStr, endStr)],
                    });
                    return;
                }
                await interaction.editReply({
                    embeds: [
                        (0, scheduleEmbeds_1.buildConflictsListEmbed)(result.conflicts, result.totalConflicts, startStr, endStr),
                    ],
                });
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                await interaction.editReply(`\u274c Error: ${msg}`);
            }
        }
    },
    async execute(interaction) {
        const panelConfig = {
            prefix: 'schedule',
            title: '\ud83d\udcc5 Schedule & Availability',
            description: 'Manage your availability and find the best event times.',
            buttons: [
                {
                    subcommand: 'set',
                    label: 'Set Availability',
                    emoji: '\ud83d\uddd3\ufe0f',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                { subcommand: 'view', label: 'View Heatmap', emoji: '\ud83d\uddfa\ufe0f' },
                { subcommand: 'my', label: 'My Conflicts', emoji: '\ud83d\udc64' },
                { subcommand: 'best', label: 'Find Best Time', emoji: '\u2b50' },
                { subcommand: 'conflicts', label: 'Check Conflicts', emoji: '\u26a0\ufe0f' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
async function handleSet(interaction) {
    await interaction.reply({
        embeds: [(0, scheduleEmbeds_1.buildSetAvailabilityEmbed)()],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleView(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    }
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.editReply('This command must be used in a server.');
        return;
    }
    const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
    if (!orgId) {
        await interaction.editReply('❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.');
        return;
    }
    const service = new AvailabilityService_1.AvailabilityService();
    const heatmap = await service.getGroupAvailability(orgId);
    if (heatmap.totalMembers === 0) {
        await interaction.editReply({ embeds: [(0, scheduleEmbeds_1.buildNoAvailabilityEmbed)()] });
        return;
    }
    await interaction.editReply({ embeds: [(0, scheduleEmbeds_1.buildAvailabilityHeatmapEmbed)(heatmap)] });
}
async function handleMyConflicts(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    }
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.editReply({
            content: '❌ This command can only be used in an organization Discord server.',
        });
        return;
    }
    const organizationId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
    if (!organizationId) {
        await interaction.editReply({
            content: '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.',
        });
        return;
    }
    const userId = interaction.user.id;
    const result = await getConflictService().getUserConflicts(organizationId, userId);
    await interaction.editReply({
        embeds: [(0, scheduleEmbeds_1.buildMyConflictsEmbed)(result.conflicts, result.totalConflicts)],
    });
}
//# sourceMappingURL=schedule.js.map