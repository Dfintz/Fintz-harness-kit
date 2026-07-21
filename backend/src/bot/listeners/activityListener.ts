/**
 * Activity announcement listener.
 *
 * Subscribes to `activity:*` domain events emitted by ActivityService /
 * ActivityEventService (anywhere in the platform — including the web UI)
 * and posts a Discord embed to the org's configured announcement channel
 * (`DiscordGuildSettings.eventSettings.eventAnnouncementChannelId`).
 *
 * Per-org gate: an org that has not configured an announcement channel
 * gets no Discord post — this acts as the feature flag from the
 * implementation plan and keeps unconfigured orgs silent.
 *
 * Failures are logged but never thrown — the bot must never break the
 * domain-event chain (other listeners still need to run).
 */
import type { Client, Guild, GuildMember, Message, TextBasedChannel } from 'discord.js';
import { ChannelType, EmbedBuilder } from 'discord.js';

import type { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
import { VoiceServerService } from '../../services/communication/voice/VoiceServerService';
import { DiscordEventService } from '../../services/discord/DiscordEventService';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { domainEvents } from '../../services/shared/DomainEventBus';
import { UserService } from '../../services/user/UserService';
import { logger } from '../../utils/logger';
import { publishMirrorRefresh } from '../mirrorSyncPublisher';
import { createEventTempVoiceChannel } from '../voice/voiceAutoCreate';

const COLOR_CREATED = 0x3498db; // blue
const COLOR_CANCELLED = 0xe74c3c; // red
const COLOR_RESCHEDULED = 0xf39c12; // orange

/**
 * Auto-create Discord Scheduled Events for activities created via the web UI.
 * Each guild with `eventSettings.createDiscordEvent` enabled gets an event.
 * The first successfully created event ID is persisted on the Activity row
 * so lifecycle hooks (cancel, reschedule, complete) can manage it.
 */
interface DiscordEventData {
  activityId: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  location?: string;
  estimatedDuration?: number;
  maxParticipants?: number;
  hostUserId: string;
  voiceChannelMode?: 'none' | 'current' | 'temp';
  voiceChannelLimit?: number;
}

const userService = new UserService();

/** Look up the linked Discord Scheduled Event ID for an activity (if any). */
async function lookupDiscordEventId(activityId: string): Promise<string | null> {
  try {
    const { AppDataSource } = await import('../../config/database');
    if (!AppDataSource.isInitialized) {
      return null;
    }
    const { Activity } = await import('../../models/Activity');
    const activity = await AppDataSource.getRepository(Activity).findOne({
      where: { id: activityId },
    });
    return activity?.discordEventId ?? null;
  } catch {
    return null;
  }
}

/** Persist the first Discord event ID on the Activity row for lifecycle hooks. */
async function persistDiscordEventId(activityId: string, discordEventId: string): Promise<void> {
  try {
    const { AppDataSource } = await import('../../config/database');
    if (AppDataSource.isInitialized) {
      const { Activity } = await import('../../models/Activity');
      await AppDataSource.getRepository(Activity).update({ id: activityId }, { discordEventId });
      logger.info(`Linked Discord event ${discordEventId} to activity ${activityId} (web-created)`);
    }
  } catch (err) {
    logger.warn('Failed to persist discordEventId on activity', {
      activityId,
      discordEventId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function persistVoiceChannelLink(
  activityId: string,
  input: {
    voiceChannelId: string;
    voiceChannelName: string;
    autoCreate: boolean;
    autoDelete: boolean;
    userLimit?: number;
  }
): Promise<void> {
  try {
    const { AppDataSource } = await import('../../config/database');
    if (AppDataSource.isInitialized) {
      const { Activity } = await import('../../models/Activity');
      await AppDataSource.getRepository(Activity).update(
        { id: activityId },
        {
          voiceChannelId: input.voiceChannelId,
          voiceChannelName: input.voiceChannelName,
          voiceChannel: {
            autoCreate: input.autoCreate,
            autoDelete: input.autoDelete,
            channelId: input.voiceChannelId,
            userLimit: input.userLimit,
          },
        }
      );
    }
  } catch (err) {
    logger.warn('Failed to persist voice channel link on activity', {
      activityId,
      voiceChannelId: input.voiceChannelId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function resolveDiscordUserId(hostUserId: string): Promise<string | undefined> {
  try {
    const user = await userService.getUserById(hostUserId);
    return user?.discordId || undefined;
  } catch {
    return undefined;
  }
}

async function resolveGuildMember(
  client: Client,
  guildId: string,
  discordUserId: string
): Promise<
  | {
      guild: Guild;
      member: GuildMember;
    }
  | undefined
> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return undefined;
  }

  const cached = guild.members.cache.get(discordUserId);
  if (cached) {
    return { guild, member: cached };
  }

  try {
    const fetched = await guild.members.fetch(discordUserId);
    return fetched ? { guild, member: fetched } : undefined;
  } catch {
    return undefined;
  }
}

async function applyWebCreatedVoiceChannelMode(
  client: Client,
  data: DiscordEventData,
  orgSettings: DiscordGuildSettings[]
): Promise<void> {
  if (!data.voiceChannelMode || data.voiceChannelMode === 'none') {
    return;
  }

  const discordUserId = await resolveDiscordUserId(data.hostUserId);
  if (!discordUserId) {
    return;
  }

  const guildSettings = orgSettings.filter(setting => Boolean(setting.guildId));
  if (guildSettings.length === 0) {
    return;
  }

  if (data.voiceChannelMode === 'current') {
    for (const setting of guildSettings) {
      const resolved = await resolveGuildMember(client, setting.guildId, discordUserId);
      const voiceChannel = resolved?.member?.voice?.channel;
      if (!resolved || !voiceChannel) {
        continue;
      }

      await persistVoiceChannelLink(data.activityId, {
        voiceChannelId: voiceChannel.id,
        voiceChannelName: voiceChannel.name,
        autoCreate: false,
        autoDelete: false,
      });
      return;
    }
    return;
  }

  for (const setting of guildSettings) {
    const resolved = await resolveGuildMember(client, setting.guildId, discordUserId);
    if (!resolved) {
      continue;
    }

    const startDate = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
    const durationMs = (data.estimatedDuration ?? 120) * 60 * 1000;
    const gracePeriodMs = 30 * 60 * 1000;
    const result = await createEventTempVoiceChannel({
      guild: resolved.guild,
      creator: resolved.member,
      channelName: `🎮 ${data.title}`,
      parentCategoryId: setting.eventSettings?.eventVoiceCategoryId || undefined,
      userLimit: data.voiceChannelLimit,
      expiresAt: new Date(startDate.getTime() + durationMs + gracePeriodMs),
      eventId: data.activityId,
    });

    if (!result?.channelId) {
      continue;
    }

    await persistVoiceChannelLink(data.activityId, {
      voiceChannelId: result.channelId,
      voiceChannelName: result.channelName,
      autoCreate: true,
      autoDelete: true,
      userLimit: data.voiceChannelLimit,
    });
    return;
  }
}

/**
 * Auto-create Discord Scheduled Events for activities created via the web UI.
 * Each guild with `eventSettings.createDiscordEvent` enabled gets an event.
 * The first successfully created event ID is persisted on the Activity row
 * so lifecycle hooks (cancel, reschedule, complete) can manage it.
 */
async function autoCreateDiscordEvents(
  data: DiscordEventData,
  orgSettings: DiscordGuildSettings[]
): Promise<void> {
  if (!data.scheduledAt) {
    return;
  }

  const startDate = new Date(data.scheduledAt);
  if (!Number.isFinite(startDate.getTime())) {
    return;
  }

  const durationMs = (data.estimatedDuration ?? 120) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  const eventService = DiscordEventService.getInstance();
  let savedEventId: string | null = null;

  for (const settings of orgSettings) {
    const enabled = settings.eventSettings?.createDiscordEvent;
    if (!enabled || !settings.guildId) {
      continue;
    }

    try {
      const discordEventId = await eventService.createEvent(settings.guildId, {
        title: data.title,
        description: data.description,
        scheduledStartDate: startDate,
        scheduledEndDate: endDate,
        location: data.location ?? 'Star Citizen',
        participantCount: 1,
        participantCap: data.maxParticipants,
      });

      if (discordEventId && !savedEventId) {
        savedEventId = discordEventId;
      }
    } catch (err) {
      logger.warn('Failed to auto-create Discord scheduled event', {
        guildId: settings.guildId,
        activityId: data.activityId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (savedEventId) {
    await persistDiscordEventId(data.activityId, savedEventId);
  }
}

interface AnnouncementTarget {
  guildId: string;
  channelId: string;
  notificationRoleIds: string[];
  autoPublish: boolean;
  createEventThread: boolean;
}

function collectAnnouncementTargets(orgSettings: DiscordGuildSettings[]): AnnouncementTarget[] {
  const targets: AnnouncementTarget[] = [];
  for (const settings of orgSettings) {
    const evt = settings.eventSettings;
    const nt = settings.notificationPreferences;
    if (nt?.eventNotifications === false) {
      continue;
    }

    const channelId =
      evt?.eventAnnouncementChannelId ??
      nt?.eventNotificationChannelId ??
      nt?.announcementChannelId;
    if (!channelId || !settings.guildId) {
      continue;
    }
    const mentionsEnabled = evt?.enableEventMentions !== false;
    const roleIds: string[] = [];
    if (mentionsEnabled) {
      if (Array.isArray(evt?.eventNotificationRoleIds)) {
        roleIds.push(...evt.eventNotificationRoleIds.filter(Boolean));
      }
      if (evt?.eventNotificationRoleId) {
        roleIds.push(evt.eventNotificationRoleId);
      }
    }
    targets.push({
      guildId: settings.guildId,
      channelId,
      notificationRoleIds: Array.from(new Set(roleIds)),
      autoPublish: evt?.autoPublishAnnouncements === true || nt?.autoPublishAnnouncements === true,
      createEventThread: evt?.createEventThread === true,
    });
  }
  return targets;
}

function buildThreadNameFromEmbed(embed: EmbedBuilder): string {
  const title = typeof embed.data.title === 'string' ? embed.data.title : 'Event discussion';
  const cleaned = title.replace(/^[^A-Za-z0-9]+/, '').trim();
  return (cleaned || 'Event discussion').slice(0, 100);
}

async function postEmbed(
  client: Client,
  target: AnnouncementTarget,
  embed: EmbedBuilder,
  createThread: boolean = false
): Promise<void> {
  const guild = client.guilds.cache.get(target.guildId);
  const channel = guild?.channels.cache.get(target.channelId);
  if (!channel?.isTextBased()) {
    return;
  }
  const content =
    target.notificationRoleIds.length > 0
      ? target.notificationRoleIds.map(id => `<@&${id}>`).join(' ')
      : undefined;
  const sentMessage = await (
    channel as TextBasedChannel & { send: (opts: unknown) => Promise<Message> }
  ).send({
    content,
    embeds: [embed],
    allowedMentions:
      target.notificationRoleIds.length > 0 ? { roles: target.notificationRoleIds } : { parse: [] },
  });

  if (createThread && target.createEventThread && sentMessage?.startThread) {
    try {
      await sentMessage.startThread({
        name: buildThreadNameFromEmbed(embed),
        autoArchiveDuration: 1440,
        reason: 'Auto-create event discussion thread from event settings',
      });
    } catch (err: unknown) {
      logger.warn('Failed to auto-create event discussion thread', {
        guildId: target.guildId,
        channelId: target.channelId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Auto-publish (crosspost) if the channel is a Discord announcement channel
  if (
    target.autoPublish &&
    channel.type === ChannelType.GuildAnnouncement &&
    sentMessage?.crosspost
  ) {
    try {
      await sentMessage.crosspost();
    } catch (err: unknown) {
      logger.warn('Failed to crosspost announcement message', {
        guildId: target.guildId,
        channelId: target.channelId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function registerActivityAnnouncementListeners(client: Client): void {
  const settingsSvc = discordSettingsService;

  domainEvents.on('activity:created', async data => {
    try {
      const orgSettings = await settingsSvc.getOrganizationSettings(data.organizationId);
      const targets = collectAnnouncementTargets(orgSettings);
      if (targets.length > 0) {
        const embed = new EmbedBuilder()
          .setColor(COLOR_CREATED)
          .setTitle(`📣 New activity: ${data.title}`)
          .addFields(
            { name: 'Type', value: String(data.activityType), inline: true },
            { name: 'Host', value: `<@${data.hostUserId}>`, inline: true }
          )
          .setTimestamp();

        if (data.scheduledAt) {
          const ts = Math.floor(new Date(data.scheduledAt).getTime() / 1000);
          if (Number.isFinite(ts)) {
            embed.addFields({ name: 'Scheduled', value: `<t:${ts}:F> (<t:${ts}:R>)` });
          }
        }
        embed.setFooter({ text: `Activity ${data.activityId}` });

        // Add voice server join link if the org has its own configured.
        // We deliberately do NOT fall back to the platform Mumble URL here:
        // announcements post to the org's Discord channel and would leak the
        // private federation server address to non-federation members.
        try {
          const voiceService = VoiceServerService.getInstance();
          const orgConfig = await voiceService.getOrgVoiceConfig(data.organizationId);
          if (orgConfig?.enabled && orgConfig.connectUrl) {
            embed.addFields({
              name: '🎧 Voice Channel',
              value: `[Join Voice](${orgConfig.connectUrl})`,
              inline: true,
            });
          }
        } catch {
          // Voice link is optional — don't fail the announcement
        }

        await Promise.allSettled(targets.map(t => postEmbed(client, t, embed, true)));
      }

      // Auto-create Discord Scheduled Events when the guild has it enabled.
      // This ensures web-created activities also appear in Discord's calendar.
      // Skip if the activity was created from the Discord bot wizard — it handles
      // event creation via tryCreateDiscordEvent() in eventCreationWizard.ts.
      if (data.scheduledAt && !data.discordServerId) {
        await autoCreateDiscordEvents(data, orgSettings);
        await applyWebCreatedVoiceChannelMode(client, data, orgSettings);
      }
    } catch (err) {
      logger.warn('Failed to post activity:created announcement', {
        activityId: data.activityId,
        organizationId: data.organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  domainEvents.on('activity:cancelled', async data => {
    // Re-render the live origin event message and any mirrored copies so they
    // reflect the cancelled state — independent of announcement-channel config.
    publishMirrorRefresh(data.activityId);
    try {
      const orgSettings = await settingsSvc.getOrganizationSettings(data.organizationId);
      const targets = collectAnnouncementTargets(orgSettings);
      if (targets.length === 0) {
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(COLOR_CANCELLED)
        .setTitle('❌ Activity cancelled')
        .setDescription(`Activity \`${data.activityId}\` has been cancelled.`)
        .addFields({
          name: 'Participants affected',
          value: String(data.participantCount),
          inline: true,
        })
        .setTimestamp();

      if (data.reason) {
        embed.addFields({ name: 'Reason', value: data.reason });
      }
      embed.setFooter({ text: `Activity ${data.activityId}` });

      await Promise.allSettled(targets.map(t => postEmbed(client, t, embed)));
    } catch (err) {
      logger.warn('Failed to post activity:cancelled announcement', {
        activityId: data.activityId,
        organizationId: data.organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  domainEvents.on('activity:rescheduled', async data => {
    // Re-render the live origin event message and any mirrored copies with the
    // new start time — independent of announcement-channel config.
    publishMirrorRefresh(data.activityId);
    try {
      const orgSettings = await settingsSvc.getOrganizationSettings(data.organizationId);
      const targets = collectAnnouncementTargets(orgSettings);
      if (targets.length === 0) {
        return;
      }

      const newTs = Math.floor(new Date(data.newStartDate).getTime() / 1000);
      const embed = new EmbedBuilder()
        .setColor(COLOR_RESCHEDULED)
        .setTitle('🔁 Activity rescheduled')
        .setDescription(`Activity \`${data.activityId}\` has a new start time.`)
        .setTimestamp();

      if (Number.isFinite(newTs)) {
        embed.addFields({ name: 'New start', value: `<t:${newTs}:F> (<t:${newTs}:R>)` });
      }
      if (data.reason) {
        embed.addFields({ name: 'Reason', value: data.reason });
      }
      embed.setFooter({ text: `Activity ${data.activityId}` });

      await Promise.allSettled(targets.map(t => postEmbed(client, t, embed)));
    } catch (err) {
      logger.warn('Failed to post activity:rescheduled announcement', {
        activityId: data.activityId,
        organizationId: data.organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Generic edits (title/description/location/time/ships/etc.) made anywhere on
  // the platform — including the web UI — re-render the live origin message and
  // all mirrored copies, and propagate content changes to the native Discord
  // Scheduled Event. This closes the gap where web-side edits left Discord stale.
  domainEvents.on('activity:updated', async data => {
    // Always re-render the live origin message + mirrors from fresh DB state.
    publishMirrorRefresh(data.activityId);

    // Only touch the native Discord Scheduled Event when a field it mirrors changed.
    const contentFields = ['title', 'description', 'location', 'scheduledStartDate'];
    if (!data.updatedFields.some(f => contentFields.includes(f))) {
      return;
    }

    try {
      const discordEventId = await lookupDiscordEventId(data.activityId);
      if (!discordEventId) {
        return;
      }

      const orgSettings = await settingsSvc.getOrganizationSettings(data.organizationId);
      const timeChanged = data.updatedFields.includes('scheduledStartDate');
      const startDate = data.scheduledAt ? new Date(data.scheduledAt) : undefined;
      const endDate =
        startDate && data.estimatedDuration
          ? new Date(startDate.getTime() + data.estimatedDuration * 60 * 1000)
          : undefined;

      const eventService = DiscordEventService.getInstance();
      for (const settings of orgSettings) {
        if (!settings.guildId) {
          continue;
        }
        await eventService
          .updateEvent(settings.guildId, discordEventId, {
            title: data.updatedFields.includes('title') ? data.title : undefined,
            description: data.updatedFields.includes('description') ? data.description : undefined,
            scheduledStartDate: timeChanged ? startDate : undefined,
            scheduledEndDate: timeChanged ? endDate : undefined,
          })
          .catch((err: unknown) => {
            logger.warn('Failed to sync Discord scheduled event on update', {
              guildId: settings.guildId,
              discordEventId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
    } catch (err) {
      logger.warn('Failed to handle activity:updated for Discord sync', {
        activityId: data.activityId,
        organizationId: data.organizationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('📣 Activity announcement listeners registered');
}
