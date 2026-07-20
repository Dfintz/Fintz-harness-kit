"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPollEmbed = buildPollEmbed;
exports.buildPollButtons = buildPollButtons;
exports.parsePollButtonId = parsePollButtonId;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const Poll_1 = require("../../models/Poll");
const appUrls_1 = require("../utils/appUrls");
const embedBuilder_1 = require("../utils/embedBuilder");
const POLL_TYPE_LABELS = {
    [Poll_1.PollType.SINGLE_CHOICE]: 'Single Choice',
    [Poll_1.PollType.MULTIPLE_CHOICE]: 'Multiple Choice',
    [Poll_1.PollType.RANKED]: 'Ranked',
    [Poll_1.PollType.APPROVAL]: 'Approval',
};
const POLL_STATUS_EMOJI = {
    [Poll_1.PollStatus.DRAFT]: '📝',
    [Poll_1.PollStatus.ACTIVE]: '🟢',
    [Poll_1.PollStatus.CLOSED]: '🔒',
    [Poll_1.PollStatus.CANCELLED]: '❌',
};
const MAX_BUTTON_OPTIONS = 20;
function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function buildPollEmbed(poll, results) {
    const isClosed = poll.status === Poll_1.PollStatus.CLOSED || poll.status === Poll_1.PollStatus.CANCELLED;
    const statusEmoji = POLL_STATUS_EMOJI[poll.status] ?? '📊';
    let color;
    if (isClosed) {
        color = embedBuilder_1.EmbedColors.CLOSED;
    }
    else if (poll.status === Poll_1.PollStatus.DRAFT) {
        color = embedBuilder_1.EmbedColors.WARNING;
    }
    else {
        color = embedBuilder_1.EmbedColors.INFO;
    }
    const builder = embedBuilder_1.SCFleetEmbed.create()
        .setColor(color)
        .setTitle(`${statusEmoji}  ${truncate((0, shared_types_1.decodeHtmlEntities)(poll.title), 230)}`)
        .setTimestamp(poll.createdAt);
    const descParts = [];
    if (poll.description) {
        descParts.push(truncate((0, shared_types_1.decodeHtmlEntities)(poll.description), 1500));
    }
    descParts.push(`**Type:** ${POLL_TYPE_LABELS[poll.pollType]} · **Status:** ${poll.status.toUpperCase()}`);
    if (poll.isAnonymous) {
        descParts.push('🔒 *Anonymous voting*');
    }
    if (poll.maxSelections > 1) {
        descParts.push(`You may select up to **${poll.maxSelections}** options`);
    }
    builder.setDescription(descParts.join('\n'));
    if (results) {
        buildResultsFields(builder, poll.options, results);
    }
    else {
        buildOptionsList(builder, poll.options);
    }
    if (poll.endsAt) {
        const label = isClosed ? '🏁 Ended' : '⏰ Ends';
        builder.addFields({
            name: label,
            value: `${(0, embedBuilder_1.formatDiscordTimestamp)(poll.endsAt, embedBuilder_1.TimestampFormat.LONG_DATETIME)}\n${(0, embedBuilder_1.formatDiscordTimestamp)(poll.endsAt, embedBuilder_1.TimestampFormat.RELATIVE)}`,
            inline: true,
        });
    }
    if (results) {
        builder.addFields({
            name: '🗳️ Total Voters',
            value: `**${results.totalVotes}** vote(s)`,
            inline: true,
        });
    }
    const footerText = isClosed
        ? `Poll ID: ${poll.id}  •  This poll is closed`
        : `Poll ID: ${poll.id}  •  Click a button below to vote`;
    builder.setFooter({ text: footerText });
    if (poll.createdByName) {
        builder.setAuthor({ name: `Created by ${(0, shared_types_1.decodeHtmlEntities)(poll.createdByName)}` });
    }
    return builder.build().setURL((0, appUrls_1.buildAppUrl)('/polls'));
}
function buildOptionsList(builder, options) {
    const lines = options
        .slice(0, 25)
        .map((opt, i) => {
        const desc = opt.description ? ` — ${truncate((0, shared_types_1.decodeHtmlEntities)(opt.description), 80)}` : '';
        return `**${i + 1}.** ${(0, shared_types_1.decodeHtmlEntities)(opt.label)}${desc}`;
    });
    builder.addFields({
        name: '📋 Options',
        value: lines.join('\n') || 'No options',
        inline: false,
    });
}
function buildResultsFields(builder, options, results) {
    const maxVotes = Math.max(...results.options.map(o => o.voteCount), 1);
    const lines = results.options.slice(0, 25).map(opt => {
        const bar = (0, embedBuilder_1.createProgressBar)(opt.voteCount, maxVotes, {
            width: 10,
            showPercentage: false,
        });
        return `${bar}  **${(0, shared_types_1.decodeHtmlEntities)(opt.label)}** — ${opt.voteCount} vote(s) (${opt.percentage}%)`;
    });
    builder.addFields({
        name: '📊 Results',
        value: lines.join('\n') || 'No votes yet',
        inline: false,
    });
}
function buildPollButtons(pollId, options, isClosed = false) {
    const rows = [];
    const capped = options.slice(0, MAX_BUTTON_OPTIONS);
    for (let i = 0; i < capped.length; i += 5) {
        const row = new discord_js_1.ActionRowBuilder();
        const chunk = capped.slice(i, i + 5);
        for (const [j, opt] of chunk.entries()) {
            const index = i + j;
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`poll_vote_${index}_${pollId}`)
                .setLabel(truncate((0, shared_types_1.decodeHtmlEntities)(opt.label), 80))
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setDisabled(isClosed));
        }
        rows.push(row);
    }
    const utilRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`poll_results_${pollId}`)
        .setLabel('View Results')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📊'));
    if (rows.length < 5) {
        rows.push(utilRow);
    }
    return rows;
}
function parsePollButtonId(customId) {
    const voteRegex = /^poll_vote_(\d+)_(.+)$/;
    const voteMatch = voteRegex.exec(customId);
    if (voteMatch) {
        return {
            action: 'vote',
            optionIndex: Number.parseInt(voteMatch[1], 10),
            pollId: voteMatch[2],
        };
    }
    const listPageRegex = /^poll_listpage_(\d+)$/;
    const listPageMatch = listPageRegex.exec(customId);
    if (listPageMatch) {
        return {
            action: 'listpage',
            page: Number.parseInt(listPageMatch[1], 10),
        };
    }
    const simpleRegex = /^poll_(results|close)_(.+)$/;
    const simpleMatch = simpleRegex.exec(customId);
    if (simpleMatch) {
        return {
            action: simpleMatch[1],
            pollId: simpleMatch[2],
        };
    }
    return null;
}
//# sourceMappingURL=pollEmbed.js.map