/**
 * Generic ephemeral "issue channel" primitive (recruitment-as-tickets).
 *
 * Creates a private Discord text channel scoped to an initiator (the person who
 * opened the issue) plus a single staff role, under a configured category. The
 * channel is invisible to `@everyone`. Intended to back recruitment applicant
 * channels now and `/ticket` categories later — hence it carries NO domain logic.
 *
 * Every failure path is non-fatal: callers run this off a flow that has already
 * succeeded (an application was submitted), so we return `null` and warn rather
 * than throw.
 *
 * ── Per-domain config resolution pattern (D-1) ──────────────────────────────
 * Each domain that uses this primitive provides its own config-resolver function
 * that maps guild settings rows → typed config or null.  The resolver MUST follow
 * this org-safety algorithm to prevent cross-org data exposure in federation guilds:
 *
 *   1. Filter rows to those whose domain settings are "fully configured"
 *      (feature-enabled flag AND all required IDs present).
 *   2. Zero rows  → return null (feature not configured — silent no-op).
 *   3. More than one row → log a warning and return null (ambiguous multi-org guild).
 *   4. Exactly one row → extract and return the typed config.
 *
 * Existing implementations:
 *   - `resolveApplicantChannelConfig` in `bot/commands/recruitmentApplicantChannel.ts`
 *   - `resolveTicketChannelConfig`    in `bot/commands/ticketIssueChannel.ts`
 *
 * When adding a third domain, copy the resolver pattern from one of the above,
 * adapt the field names, and unit-test all four branches (zero, multi, disabled,
 * fully configured).
 */
import {
  ChannelType,
  type Guild,
  type OverwriteResolvable,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';

import { logger } from '../../utils/logger';

import { checkBotGuildPermissions } from './discord';

export interface CreateIssueChannelOptions {
  /** Discord user id of the initiator (gets read/write on the channel). */
  initiatorId: string;
  /** Discord role id whose members staff the issue (gets read/write + manage). */
  roleId: string;
  /** Discord category id the channel is created under. */
  categoryId: string;
  /** Raw channel name (sanitised before use). */
  name: string;
  /** Optional channel topic (used as a durable lookup marker by callers). */
  topic?: string;
  /** Audit-log reason. */
  reason?: string;
}

/** Discord channel names cap at 100 chars; stay comfortably under. */
const CHANNEL_NAME_MAX = 90;

/**
 * Coerce an arbitrary string into a Discord-safe channel name:
 * lowercase, alphanumeric + dashes only, collapsed, trimmed, length-capped.
 */
export function sanitizeChannelName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const trimmed = cleaned.slice(0, CHANNEL_NAME_MAX).replace(/-+$/g, '');
  return trimmed.length > 0 ? trimmed : 'issue';
}

/**
 * Build the permission overwrites for a private issue channel:
 *  - `@everyone`: denied ViewChannel (private)
 *  - initiator: view + participate
 *  - staff role: view + participate + ManageMessages
 *  - bot: view + participate + ManageChannels (so it can post and later delete)
 */
export function buildIssueChannelOverwrites(
  guild: Guild,
  initiatorId: string,
  roleId: string
): OverwriteResolvable[] {
  const participate = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
  ];

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: initiatorId, allow: participate },
    { id: roleId, allow: [...participate, PermissionFlagsBits.ManageMessages] },
  ];

  const botId = guild.members.me?.id;
  if (botId) {
    overwrites.push({ id: botId, allow: [...participate, PermissionFlagsBits.ManageChannels] });
  }

  return overwrites;
}

/**
 * Create a private text channel for an issue. Returns the channel, or `null` if
 * a pre-check fails (each failure logs a distinct operator-facing warning).
 */
export async function createIssueChannel(
  guild: Guild,
  options: CreateIssueChannelOptions
): Promise<TextChannel | null> {
  const { initiatorId, roleId, categoryId, name, topic, reason } = options;

  if (!checkBotGuildPermissions(guild, PermissionFlagsBits.ManageChannels)) {
    logger.warn(
      `IssueChannel: bot lacks ManageChannels in guild ${guild.name} (${guild.id}); skipping channel`
    );
    return null;
  }

  const category = guild.channels.cache.get(categoryId);
  if (category?.type !== ChannelType.GuildCategory) {
    logger.warn(
      `IssueChannel: category ${categoryId} missing or not a category in guild ${guild.id}; skipping channel`
    );
    return null;
  }

  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) {
    logger.warn(`IssueChannel: role ${roleId} not found in guild ${guild.id}; skipping channel`);
    return null;
  }

  try {
    return await guild.channels.create({
      name: sanitizeChannelName(name),
      type: ChannelType.GuildText,
      parent: category.id,
      topic,
      permissionOverwrites: buildIssueChannelOverwrites(guild, initiatorId, roleId),
      reason: reason ?? 'Ephemeral issue channel',
    });
  } catch (error: unknown) {
    // Most common: hitting the 50-channels-per-category / 500-per-guild limit.
    logger.warn(
      `IssueChannel: failed to create channel in guild ${guild.id} (category ${categoryId}): ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    return null;
  }
}

/**
 * Best-effort delete of an issue channel. A channel that is already gone is a
 * no-op; any error is swallowed (the caller's decision is already final).
 */
export async function deleteIssueChannel(
  guild: Guild,
  channelId: string,
  reason: string
): Promise<void> {
  try {
    const channel =
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(channelId).catch(() => null));
    if (channel) {
      await channel.delete(reason);
    }
  } catch (error: unknown) {
    logger.warn(
      `IssueChannel: failed to delete channel ${channelId} in guild ${guild.id}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
}
