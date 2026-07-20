"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTicketChannelConfig = resolveTicketChannelConfig;
exports.openTicketChannel = openTicketChannel;
exports.closeTicketChannel = closeTicketChannel;
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const botApiClient_1 = require("../utils/botApiClient");
const customId_1 = require("../utils/customId");
const issueChannel_1 = require("../utils/issueChannel");
const REDIS_KEY = 'tickets:issueChannels';
function resolveTicketChannelConfig(settingsRows) {
    const configured = (settingsRows ?? []).filter(row => {
        const tk = row.ticketSettings;
        const isChannelEnabled = tk?.ticketChannelEnabled ?? tk?.enabled;
        const channelCategoryId = tk?.ticketChannelCategoryId ?? tk?.defaultCategoryId;
        return Boolean(isChannelEnabled && channelCategoryId && tk?.supportRoleId);
    });
    if (configured.length === 0) {
        return null;
    }
    if (configured.length > 1) {
        logger_1.logger.warn('ticketIssueChannel: ambiguous — multiple org settings rows enable ticket channels for this guild; skipping to avoid cross-org exposure');
        return null;
    }
    const tk = configured[0].ticketSettings;
    return {
        categoryId: tk?.ticketChannelCategoryId ?? tk?.defaultCategoryId ?? '',
        roleId: tk?.supportRoleId ?? '',
        transcriptChannelId: tk?.transcriptChannelId,
        channelNameTemplate: tk?.channelNameTemplate,
    };
}
async function getTrackedChannel(ticketId) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return null;
        }
        const raw = await client.hget(REDIS_KEY, ticketId);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
async function trackChannel(ticketId, entry) {
    try {
        const client = redis_1.redisClient.getClient();
        if (!client) {
            return;
        }
        await client.hset(REDIS_KEY, ticketId, JSON.stringify(entry));
    }
    catch (error) {
        logger_1.logger.warn('ticketIssueChannel: failed to persist channel mapping', {
            error: error instanceof Error ? error.message : 'unknown',
        });
    }
}
async function untrackChannel(ticketId) {
    try {
        const client = redis_1.redisClient.getClient();
        if (client) {
            await client.hdel(REDIS_KEY, ticketId);
        }
    }
    catch {
    }
}
function topicMarker(ticketId) {
    return `ticket:${ticketId}`;
}
function findChannelIdByTopic(guild, ticketId) {
    const marker = topicMarker(ticketId);
    const match = guild.channels.cache.find(ch => ch instanceof discord_js_1.TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker));
    return match?.id ?? null;
}
async function findChannelIdByTopicDurable(guild, ticketId) {
    const cached = findChannelIdByTopic(guild, ticketId);
    if (cached) {
        return cached;
    }
    try {
        const fetched = await guild.channels.fetch();
        const marker = topicMarker(ticketId);
        const match = fetched.find(ch => ch instanceof discord_js_1.TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker));
        return match?.id ?? null;
    }
    catch {
        return null;
    }
}
function getCategoryEmoji(category) {
    const categoryEmojiMap = {
        hr: '👥',
        recruitment: '📋',
        diplomacy: '🤝',
        general: '💬',
        support: '🔧',
        technical: '🔧',
    };
    return categoryEmojiMap[category] ?? '🎫';
}
function resolveChannelName(ticketNumber, category, member, template = '{category}-ticket-{number}') {
    const username = member?.user.username ?? member?.displayName ?? 'user';
    const categoryLabel = category.toLowerCase();
    const countMatch = /(\d+)$/.exec(ticketNumber);
    const count = countMatch ? String(Number.parseInt(countMatch[1], 10)) : ticketNumber;
    return (0, issueChannel_1.sanitizeChannelName)(template
        .replaceAll('{number}', ticketNumber)
        .replaceAll('{count}', count)
        .replaceAll('{user}', username)
        .replaceAll('{category}', categoryLabel));
}
async function fetchTicketDetails(guildId, ticketNumber, initiatorId) {
    try {
        const response = await botApiClient_1.botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
            headers: {
                'X-Discord-Guild-Id': guildId,
                'X-Discord-User-Id': initiatorId,
            },
        });
        const body = response.data;
        const ticket = body.data ?? body;
        return {
            ticketNumber: ticket.ticketNumber ?? ticketNumber,
            subject: ticket.subject ?? '',
            description: ticket.description ?? '',
            priority: (ticket.priority ?? 'medium').toLowerCase(),
            status: (ticket.status ?? 'open').toLowerCase(),
            category: (ticket.category ?? 'general').toLowerCase(),
            createdAt: ticket.createdAt ?? new Date().toISOString(),
        };
    }
    catch (error) {
        logger_1.logger.warn('ticketIssueChannel: failed to fetch ticket details', {
            error: error instanceof Error ? error.message : 'unknown',
            ticketNumber,
            guildId,
        });
        return null;
    }
}
function buildTicketEmbed(ticket) {
    const normalizedPriority = ticket.priority.toLowerCase();
    const normalizedStatus = ticket.status.toLowerCase();
    const categoryEmoji = getCategoryEmoji(ticket.category);
    let priorityEmoji = '🟢';
    if (normalizedPriority === 'high') {
        priorityEmoji = '🔴';
    }
    else if (normalizedPriority === 'medium') {
        priorityEmoji = '🟡';
    }
    let statusColor = 0x00ff88;
    if (normalizedStatus === 'open') {
        statusColor = 0x00d9ff;
    }
    else if (normalizedStatus === 'in_progress') {
        statusColor = 0xffa500;
    }
    return {
        color: statusColor,
        title: `${categoryEmoji} Ticket ${ticket.ticketNumber}`,
        description: `**${ticket.subject}**`,
        fields: [
            {
                name: 'Category',
                value: `${categoryEmoji} ${ticket.category.toUpperCase()}`,
                inline: true,
            },
            {
                name: 'Priority',
                value: `${priorityEmoji} ${normalizedPriority.toUpperCase()}`,
                inline: true,
            },
            {
                name: 'Status',
                value: `\`${normalizedStatus.toUpperCase()}\``,
                inline: true,
            },
            {
                name: 'Description',
                value: ticket.description.length > 1024
                    ? `${ticket.description.slice(0, 1021)}...`
                    : ticket.description || '*No description provided*',
                inline: false,
            },
        ],
        footer: {
            text: `Created: ${new Date(ticket.createdAt).toLocaleString()}`,
        },
    };
}
function buildActionButtons(ticketNumber) {
    const resolveButtonId = (0, customId_1.buildCustomId)('ticket', 'resolve', ticketNumber);
    const closeButtonId = (0, customId_1.buildCustomId)('ticket', 'close', ticketNumber);
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(resolveButtonId)
        .setLabel('✓ Resolve')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('✅'), new discord_js_1.ButtonBuilder()
        .setCustomId(closeButtonId)
        .setLabel('✕ Close')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('❌'));
}
async function openTicketChannel(guild, ticketId, ticketNumber, initiatorId, category, hint) {
    try {
        const settingsRows = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guild.id);
        const config = resolveTicketChannelConfig(settingsRows);
        if (!config) {
            return;
        }
        const alreadyOpen = (await getTrackedChannel(ticketId)) !== null ||
            (await findChannelIdByTopicDurable(guild, ticketId)) !== null;
        if (alreadyOpen) {
            return;
        }
        const member = await guild.members.fetch(initiatorId).catch(() => null);
        const channelName = resolveChannelName(ticketNumber, category, member, config.channelNameTemplate);
        const channel = await (0, issueChannel_1.createIssueChannel)(guild, {
            initiatorId,
            roleId: config.roleId,
            categoryId: config.categoryId,
            name: channelName,
            topic: `Support ticket ${ticketNumber} • ${topicMarker(ticketId)} • opened by <@${initiatorId}>`,
            reason: `Support ticket ${ticketNumber}`,
        });
        if (!channel) {
            return;
        }
        await trackChannel(ticketId, { channelId: channel.id, guildId: guild.id });
        const details = await fetchTicketDetails(guild.id, ticketNumber, initiatorId);
        const hintedSubject = hint?.subject?.trim();
        const fallbackSubject = hintedSubject && hintedSubject.length > 0 ? hintedSubject : `Ticket ${ticketNumber}`;
        const fallbackDescription = hint?.description?.trim();
        const fallbackCategory = (hint?.category ?? category).toUpperCase();
        let fallbackDescriptionLine;
        if (fallbackDescription) {
            const preview = fallbackDescription.length > 300
                ? `${fallbackDescription.slice(0, 297)}...`
                : fallbackDescription;
            fallbackDescriptionLine = `**Description:** ${preview}`;
        }
        const openingEmbed = details
            ? buildTicketEmbed(details)
            : {
                color: 0x00d9ff,
                title: `🎫 ${fallbackSubject}`,
                description: [
                    `This private channel is for coordinating ticket **${ticketNumber}**.`,
                    '',
                    `**Category:** ${fallbackCategory}`,
                    fallbackDescriptionLine,
                    '',
                    'Only the opener and the support team can see this channel. It will be deleted when the ticket is closed.',
                ]
                    .filter((line) => Boolean(line))
                    .join('\n'),
                footer: { text: `Ticket ID: ${ticketId}` },
            };
        await channel.send({
            content: `<@&${config.roleId}> — new ticket <@${initiatorId}> needs help.`,
            embeds: [openingEmbed],
            components: [buildActionButtons(ticketNumber)],
        });
        logger_1.logger.info('ticketIssueChannel: opened channel', {
            ticketId,
            ticketNumber,
            channelId: channel.id,
            guildId: guild.id,
        });
    }
    catch (error) {
        logger_1.logger.warn('ticketIssueChannel: failed to open channel', {
            error: error instanceof Error ? error.message : 'unknown',
            ticketId,
        });
    }
}
async function closeTicketChannel(guild, ticketId, ticketNumber) {
    try {
        const tracked = await getTrackedChannel(ticketId);
        const channelId = tracked?.channelId ?? (await findChannelIdByTopicDurable(guild, ticketId));
        if (channelId) {
            await (0, issueChannel_1.deleteIssueChannel)(guild, channelId, `Ticket ${ticketNumber} closed`);
            logger_1.logger.info('ticketIssueChannel: closed channel', {
                ticketId,
                ticketNumber,
                channelId,
                guildId: guild.id,
            });
        }
        await untrackChannel(ticketId);
    }
    catch (error) {
        logger_1.logger.warn('ticketIssueChannel: failed to close channel', {
            error: error instanceof Error ? error.message : 'unknown',
            ticketId,
        });
    }
}
//# sourceMappingURL=ticketIssueChannel.js.map