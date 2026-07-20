"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THUMB_TO_RATING = exports.THUMB_LABELS = exports.STAR_LABELS = void 0;
exports.buildLfgEmbed = buildLfgEmbed;
exports.buildLfgButtons = buildLfgButtons;
exports.parseLfgButtonId = parseLfgButtonId;
exports.buildLfgDmRatingEmbed = buildLfgDmRatingEmbed;
exports.buildLfgDmRatingRows = buildLfgDmRatingRows;
exports.buildLfgDmDoneButton = buildLfgDmDoneButton;
exports.buildLfgRatingStarButtons = buildLfgRatingStarButtons;
exports.buildLfgRatingDetailButton = buildLfgRatingDetailButton;
exports.parseLfgRatingId = parseLfgRatingId;
exports.buildTeamSuggestionEmbed = buildTeamSuggestionEmbed;
exports.buildTeamSuggestionButtons = buildTeamSuggestionButtons;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const appUrls_1 = require("../utils/appUrls");
const customId_1 = require("../utils/customId");
const embedBuilder_1 = require("../utils/embedBuilder");
const emojiMaps_1 = require("../utils/emojiMaps");
function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function buildLfgEmbed(post) {
    const activityEmoji = (0, emojiMaps_1.getLfgActivityEmoji)(post.activity);
    const statusEmoji = (0, emojiMaps_1.getLfgStatusEmoji)(post.status);
    const isClosed = post.status === 'closed';
    const gameName = post.game ?? 'Star Citizen';
    const color = isClosed
        ? embedBuilder_1.EmbedColors.CLOSED
        : post.status === 'full'
            ? embedBuilder_1.EmbedColors.FULL
            : (0, embedBuilder_1.getActivityAccentColor)(post.activity);
    const descLines = [
        truncate((0, shared_types_1.decodeHtmlEntities)(post.description), 300),
        '',
        `${activityEmoji} \`${post.activity}\`  ${statusEmoji} **${post.status.toUpperCase()}**  🎮 \`${(0, shared_types_1.decodeHtmlEntities)(gameName)}\``,
    ];
    const builder = embedBuilder_1.SCFleetEmbed.create()
        .setColor(color)
        .setTitle(`${activityEmoji}  LFG: ${(0, shared_types_1.decodeHtmlEntities)(post.activity)}`)
        .setDescription(descLines.join('\n'))
        .setAuthor({ name: (0, shared_types_1.decodeHtmlEntities)(post.creatorName) });
    const progressBar = (0, embedBuilder_1.createProgressBar)(post.currentPlayers, post.maxPlayers, {
        width: 12,
        showPercentage: false,
    });
    builder.addFields({
        name: '👥 Open Positions',
        value: `${progressBar}  **${post.currentPlayers}** / **${post.maxPlayers}** players`,
        inline: false,
    });
    builder.addFields({
        name: '⏰ Expires',
        value: `${(0, embedBuilder_1.formatDiscordTimestamp)(post.expiresAt, embedBuilder_1.TimestampFormat.LONG_DATETIME)}\n${(0, embedBuilder_1.formatDiscordTimestamp)(post.expiresAt, embedBuilder_1.TimestampFormat.RELATIVE)}`,
        inline: true,
    });
    if (post.voiceChannelId) {
        builder.addFields({
            name: '🎤 Voice Channel',
            value: `<#${post.voiceChannelId}>`,
            inline: true,
        });
    }
    if (post.members.length > 0) {
        const lines = post.members.slice(0, 12).map((memberId, i) => `${i + 1}. <@${memberId}>`);
        const overflow = post.members.length > 12 ? `\n*…and ${post.members.length - 12} more*` : '';
        builder.addFields({
            name: `👥 Members (${post.members.length})`,
            value: lines.join('\n') + overflow,
            inline: true,
        });
    }
    if (post.postedToServers && post.postedToServers.length > 0) {
        builder.addFields({
            name: '📡 Posted To',
            value: post.postedToServers.map(s => `\`${s}\``).join(' · '),
            inline: false,
        });
    }
    builder
        .setFooter({
        text: isClosed
            ? `ID: ${post.id}  •  This LFG post is closed`
            : `ID: ${post.id}  •  Click a button below to join or leave`,
    })
        .setTimestamp(post.createdAt);
    return builder.build().setURL((0, appUrls_1.buildAppUrl)('/lfg'));
}
function buildLfgButtons(postId, isClosed = false) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_join_${postId}`)
        .setLabel('Join')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('✅')
        .setDisabled(isClosed), new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_leave_${postId}`)
        .setLabel('Leave')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🚪')
        .setDisabled(isClosed), new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_close_${postId}`)
        .setLabel('Close')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🔒')
        .setDisabled(isClosed));
}
function parseLfgButtonId(customId) {
    const match = customId.match(/^lfg_(join|leave|close)_(.+)$/);
    if (!match) {
        return null;
    }
    return {
        action: match[1],
        postId: match[2],
    };
}
const STAR_LABELS = {
    1: '⭐ Poor',
    2: '⭐⭐ Below Average',
    3: '⭐⭐⭐ Average',
    4: '⭐⭐⭐⭐ Good',
    5: '⭐⭐⭐⭐⭐ Excellent',
};
exports.STAR_LABELS = STAR_LABELS;
const THUMB_LABELS = {
    up: '👍 Positive',
    neutral: '😐 Neutral',
    down: '👎 Negative',
};
exports.THUMB_LABELS = THUMB_LABELS;
const THUMB_TO_RATING = {
    up: 5,
    neutral: 3,
    down: 1,
};
exports.THUMB_TO_RATING = THUMB_TO_RATING;
function buildLfgDmRatingEmbed(post, sessionId) {
    const activityEmoji = (0, emojiMaps_1.getLfgActivityEmoji)(post.activity);
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.QUANTUM_GOLD)
        .setTitle(`${activityEmoji} Rate Your Session`)
        .setDescription(`**${(0, shared_types_1.decodeHtmlEntities)(post.activity)}** session has ended!\n` +
        `*"${truncate((0, shared_types_1.decodeHtmlEntities)(post.description), 120)}"*\n\n` +
        'Rate each teammate below using the reaction buttons.\n' +
        '👍 Positive · 😐 Neutral · 👎 Negative')
        .addFields({
        name: '👥 Participants',
        value: post.members
            .slice(0, 20)
            .map(m => `<@${m}>`)
            .join(', '),
        inline: false,
    })
        .setFooter({ text: `Session: ${sessionId} • Ratings are anonymous` })
        .setTimestamp()
        .build();
}
function buildLfgDmRatingRows(sessionId, targets) {
    return targets.slice(0, 5).map(target => new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_thumb_up_${sessionId}_${target.userId}`)
        .setLabel(`👍 ${truncate((0, shared_types_1.decodeHtmlEntities)(target.displayName), 20)}`)
        .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_thumb_neutral_${sessionId}_${target.userId}`)
        .setLabel('😐')
        .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_thumb_down_${sessionId}_${target.userId}`)
        .setLabel('👎')
        .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_comment_${sessionId}_${target.userId}`)
        .setLabel('💬')
        .setStyle(discord_js_1.ButtonStyle.Secondary)));
}
function buildLfgDmDoneButton(sessionId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_done_${sessionId}`)
        .setLabel('Done Rating')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('✅'));
}
function buildLfgRatingStarButtons(sessionId, targetUserId) {
    return new discord_js_1.ActionRowBuilder().addComponents(...[1, 2, 3, 4, 5].map(stars => new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_${stars}_${sessionId}_${targetUserId}`)
        .setLabel(`${'⭐'.repeat(stars)}`)
        .setStyle(stars >= 4
        ? discord_js_1.ButtonStyle.Success
        : stars >= 3
            ? discord_js_1.ButtonStyle.Primary
            : discord_js_1.ButtonStyle.Secondary)));
}
function buildLfgRatingDetailButton(sessionId, targetUserId, stars) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_detail_${sessionId}_${targetUserId}_${stars}`)
        .setLabel('Add Detailed Feedback')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📝'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lfg_rate_done_${sessionId}`)
        .setLabel('Done Rating')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('✅'));
}
function parseLfgRatingId(customId) {
    const thumbRe = /^lfg_rate_thumb_(up|neutral|down)_([0-9a-f-]{36})_(\d+)$/;
    const thumbMatch = thumbRe.exec(customId);
    if (thumbMatch) {
        const thumbType = thumbMatch[1];
        return {
            type: 'thumb',
            thumbType,
            sessionId: thumbMatch[2],
            targetUserId: thumbMatch[3],
            stars: THUMB_TO_RATING[thumbType],
        };
    }
    const commentRe = /^lfg_rate_comment_([0-9a-f-]{36})_(\d+)$/;
    const commentMatch = commentRe.exec(customId);
    if (commentMatch) {
        return {
            type: 'comment',
            sessionId: commentMatch[1],
            targetUserId: commentMatch[2],
        };
    }
    const doneRe = /^lfg_rate_done_([0-9a-f-]{36})$/;
    const doneMatch = doneRe.exec(customId);
    if (doneMatch) {
        return { type: 'done', sessionId: doneMatch[1] };
    }
    const detailRe = /^lfg_rate_detail_([0-9a-f-]{36})_(\d+)_(\d)$/;
    const detailMatch = detailRe.exec(customId);
    if (detailMatch) {
        return {
            type: 'detail',
            sessionId: detailMatch[1],
            targetUserId: detailMatch[2],
            stars: Number.parseInt(detailMatch[3], 10),
        };
    }
    const selectRe = /^lfg_rate_select_([0-9a-f-]{36})$/;
    const selectMatch = selectRe.exec(customId);
    if (selectMatch) {
        return { type: 'select', sessionId: selectMatch[1] };
    }
    const starRe = /^lfg_rate_(\d)_([0-9a-f-]{36})_(\d+)$/;
    const starMatch = starRe.exec(customId);
    if (starMatch) {
        return {
            type: 'star',
            sessionId: starMatch[2],
            targetUserId: starMatch[3],
            stars: Number.parseInt(starMatch[1], 10),
        };
    }
    return null;
}
function buildTeamSuggestionEmbed(matchedUsers) {
    const playerList = matchedUsers
        .map(m => `• <@${m.userId}> — ${m.sharedSessionCount} sessions together`)
        .join('\n');
    return new discord_js_1.EmbedBuilder()
        .setTitle('🎯 Team Suggestion')
        .setDescription(`You've played well with these players across multiple sessions with mutual positive feedback!\n\n${playerList}\n\nWould you like to form a team/unit together?`)
        .setColor(0x00bcd4)
        .setFooter({ text: 'Teams help you organize recurring groups' })
        .setTimestamp();
}
function buildTeamSuggestionButtons(guildId, matchedUserIds) {
    const idList = matchedUserIds.join('-');
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId((0, customId_1.buildCustomId)('lfg', 'team', 'create', guildId, idList))
        .setLabel('Create Team')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('🎯'), new discord_js_1.ButtonBuilder()
        .setCustomId((0, customId_1.buildCustomId)('lfg', 'team', 'later', guildId))
        .setLabel('Maybe Later')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('⏰'), new discord_js_1.ButtonBuilder()
        .setCustomId((0, customId_1.buildCustomId)('lfg', 'team', 'dismiss', guildId))
        .setLabel("Don't Suggest Again")
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🔇'));
}
//# sourceMappingURL=lfgEmbed.js.map