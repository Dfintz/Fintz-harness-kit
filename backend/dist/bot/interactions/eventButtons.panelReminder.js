"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ephemeralLeaveConfirmation = ephemeralLeaveConfirmation;
exports.handleOpenActionsPanel = handleOpenActionsPanel;
exports.handleRemindMe = handleRemindMe;
const discord_js_1 = require("discord.js");
const ActivityReminder_1 = require("../../models/ActivityReminder");
const eventEmbed_1 = require("../embeds/eventEmbed");
const eventButtons_services_1 = require("./eventButtons.services");
const eventReminderOffset_1 = require("./eventReminderOffset");
const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';
async function handleOpenActionsPanel(interaction, activityId) {
    await interaction.reply({
        content: '🚀 **Ship & Crew** — choose an action:',
        components: (0, eventEmbed_1.buildEventActionPanelComponents)(activityId),
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleRemindMe(interaction, activityId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const activity = await (0, eventButtons_services_1.getActivityService)().getActivityById(activityId);
    if (!activity) {
        await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
        return;
    }
    if (!activity.scheduledStartDate) {
        await interaction.editReply({
            content: '⚠️ This event has no scheduled time, so a reminder cannot be set.',
        });
        return;
    }
    const choice = (0, eventReminderOffset_1.pickReminderOffset)(new Date(activity.scheduledStartDate));
    if (!choice) {
        await interaction.editReply({
            content: '⏰ This event is too soon to set a reminder.',
        });
        return;
    }
    const discordUserId = interaction.user.id;
    try {
        const existing = await (0, eventButtons_services_1.getReminderService)().getActivityReminders(activityId);
        const now = Date.now();
        const alreadySet = existing.some(r => r.recipientUserIds?.includes(discordUserId) && new Date(r.scheduledTime).getTime() > now);
        if (alreadySet) {
            await interaction.editReply({
                content: '🔔 You already have a reminder set for this event.',
            });
            return;
        }
    }
    catch {
    }
    await (0, eventButtons_services_1.getReminderService)().createActivityReminders(activityId, [choice.type], ActivityReminder_1.ReminderChannel.DISCORD, [discordUserId]);
    const fireAtTs = Math.floor(choice.fireAt.getTime() / 1000);
    await interaction.editReply({
        content: `🔔 You'll be reminded **${choice.label}** (<t:${fireAtTs}:F>) for **${activity.title}**.`,
    });
}
function ephemeralLeaveConfirmation(action) {
    if (action === 'leavecrew') {
        return '✅ You left the ship crew.';
    }
    if (action === 'leavepassenger') {
        return '✅ You left your passenger seat.';
    }
    return '✅ Done.';
}
//# sourceMappingURL=eventButtons.panelReminder.js.map