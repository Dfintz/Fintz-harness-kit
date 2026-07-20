"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readycheck = void 0;
exports.parseReadycheckDurationModalActivityId = parseReadycheckDurationModalActivityId;
exports._resetServicesForTesting = _resetServicesForTesting;
exports.parseReadyCheckVoteCustomId = parseReadyCheckVoteCustomId;
const discord_js_1 = require("discord.js");
const activity_1 = require("../../services/activity");
const ReadyCheckService_1 = require("../../services/activity/ReadyCheckService");
const UserService_1 = require("../../services/user/UserService");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const customId_1 = require("../utils/customId");
const embedBuilder_1 = require("../utils/embedBuilder");
const guildContext_1 = require("../utils/guildContext");
const realtimeEmit_1 = require("../utils/realtimeEmit");
let _readyCheckService = null;
function getReadyCheckService() {
    _readyCheckService ??= new ReadyCheckService_1.ReadyCheckService();
    return _readyCheckService;
}
let _activityService = null;
function getActivityService() {
    _activityService ??= new activity_1.ActivityService();
    return _activityService;
}
let _userService = null;
function getUserService() {
    _userService ??= new UserService_1.UserService();
    return _userService;
}
const READYCHECK_PREFIX = 'readycheck';
function buildReadycheckDurationModalCustomId(activityId) {
    return (0, customId_1.buildCustomId)(READYCHECK_PREFIX, 'duration', 'modal', activityId);
}
function parseReadycheckDurationModalActivityId(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== READYCHECK_PREFIX || parsed.action !== 'duration') {
        return null;
    }
    const [kind = '', activityId = ''] = parsed.params;
    if (kind !== 'modal' || activityId.length === 0) {
        return null;
    }
    return activityId;
}
function _resetServicesForTesting() {
    _readyCheckService = null;
    _activityService = null;
    _userService = null;
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
async function resolveUserName(discordId, fallback) {
    try {
        const user = await getUserService().getUserByDiscordId(discordId);
        return user?.username ?? user?.displayName ?? fallback;
    }
    catch {
        return fallback;
    }
}
async function buildActivitySelectMenu(orgId, customId, placeholder) {
    const activities = await getActivityService().getUpcomingActivities({
        organizationId: orgId,
        limit: 25,
    });
    if (activities.length === 0) {
        return null;
    }
    const options = activities.map(a => ({
        label: (a.title || 'Untitled Activity').substring(0, 100),
        value: a.id,
        description: a.scheduledStartDate
            ? `Starts: ${new Date(a.scheduledStartDate).toLocaleDateString()}`
            : undefined,
    }));
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(options));
}
function getStatusEmoji(status, allReady) {
    if (status === 'completed') {
        return allReady ? '✅' : '📊';
    }
    if (status === 'expired') {
        return '⏰';
    }
    if (status === 'cancelled') {
        return '🛑';
    }
    return '🔄';
}
function getResponseEmoji(response) {
    if (response === 'ready') {
        return '✅';
    }
    if (response === 'not_ready') {
        return '❌';
    }
    return '⏳';
}
function getStatusColour(allReady, notReadyCount) {
    if (allReady) {
        return embedBuilder_1.EmbedColors.SUCCESS;
    }
    if (notReadyCount > 0) {
        return embedBuilder_1.EmbedColors.ERROR;
    }
    return embedBuilder_1.EmbedColors.SC_BLUE;
}
function buildReadyCheckStatusEmbed(readyCheck) {
    const responses = readyCheck.responses;
    const readyCount = readyCheck.readyCount;
    const notReadyCount = readyCheck.notReadyCount;
    const pendingCount = readyCheck.pendingCount;
    const total = readyCheck.totalParticipants;
    const status = readyCheck.status;
    const allReady = readyCount === total;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(getStatusColour(allReady, notReadyCount))
        .setTitle(`${getStatusEmoji(status, allReady)} Ready Check — ${readyCheck.activityId ? 'Active' : 'Status'}`)
        .addFields({
        name: 'Status',
        value: status === 'pending' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1),
        inline: true,
    }, { name: 'Ready', value: `${readyCount}/${total}`, inline: true }, { name: 'Not Ready', value: String(notReadyCount), inline: true });
    if (status === 'pending' && readyCheck.expiresAt) {
        const expiresAt = new Date(readyCheck.expiresAt);
        embed.addFields({
            name: 'Expires',
            value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
            inline: true,
        });
    }
    if (responses && responses.length > 0) {
        const participantLines = responses
            .slice(0, 15)
            .map(r => `${getResponseEmoji(r.response)} ${r.userName}`);
        if (responses.length > 15) {
            participantLines.push(`... and ${responses.length - 15} more`);
        }
        embed.addFields({ name: 'Participants', value: participantLines.join('\n') });
    }
    if (pendingCount > 0 && status === 'pending') {
        embed.setFooter({ text: `${pendingCount} participant(s) still pending` });
    }
    embed.setTimestamp();
    return embed;
}
const data = new discord_js_1.SlashCommandBuilder()
    .setName('readycheck')
    .setDescription('Start and manage ready checks for activities');
async function execute(interaction) {
    const panelConfig = {
        prefix: 'readycheck',
        title: '🚀 Ready Check',
        description: 'Start, inspect, or cancel ready checks. Respond directly in the event thread.',
        buttons: [
            {
                subcommand: 'start',
                label: 'Start Ready Check',
                emoji: '🚀',
                style: discord_js_1.ButtonStyle.Success,
            },
            {
                subcommand: 'status',
                label: 'Status',
                emoji: '📊',
            },
            {
                subcommand: 'cancel',
                label: 'Cancel',
                emoji: '🛑',
                style: discord_js_1.ButtonStyle.Danger,
            },
        ],
    };
    await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
}
const BUTTON_CONFIG = {
    start: {
        customId: 'readycheck_start_select',
        prompt: '🚀 Select an activity to start a ready check:',
    },
    status: {
        customId: 'readycheck_status_select',
        prompt: '📊 Select an activity to view its ready check status:',
    },
    cancel: {
        customId: 'readycheck_cancel_select',
        prompt: '🛑 Select an activity to cancel its ready check:',
    },
};
function parseReadyCheckVoteCustomId(customId) {
    if (customId.startsWith(ReadyCheckService_1.READY_CHECK_VOTE_READY_PREFIX)) {
        return {
            activityId: customId.slice(ReadyCheckService_1.READY_CHECK_VOTE_READY_PREFIX.length),
            response: 'ready',
        };
    }
    if (customId.startsWith(ReadyCheckService_1.READY_CHECK_VOTE_NOT_READY_PREFIX)) {
        return {
            activityId: customId.slice(ReadyCheckService_1.READY_CHECK_VOTE_NOT_READY_PREFIX.length),
            response: 'not_ready',
        };
    }
    return null;
}
async function handleThreadVoteButton(interaction, voteAction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const context = await (0, guildContext_1.resolveGuildContext)(interaction);
        if (!context) {
            return;
        }
        const internalUserId = await resolveInternalUserId(interaction.user.id);
        if (!internalUserId) {
            await interaction.editReply('❌ Your Discord account is not linked. Please link your account on the web app first.');
            return;
        }
        const userName = await resolveUserName(interaction.user.id, interaction.user.displayName || interaction.user.username);
        const readyCheck = await getReadyCheckService().respond(voteAction.activityId, internalUserId, userName, voteAction.response);
        const summary = readyCheck;
        const responses = Object.values((summary.responses ?? {}));
        const readyCount = responses.filter(response => response.response === 'ready').length;
        const totalParticipants = typeof summary.totalParticipants === 'number' ? summary.totalParticipants : responses.length;
        const activityTitle = typeof summary.activityTitle === 'string'
            ? summary.activityTitle
            : `Activity ${voteAction.activityId}`;
        const isReady = voteAction.response === 'ready';
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(isReady ? embedBuilder_1.EmbedColors.SUCCESS : embedBuilder_1.EmbedColors.ERROR)
            .setTitle(isReady ? '✅ You voted Yes' : '❌ You voted No')
            .setDescription(`**${activityTitle}**`)
            .addFields({
            name: 'Ready',
            value: `${readyCount}/${totalParticipants}`,
            inline: true,
        }, {
            name: 'Status',
            value: summary.status === 'completed' ? '✅ All responded' : '🔄 In progress',
            inline: true,
        })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        (0, realtimeEmit_1.emitRealtimeToOrg)(context.organizationId, 'activity:ready_check_response', {
            activityId: voteAction.activityId,
            userId: internalUserId,
            response: voteAction.response,
        });
    }
    catch (error) {
        const msg = (0, errorHandler_1.getErrorMessage)(error, 'An error occurred');
        logger_1.logger.error('Ready check vote button handler error', {
            customId: interaction.customId,
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        await interaction.editReply({ content: `❌ ${msg}` });
    }
}
async function handleButton(interaction) {
    const voteAction = parseReadyCheckVoteCustomId(interaction.customId);
    if (voteAction) {
        await handleThreadVoteButton(interaction, voteAction);
        return;
    }
    const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'readycheck');
    if (!sub) {
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const context = await (0, guildContext_1.resolveGuildContext)(interaction);
        if (!context) {
            return;
        }
        const config = BUTTON_CONFIG[sub];
        if (!config) {
            return;
        }
        const row = await buildActivitySelectMenu(context.organizationId, config.customId, 'Select an activity...');
        if (!row) {
            await interaction.editReply('No upcoming activities found.');
            return;
        }
        await interaction.editReply({
            content: config.prompt,
            components: [row],
        });
    }
    catch (error) {
        const msg = (0, errorHandler_1.getErrorMessage)(error, 'An error occurred');
        logger_1.logger.error('Ready check button handler error', {
            sub,
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        await interaction.editReply({ content: `❌ ${msg}` });
    }
}
async function replySelectError(interaction, delivery, message) {
    if (delivery === 'reply') {
        await interaction.reply({
            content: message,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.editReply(message);
}
async function resolveSelectContext(interaction, activityId, delivery) {
    const context = await (0, guildContext_1.resolveGuildContext)(interaction);
    if (!context) {
        return null;
    }
    const activity = await getActivityService().getActivityById(activityId);
    if (activity?.organizationId !== context.organizationId) {
        await replySelectError(interaction, delivery, '❌ Activity not found in this server.');
        return null;
    }
    const activityTitle = activity.title ?? 'Untitled Activity';
    const internalUserId = await resolveInternalUserId(interaction.user.id);
    if (!internalUserId) {
        await replySelectError(interaction, delivery, '❌ Your Discord account is not linked. Please link your account on the web app first.');
        return null;
    }
    const userName = await resolveUserName(interaction.user.id, interaction.user.displayName || interaction.user.username);
    return {
        interaction,
        activityId,
        activityTitle,
        orgId: context.organizationId,
        userId: internalUserId,
        userName,
    };
}
async function handleStartSelect(ctx) {
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(buildReadycheckDurationModalCustomId(ctx.activityId))
        .setTitle('Ready Check Duration');
    const durationInput = new discord_js_1.TextInputBuilder()
        .setCustomId('duration')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder('120')
        .setRequired(false)
        .setMaxLength(3);
    modal.addLabelComponents(new discord_js_1.LabelBuilder()
        .setLabel('Duration in seconds (30-600, default 120)')
        .setTextInputComponent(durationInput));
    await ctx.interaction.showModal(modal);
}
async function handleStartSelectMenu(interaction, activityId) {
    const { customId } = interaction;
    try {
        const ctx = await resolveSelectContext(interaction, activityId, 'reply');
        if (!ctx) {
            return;
        }
        await handleStartSelect(ctx);
    }
    catch (error) {
        const msg = (0, errorHandler_1.getErrorMessage)(error, 'An error occurred');
        logger_1.logger.error('Ready check start-select handler error', {
            customId,
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: `❌ ${msg}` });
            return;
        }
        await interaction.reply({
            content: `❌ ${msg}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function handleStatusSelect(ctx) {
    const readyCheck = await getReadyCheckService().getActiveReadyCheck(ctx.activityId);
    if (!readyCheck) {
        await ctx.interaction.editReply('ℹ️ No active ready check for this activity.');
        return;
    }
    const publicData = readyCheck;
    const responses = Object.values((publicData.responses ?? {}));
    const readyCount = responses.filter(r => r.response === 'ready').length;
    const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
    const pendingCount = responses.filter(r => r.response === 'pending').length;
    const embedData = {
        ...publicData,
        responses: Object.values(publicData.responses),
        readyCount,
        notReadyCount,
        pendingCount,
        totalParticipants: publicData.totalParticipants,
    };
    const embed = buildReadyCheckStatusEmbed(embedData);
    embed.setDescription(`**${ctx.activityTitle}**`);
    await ctx.interaction.editReply({ embeds: [embed] });
}
async function handleCancelSelect(ctx) {
    await getReadyCheckService().cancelReadyCheck(ctx.activityId, ctx.userId, ctx.userName);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.WARNING)
        .setTitle('🛑 Ready Check Cancelled')
        .setDescription(`**${ctx.activityTitle}**`)
        .addFields({ name: 'Cancelled by', value: ctx.userName, inline: true })
        .setTimestamp();
    await ctx.interaction.editReply({ embeds: [embed] });
    (0, realtimeEmit_1.emitRealtimeToOrg)(ctx.orgId, 'activity:ready_check_cancelled', {
        activityId: ctx.activityId,
        cancelledBy: ctx.userId,
    });
}
async function handleSelectMenu(interaction) {
    const { customId } = interaction;
    const activityId = interaction.values[0];
    if (customId === 'readycheck_start_select') {
        await handleStartSelectMenu(interaction, activityId);
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const ctx = await resolveSelectContext(interaction, activityId, 'editReply');
        if (!ctx) {
            return;
        }
        if (customId.startsWith('readycheck_respond_')) {
            await interaction.editReply({
                content: 'ℹ️ Ready-check responses are now thread-first. Use the **Yes/No** buttons in the event thread.',
            });
        }
        else if (customId === 'readycheck_status_select') {
            await handleStatusSelect(ctx);
        }
        else if (customId === 'readycheck_cancel_select') {
            await handleCancelSelect(ctx);
        }
    }
    catch (error) {
        const msg = (0, errorHandler_1.getErrorMessage)(error, 'An error occurred');
        logger_1.logger.error('Ready check select menu handler error', {
            customId,
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        await interaction.editReply({ content: `❌ ${msg}` });
    }
}
async function handleModal(interaction) {
    const { customId } = interaction;
    const activityId = parseReadycheckDurationModalActivityId(customId);
    if (!activityId) {
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const context = await (0, guildContext_1.resolveGuildContext)(interaction);
        if (!context) {
            return;
        }
        const internalUserId = await resolveInternalUserId(interaction.user.id);
        if (!internalUserId) {
            await interaction.editReply('❌ Your Discord account is not linked. Please link your account on the web app first.');
            return;
        }
        const userName = await resolveUserName(interaction.user.id, interaction.user.displayName || interaction.user.username);
        const durationRaw = interaction.fields.getTextInputValue('duration').trim();
        const durationSeconds = durationRaw ? Number.parseInt(durationRaw, 10) : 120;
        if (durationRaw &&
            (Number.isNaN(durationSeconds) || durationSeconds < 30 || durationSeconds > 600)) {
            await interaction.editReply('❌ Duration must be a number between 30 and 600 seconds.');
            return;
        }
        const service = getReadyCheckService();
        const readyCheck = await service.initiateReadyCheck(activityId, context.organizationId, internalUserId, userName, durationSeconds);
        const expiresAt = new Date(readyCheck.expiresAt);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedBuilder_1.EmbedColors.SUCCESS)
            .setTitle('🚀 Ready Check Started!')
            .setDescription(`**${readyCheck.activityTitle}**`)
            .addFields({ name: 'Participants', value: String(readyCheck.totalParticipants), inline: true }, { name: 'Duration', value: `${durationSeconds}s`, inline: true }, {
            name: 'Expires',
            value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
            inline: true,
        }, { name: 'Initiated by', value: userName, inline: true })
            .setFooter({ text: 'Participants have been notified. Use /readycheck to respond.' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        (0, realtimeEmit_1.emitRealtimeToOrg)(context.organizationId, 'activity:ready_check_initiated', {
            activityId,
            readyCheckId: readyCheck.id,
            initiatedBy: internalUserId,
            durationSeconds,
        });
        logger_1.logger.info('Ready check initiated via Discord', {
            activityId,
            readyCheckId: readyCheck.id,
            guildId: context.guildId,
            userId: internalUserId,
        });
    }
    catch (error) {
        const msg = (0, errorHandler_1.getErrorMessage)(error, 'An error occurred');
        logger_1.logger.error('Ready check modal handler error', {
            customId,
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        await interaction.editReply({ content: `❌ ${msg}` });
    }
}
exports.readycheck = {
    data,
    execute,
    cooldown: 5,
    category: 'events',
    guildOnly: true,
    handleButton,
    handleSelectMenu,
    handleModal,
};
//# sourceMappingURL=readycheck.js.map