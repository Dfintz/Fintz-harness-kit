import crypto from 'node:crypto';

import {
  Client,
  ClientEvents,
  EmbedBuilder,
  Message,
  MessageReaction,
  MessageReactionEventDetails,
  MessageType,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  PermissionFlagsBits,
  TextChannel,
  User,
  WebhookClient,
} from 'discord.js';

import type { Tunnel } from '../services/discord/TunnelService';
import { TunnelService } from '../services/discord/TunnelService';
import { rateLimitRetryAfterSeconds } from '../services/shared/rateLimitPolicy';
import { logger } from '../utils/logger';
import {
  emitTunnelMessage,
  emitTunnelReactionAdded,
  emitTunnelReactionRemoved,
} from '../websocket/controllers/tunnelWebSocketController';

import { ContentFilter } from './utils/contentFilter';
import { checkBotChannelPermissions } from './utils/discord';
import { RateLimitResult, TunnelRateLimiter } from './utils/tunnelRateLimiter';

export class MessageRelay {
  private readonly client: Client;
  private readonly tunnelService: TunnelService;
  private readonly contentFilter: ContentFilter;
  private readonly rateLimiter: TunnelRateLimiter;
  private readonly webhookCache = new Map<string, { client: WebhookClient; lastUsed: number }>();
  private static readonly WEBHOOK_TTL_MS = 30 * 60_000; // 30 minutes
  private webhookEvictionInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  private readonly onMessageCreate: (...args: ClientEvents['messageCreate']) => void = message => {
    void this.handleMessage(message);
  };

  private readonly onMessageUpdate: (...args: ClientEvents['messageUpdate']) => void = (
    oldMessage,
    newMessage
  ) => {
    void this.handleMessageUpdate(oldMessage, newMessage);
  };

  private readonly onMessageReactionAdd = (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    _details: MessageReactionEventDetails
  ): void => {
    void this.handleReactionAdd(reaction, user);
  };

  private readonly onMessageReactionRemove = (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    _details: MessageReactionEventDetails
  ): void => {
    void this.handleReactionRemove(reaction, user);
  };

  constructor(client: Client, tunnelService: TunnelService) {
    this.client = client;
    this.tunnelService = tunnelService;
    this.contentFilter = ContentFilter.getInstance();
    this.rateLimiter = TunnelRateLimiter.getInstance();
  }

  private evictStaleWebhooks(): void {
    const now = Date.now();
    for (const [url, entry] of this.webhookCache) {
      if (now - entry.lastUsed > MessageRelay.WEBHOOK_TTL_MS) {
        this.webhookCache.delete(url);
      }
    }
  }

  private getOrCreateWebhook(url: string): WebhookClient {
    const cached = this.webhookCache.get(url);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.client;
    }
    const wh = new WebhookClient({ url });
    this.webhookCache.set(url, { client: wh, lastUsed: Date.now() });
    return wh;
  }

  /**
   * Auto-create a Discord webhook in a channel if the bot has ManageWebhooks.
   * Returns the webhook URL or undefined if creation fails.
   * Persists the URL to TunnelService so it's reused on subsequent messages.
   */
  private async autoCreateChannelWebhook(
    tunnelId: string,
    channelId: string
  ): Promise<string | undefined> {
    try {
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased() || !('createWebhook' in channel)) {
        return undefined;
      }

      const textChannel = channel as TextChannel;
      if (!checkBotChannelPermissions(textChannel, PermissionFlagsBits.ManageWebhooks)) {
        logger.debug(
          `MessageRelay: Missing ManageWebhooks in channel ${channelId}, skipping auto-create`
        );
        return undefined;
      }

      // Check for an existing bot-managed webhook first to avoid creating duplicates
      const existingWebhooks = await textChannel.fetchWebhooks();
      const botWebhook = existingWebhooks.find(
        wh => wh.owner?.id === this.client.user?.id && wh.name === 'Tunnel Relay'
      );
      if (botWebhook?.url) {
        void this.tunnelService.updateWebhook(tunnelId, channelId, botWebhook.url);
        return botWebhook.url;
      }

      const webhook = await textChannel.createWebhook({
        name: 'Tunnel Relay',
        reason: 'Auto-created for cross-org tunnel message relay',
      });

      // Persist so future messages reuse the webhook
      void this.tunnelService.updateWebhook(tunnelId, channelId, webhook.url);
      logger.info(`Auto-created webhook for tunnel relay in channel ${channelId}`);
      return webhook.url;
    } catch (error) {
      logger.warn(`Failed to auto-create webhook in channel ${channelId}:`, error);
      return undefined;
    }
  }

  /**
   * Initialize message relay listener
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.client.on('messageCreate', this.onMessageCreate);
    this.client.on('messageUpdate', this.onMessageUpdate);
    this.client.on(
      'messageReactionAdd',
      this.onMessageReactionAdd as unknown as (...args: unknown[]) => void
    );
    this.client.on(
      'messageReactionRemove',
      this.onMessageReactionRemove as unknown as (...args: unknown[]) => void
    );

    this.webhookEvictionInterval = setInterval(
      () => this.evictStaleWebhooks(),
      MessageRelay.WEBHOOK_TTL_MS
    );
    if (typeof this.webhookEvictionInterval.unref === 'function') {
      this.webhookEvictionInterval.unref();
    }

    this.initialized = true;
  }

  /**
   * Release runtime resources used by this relay.
   * Safe to call multiple times.
   */
  public dispose(): void {
    if (this.initialized) {
      this.client.off('messageCreate', this.onMessageCreate);
      this.client.off('messageUpdate', this.onMessageUpdate);
      this.client.off(
        'messageReactionAdd',
        this.onMessageReactionAdd as unknown as (...args: unknown[]) => void
      );
      this.client.off(
        'messageReactionRemove',
        this.onMessageReactionRemove as unknown as (...args: unknown[]) => void
      );
      this.initialized = false;
    }

    if (this.webhookEvictionInterval) {
      clearInterval(this.webhookEvictionInterval);
      this.webhookEvictionInterval = null;
    }
    this.webhookCache.clear();
  }

  /**
   * Handle incoming messages and relay to connected channels
   */
  private async handleMessage(message: Message) {
    // Ignore messages without content, attachments, or stickers
    if (!message.content && message.attachments.size === 0 && message.stickers.size === 0) {
      return;
    }

    // Ignore system messages (joins, pins, boosts, etc.)
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
      return;
    }

    // Check if message is from a channel connected to a tunnel
    const tunnel = await this.tunnelService.findTunnelByChannelAsync(message.channel.id);
    if (!tunnel) {
      return;
    }

    // Ignore webhook-origin messages and messages authored by this bot to prevent loops.
    if (message.webhookId || message.author.id === this.client.user?.id) {
      return;
    }

    // Respect per-tunnel bot relay config for third-party bot/system messages.
    if (message.author.bot && !tunnel.allowBotMessages) {
      return;
    }

    // Idempotency guard (B7): skip if this exact source message was already
    // relayed. Discord can re-deliver the same `messageCreate` (e.g. a gateway
    // RESUME replaying buffered events after a brief disconnect); without this
    // check the message would be cross-posted twice. The relayed-id mapping is
    // written after a successful relay, so its presence means "already done".
    // Edits/deletes use the same mapping separately — this only guards the
    // initial relay.
    const alreadyRelayed = await this.tunnelService.getRelayedMessageIds(message.id);
    if (alreadyRelayed && Object.keys(alreadyRelayed).length > 0) {
      logger.debug(`Skipping already-relayed message ${message.id} (duplicate delivery)`);
      return;
    }

    // Apply content filter if enabled
    if (tunnel.contentFilterEnabled && message.content) {
      const filterResult = this.contentFilter.filterMessage(message.content, message.author.id);

      if (!filterResult.allowed) {
        await this.sendFilterWarning(message, filterResult.reason ?? 'Message blocked');
        logger.warn(
          `Message from ${message.author.username} blocked in tunnel ${tunnel.id}: ` +
            `${filterResult.reason} (severity: ${filterResult.severity})`
        );
        return;
      }
    }

    // Check rate limit
    const rateLimitResult = this.rateLimiter.checkRateLimit(tunnel.id, message.author.id);

    if (!rateLimitResult.allowed) {
      await this.sendRateLimitWarning(message, rateLimitResult);
      logger.warn(`Rate limit exceeded for ${message.author.username} in tunnel ${tunnel.id}`);
      return;
    }

    // Record message for rate limiting
    this.rateLimiter.recordMessage(tunnel.id, message.author.id);

    // Update tunnel rate limit config if specified
    if (tunnel.rateLimitConfig) {
      this.rateLimiter.setTunnelConfig(tunnel.id, tunnel.rateLimitConfig);
    }

    await this.relayAndPersist(message, tunnel);
  }

  /**
   * Handle Discord message edits and propagate to connected channels
   */
  private async handleMessageUpdate(
    _oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
  ) {
    // Fetch full message if partial (Discord may send partial for uncached messages)
    let message: Message;
    try {
      message = newMessage.partial ? await newMessage.fetch() : newMessage;
    } catch {
      return; // Message was deleted before we could fetch it
    }

    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    // Only handle text edits (content changes)
    if (!message.content) {
      return;
    }

    // Check if this channel is in a tunnel
    const tunnel = await this.tunnelService.findTunnelByChannelAsync(message.channel.id);
    if (!tunnel) {
      return;
    }

    // Look up the relayed webhook message IDs from Redis
    const relayedIds = await this.tunnelService.getRelayedMessageIds(message.id);
    if (!relayedIds) {
      // No relay mapping found — message too old or Redis unavailable
      // Still update DB content for history accuracy
      void this.tunnelService.updateMessageContent(message.id, message.content);
      return;
    }

    // Update the persisted message content (single query, non-blocking)
    void this.tunnelService.updateMessageContent(message.id, message.content);

    // Propagate edit to all connected channels via webhooks
    const connectedChannels = this.tunnelService.getConnectedChannels(
      tunnel.id,
      message.channel.id
    );

    for (const connection of connectedChannels) {
      const relayedMessageId = relayedIds[connection.channelId];
      if (!relayedMessageId || !connection.webhookUrl) {
        continue;
      }

      try {
        await this.editRelayedMessage(connection.webhookUrl, relayedMessageId, message);
      } catch (error) {
        logger.error(`Failed to edit relayed message in channel ${connection.channelId}:`, error);
      }
    }

    logger.debug(`Message edit relayed in tunnel ${tunnel.id} by ${message.author.username}`);
  }

  /**
   * Edit a previously relayed webhook message
   */
  private async editRelayedMessage(
    webhookUrl: string,
    messageId: string,
    originalMessage: Message
  ): Promise<void> {
    const webhook = this.getOrCreateWebhook(webhookUrl);
    const replyPrefix = await this.buildReplyPrefix(originalMessage);
    const content = replyPrefix + (originalMessage.content || '');

    try {
      await webhook.editMessage(messageId, {
        content: content || undefined,
        allowedMentions: { parse: ['users'] },
      });
    } catch (error: unknown) {
      // 10008 = Unknown Message — original webhook message was deleted, skip silently
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 10008) {
        logger.debug(`Relayed message ${messageId} was deleted — skipping edit`);
        return;
      }
      throw error;
    }
  }

  /**
   * Relay a Discord message to connected channels, emit to Socket.IO, and persist for history.
   */
  private async relayAndPersist(message: Message, tunnel: Tunnel): Promise<void> {
    // Get all connected channels except the source
    const connectedChannels = this.tunnelService.getConnectedChannels(
      tunnel.id,
      message.channel.id
    );

    // Track relayed webhook message IDs for edit/delete propagation
    const relayedMessageIds: Record<string, string> = {};

    // Relay message to all connected Discord channels
    for (const connection of connectedChannels) {
      try {
        const webhookMessageId = await this.relayMessage(
          message,
          connection.webhookUrl,
          tunnel.name,
          tunnel.id,
          connection.channelId
        );
        if (webhookMessageId) {
          relayedMessageIds[connection.channelId] = webhookMessageId;
        }
      } catch (error) {
        logger.error(`Failed to relay message to ${connection.channelId}:`, error);
      }
    }

    // Also emit to Socket.IO tunnel room so web clients receive Discord messages
    try {
      emitTunnelMessage(tunnel.id, {
        id: crypto.randomUUID(),
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
    } catch (error) {
      // Socket.IO may not be initialized (e.g. bot-only process) — non-fatal
      logger.debug('Failed to emit tunnel message to Socket.IO room:', error);
    }

    // Record analytics
    this.tunnelService.recordMessageRelay(tunnel.id, false, message.author.id);

    // Store relay mapping in Redis for edit/delete/reaction propagation (1-hour TTL)
    if (Object.keys(relayedMessageIds).length > 0) {
      void this.tunnelService.storeRelayedMessageIds(
        message.id,
        relayedMessageIds,
        message.channel.id
      );
    }

    // Persist message for history (non-blocking)
    void this.tunnelService.saveMessage({
      id: crypto.randomUUID(),
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

  /**
   * Truncate text to a maximum length with ellipsis.
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.substring(0, maxLength)}…`;
  }

  /**
   * Build reply-quote prefix when the message is a reply to another message.
   */
  private async buildReplyPrefix(message: Message): Promise<string> {
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
    } catch {
      // Referenced message may be deleted — continue without context
      return '';
    }
  }

  /**
   * Build a short preview snippet for a referenced message.
   * Falls back to embed title/description, then attachment/sticker hints,
   * before defaulting to a generic placeholder.
   */
  private buildReplyPreview(referencedMsg: Message): string {
    if (referencedMsg.content) {
      return this.truncate(referencedMsg.content, 60);
    }

    const richEmbed = referencedMsg.embeds.find(e => (e.data.type as string) === 'rich');
    if (richEmbed) {
      const parts: string[] = [];
      if (richEmbed.title) {
        parts.push(`**${richEmbed.title}**`);
      }
      if (richEmbed.description) {
        parts.push(richEmbed.description);
      } else if (richEmbed.fields.length > 0) {
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

  /**
   * Collect all files to attach (user attachments + sticker images).
   */
  private collectFiles(message: Message): Array<{ attachment: string; name: string }> {
    const files = message.attachments.map(attachment => ({
      attachment: attachment.url,
      name: attachment.name,
    }));

    // Forward stickers as image URLs (stickers don't transfer cross-server)
    for (const sticker of message.stickers.values()) {
      files.push({ attachment: sticker.url, name: 'sticker.png' });
    }

    return files;
  }

  /**
   * Relay a message to a specific channel using webhook.
   * Returns the webhook message ID for edit/delete tracking.
   */
  private async relayMessage(
    message: Message,
    initialWebhookUrl: string | undefined,
    _tunnelName: string | undefined,
    tunnelId: string,
    channelId: string
  ): Promise<string | undefined> {
    let webhookUrl = initialWebhookUrl;
    if (!webhookUrl) {
      // Attempt to auto-create a webhook for this channel
      webhookUrl = await this.autoCreateChannelWebhook(tunnelId, channelId);
      if (!webhookUrl) {
        logger.warn(`No webhook URL configured for channel ${channelId} and auto-create failed`);
        return undefined;
      }
    }

    try {
      return await this.sendViaWebhook(webhookUrl, message);
    } catch (error: unknown) {
      // 10015 = Unknown Webhook — the stored webhook was deleted from Discord.
      // Recreate it and retry so the triggering message is not lost (self-healing),
      // instead of silently dropping it and only relaying the next message.
      const errorCode =
        error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (errorCode !== 10015) {
        throw error;
      }

      logger.warn(
        `Webhook for channel ${channelId} in tunnel ${tunnelId} is invalid — recreating and retrying`
      );
      this.webhookCache.delete(webhookUrl);

      const freshWebhookUrl = await this.autoCreateChannelWebhook(tunnelId, channelId);
      if (!freshWebhookUrl) {
        // Could not recreate (e.g. missing ManageWebhooks) — clear the stale URL and give up
        void this.tunnelService.updateWebhook(tunnelId, channelId, '');
        logger.error(
          `Failed to recreate webhook for channel ${channelId} in tunnel ${tunnelId}; message not relayed`
        );
        return undefined;
      }

      try {
        return await this.sendViaWebhook(freshWebhookUrl, message);
      } catch (retryError: unknown) {
        logger.error(
          `Retry after webhook recreation failed for channel ${channelId} in tunnel ${tunnelId}:`,
          retryError
        );
        return undefined;
      }
    }
  }

  /**
   * Build the relay payload from a source message and send it through the given webhook.
   * Returns the sent webhook message ID. Throws on failure so the caller can handle
   * webhook recovery (e.g. recreating a deleted webhook and retrying).
   */
  private async sendViaWebhook(webhookUrl: string, message: Message): Promise<string> {
    const webhook = this.getOrCreateWebhook(webhookUrl);

    // Resolve display name: prefer server nickname, fall back to global display name
    const displayName = message.member?.displayName ?? message.author.displayName;
    const guildName = message.guild?.name ?? 'Unknown';

    // Build content with optional reply-quote prefix
    const replyPrefix = await this.buildReplyPrefix(message);
    const content = replyPrefix + (message.content || '');

    // Collect attachments and stickers
    const files = this.collectFiles(message);

    // Forward rich embeds from the original message (not auto-generated link previews —
    // Discord will auto-generate those for any URLs in the relayed content)
    const embeds = message.embeds
      .filter(e => (e.data.type as string) === 'rich')
      .slice(0, 5)
      .map(e => EmbedBuilder.from(e));

    // Send via webhook with author's display name and server origin
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

  /**
   * Resolve relay targets for a reaction event.
   * Handles both original messages (forward lookup) and relayed messages (reverse lookup).
   * Returns the list of { channelId, messageId } pairs to propagate the reaction to,
   * or null if no relay mapping exists.
   */
  private async resolveRelayTargets(
    messageId: string,
    sourceChannelId: string,
    tunnelId: string
  ): Promise<{ targets: Array<{ channelId: string; messageId: string }> } | null> {
    // Forward lookup: message is the original
    const relayedIds = await this.tunnelService.getRelayedMessageIds(messageId);
    if (relayedIds) {
      const connections = this.tunnelService.getConnectedChannels(tunnelId, sourceChannelId);
      const targets = connections
        .map(conn => {
          const relayedMsgId = relayedIds[conn.channelId];
          return relayedMsgId ? { channelId: conn.channelId, messageId: relayedMsgId } : null;
        })
        .filter((t): t is { channelId: string; messageId: string } => t !== null);
      return targets.length > 0 ? { targets } : null;
    }

    // Reverse lookup: message is a relayed copy — find the original and all other copies
    const reverse = await this.tunnelService.getOriginalMessageId(messageId);
    if (!reverse) {
      return null;
    }

    const originalRelayedIds = await this.tunnelService.getRelayedMessageIds(reverse.originalId);
    if (!originalRelayedIds) {
      return null;
    }

    const targets: Array<{ channelId: string; messageId: string }> = [];

    // Propagate to the original message in its source channel
    if (reverse.sourceChannelId && reverse.sourceChannelId !== sourceChannelId) {
      targets.push({ channelId: reverse.sourceChannelId, messageId: reverse.originalId });
    }

    // Propagate to all other relayed copies (excluding the one that was reacted on)
    for (const [channelId, relayedMsgId] of Object.entries(originalRelayedIds)) {
      if (channelId !== sourceChannelId) {
        targets.push({ channelId, messageId: relayedMsgId });
      }
    }

    return targets.length > 0 ? { targets } : null;
  }

  /**
   * Fetch a full reaction from a partial, returning null if the message was deleted.
   */
  private async fetchReaction(
    reaction: MessageReaction | PartialMessageReaction
  ): Promise<MessageReaction | null> {
    if (!reaction.partial) {
      return reaction;
    }
    try {
      return await reaction.fetch();
    } catch {
      return null;
    }
  }

  /**
   * Resolve the display string for a reaction emoji.
   */
  private getEmojiDisplay(reaction: MessageReaction): string {
    return reaction.emoji.id
      ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
      : (reaction.emoji.name ?? '?');
  }

  /**
   * Add a reaction to a relayed webhook message in a target channel.
   * Uses REST API directly to avoid unnecessary channel/message cache fetches.
   */
  private async addReactionToRelayed(
    channelId: string,
    messageId: string,
    reaction: MessageReaction
  ): Promise<void> {
    const emojiIdentifier = reaction.emoji.id
      ? `${reaction.emoji.name}:${reaction.emoji.id}`
      : encodeURIComponent(reaction.emoji.name ?? '');

    if (!emojiIdentifier) {
      return;
    }

    await this.client.rest.put(
      `/channels/${channelId}/messages/${messageId}/reactions/${emojiIdentifier}/@me`
    );
  }

  /**
   * Remove the bot's reaction from a relayed webhook message in a target channel.
   * Uses REST API directly because ReactionManager cache is disabled (size 0).
   */
  private async removeReactionFromRelayed(
    channelId: string,
    messageId: string,
    reaction: MessageReaction
  ): Promise<void> {
    const emojiIdentifier = reaction.emoji.id
      ? `${reaction.emoji.name}:${reaction.emoji.id}`
      : encodeURIComponent(reaction.emoji.name ?? '');

    if (!emojiIdentifier) {
      return;
    }

    await this.client.rest.delete(
      `/channels/${channelId}/messages/${messageId}/reactions/${emojiIdentifier}/@me`
    );
  }

  /**
   * Handle reaction add and relay to connected channels
   */
  private async handleReactionAdd(
    rawReaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
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
      const resolved = await this.resolveRelayTargets(
        reaction.message.id,
        reaction.message.channel.id,
        tunnel.id
      );

      if (resolved) {
        for (const { channelId, messageId } of resolved.targets) {
          try {
            await this.addReactionToRelayed(channelId, messageId, reaction);
          } catch (error) {
            logger.debug(`Failed to relay reaction to channel ${channelId}:`, error);
          }
        }
      }

      emitTunnelReactionAdded(tunnel.id, reaction.message.id, user.id, emoji);

      const analytics = this.tunnelService.getTunnelAnalytics(tunnel.id);
      if (analytics) {
        analytics.reactionsRelayed++;
      }

      logger.debug(`Reaction ${emoji} relayed in tunnel ${tunnel.id}`);
    } catch (error) {
      logger.error('Failed to handle reaction add for tunnel relay:', error);
    }
  }

  /**
   * Handle reaction remove and relay to connected channels
   */
  private async handleReactionRemove(
    rawReaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> {
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
      const resolved = await this.resolveRelayTargets(
        reaction.message.id,
        reaction.message.channel.id,
        tunnel.id
      );

      if (resolved) {
        for (const { channelId, messageId } of resolved.targets) {
          try {
            await this.removeReactionFromRelayed(channelId, messageId, reaction);
          } catch (error) {
            logger.debug(`Failed to remove relayed reaction in channel ${channelId}:`, error);
          }
        }
      }

      emitTunnelReactionRemoved(tunnel.id, reaction.message.id, user.id, emoji);
      logger.debug(`Reaction removal relayed in tunnel ${tunnel.id}`);
    } catch (error) {
      logger.error('Failed to handle reaction remove for tunnel relay:', error);
    }
  }

  /**
   * Send content filter warning to user
   */
  private async sendFilterWarning(message: Message, reason: string) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🚫 Message Blocked')
        .setDescription(`Your message was blocked by the content filter.`)
        .addFields({ name: 'Reason', value: reason })
        .setFooter({ text: 'Please review tunnel guidelines and try again.' })
        .setTimestamp();

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    } catch (error) {
      logger.error('Failed to send filter warning:', error);
    }
  }

  /**
   * Send rate limit warning to user
   */
  private async sendRateLimitWarning(message: Message, rateLimitResult: RateLimitResult) {
    try {
      const resetTime = rateLimitRetryAfterSeconds(rateLimitResult);

      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('⏱️ Rate Limit Exceeded')
        .setDescription(`You're sending messages too quickly in this tunnel.`)
        .addFields(
          {
            name: 'Status',
            value: rateLimitResult.blockedUntil ? '🔒 Temporarily Blocked' : '⚠️ Limit Reached',
            inline: true,
          },
          { name: 'Reset In', value: `${resetTime} seconds`, inline: true }
        )
        .setFooter({ text: 'Please slow down and try again later.' })
        .setTimestamp();

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    } catch (error) {
      logger.error('Failed to send rate limit warning:', error);
    }
  }
}
