"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeMirrorSyncHandler = initializeMirrorSyncHandler;
const discord_js_1 = require("discord.js");
const activity_1 = require("../services/activity");
const DiscordSettingsService_1 = require("../services/discord/DiscordSettingsService");
const logger_1 = require("../utils/logger");
const mirroredEventMessage_1 = require("./embeds/mirroredEventMessage");
const mirrorSyncPublisher_1 = require("./mirrorSyncPublisher");
const MIRROR_EMBED_UPDATE_EVENT = 'mirror:embed:update';
const SOURCE_SCAN_MESSAGE_LIMIT = 50;
const SOURCE_SCAN_CHANNEL_LIMIT = 40;
let _activityServiceInstance = null;
function getActivityServiceInstance() {
    _activityServiceInstance ??= new activity_1.ActivityService();
    return _activityServiceInstance;
}
function appendMirrorIdFooter(embed, mirrorId) {
    const footerText = embed.data.footer?.text?.trim();
    const mirrorText = `Mirror ID: ${mirrorId}`;
    if (!footerText) {
        embed.setFooter({ text: mirrorText });
        return embed;
    }
    if (footerText.includes(mirrorText)) {
        return embed;
    }
    embed.setFooter({ text: `${footerText}  •  ${mirrorText}` });
    return embed;
}
function parseMirrorSyncPayload(data) {
    const { activityId, userId, action } = data;
    const isValidAction = action === 'join' ||
        action === 'tentative' ||
        action === 'decline' ||
        action === 'leave' ||
        action === 'refresh';
    if (typeof activityId !== 'string' || typeof userId !== 'string' || !isValidAction) {
        return null;
    }
    return {
        activityId,
        userId,
        action,
        currentParticipants: typeof data.currentParticipants === 'number' ? data.currentParticipants : 0,
        maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
    };
}
function isRelevantMirrorOnShard(client, mirrors) {
    return mirrors.some(mirror => mirror.canSync() && mirror.mirrorMessageId && client.guilds.cache.has(mirror.mirrorGuildId));
}
async function syncRelevantMirrorMessages(client, mirrorService, mirrors, activity) {
    const relevantMirrors = mirrors.filter(mirror => mirror.canSync() && mirror.mirrorMessageId && client.guilds.cache.has(mirror.mirrorGuildId));
    if (relevantMirrors.length === 0) {
        return 0;
    }
    const baseEmbed = await (0, mirroredEventMessage_1.buildMirroredEventEmbed)(activity);
    const mirrorComponents = (0, mirroredEventMessage_1.buildMirroredEventComponents)(activity.id);
    let updatedCount = 0;
    for (const mirror of relevantMirrors) {
        const guild = client.guilds.cache.get(mirror.mirrorGuildId);
        if (!guild || !mirror.mirrorMessageId) {
            continue;
        }
        try {
            const channel = guild.channels.cache.get(mirror.mirrorChannelId);
            if (!channel?.isTextBased()) {
                continue;
            }
            const msg = await channel.messages.fetch(mirror.mirrorMessageId).catch(() => null);
            if (!msg) {
                continue;
            }
            const updatedEmbed = appendMirrorIdFooter(discord_js_1.EmbedBuilder.from(baseEmbed), mirror.id);
            await msg.edit({ embeds: [updatedEmbed], components: mirrorComponents });
            await mirrorService.recordSync(mirror.id);
            updatedCount++;
        }
        catch (error) {
            logger_1.logger.error(`MirrorSync: Failed to update mirror ${mirror.id}:`, error);
        }
    }
    return updatedCount;
}
async function syncSourceMessage(client, activity) {
    const sourceGuildId = activity.metadata?.discordServerId;
    if (!sourceGuildId) {
        return false;
    }
    const guild = client.guilds.cache.get(sourceGuildId);
    if (!guild) {
        return false;
    }
    try {
        const settingsList = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(sourceGuildId);
        const configuredChannelIds = Array.from(new Set(settingsList
            .map(s => s.eventSettings?.eventAnnouncementChannelId)
            .filter((id) => Boolean(id))));
        const fallbackChannelIds = Array.from(guild.channels.cache.values())
            .filter(channel => channel.isTextBased())
            .map(channel => channel.id);
        const channelIds = Array.from(new Set([...configuredChannelIds, ...fallbackChannelIds])).slice(0, SOURCE_SCAN_CHANNEL_LIMIT);
        if (channelIds.length === 0) {
            return false;
        }
        const footerMarker = `ID: ${activity.id}`;
        let built = null;
        for (const channelId of channelIds) {
            const channel = guild.channels.cache.get(channelId);
            if (!channel?.isTextBased()) {
                continue;
            }
            const messages = await channel.messages
                .fetch({ limit: SOURCE_SCAN_MESSAGE_LIMIT })
                .catch(() => null);
            if (!messages) {
                continue;
            }
            const sourceMsg = messages.find(m => {
                const footer = m.embeds[0]?.footer?.text ?? '';
                return footer.includes(footerMarker) && !footer.includes('Mirror ID:');
            });
            if (!sourceMsg) {
                continue;
            }
            built ??= await (0, mirroredEventMessage_1.buildSourceEventMessage)(activity);
            await sourceMsg.edit({ embeds: [built.embed], components: built.components });
            return true;
        }
    }
    catch (error) {
        logger_1.logger.error(`MirrorSync: Failed to refresh source message for activity ${activity.id}:`, error);
    }
    return false;
}
function initializeMirrorSyncHandler(ipcService, client) {
    if (!ipcService.isAvailable()) {
        logger_1.logger.debug('MirrorSync: IPC not available, mirror sync disabled');
        return;
    }
    ipcService.registerHandler(mirrorSyncPublisher_1.MIRROR_RSVP_SYNC_ACTION, async (message) => {
        const data = message.data;
        const payload = parseMirrorSyncPayload(data);
        if (!payload) {
            return {
                correlationId: message.correlationId,
                success: false,
                status: 'handled',
                definitive: true,
                error: 'Invalid mirror sync payload: missing activityId, userId, or action',
            };
        }
        try {
            const mirrorService = activity_1.EventMirrorService.getInstance();
            const [activity, mirrors] = await Promise.all([
                getActivityServiceInstance().getActivityById(payload.activityId),
                mirrorService.findRelatedMirrors(payload.activityId),
            ]);
            if (!activity) {
                return {
                    correlationId: message.correlationId,
                    success: true,
                    status: 'handled',
                    definitive: true,
                    data: { updatedCount: 0, sourceRefreshed: false, reason: 'activity_not_found' },
                };
            }
            const ownsSourceGuild = Boolean(activity.metadata?.discordServerId &&
                client.guilds.cache.has(activity.metadata.discordServerId));
            const ownsRelevantMirrorGuild = isRelevantMirrorOnShard(client, mirrors);
            if (!ownsSourceGuild && !ownsRelevantMirrorGuild) {
                return {
                    correlationId: message.correlationId,
                    success: true,
                    status: 'not_handled',
                    definitive: false,
                    data: {
                        updatedCount: 0,
                        sourceRefreshed: false,
                        reason: 'guild_not_cached',
                    },
                };
            }
            const [sourceRefreshed, updatedCount] = await Promise.all([
                syncSourceMessage(client, activity),
                mirrors.length > 0
                    ? syncRelevantMirrorMessages(client, mirrorService, mirrors, activity)
                    : Promise.resolve(0),
            ]);
            return {
                correlationId: message.correlationId,
                success: true,
                status: 'handled',
                definitive: true,
                data: { updatedCount, sourceRefreshed },
            };
        }
        catch (error) {
            return {
                correlationId: message.correlationId,
                success: false,
                status: 'handled',
                definitive: true,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });
    ipcService.onEvent(MIRROR_EMBED_UPDATE_EVENT, (data) => {
        logger_1.logger.debug('MirrorSync: Received embed update event', data);
    });
    logger_1.logger.info('🪞 Mirror RSVP sync handler initialized');
}
//# sourceMappingURL=mirrorSync.js.map