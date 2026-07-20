"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLfgCommentModalCustomId = parseLfgCommentModalCustomId;
exports.parseLfgTeamSuggestionCustomId = parseLfgTeamSuggestionCustomId;
exports.handleLfgButton = handleLfgButton;
exports.handleLfgRatingButton = handleLfgRatingButton;
exports.handleLfgRatingSelect = handleLfgRatingSelect;
exports.handleLfgRatingModal = handleLfgRatingModal;
exports.handleLfgCommentModal = handleLfgCommentModal;
exports.handleTeamSuggestionButton = handleTeamSuggestionButton;
const discord_js_1 = require("discord.js");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const RedisRateLimiter_1 = require("../../services/shared/RedisRateLimiter");
const social_1 = require("../../services/social");
const ReputationService_1 = require("../../services/social/ReputationService");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const lfgWebSocketController_1 = require("../../websocket/controllers/lfgWebSocketController");
const lfg_1 = require("../commands/lfg");
const lfgEmbed_1 = require("../embeds/lfgEmbed");
const confirmationPrompt_1 = require("../utils/confirmationPrompt");
const customId_1 = require("../utils/customId");
let _lfgService = null;
function getLfgService() {
    _lfgService ??= social_1.SocialGroupService.getInstance();
    return _lfgService;
}
function buildLfgCommentModalCustomId(sessionId, targetUserId) {
    return (0, customId_1.buildCustomId)('lfg', 'rate', 'comment', 'modal', sessionId, targetUserId);
}
function parseLfgCommentModalCustomId(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== 'lfg' || parsed.action !== 'rate') {
        return null;
    }
    const [mode = '', kind = '', sessionId = '', targetUserId = ''] = parsed.params;
    if (mode !== 'comment' || kind !== 'modal' || !sessionId || !targetUserId) {
        return null;
    }
    return { sessionId, targetUserId };
}
function parseLfgTeamSuggestionCustomId(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== 'lfg' || parsed.action !== 'team') {
        return null;
    }
    const [teamAction = '', guildId = '', rawMemberIds = ''] = parsed.params;
    if (!guildId) {
        return null;
    }
    if (teamAction === 'dismiss' || teamAction === 'later') {
        return { action: teamAction, guildId };
    }
    if (teamAction === 'create') {
        const memberIds = rawMemberIds.length > 0 ? rawMemberIds.split('-') : [];
        return memberIds.length > 0 ? { action: 'create', guildId, memberIds } : null;
    }
    return null;
}
async function handleLfgButton(interaction) {
    if (await routeLfgCloseConfirmation(interaction)) {
        return;
    }
    const parsed = (0, lfgEmbed_1.parseLfgButtonId)(interaction.customId);
    if (!parsed) {
        await interaction.reply({
            content: '❌ Unknown button action.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const { action, postId } = parsed;
    const userId = interaction.user.id;
    if (interaction.guildId) {
        await getLfgService().getActivePostsByGuild(interaction.guildId);
    }
    if (action === 'close') {
        await handleClosePrompt(interaction, postId);
        return;
    }
    try {
        let post;
        if (action === 'join') {
            const rateLimit = await RedisRateLimiter_1.redisRateLimiter.check((0, lfg_1.lfgJoinRateLimitKey)(interaction.guildId, userId), lfg_1.JOIN_LIMIT_PER_HOUR, 60 * 60);
            if (!rateLimit.allowed) {
                await interaction.reply({
                    content: '⏱️ You have reached the join limit. Please try again later.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            post = getLfgService().joinPost(postId, userId);
        }
        else {
            post = getLfgService().leavePost(postId, userId);
        }
        if (!post) {
            try {
                await interaction.update({ components: [(0, lfgEmbed_1.buildLfgButtons)(postId, true)] });
            }
            catch {
            }
            await interaction.followUp({
                content: '⏰ This LFG session has expired and is no longer available.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.update({
            embeds: [(0, lfgEmbed_1.buildLfgEmbed)(post)],
            components: [(0, lfgEmbed_1.buildLfgButtons)(postId, post.status === 'closed')],
        });
        await emitLfgMembershipEvent(interaction.guildId, action, postId, userId);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
            userId: interaction.user.id,
            username: interaction.user.username,
            resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
            action: `LFG_BUTTON_${action.toUpperCase()}`,
            message: `User ${action} LFG post via button: ${postId}`,
            metadata: { postId, action },
        });
    }
    catch (error) {
        await replyLfgButtonError(interaction, (0, errorHandler_1.getErrorMessage)(error), postId);
    }
}
async function routeLfgCloseConfirmation(interaction) {
    if (interaction.customId.startsWith('lfg_confirmclose_')) {
        await handleCloseConfirmed(interaction);
        return true;
    }
    if (interaction.customId.startsWith('lfg_canceldismiss_')) {
        await (0, confirmationPrompt_1.respondConfirmationCancelled)(interaction);
        return true;
    }
    return false;
}
async function emitLfgMembershipEvent(guildId, action, postId, userId) {
    if (!guildId) {
        return;
    }
    const orgId = await GuildOrganizationService_1.GuildOrganizationService.getInstance().resolveOrganization(guildId);
    if (!orgId) {
        return;
    }
    if (action === 'join') {
        (0, lfgWebSocketController_1.emitLfgMemberJoined)(orgId, postId, userId);
    }
    else {
        (0, lfgWebSocketController_1.emitLfgMemberLeft)(orgId, postId, userId);
    }
}
async function replyLfgButtonError(interaction, errorMsg, postId) {
    if (errorMsg.includes('expired') || errorMsg.includes('not found')) {
        try {
            await interaction.update({ components: [(0, lfgEmbed_1.buildLfgButtons)(postId, true)] });
        }
        catch {
        }
        await interaction.followUp({
            content: '⏰ This LFG session has expired and is no longer available.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (errorMsg.includes('full')) {
        await interaction.reply({
            content: '❌ This group is already full!',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (errorMsg.includes('creator') || errorMsg.includes('permission')) {
        await interaction.reply({
            content: '❌ Only the creator can close this LFG post.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.reply({
        content: `❌ Error: ${errorMsg}`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleClosePrompt(interaction, postId) {
    const post = getLfgService().getPost(postId);
    if (!post) {
        await interaction.reply({
            content: '⏰ This LFG session has expired and is no longer available.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (post.creatorId !== interaction.user.id) {
        await interaction.reply({
            content: '❌ Only the creator can close this LFG post.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const prompt = (0, confirmationPrompt_1.buildConfirmationPrompt)({
        confirmCustomId: `lfg_confirmclose_${interaction.message.id}_${postId}`,
        cancelCustomId: `lfg_canceldismiss_${postId}`,
        message: `close the **${post.activity}** LFG post`,
        confirmLabel: 'Close Post',
    });
    await interaction.reply(prompt);
}
async function handleCloseConfirmed(interaction) {
    const match = /^lfg_confirmclose_(\d+)_(.+)$/.exec(interaction.customId);
    if (!match) {
        await (0, confirmationPrompt_1.respondConfirmationCancelled)(interaction);
        return;
    }
    const publicMessageId = match[1];
    const postId = match[2];
    const userId = interaction.user.id;
    if (interaction.guildId) {
        await getLfgService().getActivePostsByGuild(interaction.guildId);
    }
    let post;
    try {
        post = getLfgService().closePost(postId, userId);
    }
    catch (error) {
        const errorMsg = (0, errorHandler_1.getErrorMessage)(error);
        await interaction
            .update({ content: `❌ ${errorMsg}`, components: [] })
            .catch(() => interaction.reply({ content: `❌ ${errorMsg}`, flags: discord_js_1.MessageFlags.Ephemeral }))
            .catch(() => { });
        return;
    }
    await interaction.update({ content: '✅ LFG post closed.', components: [] }).catch(() => { });
    let publicMessage = null;
    const channel = interaction.channel;
    if (channel && 'messages' in channel) {
        publicMessage = await channel.messages.fetch(publicMessageId).catch(() => null);
        if (publicMessage) {
            await publicMessage
                .edit({ embeds: [(0, lfgEmbed_1.buildLfgEmbed)(post)], components: [(0, lfgEmbed_1.buildLfgButtons)(postId, true)] })
                .catch(() => { });
        }
    }
    if (interaction.guildId) {
        const orgId = await GuildOrganizationService_1.GuildOrganizationService.getInstance().resolveOrganization(interaction.guildId);
        if (orgId) {
            (0, lfgWebSocketController_1.emitLfgSessionCancelled)(orgId, postId, userId);
        }
    }
    await getLfgService().finalizeClosedSession(post);
    setTimeout(() => {
        void (async () => {
            try {
                await publicMessage?.delete();
            }
            catch {
            }
            getLfgService().deletePost(postId);
        })();
    }, 5_000);
    (0, auditLogger_1.logAuditEvent)({
        eventType: auditLogger_1.AuditEventType.ACTIVITY_ACTION,
        userId: interaction.user.id,
        username: interaction.user.username,
        resource: `discord/guild/${interaction.guildId}/channel/${interaction.channelId}`,
        action: 'LFG_BUTTON_CLOSE',
        message: `User closed LFG post via button: ${postId}`,
        metadata: { postId, action: 'close' },
    });
}
async function handleLfgRatingButton(interaction) {
    const parsed = (0, lfgEmbed_1.parseLfgRatingId)(interaction.customId);
    if (!parsed) {
        return;
    }
    const userId = interaction.user.id;
    try {
        switch (parsed.type) {
            case 'thumb': {
                const targetUserId = parsed.targetUserId;
                const stars = parsed.stars;
                const thumbType = parsed.thumbType;
                if (!targetUserId || !stars || !thumbType) {
                    await interaction.reply({
                        content: '❌ Invalid rating payload.',
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    break;
                }
                const reputationService = new ReputationService_1.ReputationService();
                await reputationService.submitRating({
                    sessionId: parsed.sessionId,
                    userId: targetUserId,
                    raterId: userId,
                    overallRating: stars,
                });
                const label = lfgEmbed_1.THUMB_LABELS[thumbType] ?? 'Rating';
                await interaction.reply({
                    content: `${label} — Rating submitted for <@${targetUserId}>!`,
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            }
            case 'comment': {
                const targetUserId = parsed.targetUserId;
                if (!targetUserId) {
                    await interaction.reply({
                        content: '❌ Invalid rating payload.',
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    break;
                }
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(buildLfgCommentModalCustomId(parsed.sessionId, targetUserId))
                    .setTitle('Add Comment');
                const commentInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('comment')
                    .setPlaceholder('Any feedback about this player...')
                    .setStyle(discord_js_1.TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(500);
                const commentLabel = new discord_js_1.LabelBuilder()
                    .setLabel('Comment (optional)')
                    .setTextInputComponent(commentInput);
                modal.addLabelComponents(commentLabel);
                await interaction.showModal(modal);
                break;
            }
            case 'star': {
                const targetUserId = parsed.targetUserId;
                const stars = parsed.stars;
                if (!targetUserId || !stars) {
                    await interaction.reply({
                        content: '❌ Invalid rating payload.',
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    break;
                }
                const reputationService = new ReputationService_1.ReputationService();
                await reputationService.submitRating({
                    sessionId: parsed.sessionId,
                    userId: targetUserId,
                    raterId: userId,
                    overallRating: stars,
                });
                const detailRow = (0, lfgEmbed_1.buildLfgRatingDetailButton)(parsed.sessionId, targetUserId, stars);
                const starLabel = lfgEmbed_1.STAR_LABELS[stars] ?? 'Rating';
                await interaction.reply({
                    content: `${starLabel} — Rating submitted for <@${targetUserId}>! You can add detailed feedback or select another teammate.`,
                    components: [detailRow],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            }
            case 'detail': {
                const modal = new discord_js_1.ModalBuilder()
                    .setCustomId(`lfg_rate_modal_${parsed.sessionId}_${parsed.targetUserId}_${parsed.stars}`)
                    .setTitle('Detailed Rating Feedback');
                const communicationInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('communication')
                    .setPlaceholder('Rate their communication skills 1-5')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(1);
                const teamworkInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('teamwork')
                    .setPlaceholder('Rate their teamwork 1-5')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(1);
                const skillInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('skill')
                    .setPlaceholder('Rate their skill level 1-5')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(1);
                const reliabilityInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('reliability')
                    .setPlaceholder('Rate their reliability 1-5')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(1);
                const commentInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('comment')
                    .setPlaceholder('Any additional feedback...')
                    .setStyle(discord_js_1.TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(500);
                modal.addLabelComponents(new discord_js_1.LabelBuilder()
                    .setLabel('Communication (1-5)')
                    .setTextInputComponent(communicationInput), new discord_js_1.LabelBuilder().setLabel('Teamwork (1-5)').setTextInputComponent(teamworkInput), new discord_js_1.LabelBuilder().setLabel('Skill (1-5)').setTextInputComponent(skillInput), new discord_js_1.LabelBuilder().setLabel('Reliability (1-5)').setTextInputComponent(reliabilityInput), new discord_js_1.LabelBuilder().setLabel('Comment (optional)').setTextInputComponent(commentInput));
                await interaction.showModal(modal);
                break;
            }
            case 'done': {
                await interaction.reply({
                    content: '✅ Thanks for rating your teammates! Your feedback helps build a better community.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                checkAndSuggestTeam(interaction, userId, parsed.sessionId).catch((err) => {
                    logger_1.logger.debug('Team suggestion check failed (non-critical)', {
                        err: err instanceof Error ? err.message : String(err),
                    });
                });
                break;
            }
        }
    }
    catch (error) {
        const errorMsg = (0, errorHandler_1.getErrorMessage)(error);
        logger_1.logger.error(`LFG rating button error: ${errorMsg}`, error);
        let content = `❌ Error: ${errorMsg}`;
        if (errorMsg.includes('Cannot rate yourself')) {
            content = '❌ You cannot rate yourself.';
        }
        else if (errorMsg.includes('not in this session')) {
            content = '❌ You were not in this session.';
        }
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else {
            await interaction.reply({ content, flags: discord_js_1.MessageFlags.Ephemeral });
        }
    }
}
async function handleLfgRatingSelect(interaction) {
    const parsed = (0, lfgEmbed_1.parseLfgRatingId)(interaction.customId);
    if (parsed?.type !== 'select') {
        await interaction.reply({
            content: '❌ Unknown select action.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const selectedValue = interaction.values[0];
    const parts = selectedValue.split(':');
    const targetUserId = parts.at(-1);
    if (!targetUserId || parts.length < 2) {
        await interaction.reply({
            content: '❌ Invalid selection.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const starButtons = (0, lfgEmbed_1.buildLfgRatingStarButtons)(parsed.sessionId, targetUserId);
    await interaction.reply({
        content: `Rate <@${targetUserId}>:`,
        components: [starButtons],
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleLfgRatingModal(interaction) {
    const modalRe = /^lfg_rate_modal_([0-9a-f-]{36})_(\d+)_(\d)$/;
    const match = modalRe.exec(interaction.customId);
    if (!match) {
        await interaction.reply({
            content: '❌ Invalid modal submission.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const sessionId = match[1];
    const targetUserId = match[2];
    const stars = Number.parseInt(match[3], 10);
    const raterId = interaction.user.id;
    const parseCategory = (fieldId) => {
        const raw = interaction.fields.getTextInputValue(fieldId).trim();
        if (!raw) {
            return undefined;
        }
        const val = Number.parseInt(raw, 10);
        return val >= 1 && val <= 5 ? val : undefined;
    };
    const categoryRatings = {};
    const communication = parseCategory('communication');
    const teamwork = parseCategory('teamwork');
    const skill = parseCategory('skill');
    const reliability = parseCategory('reliability');
    if (communication) {
        categoryRatings.communication = communication;
    }
    if (teamwork) {
        categoryRatings.teamwork = teamwork;
    }
    if (skill) {
        categoryRatings.skill = skill;
    }
    if (reliability) {
        categoryRatings.reliability = reliability;
    }
    const comment = interaction.fields.getTextInputValue('comment').trim() || undefined;
    try {
        const reputationService = new ReputationService_1.ReputationService();
        await reputationService.submitRating({
            sessionId,
            userId: targetUserId,
            raterId,
            overallRating: stars,
            categoryRatings: Object.keys(categoryRatings).length > 0 ? categoryRatings : undefined,
            comment,
        });
        await interaction.reply({
            content: `✅ Detailed rating submitted for <@${targetUserId}>! ${lfgEmbed_1.STAR_LABELS[stars]}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        const errorMsg = (0, errorHandler_1.getErrorMessage)(error);
        logger_1.logger.error(`LFG rating modal error: ${errorMsg}`, error);
        await interaction.reply({
            content: `❌ Error submitting rating: ${errorMsg}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleLfgCommentModal(interaction) {
    const parsed = parseLfgCommentModalCustomId(interaction.customId);
    if (!parsed) {
        return;
    }
    const { sessionId, targetUserId } = parsed;
    const raterId = interaction.user.id;
    const comment = interaction.fields.getTextInputValue('comment').trim() || undefined;
    if (!comment) {
        await interaction.reply({
            content: '💬 No comment provided — skipped.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        const reputationService = new ReputationService_1.ReputationService();
        await reputationService.submitRating({
            sessionId,
            userId: targetUserId,
            raterId,
            overallRating: 3,
            comment,
        });
        await interaction.reply({
            content: `💬 Comment submitted for <@${targetUserId}>!`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    catch (error) {
        const errorMsg = (0, errorHandler_1.getErrorMessage)(error);
        logger_1.logger.error(`LFG comment modal error: ${errorMsg}`, error);
        await interaction.reply({
            content: `❌ Error submitting comment: ${errorMsg}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
const teamSuggestionDismissals = new Map();
async function checkAndSuggestTeam(interaction, userId, sessionId) {
    const session = await getLfgService().getSession(sessionId);
    if (!session) {
        return;
    }
    const guildId = session.guildId;
    const dismissKey = `${guildId}:${userId}`;
    if (teamSuggestionDismissals.get(dismissKey)) {
        return;
    }
    const matches = await getLfgService().findFrequentPositiveMatches(userId, guildId, 3);
    if (matches.length === 0) {
        return;
    }
    const topMatches = matches.slice(0, 4);
    try {
        const user = await interaction.client.users.fetch(userId);
        const embed = (0, lfgEmbed_1.buildTeamSuggestionEmbed)(topMatches);
        const buttons = (0, lfgEmbed_1.buildTeamSuggestionButtons)(guildId, topMatches.map(m => m.userId));
        await user.send({
            embeds: [embed],
            components: [buttons],
        });
    }
    catch {
    }
}
async function handleTeamSuggestionButton(interaction) {
    const parsed = parseLfgTeamSuggestionCustomId(interaction.customId);
    if (!parsed) {
        return;
    }
    if (parsed.action === 'dismiss') {
        const guildId = parsed.guildId;
        const dismissKey = `${guildId}:${interaction.user.id}`;
        teamSuggestionDismissals.set(dismissKey, true);
        await interaction.reply({
            content: '🔇 Team suggestions disabled for this server. You can re-enable by playing more sessions.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (parsed.action === 'later') {
        await interaction.reply({
            content: '⏰ No problem! We may suggest again after future sessions.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    if (parsed.action === 'create') {
        const guildId = parsed.guildId;
        const memberIds = parsed.memberIds;
        const allMembers = [interaction.user.id, ...memberIds];
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const teamName = `Team ${new Date().toISOString().slice(0, 10)}`;
            const result = await getLfgService().convertToTeamFromUsers(guildId, allMembers, teamName, interaction.user.id);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.BOT_TEAM_CREATED,
                userId: interaction.user.id,
                message: `Team created from suggestion: ${result.teamId}`,
                metadata: { guildId, teamId: result.teamId, memberCount: result.memberCount },
            });
            await interaction.editReply({
                content: `🎯 Team created! **${teamName}** with ${result.memberCount} members.`,
            });
        }
        catch (error) {
            const errorMsg = (0, errorHandler_1.getErrorMessage)(error);
            logger_1.logger.error(`Team creation from suggestion failed: ${errorMsg}`, error);
            await interaction.editReply({
                content: `❌ Could not create team: ${errorMsg}`,
            });
        }
    }
}
//# sourceMappingURL=lfgButtons.js.map