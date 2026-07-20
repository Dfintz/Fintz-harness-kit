"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRelay = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const discord_js_1 = require("discord.js");
const rateLimitPolicy_1 = require("../services/shared/rateLimitPolicy");
const logger_1 = require("../utils/logger");
const tunnelWebSocketController_1 = require("../websocket/controllers/tunnelWebSocketController");
const contentFilter_1 = require("./utils/contentFilter");
const discord_1 = require("./utils/discord");
const tunnelRateLimiter_1 = require("./utils/tunnelRateLimiter");
class MessageRelay {
    client;
    tunnelService;
    contentFilter;
    rateLimiter;
    webhookCache = new Map();
    static WEBHOOK_TTL_MS = 30 * 60_000;
    webhookEvictionInterval = null;
    initialized = false;
    onMessageCreate = message => {
        void this.handleMessage(message);
    };
    onMessageUpdate = (oldMessage, newMessage) => {
        void this.handleMessageUpdate(oldMessage, newMessage);
    };
    onMessageReactionAdd = (reaction, user, _details) => {
        void this.handleReactionAdd(reaction, user);
    };
    onMessageReactionRemove = (reaction, user, _details) => {
        void this.handleReactionRemove(reaction, user);
    };
    constructor(client, tunnelService) {
        this.client = client;
        this.tunnelService = tunnelService;
        this.contentFilter = contentFilter_1.ContentFilter.getInstance();
        this.rateLimiter = tunnelRateLimiter_1.TunnelRateLimiter.getInstance();
    }
    evictStaleWebhooks() {
        const now = Date.now();
        for (const [url, entry] of this.webhookCache) {
            if (now - entry.lastUsed > MessageRelay.WEBHOOK_TTL_MS) {
                this.webhookCache.delete(url);
            }
        }
    }
    getOrCreateWebhook(url) {
        const cached = this.webhookCache.get(url);
        if (cached) {
            cached.lastUsed = Date.now();
            return cached.client;
        }
        const wh = new discord_js_1.WebhookClient({ url });
        this.webhookCache.set(url, { client: wh, lastUsed: Date.now() });
        return wh;
    }
    async autoCreateChannelWebhook(tunnelId, channelId) {
        try {
            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            if (!channel?.isTextBased() || !('createWebhook' in channel)) {
                return undefined;
            }
            const textChannel = channel;
            if (!(0, discord_1.checkBotChannelPermissions)(textChannel, discord_js_1.PermissionFlagsBits.ManageWebhooks)) {
                logger_1.logger.debug(`MessageRelay: Missing ManageWebhooks in channel ${channelId}, skipping auto-create`);
                return undefined;
            }
            const existingWebhooks = await textChannel.fetchWebhooks();
            const botWebhook = existingWebhooks.find(wh => wh.owner?.id === this.client.user?.id && wh.name === 'Tunnel Relay');
            if (botWebhook?.url) {
                void this.tunnelService.updateWebhook(tunnelId, channelId, botWebhook.url);
                return botWebhook.url;
            }
            const webhook = await textChannel.createWebhook({
                name: 'Tunnel Relay',
                reason: 'Auto-created for cross-org tunnel message relay',
            });
            void this.tunnelService.updateWebhook(tunnelId, channelId, webhook.url);
            logger_1.logger.info(`Auto-created webhook for tunnel relay in channel ${channelId}`);
            return webhook.url;
        }
        catch (error) {
            logger_1.logger.warn(`Failed to auto-create webhook in channel ${channelId}:`, error);
            return undefined;
        }
    }
    initialize() {
        if (this.initialized) {
            return;
        }
        this.client.on('messageCreate', this.onMessageCreate);
        this.client.on('messageUpdate', this.onMessageUpdate);
        this.client.on('messageReactionAdd', this.onMessageReactionAdd);
        this.client.on('messageReactionRemove', this.onMessageReactionRemove);
        this.webhookEvictionInterval = setInterval(() => this.evictStaleWebhooks(), MessageRelay.WEBHOOK_TTL_MS);
        if (typeof this.webhookEvictionInterval.unref === 'function') {
            this.webhookEvictionInterval.unref();
        }
        this.initialized = true;
    }
    dispose() {
        if (this.initialized) {
            this.client.off('messageCreate', this.onMessageCreate);
            this.client.off('messageUpdate', this.onMessageUpdate);
            this.client.off('messageReactionAdd', this.onMessageReactionAdd);
            this.client.off('messageReactionRemove', this.onMessageReactionRemove);
            this.initialized = false;
        }
        if (this.webhookEvictionInterval) {
            clearInterval(this.webhookEvictionInterval);
            this.webhookEvictionInterval = null;
        }
        this.webhookCache.clear();
    }
    async handleMessage(message) {
        if (!message.content && message.attachments.size === 0 && message.stickers.size === 0) {
            return;
        }
        if (message.type !== discord_js_1.MessageType.Default && message.type !== discord_js_1.MessageType.Reply) {
            return;
        }
        const tunnel = await this.tunnelService.findTunnelByChannelAsync(message.channel.id);
        if (!tunnel) {
            return;
        }
        if (message.webhookId || message.author.id === this.client.user?.id) {
            return;
        }
        if (message.author.bot && !tunnel.allowBotMessages) {
            return;
        }
        const alreadyRelayed = await this.tunnelService.getRelayedMessageIds(message.id);
        if (alreadyRelayed && Object.keys(alreadyRelayed).length > 0) {
            logger_1.logger.debug(`Skipping already-relayed message ${message.id} (duplicate delivery)`);
            return;
        }
        if (tunnel.contentFilterEnabled && message.content) {
            const filterResult = this.contentFilter.filterMessage(message.content, message.author.id);
            if (!filterResult.allowed) {
                await this.sendFilterWarning(message, filterResult.reason ?? 'Message blocked');
                logger_1.logger.warn(`Message from ${message.author.username} blocked in tunnel ${tunnel.id}: ` +
                    `${filterResult.reason} (severity: ${filterResult.severity})`);
                return;
            }
        }
        const rateLimitResult = this.rateLimiter.checkRateLimit(tunnel.id, message.author.id);
        if (!rateLimitResult.allowed) {
            await this.sendRateLimitWarning(message, rateLimitResult);
            logger_1.logger.warn(`Rate limit exceeded for ${message.author.username} in tunnel ${tunnel.id}`);
            return;
        }
        this.rateLimiter.recordMessage(tunnel.id, message.author.id);
        if (tunnel.rateLimitConfig) {
            this.rateLimiter.setTunnelConfig(tunnel.id, tunnel.rateLimitConfig);
        }
        await this.relayAndPersist(message, tunnel);
    }
    async handleMessageUpdate(_oldMessage, newMessage) {
        let message;
        try {
            message = newMessage.partial ? await newMessage.fetch() : newMessage;
        }
        catch {
            return;
        }
        if (message.author.bot) {
            return;
        }
        if (!message.content) {
            return;
        }
        const tunnel = await this.tunnelService.findTunnelByChannelAsync(message.channel.id);
        if (!tunnel) {
            return;
        }
        const relayedIds = await this.tunnelService.getRelayedMessageIds(message.id);
        if (!relayedIds) {
            void this.tunnelService.updateMessageContent(message.id, message.content);
            return;
        }
        void this.tunnelService.updateMessageContent(message.id, message.content);
        const connectedChannels = this.tunnelService.getConnectedChannels(tunnel.id, message.channel.id);
        for (const connection of connectedChannels) {
            const relayedMessageId = relayedIds[connection.channelId];
            if (!relayedMessageId || !connection.webhookUrl) {
                continue;
            }
            try {
                await this.editRelayedMessage(connection.webhookUrl, relayedMessageId, message);
            }
            catch (error) {
                logger_1.logger.error(`Failed to edit relayed message in channel ${connection.channelId}:`, error);
            }
        }
        logger_1.logger.debug(`Message edit relayed in tunnel ${tunnel.id} by ${message.author.username}`);
    }
    async editRelayedMessage(webhookUrl, messageId, originalMessage) {
        const webhook = this.getOrCreateWebhook(webhookUrl);
        const replyPrefix = await this.buildReplyPrefix(originalMessage);
        const content = replyPrefix + (originalMessage.content || '');
        try {
            await webhook.editMessage(messageId, {
                content: content || undefined,
                allowedMentions: { parse: ['users'] },
            });
        }
        catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (code === 10008) {
                logger_1.logger.debug(`Relayed message ${messageId} was deleted — skipping edit`);
                return;
            }
            throw error;
        }
    }
    async relayAndPersist(message, tunnel) {
        const connectedChannels = this.tunnelService.getConnectedChannels(tunnel.id, message.channel.id);
        const relayedMessageIds = {};
        for (const connection of connectedChannels) {
            try {
                const webhookMessageId = await this.relayMessage(message, connection.webhookUrl, tunnel.name, tunnel.id, connection.channelId);
                if (webhookMessageId) {
                    relayedMessageIds[connection.channelId] = webhookMessageId;
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to relay message to ${connection.channelId}:`, error);
            }
        }
        try {
            (0, tunnelWebSocketController_1.emitTunnelMessage)(tunnel.id, {
                id: node_crypto_1.default.randomUUID(),
                tunnelId: tunnel.id,
                authorId: message.author.id,
                authorName: message.author.username,
                authorAvatar: message.author.displayAvatarURL(),
                content: message.content || undefined,
                attachments: message.attachments.map(a => ({
                    url: a.url,
                    filename: a.name,
                    contentType: a.contentType ?? undefined,
                    size: a.size,
                })),
                isBot: message.author.bot,
                timestamp: Date.now(),
                guildId: message.guild?.id,
            });
        }
        catch (error) {
            logger_1.logger.debug('Failed to emit tunnel message to Socket.IO room:', error);
        }
        this.tunnelService.recordMessageRelay(tunnel.id, false, message.author.id);
        if (Object.keys(relayedMessageIds).length > 0) {
            void this.tunnelService.storeRelayedMessageIds(message.id, relayedMessageIds, message.channel.id);
        }
        void this.tunnelService.saveMessage({
            id: node_crypto_1.default.randomUUID(),
            tunnelId: tunnel.id,
            authorId: message.author.id,
            authorName: message.author.username,
            authorAvatar: message.author.displayAvatarURL(),
            sourceGuildId: message.guild?.id,
            sourceChannelId: message.channel.id,
            discordMessageId: message.id,
            content: message.content || undefined,
            attachments: message.attachments.map(a => ({
                url: a.url,
                filename: a.name,
                contentType: a.contentType ?? undefined,
                size: a.size,
            })),
            isBot: message.author.bot,
            timestamp: new Date(),
        });
    }
    truncate(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return `${text.substring(0, maxLength)}…`;
    }
    async buildReplyPrefix(message) {
        if (!message.reference?.messageId || !message.channel || !('messages' in message.channel)) {
            return '';
        }
        try {
            const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
            if (!referencedMsg) {
                return '';
            }
            const refDisplayName = referencedMsg.member?.displayName ?? referencedMsg.author.displayName;
            const replyPreview = this.buildReplyPreview(referencedMsg);
            return `> ┃ ↩️ **${refDisplayName}**\n> ┃ ${replyPreview}\n`;
        }
        catch {
            return '';
        }
    }
    buildReplyPreview(referencedMsg) {
        if (referencedMsg.content) {
            return this.truncate(referencedMsg.content, 60);
        }
        const richEmbed = referencedMsg.embeds.find(e => e.data.type === 'rich');
        if (richEmbed) {
            const parts = [];
            if (richEmbed.title) {
                parts.push(`**${richEmbed.title}**`);
            }
            if (richEmbed.description) {
                parts.push(richEmbed.description);
            }
            else if (richEmbed.fields.length > 0) {
                const firstField = richEmbed.fields[0];
                parts.push(`${firstField.name}: ${firstField.value}`);
            }
            if (parts.length > 0) {
                return this.truncate(parts.join(' — ').replaceAll(/\s+/g, ' '), 80);
            }
            return '*[embed]*';
        }
        if (referencedMsg.attachments.size > 0) {
            const first = referencedMsg.attachments.first();
            return `*[attachment: ${first?.name ?? 'file'}]*`;
        }
        if (referencedMsg.stickers.size > 0) {
            return '*[sticker]*';
        }
        return '*[no preview]*';
    }
    collectFiles(message) {
        const files = message.attachments.map(attachment => ({
            attachment: attachment.url,
            name: attachment.name,
        }));
        for (const sticker of message.stickers.values()) {
            files.push({ attachment: sticker.url, name: 'sticker.png' });
        }
        return files;
    }
    async relayMessage(message, initialWebhookUrl, _tunnelName, tunnelId, channelId) {
        let webhookUrl = initialWebhookUrl;
        if (!webhookUrl) {
            webhookUrl = await this.autoCreateChannelWebhook(tunnelId, channelId);
            if (!webhookUrl) {
                logger_1.logger.warn(`No webhook URL configured for channel ${channelId} and auto-create failed`);
                return undefined;
            }
        }
        try {
            return await this.sendViaWebhook(webhookUrl, message);
        }
        catch (error) {
            const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (errorCode !== 10015) {
                throw error;
            }
            logger_1.logger.warn(`Webhook for channel ${channelId} in tunnel ${tunnelId} is invalid — recreating and retrying`);
            this.webhookCache.delete(webhookUrl);
            const freshWebhookUrl = await this.autoCreateChannelWebhook(tunnelId, channelId);
            if (!freshWebhookUrl) {
                void this.tunnelService.updateWebhook(tunnelId, channelId, '');
                logger_1.logger.error(`Failed to recreate webhook for channel ${channelId} in tunnel ${tunnelId}; message not relayed`);
                return undefined;
            }
            try {
                return await this.sendViaWebhook(freshWebhookUrl, message);
            }
            catch (retryError) {
                logger_1.logger.error(`Retry after webhook recreation failed for channel ${channelId} in tunnel ${tunnelId}:`, retryError);
                return undefined;
            }
        }
    }
    async sendViaWebhook(webhookUrl, message) {
        const webhook = this.getOrCreateWebhook(webhookUrl);
        const displayName = message.member?.displayName ?? message.author.displayName;
        const guildName = message.guild?.name ?? 'Unknown';
        const replyPrefix = await this.buildReplyPrefix(message);
        const content = replyPrefix + (message.content || '');
        const files = this.collectFiles(message);
        const embeds = message.embeds
            .filter(e => e.data.type === 'rich')
            .slice(0, 5)
            .map(e => discord_js_1.EmbedBuilder.from(e));
        const sentMessage = await webhook.send({
            content: content || undefined,
            username: `${displayName} · ${guildName}`,
            avatarURL: message.author.displayAvatarURL({ size: 128 }),
            files: files.length > 0 ? files : undefined,
            embeds: embeds.length > 0 ? embeds : undefined,
            allowedMentions: { parse: ['users'] },
        });
        return sentMessage.id;
    }
    async resolveRelayTargets(messageId, sourceChannelId, tunnelId) {
        const relayedIds = await this.tunnelService.getRelayedMessageIds(messageId);
        if (relayedIds) {
            const connections = this.tunnelService.getConnectedChannels(tunnelId, sourceChannelId);
            const targets = connections
                .map(conn => {
                const relayedMsgId = relayedIds[conn.channelId];
                return relayedMsgId ? { channelId: conn.channelId, messageId: relayedMsgId } : null;
            })
                .filter((t) => t !== null);
            return targets.length > 0 ? { targets } : null;
        }
        const reverse = await this.tunnelService.getOriginalMessageId(messageId);
        if (!reverse) {
            return null;
        }
        const originalRelayedIds = await this.tunnelService.getRelayedMessageIds(reverse.originalId);
        if (!originalRelayedIds) {
            return null;
        }
        const targets = [];
        if (reverse.sourceChannelId && reverse.sourceChannelId !== sourceChannelId) {
            targets.push({ channelId: reverse.sourceChannelId, messageId: reverse.originalId });
        }
        for (const [channelId, relayedMsgId] of Object.entries(originalRelayedIds)) {
            if (channelId !== sourceChannelId) {
                targets.push({ channelId, messageId: relayedMsgId });
            }
        }
        return targets.length > 0 ? { targets } : null;
    }
    async fetchReaction(reaction) {
        if (!reaction.partial) {
            return reaction;
        }
        try {
            return await reaction.fetch();
        }
        catch {
            return null;
        }
    }
    getEmojiDisplay(reaction) {
        return reaction.emoji.id
            ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
            : (reaction.emoji.name ?? '?');
    }
    async addReactionToRelayed(channelId, messageId, reaction) {
        const emojiIdentifier = reaction.emoji.id
            ? `${reaction.emoji.name}:${reaction.emoji.id}`
            : encodeURIComponent(reaction.emoji.name ?? '');
        if (!emojiIdentifier) {
            return;
        }
        await this.client.rest.put(`/channels/${channelId}/messages/${messageId}/reactions/${emojiIdentifier}/@me`);
    }
    async removeReactionFromRelayed(channelId, messageId, reaction) {
        const emojiIdentifier = reaction.emoji.id
            ? `${reaction.emoji.name}:${reaction.emoji.id}`
            : encodeURIComponent(reaction.emoji.name ?? '');
        if (!emojiIdentifier) {
            return;
        }
        await this.client.rest.delete(`/channels/${channelId}/messages/${messageId}/reactions/${emojiIdentifier}/@me`);
    }
    async handleReactionAdd(rawReaction, user) {
        try {
            const reaction = await this.fetchReaction(rawReaction);
            if (!reaction || ('bot' in user && user.bot)) {
                return;
            }
            const tunnel = await this.tunnelService.findTunnelByChannelAsync(reaction.message.channel.id);
            if (!tunnel) {
                return;
            }
            const emoji = this.getEmojiDisplay(reaction);
            const resolved = await this.resolveRelayTargets(reaction.message.id, reaction.message.channel.id, tunnel.id);
            if (resolved) {
                for (const { channelId, messageId } of resolved.targets) {
                    try {
                        await this.addReactionToRelayed(channelId, messageId, reaction);
                    }
                    catch (error) {
                        logger_1.logger.debug(`Failed to relay reaction to channel ${channelId}:`, error);
                    }
                }
            }
            (0, tunnelWebSocketController_1.emitTunnelReactionAdded)(tunnel.id, reaction.message.id, user.id, emoji);
            const analytics = this.tunnelService.getTunnelAnalytics(tunnel.id);
            if (analytics) {
                analytics.reactionsRelayed++;
            }
            logger_1.logger.debug(`Reaction ${emoji} relayed in tunnel ${tunnel.id}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to handle reaction add for tunnel relay:', error);
        }
    }
    async handleReactionRemove(rawReaction, user) {
        try {
            const reaction = await this.fetchReaction(rawReaction);
            if (!reaction || ('bot' in user && user.bot)) {
                return;
            }
            const tunnel = await this.tunnelService.findTunnelByChannelAsync(reaction.message.channel.id);
            if (!tunnel) {
                return;
            }
            const emoji = this.getEmojiDisplay(reaction);
            const resolved = await this.resolveRelayTargets(reaction.message.id, reaction.message.channel.id, tunnel.id);
            if (resolved) {
                for (const { channelId, messageId } of resolved.targets) {
                    try {
                        await this.removeReactionFromRelayed(channelId, messageId, reaction);
                    }
                    catch (error) {
                        logger_1.logger.debug(`Failed to remove relayed reaction in channel ${channelId}:`, error);
                    }
                }
            }
            (0, tunnelWebSocketController_1.emitTunnelReactionRemoved)(tunnel.id, reaction.message.id, user.id, emoji);
            logger_1.logger.debug(`Reaction removal relayed in tunnel ${tunnel.id}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to handle reaction remove for tunnel relay:', error);
        }
    }
    async sendFilterWarning(message, reason) {
        try {
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🚫 Message Blocked')
                .setDescription(`Your message was blocked by the content filter.`)
                .addFields({ name: 'Reason', value: reason })
                .setFooter({ text: 'Please review tunnel guidelines and try again.' })
                .setTimestamp();
            await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }
        catch (error) {
            logger_1.logger.error('Failed to send filter warning:', error);
        }
    }
    async sendRateLimitWarning(message, rateLimitResult) {
        try {
            const resetTime = (0, rateLimitPolicy_1.rateLimitRetryAfterSeconds)(rateLimitResult);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle('⏱️ Rate Limit Exceeded')
                .setDescription(`You're sending messages too quickly in this tunnel.`)
                .addFields({
                name: 'Status',
                value: rateLimitResult.blockedUntil ? '🔒 Temporarily Blocked' : '⚠️ Limit Reached',
                inline: true,
            }, { name: 'Reset In', value: `${resetTime} seconds`, inline: true })
                .setFooter({ text: 'Please slow down and try again later.' })
                .setTimestamp();
            await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }
        catch (error) {
            logger_1.logger.error('Failed to send rate limit warning:', error);
        }
    }
}
exports.MessageRelay = MessageRelay;
//# sourceMappingURL=messageRelay.js.map