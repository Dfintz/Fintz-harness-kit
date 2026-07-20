"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerActivityAnnouncementListeners = registerActivityAnnouncementListeners;
const discord_js_1 = require("discord.js");
const VoiceServerService_1 = require("../../services/communication/voice/VoiceServerService");
const DiscordEventService_1 = require("../../services/discord/DiscordEventService");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const DomainEventBus_1 = require("../../services/shared/DomainEventBus");
const UserService_1 = require("../../services/user/UserService");
const logger_1 = require("../../utils/logger");
const mirrorSyncPublisher_1 = require("../mirrorSyncPublisher");
const voiceAutoCreate_1 = require("../voice/voiceAutoCreate");
const COLOR_CREATED = 0x3498db;
const COLOR_CANCELLED = 0xe74c3c;
const COLOR_RESCHEDULED = 0xf39c12;
const userService = new UserService_1.UserService();
async function lookupDiscordEventId(activityId) {
    try {
        const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../../config/database')));
        if (!AppDataSource.isInitialized) {
            return null;
        }
        const { Activity } = await Promise.resolve().then(() => __importStar(require('../../models/Activity')));
        const activity = await AppDataSource.getRepository(Activity).findOne({
            where: { id: activityId },
        });
        return activity?.discordEventId ?? null;
    }
    catch {
        return null;
    }
}
async function persistDiscordEventId(activityId, discordEventId) {
    try {
        const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../../config/database')));
        if (AppDataSource.isInitialized) {
            const { Activity } = await Promise.resolve().then(() => __importStar(require('../../models/Activity')));
            await AppDataSource.getRepository(Activity).update({ id: activityId }, { discordEventId });
            logger_1.logger.info(`Linked Discord event ${discordEventId} to activity ${activityId} (web-created)`);
        }
    }
    catch (err) {
        logger_1.logger.warn('Failed to persist discordEventId on activity', {
            activityId,
            discordEventId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
async function persistVoiceChannelLink(activityId, input) {
    try {
        const { AppDataSource } = await Promise.resolve().then(() => __importStar(require('../../config/database')));
        if (AppDataSource.isInitialized) {
            const { Activity } = await Promise.resolve().then(() => __importStar(require('../../models/Activity')));
            await AppDataSource.getRepository(Activity).update({ id: activityId }, {
                voiceChannelId: input.voiceChannelId,
                voiceChannelName: input.voiceChannelName,
                voiceChannel: {
                    autoCreate: input.autoCreate,
                    autoDelete: input.autoDelete,
                    channelId: input.voiceChannelId,
                    userLimit: input.userLimit,
                },
            });
        }
    }
    catch (err) {
        logger_1.logger.warn('Failed to persist voice channel link on activity', {
            activityId,
            voiceChannelId: input.voiceChannelId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
async function resolveDiscordUserId(hostUserId) {
    try {
        const user = await userService.getUserById(hostUserId);
        return user?.discordId || undefined;
    }
    catch {
        return undefined;
    }
}
async function resolveGuildMember(client, guildId, discordUserId) {
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
    }
    catch {
        return undefined;
    }
}
async function applyWebCreatedVoiceChannelMode(client, data, orgSettings) {
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
        const result = await (0, voiceAutoCreate_1.createEventTempVoiceChannel)({
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
async function autoCreateDiscordEvents(data, orgSettings) {
    if (!data.scheduledAt) {
        return;
    }
    const startDate = new Date(data.scheduledAt);
    if (!Number.isFinite(startDate.getTime())) {
        return;
    }
    const durationMs = (data.estimatedDuration ?? 120) * 60 * 1000;
    const endDate = new Date(startDate.getTime() + durationMs);
    const eventService = DiscordEventService_1.DiscordEventService.getInstance();
    let savedEventId = null;
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
        }
        catch (err) {
            logger_1.logger.warn('Failed to auto-create Discord scheduled event', {
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
function collectAnnouncementTargets(orgSettings) {
    const targets = [];
    for (const settings of orgSettings) {
        const evt = settings.eventSettings;
        const nt = settings.notificationPreferences;
        if (nt?.eventNotifications === false) {
            continue;
        }
        const channelId = evt?.eventAnnouncementChannelId ??
            nt?.eventNotificationChannelId ??
            nt?.announcementChannelId;
        if (!channelId || !settings.guildId) {
            continue;
        }
        const mentionsEnabled = evt?.enableEventMentions !== false;
        const roleIds = [];
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
function buildThreadNameFromEmbed(embed) {
    const title = typeof embed.data.title === 'string' ? embed.data.title : 'Event discussion';
    const cleaned = title.replace(/^[^A-Za-z0-9]+/, '').trim();
    return (cleaned || 'Event discussion').slice(0, 100);
}
async function postEmbed(client, target, embed, createThread = false) {
    const guild = client.guilds.cache.get(target.guildId);
    const channel = guild?.channels.cache.get(target.channelId);
    if (!channel?.isTextBased()) {
        return;
    }
    const content = target.notificationRoleIds.length > 0
        ? target.notificationRoleIds.map(id => `<@&${id}>`).join(' ')
        : undefined;
    const sentMessage = await channel.send({
        content,
        embeds: [embed],
        allowedMentions: target.notificationRoleIds.length > 0 ? { roles: target.notificationRoleIds } : { parse: [] },
    });
    if (createThread && target.createEventThread && sentMessage?.startThread) {
        try {
            await sentMessage.startThread({
                name: buildThreadNameFromEmbed(embed),
                autoArchiveDuration: 1440,
                reason: 'Auto-create event discussion thread from event settings',
            });
        }
        catch (err) {
            logger_1.logger.warn('Failed to auto-create event discussion thread', {
                guildId: target.guildId,
                channelId: target.channelId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    if (target.autoPublish &&
        channel.type === discord_js_1.ChannelType.GuildAnnouncement &&
        sentMessage?.crosspost) {
        try {
            await sentMessage.crosspost();
        }
        catch (err) {
            logger_1.logger.warn('Failed to crosspost announcement message', {
                guildId: target.guildId,
                channelId: target.channelId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
}
function registerActivityAnnouncementListeners(client) {
    const settingsSvc = DiscordSettingsService_1.discordSettingsService;
    DomainEventBus_1.domainEvents.on('activity:created', async (data) => {
        try {
            const orgSettings = await settingsSvc.getOrganizationSettings(data.organizationId);
            const targets = collectAnnouncementTargets(orgSettings);
            if (targets.length > 0) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(COLOR_CREATED)
                    .setTitle(`📣 New activity: ${data.title}`)
                    .addFields({ name: 'Type', value: String(data.activityType), inline: true }, { name: 'Host', value: `<@${data.hostUserId}>`, inline: true })
                    .setTimestamp();
                if (data.scheduledAt) {
                    const ts = Math.floor(new Date(data.scheduledAt).getTime() / 1000);
                    if (Number.isFinite(ts)) {
                        embed.addFields({ name: 'Scheduled', value: `<t:${ts}:F> (<t:${ts}:R>)` });
                    }
                }
                embed.setFooter({ text: `Activity ${data.activityId}` });
                try {
                    const voiceService = VoiceServerService_1.VoiceServerService.getInstance();
                    const orgConfig = await voiceService.getOrgVoiceConfig(data.organizationId);
                    if (orgConfig?.enabled && orgConfig.connectUrl) {
                        embed.addFields({
                            name: '🎧 Voice Channel',
                            value: `[Join Voice](${orgConfig.connectUrl})`,
                            inline: true,
                        });
                    }
                }
                catch {
                }
                await Promise.allSettled(targets.map(t => postEmbed(client, t, embed, true)));
            }
            if (data.scheduledAt && !data.discordServerId) {
                await autoCreateDiscordEvents(data, orgSettings);
                await applyWebCreatedVoiceChannelMode(client, data, orgSettings);
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to post activity:created announcement', {
                activityId: data.activityId,
                organizationId: data.organizationId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
    DomainEventBus_1.domainEvents.on('activity:cancelled', async (data) => {
        (0, mirrorSyncPublisher_1.publishMirrorRefresh)(data.activityId);
        try {
            const orgSettings = await settingsSvc.getOrganizationSettings(data.organizationId);
            const targets = collectAnnouncementTargets(orgSettings);
            if (targets.length === 0) {
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
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
        }
        catch (err) {
            logger_1.logger.warn('Failed to post activity:cancelled announcement', {
                activityId: data.activityId,
                organizationId: data.organizationId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
    DomainEventBus_1.domainEvents.on('activity:rescheduled', async (data) => {
        (0, mirrorSyncPublisher_1.publishMirrorRefresh)(data.activityId);
        try {
            const orgSettings = await settingsSvc.getOrganizationSettings(data.organizationId);
            const targets = collectAnnouncementTargets(orgSettings);
            if (targets.length === 0) {
                return;
            }
            const newTs = Math.floor(new Date(data.newStartDate).getTime() / 1000);
            const embed = new discord_js_1.EmbedBuilder()
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
        }
        catch (err) {
            logger_1.logger.warn('Failed to post activity:rescheduled announcement', {
                activityId: data.activityId,
                organizationId: data.organizationId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
    DomainEventBus_1.domainEvents.on('activity:updated', async (data) => {
        (0, mirrorSyncPublisher_1.publishMirrorRefresh)(data.activityId);
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
            const endDate = startDate && data.estimatedDuration
                ? new Date(startDate.getTime() + data.estimatedDuration * 60 * 1000)
                : undefined;
            const eventService = DiscordEventService_1.DiscordEventService.getInstance();
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
                    .catch((err) => {
                    logger_1.logger.warn('Failed to sync Discord scheduled event on update', {
                        guildId: settings.guildId,
                        discordEventId,
                        error: err instanceof Error ? err.message : String(err),
                    });
                });
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to handle activity:updated for Discord sync', {
                activityId: data.activityId,
                organizationId: data.organizationId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
    logger_1.logger.info('📣 Activity announcement listeners registered');
}
//# sourceMappingURL=activityListener.js.map