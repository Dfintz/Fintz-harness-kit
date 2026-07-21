import type { Client } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

import { activityDiscordSyncService } from '../../services/activity/ActivityDiscordSyncService';
import { VoiceChannelService } from '../../services/communication';
import { DiscordEventService } from '../../services/discord/DiscordEventService';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { domainEvents } from '../../services/shared/DomainEventBus';
import { logger } from '../../utils/logger';
import { getChannelOwners } from '../voice/voiceAutoCreate';

interface CompletedEventPayload {
  activityId: string;
  organizationId: string;
  participantCount: number;
}

interface LifecyclePayload {
  activityId: string;
  organizationId: string;
}

interface RescheduledPayload extends LifecyclePayload {
  newStartDate: string;
  newEndDate?: string;
}

interface DeletedPayload extends LifecyclePayload {
  discordEventId?: string;
}

type OrganizationSettings = Awaited<
  ReturnType<typeof discordSettingsService.getOrganizationSettings>
>;

type VoiceDeleteResult = 'deleted' | 'not-found' | 'failed';

async function postCompletionArchiveEmbeds(
  client: Client,
  data: CompletedEventPayload,
  orgSettings: OrganizationSettings
): Promise<void> {
  await Promise.allSettled(
    orgSettings.map(async settings => {
      const archiveChannelId = settings.eventSettings?.archiveChannelId;
      if (!archiveChannelId || !settings.guildId) {
        return;
      }

      const guild = client.guilds.cache.get(settings.guildId);
      const channel = guild?.channels.cache.get(archiveChannelId);
      if (!channel?.isTextBased()) {
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x9e9e9e)
        .setTitle('Event Completed')
        .setDescription(
          `Activity \`${data.activityId}\` has been completed with ${data.participantCount} participants.`
        )
        .setTimestamp();

      await (channel as { send: (opts: unknown) => Promise<unknown> }).send({
        embeds: [embed],
      });
    })
  );
}

async function syncCompletedScheduledEvent(
  activityId: string,
  organizationId: string,
  orgSettings: OrganizationSettings,
  eventService: DiscordEventService
): Promise<void> {
  const discordEventId = await activityDiscordSyncService.getDiscordEventId(
    activityId,
    organizationId
  );
  if (!discordEventId) {
    return;
  }

  await Promise.allSettled(
    orgSettings.map(async settings => {
      if (!settings.guildId) {
        return;
      }

      await eventService.updateEvent(settings.guildId, discordEventId, {
        status: 'completed',
      });
    })
  );
}

async function deleteCancelledActivityScheduledEvent(
  data: LifecyclePayload,
  eventService: DiscordEventService
): Promise<void> {
  const discordEventId = await activityDiscordSyncService.getDiscordEventId(
    data.activityId,
    data.organizationId
  );
  if (!discordEventId) {
    return;
  }

  const orgSettings = await discordSettingsService.getOrganizationSettings(data.organizationId);

  const guildIds = orgSettings
    .map(settings => settings.guildId)
    .filter((guildId): guildId is string => Boolean(guildId));

  const deleteResults = await Promise.all(
    guildIds.map(async guildId => ({
      guildId,
      deleted: await eventService.deleteEvent(guildId, discordEventId),
    }))
  );

  const failedDeletes = deleteResults.filter(result => !result.deleted);
  const hasDeleteFailure = failedDeletes.length > 0;

  failedDeletes.forEach(result => {
    logger.warn('Failed to delete Discord scheduled event on cancel', {
      guildId: result.guildId,
      discordEventId,
    });
  });

  if (!hasDeleteFailure) {
    await activityDiscordSyncService.clearDiscordEventPointer(data.activityId, data.organizationId);
  }
}

async function resolveCancelledVoiceChannelId(
  activityId: string,
  organizationId: string,
  voiceChannelService: VoiceChannelService
): Promise<string | null> {
  const voiceInfo = await activityDiscordSyncService.getVoiceChannelInfo(
    activityId,
    organizationId
  );
  if (voiceInfo?.autoDelete) {
    return voiceInfo.channelId;
  }

  const eventChannels = voiceChannelService.getEventChannels(activityId);
  return eventChannels[0]?.channelId ?? null;
}

async function deleteVoiceChannelFromDiscord(
  client: Client,
  discordChannelId: string,
  activityId: string,
  guildIds: readonly string[]
): Promise<VoiceDeleteResult> {
  for (const guildId of guildIds) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      continue;
    }

    let channel = null;
    try {
      channel = await guild.channels.fetch(discordChannelId);
    } catch (error) {
      logger.warn('Failed to fetch Discord voice channel during cancel cleanup', {
        guildId,
        discordChannelId,
        activityId,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (!channel) {
      continue;
    }

    try {
      await channel.delete('Event cancelled - cleaning up voice channel');
      logger.info(`Deleted voice channel for cancelled event ${activityId}: ${channel.name}`);
      return 'deleted';
    } catch (error) {
      logger.warn('Failed to delete Discord voice channel during cancel cleanup', {
        guildId,
        discordChannelId,
        activityId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'failed';
    }
  }

  return 'not-found';
}

async function deleteCancelledActivityVoiceChannel(
  client: Client,
  data: LifecyclePayload,
  voiceChannelService: VoiceChannelService
): Promise<void> {
  const discordChannelId = await resolveCancelledVoiceChannelId(
    data.activityId,
    data.organizationId,
    voiceChannelService
  );
  if (!discordChannelId) {
    return;
  }

  const orgSettings = await discordSettingsService.getOrganizationSettings(data.organizationId);
  const guildIds = orgSettings
    .map(settings => settings.guildId)
    .filter((guildId): guildId is string => Boolean(guildId));

  const deleteResult = await deleteVoiceChannelFromDiscord(
    client,
    discordChannelId,
    data.activityId,
    guildIds
  );

  if (deleteResult === 'failed') {
    logger.warn('Skipping voice pointer cleanup because Discord channel deletion failed', {
      activityId: data.activityId,
      organizationId: data.organizationId,
      discordChannelId,
    });
    return;
  }

  voiceChannelService.deleteByDiscordId(discordChannelId);
  getChannelOwners().delete(discordChannelId);
  await activityDiscordSyncService.clearVoiceChannelPointers(data.activityId, data.organizationId);
}

async function updateRescheduledScheduledEvent(
  data: RescheduledPayload,
  eventService: DiscordEventService
): Promise<void> {
  const discordEventId = await activityDiscordSyncService.getDiscordEventId(
    data.activityId,
    data.organizationId
  );
  if (!discordEventId) {
    return;
  }

  const orgSettings = await discordSettingsService.getOrganizationSettings(data.organizationId);

  await Promise.allSettled(
    orgSettings.map(async settings => {
      if (!settings.guildId) {
        return;
      }

      await eventService.updateEvent(settings.guildId, discordEventId, {
        scheduledStartDate: new Date(data.newStartDate),
        scheduledEndDate: data.newEndDate ? new Date(data.newEndDate) : undefined,
      });
    })
  );
}

async function deleteDeletedActivityScheduledEvent(
  data: DeletedPayload,
  eventService: DiscordEventService
): Promise<void> {
  if (!data.discordEventId) {
    return;
  }
  const discordEventId = data.discordEventId;

  const orgSettings = await discordSettingsService.getOrganizationSettings(data.organizationId);

  await Promise.allSettled(
    orgSettings.map(async settings => {
      if (!settings.guildId) {
        return;
      }

      await eventService.deleteEvent(settings.guildId, discordEventId);
    })
  );
}

export function registerActivityDiscordLifecycleListeners(
  client: Client,
  voiceChannelService: VoiceChannelService
): void {
  const eventService = DiscordEventService.getInstance();

  domainEvents.on('activity:completed', async (data: CompletedEventPayload) => {
    try {
      const orgSettings = await discordSettingsService.getOrganizationSettings(data.organizationId);

      await Promise.allSettled([
        postCompletionArchiveEmbeds(client, data, orgSettings),
        syncCompletedScheduledEvent(
          data.activityId,
          data.organizationId,
          orgSettings,
          eventService
        ),
      ]);
    } catch (error) {
      logger.warn('Failed to sync completed activity lifecycle to Discord', {
        activityId: data.activityId,
        organizationId: data.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  domainEvents.on('activity:cancelled', async (data: LifecyclePayload) => {
    await Promise.allSettled([
      deleteCancelledActivityScheduledEvent(data, eventService),
      deleteCancelledActivityVoiceChannel(client, data, voiceChannelService),
    ]);
  });

  domainEvents.on('activity:rescheduled', async (data: RescheduledPayload) => {
    try {
      await updateRescheduledScheduledEvent(data, eventService);
    } catch (error) {
      logger.warn('Failed to sync rescheduled activity to Discord', {
        activityId: data.activityId,
        organizationId: data.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  domainEvents.on('activity:deleted', async (data: DeletedPayload) => {
    try {
      await deleteDeletedActivityScheduledEvent(data, eventService);
    } catch (error) {
      logger.warn('Failed to delete Discord scheduled event for deleted activity', {
        activityId: data.activityId,
        organizationId: data.organizationId,
        discordEventId: data.discordEventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info('Activity archive and Discord lifecycle sync hooks registered');
}
