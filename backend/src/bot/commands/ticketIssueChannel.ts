/**
 * Ticket private temporal channels.
 *
 * When a ticket is created, opens a private text channel scoped to the ticket
 * opener and the guild's support role.  On ticket close the channel is torn down
 * (optionally after posting a transcript).
 *
 * This module is the ticket-domain analogue of `recruitmentApplicantChannel.ts`:
 * it wires the generic `issueChannel` primitive with ticket-specific config
 * resolution, idempotency, and durable teardown lookup.
 *
 * Org safety: a guild can be linked to many organisations (federation).
 * We act only when EXACTLY ONE settings row has the feature fully configured.
 * Zero → not configured (silent), more than one → ambiguous, skip + warn.
 *
 * All paths are non-critical: the ticket already succeeded when these run.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Guild,
  type GuildMember,
  TextChannel,
} from 'discord.js';

import type { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import { botApiClient } from '../utils/botApiClient';
import { buildCustomId } from '../utils/customId';
import { createIssueChannel, deleteIssueChannel, sanitizeChannelName } from '../utils/issueChannel';

/** Redis hash: ticketId -> { channelId, guildId } */
const REDIS_KEY = 'tickets:issueChannels';

interface TicketChannelConfig {
  categoryId: string;
  roleId: string;
  transcriptChannelId?: string;
  channelNameTemplate?: string;
}

interface TrackedChannel {
  channelId: string;
  guildId: string;
}

interface TicketOpenHint {
  subject?: string;
  description?: string;
  category?: string;
}

// ── Config resolution ──────────────────────────────────────────────────

/**
 * Resolve the single guild settings row that has ticket channels fully
 * configured.  Returns null when zero (not configured) or more than one
 * (ambiguous multi-org guild — fail safe to avoid cross-org exposure).
 */
export function resolveTicketChannelConfig(
  settingsRows: DiscordGuildSettings[] | null | undefined
): TicketChannelConfig | null {
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
    logger.warn(
      'ticketIssueChannel: ambiguous — multiple org settings rows enable ticket channels for this guild; skipping to avoid cross-org exposure'
    );
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

// ── Redis tracking ──────────────────────────────────────────────────────

async function getTrackedChannel(ticketId: string): Promise<TrackedChannel | null> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return null;
    }
    const raw = await client.hget(REDIS_KEY, ticketId);
    return raw ? (JSON.parse(raw) as TrackedChannel) : null;
  } catch {
    return null;
  }
}

async function trackChannel(ticketId: string, entry: TrackedChannel): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return;
    }
    await client.hset(REDIS_KEY, ticketId, JSON.stringify(entry));
  } catch (error: unknown) {
    logger.warn('ticketIssueChannel: failed to persist channel mapping', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

async function untrackChannel(ticketId: string): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (client) {
      await client.hdel(REDIS_KEY, ticketId);
    }
  } catch {
    // non-critical
  }
}

// ── Durable topic-scan lookup (fallback for cold-cache / lost Redis entry) ──

function topicMarker(ticketId: string): string {
  return `ticket:${ticketId}`;
}

function findChannelIdByTopic(guild: Guild, ticketId: string): string | null {
  const marker = topicMarker(ticketId);
  const match = guild.channels.cache.find(
    ch => ch instanceof TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker)
  );
  return match?.id ?? null;
}

async function findChannelIdByTopicDurable(guild: Guild, ticketId: string): Promise<string | null> {
  const cached = findChannelIdByTopic(guild, ticketId);
  if (cached) {
    return cached;
  }
  try {
    const fetched = await guild.channels.fetch();
    const marker = topicMarker(ticketId);
    const match = fetched.find(
      ch => ch instanceof TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker)
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

// ── Channel name resolution ──────────────────────────────────────────────

function getCategoryEmoji(category: string): string {
  const categoryEmojiMap: Record<string, string> = {
    hr: '👥',
    recruitment: '📋',
    diplomacy: '🤝',
    general: '💬',
    support: '🔧',
    technical: '🔧',
  };
  return categoryEmojiMap[category] ?? '🎫';
}

function resolveChannelName(
  ticketNumber: string,
  category: string,
  member: GuildMember | null,
  template = '{category}-ticket-{number}'
): string {
  const username = member?.user.username ?? member?.displayName ?? 'user';
  const categoryLabel = category.toLowerCase();
  // Extract just the trailing numeric portion and strip leading zeros (e.g. TKT-000007 → 7)
  const countMatch = /(\d+)$/.exec(ticketNumber);
  const count = countMatch ? String(Number.parseInt(countMatch[1], 10)) : ticketNumber;
  return sanitizeChannelName(
    template
      .replaceAll('{number}', ticketNumber)
      .replaceAll('{count}', count)
      .replaceAll('{user}', username)
      .replaceAll('{category}', categoryLabel)
  );
}

// ── Ticket detail fetching ──────────────────────────────────────────────

interface TicketDetails {
  ticketNumber: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  createdAt: string;
}

interface TicketDetailsApiPayload {
  data?: Partial<TicketDetails>;
  ticketNumber?: string;
  subject?: string;
  description?: string;
  priority?: string;
  status?: string;
  category?: string;
  createdAt?: string;
}

async function fetchTicketDetails(
  guildId: string,
  ticketNumber: string,
  initiatorId: string
): Promise<TicketDetails | null> {
  try {
    const response = await botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
      headers: {
        'X-Discord-Guild-Id': guildId,
        'X-Discord-User-Id': initiatorId,
      },
    });

    const body = response.data as TicketDetailsApiPayload;
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
  } catch (error: unknown) {
    logger.warn('ticketIssueChannel: failed to fetch ticket details', {
      error: error instanceof Error ? error.message : 'unknown',
      ticketNumber,
      guildId,
    });
    return null;
  }
}

// ── Embed builder ──────────────────────────────────────────────────────

function buildTicketEmbed(ticket: TicketDetails): {
  color: number;
  title: string;
  description: string;
  fields: Array<{ name: string; value: string; inline: boolean }>;
  footer: { text: string };
} {
  const normalizedPriority = ticket.priority.toLowerCase();
  const normalizedStatus = ticket.status.toLowerCase();
  const categoryEmoji = getCategoryEmoji(ticket.category);
  let priorityEmoji = '🟢';
  if (normalizedPriority === 'high') {
    priorityEmoji = '🔴';
  } else if (normalizedPriority === 'medium') {
    priorityEmoji = '🟡';
  }
  let statusColor = 0x00ff88;
  if (normalizedStatus === 'open') {
    statusColor = 0x00d9ff;
  } else if (normalizedStatus === 'in_progress') {
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
        value:
          ticket.description.length > 1024
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

function buildActionButtons(ticketNumber: string): ActionRowBuilder<ButtonBuilder> {
  const resolveButtonId = buildCustomId('ticket', 'resolve', ticketNumber);
  const closeButtonId = buildCustomId('ticket', 'close', ticketNumber);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(resolveButtonId)
      .setLabel('✓ Resolve')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(closeButtonId)
      .setLabel('✕ Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Open a private ticket channel for a newly created ticket.
 * No-op when the feature is not configured / ambiguous, or already open.
 */
export async function openTicketChannel(
  guild: Guild,
  ticketId: string,
  ticketNumber: string,
  initiatorId: string,
  category: string,
  hint?: TicketOpenHint
): Promise<void> {
  try {
    const settingsRows = await discordSettingsService.getSettingsByGuildId(guild.id);
    const config = resolveTicketChannelConfig(settingsRows);
    if (!config) {
      return;
    }

    // Idempotency: never create a second channel for the same ticket.
    const alreadyOpen =
      (await getTrackedChannel(ticketId)) !== null ||
      (await findChannelIdByTopicDurable(guild, ticketId)) !== null;
    if (alreadyOpen) {
      return;
    }

    // Resolve channel name from template / defaults.
    const member = await guild.members.fetch(initiatorId).catch(() => null);
    const channelName = resolveChannelName(
      ticketNumber,
      category,
      member,
      config.channelNameTemplate
    );

    const channel = await createIssueChannel(guild, {
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

    // Fetch ticket details for the rich opening embed.
    const details = await fetchTicketDetails(guild.id, ticketNumber, initiatorId);
    const hintedSubject = hint?.subject?.trim();
    const fallbackSubject =
      hintedSubject && hintedSubject.length > 0 ? hintedSubject : `Ticket ${ticketNumber}`;
    const fallbackDescription = hint?.description?.trim();
    const fallbackCategory = (hint?.category ?? category).toUpperCase();
    let fallbackDescriptionLine: string | undefined;
    if (fallbackDescription) {
      const preview =
        fallbackDescription.length > 300
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
            .filter((line): line is string => Boolean(line))
            .join('\n'),
          footer: { text: `Ticket ID: ${ticketId}` },
        };

    // Send an opening message mentioning the support role.
    await channel.send({
      content: `<@&${config.roleId}> — new ticket <@${initiatorId}> needs help.`,
      embeds: [openingEmbed],
      components: [buildActionButtons(ticketNumber)],
    });

    logger.info('ticketIssueChannel: opened channel', {
      ticketId,
      ticketNumber,
      channelId: channel.id,
      guildId: guild.id,
    });
  } catch (error: unknown) {
    logger.warn('ticketIssueChannel: failed to open channel', {
      error: error instanceof Error ? error.message : 'unknown',
      ticketId,
    });
  }
}

/**
 * Tear down the private channel for a closed ticket.
 * Uses Redis mapping first, then topic scan as a durable fallback.
 */
export async function closeTicketChannel(
  guild: Guild,
  ticketId: string,
  ticketNumber: string
): Promise<void> {
  try {
    const tracked = await getTrackedChannel(ticketId);
    const channelId = tracked?.channelId ?? (await findChannelIdByTopicDurable(guild, ticketId));

    if (channelId) {
      await deleteIssueChannel(guild, channelId, `Ticket ${ticketNumber} closed`);
      logger.info('ticketIssueChannel: closed channel', {
        ticketId,
        ticketNumber,
        channelId,
        guildId: guild.id,
      });
    }

    await untrackChannel(ticketId);
  } catch (error: unknown) {
    logger.warn('ticketIssueChannel: failed to close channel', {
      error: error instanceof Error ? error.message : 'unknown',
      ticketId,
    });
  }
}
