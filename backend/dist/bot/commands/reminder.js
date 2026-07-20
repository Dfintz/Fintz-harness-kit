"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminder = void 0;
exports.parseReminderTypeSelectEventId = parseReminderTypeSelectEventId;
const discord_js_1 = require("discord.js");
const ActivityReminder_1 = require("../../models/ActivityReminder");
const activity_1 = require("../../services/activity");
const communication_1 = require("../../services/communication");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const errorHandler_1 = require("../../utils/errorHandler");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const customId_1 = require("../utils/customId");
let _services = null;
const REMINDER_PREFIX = 'reminder';
function buildReminderTypeSelectCustomId(eventId) {
    return (0, customId_1.buildCustomId)(REMINDER_PREFIX, 'type', 'select', eventId);
}
function parseReminderTypeSelectEventId(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
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
    if (!_services) {
        const notificationService = new communication_1.NotificationService();
        _services = {
            notificationService,
            reminderService: new activity_1.ActivityReminderService(notificationService),
        };
    }
    return _services;
}
exports.reminder = {
    data: new discord_js_1.SlashCommandBuilder().setName('reminder').setDescription('Manage event reminders'),
    category: 'events',
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'reminder');
        if (!sub) {
            return;
        }
        if (sub === 'create' || sub === 'list') {
            try {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
                const orgId = await guildOrgService.resolveOrganization(interaction.guildId || '');
                if (!orgId) {
                    await interaction.editReply('Γ¥î This server is not linked to an organization. Use `/guild setup` first.');
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
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId(sub === 'create' ? 'reminder_event_for_create' : 'reminder_event_for_list')
                        .setPlaceholder('Select an event...')
                        .addOptions(options));
                    await interaction.editReply({
                        content: `Select an event to ${sub === 'create' ? 'create a reminder for' : 'view reminders for'}:`,
                        components: [row],
                    });
                    return;
                }
            }
            catch {
            }
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    content: `No upcoming events found. Use \`/reminder ${sub} eventid:<id>\` with a specific event ID.`,
                });
            }
        }
        else if (sub === 'cancel') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('reminder_cancel_modal')
                .setTitle('Cancel Reminder');
            const reminderIdInput = new discord_js_1.TextInputBuilder()
                .setCustomId('reminderid')
                .setPlaceholder('Enter the reminder ID to cancel')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);
            modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Reminder ID').setTextInputComponent(reminderIdInput));
            await interaction.showModal(modal);
        }
    },
    handleSelectMenu: async (interaction) => {
        const { customId } = interaction;
        if (customId === 'reminder_event_for_create') {
            const eventId = interaction.values[0];
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(buildReminderTypeSelectCustomId(eventId))
                .setPlaceholder('Select reminder timing...')
                .addOptions({ label: '1 Day Before', value: ActivityReminder_1.ReminderType.ONE_DAY_BEFORE }, { label: '1 Hour Before', value: ActivityReminder_1.ReminderType.ONE_HOUR_BEFORE }, { label: '30 Minutes Before', value: ActivityReminder_1.ReminderType.THIRTY_MINUTES_BEFORE }));
            await interaction.reply({
                content: `**Step 2/3:** When should the reminder be sent?`,
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else if (customId === 'reminder_event_for_list') {
            const eventId = interaction.values[0];
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const { reminderService } = getServices();
                const reminders = await reminderService.getActivityReminders(eventId);
                if (reminders.length === 0) {
                    await interaction.editReply(`\ud83d\udced No reminders found for this event.`);
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
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
            }
            catch (error) {
                await interaction.editReply(`\u274c Failed to list reminders: ${(0, errorHandler_1.getErrorMessage)(error)}`);
            }
        }
        else if (customId.startsWith('reminder_channel_select_')) {
            const parts = customId.replace('reminder_channel_select_', '').split('_');
            const eventId = parts.slice(0, -1).join('_');
            const reminderType = parts[parts.length - 1];
            const channel = interaction.values[0];
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const { reminderService } = getServices();
                await reminderService.createReminder({
                    activityId: eventId,
                    reminderType,
                    channel,
                });
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0x57f287)
                    .setTitle('\u2705 Reminder Created')
                    .addFields({ name: 'Event', value: eventId, inline: true }, { name: 'When', value: reminderType.replace(/_/g, ' '), inline: true }, { name: 'Channel', value: channel, inline: true })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            }
            catch (error) {
                await interaction.editReply(`\u274c Failed to create reminder: ${(0, errorHandler_1.getErrorMessage)(error)}`);
            }
        }
        else {
            const eventId = parseReminderTypeSelectEventId(customId);
            if (!eventId) {
                return;
            }
            const reminderType = interaction.values[0];
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`reminder_channel_select_${eventId}_${reminderType}`)
                .setPlaceholder('Select delivery channel...')
                .addOptions({
                label: 'Discord',
                value: ActivityReminder_1.ReminderChannel.DISCORD,
                description: 'Discord DM notification',
            }, { label: 'Email', value: ActivityReminder_1.ReminderChannel.EMAIL, description: 'Email notification' }, {
                label: 'Both',
                value: ActivityReminder_1.ReminderChannel.BOTH,
                description: 'Discord DM + Email',
                default: true,
            }));
            await interaction.reply({
                content: '**Step 2/2:** Select how to receive the reminder:',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    },
    handleModal: async (interaction) => {
        const { customId } = interaction;
        if (customId === 'reminder_create_modal') {
            const eventId = interaction.fields.getTextInputValue('eventid').trim();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(buildReminderTypeSelectCustomId(eventId))
                .setPlaceholder('Select reminder timing...')
                .addOptions({ label: '1 Day Before', value: ActivityReminder_1.ReminderType.ONE_DAY_BEFORE }, { label: '1 Hour Before', value: ActivityReminder_1.ReminderType.ONE_HOUR_BEFORE }, { label: '30 Minutes Before', value: ActivityReminder_1.ReminderType.THIRTY_MINUTES_BEFORE }));
            await interaction.reply({
                content: `**Step 1/2:** When should the reminder for event \`${eventId}\` be sent?`,
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else if (customId === 'reminder_list_modal') {
            const eventId = interaction.fields.getTextInputValue('eventid').trim();
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const { reminderService } = getServices();
                const reminders = await reminderService.getActivityReminders(eventId);
                if (reminders.length === 0) {
                    await interaction.editReply(`\ud83d\udced No reminders found for event \`${eventId}\`.`);
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
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
            }
            catch (error) {
                await interaction.editReply(`\u274c Failed to list reminders: ${(0, errorHandler_1.getErrorMessage)(error)}`);
            }
        }
        else if (customId === 'reminder_cancel_modal') {
            const reminderId = interaction.fields.getTextInputValue('reminderid').trim();
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const { reminderService } = getServices();
                await reminderService.cancelReminder(reminderId);
                await interaction.editReply(`\u2705 Reminder \`${reminderId}\` has been cancelled.`);
            }
            catch (error) {
                await interaction.editReply(`\u274c Failed to cancel reminder: ${(0, errorHandler_1.getErrorMessage)(error)}`);
            }
        }
    },
    async execute(interaction) {
        const panelConfig = {
            prefix: 'reminder',
            title: '\u23f0 Event Reminders',
            description: 'Manage reminders for events.',
            buttons: [
                {
                    subcommand: 'create',
                    label: 'Create Reminder',
                    emoji: '\u2795',
                    style: discord_js_1.ButtonStyle.Success,
                },
                { subcommand: 'list', label: 'List Reminders', emoji: '\ud83d\udccb' },
                {
                    subcommand: 'cancel',
                    label: 'Cancel Reminder',
                    emoji: '\u274c',
                    style: discord_js_1.ButtonStyle.Danger,
                },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
//# sourceMappingURL=reminder.js.map