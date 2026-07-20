"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDmNotificationStatusEmbed = buildDmNotificationStatusEmbed;
exports.buildLfgPingStatusEmbed = buildLfgPingStatusEmbed;
exports.buildMyNotificationPreferencesEmbed = buildMyNotificationPreferencesEmbed;
const discord_js_1 = require("discord.js");
function buildDmNotificationStatusEmbed(dm, formatBool) {
    const enabled = dm?.enabled ?? false;
    return new discord_js_1.EmbedBuilder()
        .setColor(enabled ? 0x00c853 : 0x9e9e9e)
        .setTitle('\u{1F514} DM Notification Settings')
        .setDescription(enabled ? '✅ DM notifications are **enabled**' : '❌ DM notifications are **disabled**')
        .addFields({ name: '\u{1F3AB} Ticket Created', value: formatBool(dm?.ticketCreated), inline: true }, { name: '\u{1F3AB} Ticket Assigned', value: formatBool(dm?.ticketAssigned), inline: true }, { name: '\u{1F3AB} Ticket Replied', value: formatBool(dm?.ticketReplied), inline: true }, { name: '\u{1F3AB} Ticket Closed', value: formatBool(dm?.ticketClosed), inline: true }, { name: '\u{1F3AB} Ticket Escalated', value: formatBool(dm?.ticketEscalated), inline: true }, {
        name: '\u{1F4CB} Recruitment Received',
        value: formatBool(dm?.recruitmentReceived),
        inline: true,
    }, {
        name: '\u{1F4CB} Recruitment Accepted',
        value: formatBool(dm?.recruitmentAccepted),
        inline: true,
    }, {
        name: '\u{1F4CB} Recruitment Denied',
        value: formatBool(dm?.recruitmentDenied),
        inline: true,
    }, { name: '\u{1F4C5} Event Reminder', value: formatBool(dm?.eventReminder), inline: true }, { name: '\u{1F4C5} Event Cancelled', value: formatBool(dm?.eventCancelled), inline: true }, { name: '\u{1F3AE} LFG Player Joined', value: formatBool(dm?.lfgPlayerJoined), inline: true })
        .setTimestamp();
}
function buildLfgPingStatusEmbed(ping) {
    const enabled = ping?.enabled ?? false;
    return new discord_js_1.EmbedBuilder()
        .setColor(enabled ? 0x00bcd4 : 0x9e9e9e)
        .setTitle('\u{1F3AE} Smart LFG Ping Settings')
        .setDescription(enabled ? '✅ Smart pings are **enabled**' : '❌ Smart pings are **disabled**')
        .addFields({ name: 'Cooldown', value: `${ping?.cooldownHours ?? 8}h`, inline: true }, { name: 'Max Pings/Post', value: `${ping?.maxPingsPerPost ?? 5}`, inline: true }, {
        name: 'Opt-In Role',
        value: ping?.optInRoleId ? `<@&${ping.optInRoleId}>` : 'None (all members)',
        inline: true,
    }, {
        name: 'Activity Filter',
        value: ping?.activityFilter?.length ? ping.activityFilter.join(', ') : 'All activities',
        inline: false,
    })
        .setTimestamp();
}
function buildMyNotificationPreferencesEmbed(pref, formatBool) {
    return new discord_js_1.EmbedBuilder()
        .setColor(pref.dmEnabled ? 0x00c853 : 0x9e9e9e)
        .setTitle('Your DM Notification Preferences')
        .setDescription(pref.dmEnabled
        ? '✅ Your DMs from this server are **enabled**'
        : '❌ Your DMs from this server are **disabled**')
        .addFields({ name: 'All DMs', value: formatBool(pref.dmEnabled), inline: true }, { name: 'LFG Pings', value: formatBool(pref.lfgPingOptIn), inline: true }, { name: 'Event Reminders', value: formatBool(pref.eventReminderOptIn), inline: true }, { name: 'Ticket DMs', value: formatBool(pref.ticketDmOptIn), inline: true }, { name: 'Recruitment DMs', value: formatBool(pref.recruitmentDmOptIn), inline: true }, { name: 'Moderation Alerts', value: formatBool(pref.moderationAlertOptIn), inline: true }, {
        name: '\u{1F4EC} Bot Responses via DM',
        value: formatBool(pref.botResponseViaDm),
        inline: true,
    }, { name: 'Timezone', value: pref.timezone ? pref.timezone : 'Not set', inline: true })
        .setFooter({ text: 'These are your personal preferences — they override server defaults' })
        .setTimestamp();
}
//# sourceMappingURL=notifyEmbeds.js.map