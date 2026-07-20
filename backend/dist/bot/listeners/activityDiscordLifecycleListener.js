"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerActivityDiscordLifecycleListeners = registerActivityDiscordLifecycleListeners;
const discord_js_1 = require("discord.js");
const ActivityDiscordSyncService_1 = require("../../services/activity/ActivityDiscordSyncService");
const DiscordEventService_1 = require("../../services/discord/DiscordEventService");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const DomainEventBus_1 = require("../../services/shared/DomainEventBus");
const logger_1 = require("../../utils/logger");
const voiceAutoCreate_1 = require("../voice/voiceAutoCreate");
async function postCompletionArchiveEmbeds(client, data, orgSettings) {
    await Promise.allSettled(orgSettings.map(async (settings) => {
        const archiveChannelId = settings.eventSettings?.archiveChannelId;
        if (!archiveChannelId || !settings.guildId) {
            return;
        }
        const guild = client.guilds.cache.get(settings.guildId);
        const channel = guild?.channels.cache.get(archiveChannelId);
        if (!channel?.isTextBased()) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x9e9e9e)
            .setTitle('Event Completed')
            .setDescription(`Activity \`${data.activityId}\` has been completed with ${data.participantCount} participants.`)
            .setTimestamp();
        await channel.send({
            embeds: [embed],
        });
    }));
}
async function syncCompletedScheduledEvent(activityId, organizationId, orgSettings, eventService) {
    const discordEventId = await ActivityDiscordSyncService_1.activityDiscordSyncService.getDiscordEventId(activityId, organizationId);
    if (!discordEventId) {
        return;
    }
    await Promise.allSettled(orgSettings.map(async (settings) => {
        if (!settings.guildId) {
            return;
        }
        await eventService.updateEvent(settings.guildId, discordEventId, {
            status: 'completed',
        });
    }));
}
async function deleteCancelledActivityScheduledEvent(data, eventService) {
    const discordEventId = await ActivityDiscordSyncService_1.activityDiscordSyncService.getDiscordEventId(data.activityId, data.organizationId);
    if (!discordEventId) {
        return;
    }
    const orgSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(data.organizationId);
    const guildIds = orgSettings
        .map(settings => settings.guildId)
        .filter((guildId) => Boolean(guildId));
    const deleteResults = await Promise.all(guildIds.map(async (guildId) => ({
        guildId,
        deleted: await eventService.deleteEvent(guildId, discordEventId),
    })));
    const failedDeletes = deleteResults.filter(result => !result.deleted);
    const hasDeleteFailure = failedDeletes.length > 0;
    failedDeletes.forEach(result => {
        logger_1.logger.warn('Failed to delete Discord scheduled event on cancel', {
            guildId: result.guildId,
            discordEventId,
        });
    });
    if (!hasDeleteFailure) {
        await ActivityDiscordSyncService_1.activityDiscordSyncService.clearDiscordEventPointer(data.activityId, data.organizationId);
    }
}
async function resolveCancelledVoiceChannelId(activityId, organizationId, voiceChannelService) {
    const voiceInfo = await ActivityDiscordSyncService_1.activityDiscordSyncService.getVoiceChannelInfo(activityId, organizationId);
    if (voiceInfo?.autoDelete) {
        return voiceInfo.channelId;
    }
    const eventChannels = voiceChannelService.getEventChannels(activityId);
    return eventChannels[0]?.channelId ?? null;
}
async function deleteVoiceChannelFromDiscord(client, discordChannelId, activityId, guildIds) {
    for (const guildId of guildIds) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            continue;
        }
        let channel = null;
        try {
            channel = await guild.channels.fetch(discordChannelId);
        }
        catch (error) {
            logger_1.logger.warn('Failed to fetch Discord voice channel during cancel cleanup', {
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
            logger_1.logger.info(`Deleted voice channel for cancelled event ${activityId}: ${channel.name}`);
            return 'deleted';
        }
        catch (error) {
            logger_1.logger.warn('Failed to delete Discord voice channel during cancel cleanup', {
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
async function deleteCancelledActivityVoiceChannel(client, data, voiceChannelService) {
    const discordChannelId = await resolveCancelledVoiceChannelId(data.activityId, data.organizationId, voiceChannelService);
    if (!discordChannelId) {
        return;
    }
    const orgSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(data.organizationId);
    const guildIds = orgSettings
        .map(settings => settings.guildId)
        .filter((guildId) => Boolean(guildId));
    const deleteResult = await deleteVoiceChannelFromDiscord(client, discordChannelId, data.activityId, guildIds);
    if (deleteResult === 'failed') {
        logger_1.logger.warn('Skipping voice pointer cleanup because Discord channel deletion failed', {
            activityId: data.activityId,
            organizationId: data.organizationId,
            discordChannelId,
        });
        return;
    }
    voiceChannelService.deleteByDiscordId(discordChannelId);
    (0, voiceAutoCreate_1.getChannelOwners)().delete(discordChannelId);
    await ActivityDiscordSyncService_1.activityDiscordSyncService.clearVoiceChannelPointers(data.activityId, data.organizationId);
}
async function updateRescheduledScheduledEvent(data, eventService) {
    const discordEventId = await ActivityDiscordSyncService_1.activityDiscordSyncService.getDiscordEventId(data.activityId, data.organizationId);
    if (!discordEventId) {
        return;
    }
    const orgSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(data.organizationId);
    await Promise.allSettled(orgSettings.map(async (settings) => {
        if (!settings.guildId) {
            return;
        }
        await eventService.updateEvent(settings.guildId, discordEventId, {
            scheduledStartDate: new Date(data.newStartDate),
            scheduledEndDate: data.newEndDate ? new Date(data.newEndDate) : undefined,
        });
    }));
}
async function deleteDeletedActivityScheduledEvent(data, eventService) {
    if (!data.discordEventId) {
        return;
    }
    const discordEventId = data.discordEventId;
    const orgSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(data.organizationId);
    await Promise.allSettled(orgSettings.map(async (settings) => {
        if (!settings.guildId) {
            return;
        }
        await eventService.deleteEvent(settings.guildId, discordEventId);
    }));
}
function registerActivityDiscordLifecycleListeners(client, voiceChannelService) {
    const eventService = DiscordEventService_1.DiscordEventService.getInstance();
    DomainEventBus_1.domainEvents.on('activity:completed', async (data) => {
        try {
            const orgSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(data.organizationId);
            await Promise.allSettled([
                postCompletionArchiveEmbeds(client, data, orgSettings),
                syncCompletedScheduledEvent(data.activityId, data.organizationId, orgSettings, eventService),
            ]);
        }
        catch (error) {
            logger_1.logger.warn('Failed to sync completed activity lifecycle to Discord', {
                activityId: data.activityId,
                organizationId: data.organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
    DomainEventBus_1.domainEvents.on('activity:cancelled', async (data) => {
        await Promise.allSettled([
            deleteCancelledActivityScheduledEvent(data, eventService),
            deleteCancelledActivityVoiceChannel(client, data, voiceChannelService),
        ]);
    });
    DomainEventBus_1.domainEvents.on('activity:rescheduled', async (data) => {
        try {
            await updateRescheduledScheduledEvent(data, eventService);
        }
        catch (error) {
            logger_1.logger.warn('Failed to sync rescheduled activity to Discord', {
                activityId: data.activityId,
                organizationId: data.organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
    DomainEventBus_1.domainEvents.on('activity:deleted', async (data) => {
        try {
            await deleteDeletedActivityScheduledEvent(data, eventService);
        }
        catch (error) {
            logger_1.logger.warn('Failed to delete Discord scheduled event for deleted activity', {
                activityId: data.activityId,
                organizationId: data.organizationId,
                discordEventId: data.discordEventId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
    logger_1.logger.info('Activity archive and Discord lifecycle sync hooks registered');
}
//# sourceMappingURL=activityDiscordLifecycleListener.js.map