"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOrgRootHubEmbed = buildOrgRootHubEmbed;
exports.buildOrgPublicFleetSnapshotEmbed = buildOrgPublicFleetSnapshotEmbed;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
function buildOrgRootHubEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F3E2} Org Command Hub')
        .setDescription([
        'Organization operations root panel.',
        '',
        '\u{1F4C5} **Activities** — Handoff to events panel',
        '\u{1F9ED} **Missions** — Handoff to mission panel',
        '\u{1F3AF} **Bounties** — Handoff to bounty panel',
        '\u{1F3AF} **LFG** — Handoff to LFG panel',
        '\u{1F4CB} **Attendance** — Handoff to attendance panel',
        '\u{1F4E2} **Announcements** — Handoff to announcement panel',
        '\u{1F5F3} **Polls** — Handoff to poll panel',
        '\u{1F4CB} **Recruitment** — Handoff to recruitment panel',
        '\u{1F3AB} **Tickets** — Handoff to ticket panel',
        '\u{1F50A} **Voice** — Handoff to voice panel',
        '\u{1F6F0} **RSI Status** — Handoff to RSI status panel',
        '\u{1F3DB} **Guild Setup** — Handoff to guild panel',
        '\u{1F6E1} **Moderation** — Handoff to moderation panel',
        '\u{1F309} **Commlink** — Handoff to commlink panel',
        '\u{1F680} **Fleet** — Summary, list, and public snapshot',
        '\u{1F4E6} **Logistics Web** — Open /logistics',
    ].join('\n'))
        .setFooter({ text: 'Org panel root' })
        .setTimestamp();
}
function buildOrgPublicFleetSnapshotEmbed(input) {
    return new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle(`\u{1F680} Fleet Snapshot \u2014 ${input.organizationLabel}`)
        .setURL(input.fleetUrl)
        .setDescription('Snapshot shared from the SC Fleet Manager Discord org panel.')
        .addFields({
        name: 'Totals',
        value: `Fleets: **${input.totalFleets}**\n` +
            `Ships assigned: **${input.totalShips}**\n` +
            `Active fleets: **${input.activeFleetCount}**`,
        inline: true,
    }, {
        name: 'Visibility',
        value: `Public-enabled fleets: **${input.publicFleetCount}**`,
        inline: true,
    }, {
        name: 'Status Breakdown',
        value: input.statusBreakdown,
        inline: true,
    }, {
        name: 'Role Breakdown',
        value: input.roleBreakdown,
        inline: true,
    }, {
        name: 'Top 3 Fleets',
        value: input.topFleets || 'No fleets yet.',
        inline: false,
    })
        .setFooter({ text: 'Open full fleet details in the web app' })
        .setTimestamp();
}
//# sourceMappingURL=orgEmbeds.js.map