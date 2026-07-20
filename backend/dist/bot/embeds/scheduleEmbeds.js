"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNoTimeWindowsEmbed = buildNoTimeWindowsEmbed;
exports.buildBestTimesEmbed = buildBestTimesEmbed;
exports.buildNoConflictsEmbed = buildNoConflictsEmbed;
exports.buildConflictsListEmbed = buildConflictsListEmbed;
exports.buildSetAvailabilityEmbed = buildSetAvailabilityEmbed;
exports.buildNoAvailabilityEmbed = buildNoAvailabilityEmbed;
exports.buildAvailabilityHeatmapEmbed = buildAvailabilityHeatmapEmbed;
exports.buildMyConflictsEmbed = buildMyConflictsEmbed;
const appUrls_1 = require("../utils/appUrls");
const embedBuilder_1 = require("../utils/embedBuilder");
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BLOCK_CHARS = [' ', '\u2591', '\u2592', '\u2593', '\u2588'];
function intensityChar(count, max) {
    if (max === 0 || count === 0) {
        return BLOCK_CHARS[0];
    }
    const ratio = count / max;
    const idx = Math.min(Math.floor(ratio * (BLOCK_CHARS.length - 1)) + 1, BLOCK_CHARS.length - 1);
    return BLOCK_CHARS[idx];
}
function buildNoTimeWindowsEmbed(duration, minAttendees) {
    return embedBuilder_1.SCFleetEmbed.warning('No Time Windows Found', `No ${duration}-minute windows found with at least ${minAttendees} attendees.\n` +
        'Try lowering the minimum attendees or ask more members to set their availability.').build();
}
function buildBestTimesEmbed(windows, duration, minAttendees) {
    const lines = windows.map((w, i) => `**${i + 1}.** ${w.dayName} ${w.timeRange} \u2014 ${w.availableCount} available`);
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`\u23f0 Best Times (${duration}min, \u2265${minAttendees} people)`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'SC Fleet Manager \u2014 Group Scheduling' })
        .build()
        .setURL((0, appUrls_1.buildAppUrl)('/calendar'));
}
function buildNoConflictsEmbed(startStr, endStr) {
    return embedBuilder_1.SCFleetEmbed.success('No Conflicts', `No scheduling conflicts found between ${startStr} and ${endStr}.`).build();
}
function buildConflictsListEmbed(conflicts, totalConflicts, startStr, endStr) {
    const lines = conflicts
        .slice(0, 10)
        .map((c, i) => `**${i + 1}.** ${c.activityTitle || 'Event'} \u2014 ${c.conflictType} conflict`);
    return embedBuilder_1.SCFleetEmbed.warning(`Scheduling Conflicts (${startStr} to ${endStr})`, lines.join('\n'))
        .setFooter({ text: `${totalConflicts} conflict(s) found` })
        .build()
        .setURL((0, appUrls_1.buildAppUrl)('/calendar'));
}
function buildSetAvailabilityEmbed() {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4C5} Set Your Availability')
        .setDescription('Use the web app to mark your available times on the interactive weekly grid.\n\n' +
        `**[Open Availability Grid](${(0, appUrls_1.buildAppUrl)('/calendar')})**\n\n` +
        'Navigate to the **Availability** tab and click-drag to select your available hours.')
        .setFooter({ text: 'SC Fleet Manager \u2014 Group Scheduling' })
        .build();
}
function buildNoAvailabilityEmbed() {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.WARNING)
        .setTitle('\u{1F4CA} Group Availability')
        .setDescription('No members have set their availability yet.\nUse `/schedule set` to get started!')
        .build()
        .setURL((0, appUrls_1.buildAppUrl)('/calendar'));
}
function buildAvailabilityHeatmapEmbed(heatmap) {
    const hoursToShow = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
    let grid = `\`\`\`\n      ${hoursToShow.map(h => h.toString().padStart(2, '0')).join(' ')}\n`;
    for (let d = 0; d < 7; d++) {
        grid += `${DAY_LABELS[d].padEnd(4)}  `;
        for (const h of hoursToShow) {
            const cell = heatmap.cells.find(c => c.dayOfWeek === d && c.hour === h);
            grid += `${intensityChar(cell?.count ?? 0, heatmap.totalMembers)}  `;
        }
        grid += '\n';
    }
    grid += '```';
    grid += `\n\u2591 = few  \u2592 = some  \u2593 = many  \u2588 = most  (${heatmap.totalMembers} members)`;
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4CA} Group Availability Heatmap')
        .setDescription(grid)
        .setFooter({ text: 'SC Fleet Manager \u2014 Group Scheduling' })
        .build()
        .setURL((0, appUrls_1.buildAppUrl)('/calendar'));
}
function buildMyConflictsEmbed(conflicts, totalConflicts) {
    const hasConflicts = totalConflicts > 0;
    const builder = embedBuilder_1.SCFleetEmbed.create()
        .setColor(hasConflicts ? embedBuilder_1.EmbedColors.ERROR : embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('\u{1F4CB} Your Event Conflicts')
        .setTimestamp();
    if (hasConflicts) {
        builder.setDescription(`You have ${totalConflicts} scheduling conflict(s).`);
        conflicts.slice(0, 10).forEach((conflict, index) => {
            const startStr = conflict.scheduledStartDate.toLocaleString();
            builder.addFields({
                name: `${index + 1}. ${conflict.activityTitle}`,
                value: `**Type:** ${conflict.activityType}\n**Time:** ${startStr}\n**Reason:** ${conflict.conflictReason}`,
                inline: false,
            });
        });
        if (totalConflicts > 10) {
            builder.setFooter({ text: `Showing 10 of ${totalConflicts} conflicts` });
        }
    }
    else {
        builder.setDescription('\u2705 You have no scheduling conflicts! Your calendar is clear.');
    }
    return builder.build().setURL((0, appUrls_1.buildAppUrl)('/calendar'));
}
//# sourceMappingURL=scheduleEmbeds.js.map