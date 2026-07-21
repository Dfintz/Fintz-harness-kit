/**
 * Recruitment applicant ephemeral channels (recruitment-as-tickets).
 *
 * On application submit, opens a private text channel scoped to the applicant +
 * the recruitment staff role; on accept/deny, tears it down. Orchestrates the
 * generic `issueChannel` primitive with recruitment-specific config resolution,
 * idempotency, and durable teardown lookup.
 *
 * Org safety: a Discord guild can be linked to MANY organisations (federation).
 * We therefore only act when EXACTLY ONE settings row for the guild has the
 * feature fully configured; zero → not configured (silent), more than one →
 * ambiguous, skip + warn (never expose an applicant to the wrong org's staff).
 *
 * All paths are non-critical: the application already succeeded, so failures
 * warn and return rather than throw.
 */
import {
  type Guild,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';

import type { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { logger } from '../../utils/logger';
import { redisClient } from '../../utils/redis';
import { buildApplicantChannelReceivedEmbed } from '../embeds/recruitmentEmbeds';
import { createIssueChannel, deleteIssueChannel } from '../utils/issueChannel';

/** Redis hash: applicationId -> { channelId, guildId }. */
const REDIS_KEY = 'recruitment:applicantChannels';

interface ApplicantChannelConfig {
  categoryId: string;
  roleId: string;
}

interface TrackedChannel {
  channelId: string;
  guildId: string;
}

/**
 * Resolve the single guild settings row that has applicant channels fully
 * configured. Returns null when zero (not configured) or more than one
 * (ambiguous multi-org guild — fail safe).
 */
export function resolveApplicantChannelConfig(
  settingsRows: DiscordGuildSettings[] | null | undefined
): ApplicantChannelConfig | null {
  const configured = (settingsRows ?? []).filter(row => {
    const rs = row.recruitmentSettings;
    const reviewerRoleId = rs?.staffPingRoleId ?? rs?.pendingRoleId ?? rs?.acceptRoleId;
    return Boolean(rs?.applicantChannelEnabled && rs?.applicantChannelCategoryId && reviewerRoleId);
  });

  if (configured.length === 0) {
    return null;
  }
  if (configured.length > 1) {
    logger.warn(
      'recruitment: applicant channel ambiguous — multiple org settings rows enable it for this guild; skipping to avoid cross-org exposure'
    );
    return null;
  }

  const rs = configured[0].recruitmentSettings;
  const reviewerRoleId = rs?.staffPingRoleId ?? rs?.pendingRoleId ?? rs?.acceptRoleId;
  return {
    categoryId: rs?.applicantChannelCategoryId ?? '',
    roleId: reviewerRoleId ?? '',
  };
}

function getApplicationId(application: Record<string, unknown>): string | undefined {
  const id = application.id ?? application.applicationId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function topicMarker(applicationId: string): string {
  return `app:${applicationId}`;
}

/** Durable fallback: find an applicant channel by the id embedded in its topic. */
function findChannelIdByTopic(guild: Guild, applicationId: string): string | null {
  const marker = topicMarker(applicationId);
  const match = guild.channels.cache.find(
    ch => ch instanceof TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker)
  );
  return match?.id ?? null;
}

/**
 * Durable variant for teardown: scans the cache, then force-fetches the guild's
 * channels on a miss so a lost Redis mapping plus a cold cache (post-restart)
 * can still locate the channel by its topic marker.
 */
async function findChannelIdByTopicDurable(
  guild: Guild,
  applicationId: string
): Promise<string | null> {
  const cached = findChannelIdByTopic(guild, applicationId);
  if (cached) {
    return cached;
  }
  try {
    const fetched = await guild.channels.fetch();
    const marker = topicMarker(applicationId);
    const match = fetched.find(
      ch => ch instanceof TextChannel && typeof ch.topic === 'string' && ch.topic.includes(marker)
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

async function getTrackedChannel(applicationId: string): Promise<TrackedChannel | null> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return null;
    }
    const raw = await client.hget(REDIS_KEY, applicationId);
    return raw ? (JSON.parse(raw) as TrackedChannel) : null;
  } catch {
    return null;
  }
}

async function trackChannel(applicationId: string, entry: TrackedChannel): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (!client) {
      return;
    }
    await client.hset(REDIS_KEY, applicationId, JSON.stringify(entry));
  } catch (error: unknown) {
    logger.warn('recruitment: failed to persist applicant channel mapping', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

async function untrackChannel(applicationId: string): Promise<void> {
  try {
    const client = redisClient.getClient();
    if (client) {
      await client.hdel(REDIS_KEY, applicationId);
    }
  } catch {
    // non-critical
  }
}

/**
 * Open a private applicant channel for a freshly submitted application.
 * No-op when the feature is not configured / ambiguous, or already opened.
 */
export async function openApplicantChannel(
  interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
  recruitmentId: string,
  application: Record<string, unknown>
): Promise<void> {
  try {
    const guild = interaction.guild;
    if (!guild) {
      return;
    }

    const settingsRows = await discordSettingsService.getSettingsByGuildId(guild.id);
    const config = resolveApplicantChannelConfig(settingsRows);
    if (!config) {
      return;
    }

    const applicationId = getApplicationId(application);
    if (!applicationId) {
      return;
    }

    // Idempotency: never create a second channel for the same application.
    const alreadyOpen =
      (await getTrackedChannel(applicationId)) !== null ||
      findChannelIdByTopic(guild, applicationId) !== null;
    if (alreadyOpen) {
      return;
    }

    const channel = await createIssueChannel(guild, {
      initiatorId: interaction.user.id,
      roleId: config.roleId,
      categoryId: config.categoryId,
      name: `apply-${applicationId.slice(0, 6)}`,
      topic: `Recruitment application • ${topicMarker(applicationId)} • applicant <@${interaction.user.id}>`,
      reason: `Recruitment application ${applicationId}`,
    });
    if (!channel) {
      return;
    }

    await trackChannel(applicationId, { channelId: channel.id, guildId: guild.id });

    const embed = buildApplicantChannelReceivedEmbed(interaction.user.id, config.roleId);

    await channel.send({ content: `<@&${config.roleId}>`, embeds: [embed] });

    logger.info('recruitment: opened applicant channel', {
      applicationId,
      channelId: channel.id,
      guildId: guild.id,
      recruitmentId,
    });
  } catch (error: unknown) {
    logger.warn('recruitment: failed to open applicant channel', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/**
 * Tear down the applicant channel for an application on accept/deny.
 * Uses the Redis mapping first, then a topic scan as a durable fallback.
 */
export async function closeApplicantChannel(
  guild: Guild | null,
  applicationId: string,
  reason: string
): Promise<void> {
  try {
    if (!guild) {
      return;
    }

    const tracked = await getTrackedChannel(applicationId);
    const channelId =
      tracked?.channelId ?? (await findChannelIdByTopicDurable(guild, applicationId));

    if (channelId) {
      await deleteIssueChannel(guild, channelId, reason);
      logger.info('recruitment: closed applicant channel', {
        applicationId,
        channelId,
        guildId: guild.id,
      });
    }

    await untrackChannel(applicationId);
  } catch (error: unknown) {
    logger.warn('recruitment: failed to close applicant channel', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
