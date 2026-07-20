"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadyCheckService = exports.READY_CHECK_VOTE_NOT_READY_PREFIX = exports.READY_CHECK_VOTE_READY_PREFIX = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const discord_js_1 = require("discord.js");
const BotClientManager_1 = require("../../bot/BotClientManager");
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const activityWebSocketController_1 = require("../../websocket/controllers/activityWebSocketController");
const NotificationPreferencesService_1 = require("../communication/notifications/NotificationPreferencesService");
const NotificationRouter_1 = require("../communication/notifications/NotificationRouter");
const DiscordSettingsService_1 = require("../discord/DiscordSettingsService");
const ActivityAuditLogger_1 = require("./ActivityAuditLogger");
const REDIS_KEY_PREFIX = 'ready_check:';
const ACTIVE_CHECK_KEY_PREFIX = 'ready_check_active:';
const DEFAULT_DURATION_SECONDS = 120;
const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 600;
exports.READY_CHECK_VOTE_READY_PREFIX = 'readycheck_vote_ready_';
exports.READY_CHECK_VOTE_NOT_READY_PREFIX = 'readycheck_vote_notready_';
class ReadyCheckService {
    activityRepo = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
    userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
    notificationRouter = new NotificationRouter_1.NotificationRouter();
    notificationPreferencesService = new NotificationPreferencesService_1.NotificationPreferencesService();
    async initiateReadyCheck(activityId, organizationId, userId, userName, durationSeconds = DEFAULT_DURATION_SECONDS) {
        if (durationSeconds < MIN_DURATION_SECONDS || durationSeconds > MAX_DURATION_SECONDS) {
            throw new apiErrors_1.ValidationError(`Duration must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds`);
        }
        const activity = await this.activityRepo.findOne({ where: { id: activityId, organizationId } });
        if (!activity) {
            throw new apiErrors_1.NotFoundError('Activity not found');
        }
        const isCreator = activity.creatorId === userId;
        const isLeader = await this.isLeaderParticipant(activityId, userId);
        if (!isCreator && !isLeader) {
            throw new apiErrors_1.ForbiddenError('Only the activity creator or a leader can initiate a ready check');
        }
        const validStatuses = [
            Activity_1.ActivityStatus.OPEN,
            Activity_1.ActivityStatus.PLANNING,
            Activity_1.ActivityStatus.RECRUITING,
            Activity_1.ActivityStatus.READY,
        ];
        if (!validStatuses.includes(activity.status)) {
            throw new apiErrors_1.ValidationError(`Cannot initiate ready check for activity in ${activity.status} status`);
        }
        const existingCheck = await this.getActiveReadyCheck(activityId);
        if (existingCheck?.status === 'pending') {
            throw new apiErrors_1.ConflictError('A ready check is already active for this activity');
        }
        const participants = await this.participantRepo.find({
            where: {
                activityId,
                status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED,
            },
        });
        if (participants.length < 2) {
            throw new apiErrors_1.ValidationError('Need at least 2 accepted participants to initiate a ready check');
        }
        const readyCheckId = node_crypto_1.default.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + durationSeconds * 1000);
        const responses = {};
        for (const p of participants) {
            responses[p.userId] = {
                userId: p.userId,
                userName: p.userName,
                response: 'pending',
            };
        }
        const readyCheck = {
            id: readyCheckId,
            activityId,
            activityTitle: activity.title,
            organizationId: activity.organizationId ?? '',
            initiatedBy: userId,
            initiatedByName: userName,
            status: 'pending',
            expiresAt: expiresAt.toISOString(),
            durationSeconds,
            responses,
            totalParticipants: participants.length,
            createdAt: now.toISOString(),
        };
        const redisTtl = durationSeconds + 60;
        await redis_1.redisClient.set(`${REDIS_KEY_PREFIX}${readyCheckId}`, readyCheck, redisTtl);
        await redis_1.redisClient.set(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`, readyCheckId, redisTtl);
        this.scheduleExpirationCheck(readyCheckId, activityId, durationSeconds);
        (0, activityWebSocketController_1.emitReadyCheckInitiated)(readyCheck.organizationId, activityId, this.toPublicReadyCheck(readyCheck), userId);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.READY_CHECK_INITIATED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: userName,
            details: {
                readyCheckId,
                durationSeconds,
                totalParticipants: participants.length,
            },
        });
        logger_1.logger.info(`Ready check ${readyCheckId} initiated for activity ${activityId} by ${userName} (${durationSeconds}s)`);
        for (const p of participants) {
            if (p.userId !== userId) {
                this.notificationRouter
                    .notifyUser({
                    context: NotificationRouter_1.NotificationContext.READY_CHECK_INITIATED,
                    userId: p.userId,
                    title: `Ready Check: ${activity.title}`,
                    message: `${userName} initiated a ready check. Respond within ${durationSeconds}s.`,
                    actionUrl: `/activities/${activityId}`,
                    metadata: { activityId, readyCheckId },
                })
                    .catch(() => {
                });
            }
        }
        void this.notifyParticipantsViaDiscordWithThreadFallback(readyCheck, participants).catch((error) => {
            logger_1.logger.warn('Ready check Discord notification flow failed', {
                readyCheckId,
                activityId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        void this.syncReadyCheckThreadPanel(readyCheck).catch((error) => {
            logger_1.logger.warn('Ready check thread panel sync failed on initiate', {
                readyCheckId,
                activityId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        return readyCheck;
    }
    async respond(activityId, userId, userName, response) {
        const readyCheck = await this.getActiveReadyCheckState(activityId);
        if (!readyCheck) {
            throw new apiErrors_1.NotFoundError('No active ready check found for this activity');
        }
        if (readyCheck.status !== 'pending') {
            throw new apiErrors_1.ValidationError(`Ready check is already ${readyCheck.status}`);
        }
        if (!readyCheck.responses[userId]) {
            throw new apiErrors_1.ForbiddenError('You are not a participant in this ready check');
        }
        if (new Date(readyCheck.expiresAt) < new Date()) {
            await this.expireReadyCheck(readyCheck);
            throw new apiErrors_1.ValidationError('This ready check has expired');
        }
        const previousResponse = readyCheck.responses[userId].response;
        if (previousResponse === response && readyCheck.responses[userId].respondedAt) {
            return readyCheck;
        }
        readyCheck.responses[userId] = {
            userId,
            userName,
            response,
            respondedAt: new Date().toISOString(),
        };
        const summary = this.calculateSummary(readyCheck);
        if (summary.pendingCount === 0) {
            readyCheck.status = 'completed';
            readyCheck.completedAt = new Date().toISOString();
        }
        const remainingTtl = Math.max(1, Math.ceil((new Date(readyCheck.expiresAt).getTime() - Date.now()) / 1000) + 60);
        await redis_1.redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, remainingTtl);
        (0, activityWebSocketController_1.emitReadyCheckResponse)(readyCheck.organizationId, activityId, {
            ...this.toPublicReadyCheck(readyCheck),
            respondedUserId: userId,
            respondedUserName: userName,
            respondedWith: response,
        }, userId);
        if (readyCheck.status === 'completed') {
            (0, activityWebSocketController_1.emitReadyCheckCompleted)(readyCheck.organizationId, activityId, this.toPublicReadyCheck(readyCheck), userId);
            ActivityAuditLogger_1.activityAuditLogger.log({
                action: ActivityAuditLogger_1.ActivityAuditAction.READY_CHECK_COMPLETED,
                activityId,
                activityTitle: readyCheck.activityTitle,
                activityType: Activity_1.ActivityType.OPERATION,
                organizationId: readyCheck.organizationId,
                performedById: 'system',
                performedByName: 'System',
                details: {
                    readyCheckId: readyCheck.id,
                    readyCount: summary.readyCount,
                    notReadyCount: summary.notReadyCount,
                    allReady: summary.allReady,
                },
            });
        }
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.READY_CHECK_RESPONDED,
            activityId,
            activityTitle: readyCheck.activityTitle,
            activityType: Activity_1.ActivityType.OPERATION,
            organizationId: readyCheck.organizationId,
            performedById: userId,
            performedByName: userName,
            details: {
                readyCheckId: readyCheck.id,
                response,
            },
        });
        await this.syncReadyCheckThreadPanel(readyCheck).catch((error) => {
            logger_1.logger.warn('Ready check thread panel sync failed on response', {
                readyCheckId: readyCheck.id,
                activityId,
                userId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        return readyCheck;
    }
    async getActiveReadyCheck(activityId) {
        return this.getActiveReadyCheckState(activityId);
    }
    async cancelReadyCheck(activityId, userId, userName) {
        const readyCheck = await this.getActiveReadyCheckState(activityId);
        if (!readyCheck) {
            throw new apiErrors_1.NotFoundError('No active ready check found for this activity');
        }
        if (readyCheck.status !== 'pending') {
            throw new apiErrors_1.ValidationError(`Ready check is already ${readyCheck.status}`);
        }
        const activity = await this.activityRepo.findOne({
            where: { id: activityId, organizationId: readyCheck.organizationId },
        });
        if (readyCheck.initiatedBy !== userId && activity?.creatorId !== userId) {
            throw new apiErrors_1.ForbiddenError('Only the initiator or activity creator can cancel a ready check');
        }
        readyCheck.status = 'cancelled';
        readyCheck.completedAt = new Date().toISOString();
        await redis_1.redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, 60);
        await redis_1.redisClient.del(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`);
        (0, activityWebSocketController_1.emitReadyCheckCancelled)(readyCheck.organizationId, activityId, userId);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.READY_CHECK_CANCELLED,
            activityId,
            activityTitle: activity?.title ?? '',
            activityType: activity?.activityType ?? Activity_1.ActivityType.OPERATION,
            organizationId: readyCheck.organizationId,
            performedById: userId,
            performedByName: userName,
            details: { readyCheckId: readyCheck.id },
        });
        await this.syncReadyCheckThreadPanel(readyCheck).catch((error) => {
            logger_1.logger.warn('Ready check thread panel sync failed on cancel', {
                readyCheckId: readyCheck.id,
                activityId,
                userId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        logger_1.logger.info(`Ready check ${readyCheck.id} cancelled for activity ${activityId} by ${userName}`);
    }
    getReadyCheckDiscordClient() {
        try {
            const manager = BotClientManager_1.BotClientManager.getInstance();
            if (!manager.isReady()) {
                return null;
            }
            return manager.getClient();
        }
        catch (error) {
            logger_1.logger.warn('Ready check Discord client unavailable', {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    buildReadyCheckDmMessage(readyCheck) {
        const expiresTs = Math.floor(new Date(readyCheck.expiresAt).getTime() / 1000);
        return [
            `🚀 Ready check for **${readyCheck.activityTitle}**`,
            `${readyCheck.initiatedByName} initiated a ready check.`,
            `Respond with the **Yes/No** buttons in the event thread (or \`/readycheck\`) before <t:${expiresTs}:R>.`,
        ].join('\n');
    }
    buildEventThreadName(activityTitle) {
        const title = `📣 New activity: ${activityTitle}`;
        const cleaned = title.replace(/^[^A-Za-z0-9]+/, '').trim();
        return (cleaned || 'Event discussion').slice(0, 100);
    }
    async shouldDeliverDiscordActivityNotification(userId) {
        try {
            return await this.notificationPreferencesService.shouldDeliver(userId, 'discord', 'activity');
        }
        catch (error) {
            logger_1.logger.warn('Ready check notification preference lookup failed; suppressing notification', {
                userId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async findActivityDiscussionThread(channel, activityTitle) {
        const expectedThreadName = this.buildEventThreadName(activityTitle).toLowerCase();
        const titleNeedle = activityTitle.trim().toLowerCase();
        const isMatch = (candidateName) => {
            const normalizedName = candidateName.toLowerCase();
            if (normalizedName === expectedThreadName) {
                return true;
            }
            return titleNeedle.length > 0 && normalizedName.includes(titleNeedle);
        };
        try {
            const active = await channel.threads.fetchActive();
            const match = active.threads.find((thread) => isMatch(thread.name));
            if (match) {
                return match;
            }
        }
        catch (error) {
            logger_1.logger.debug('Failed to search active event threads for ready check fallback', {
                channelId: channel.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const archived = await channel.threads.fetchArchived({
                type: 'public',
                fetchAll: false,
                limit: 100,
            });
            return archived.threads.find((thread) => isMatch(thread.name)) ?? null;
        }
        catch (error) {
            logger_1.logger.debug('Failed to search archived event threads for ready check fallback', {
                channelId: channel.id,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async createFallbackEventThread(channel, readyCheck) {
        try {
            const seedMessage = await channel.send({
                content: `🧵 Ready check fallback thread for **${readyCheck.activityTitle}** (\`${readyCheck.activityId}\`).`,
                allowedMentions: { parse: [] },
            });
            return await seedMessage.startThread({
                name: this.buildEventThreadName(readyCheck.activityTitle),
                autoArchiveDuration: 1440,
                reason: `Ready check DM fallback for activity ${readyCheck.activityId}`,
            });
        }
        catch (error) {
            logger_1.logger.warn('Failed to create ready check fallback event thread', {
                activityId: readyCheck.activityId,
                channelId: channel.id,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async postReadyCheckThreadFallbackMentions(client, readyCheck, failedDiscordIds) {
        const uniqueFailedIds = Array.from(new Set(failedDiscordIds));
        if (uniqueFailedIds.length === 0) {
            return;
        }
        const expiresTs = Math.floor(new Date(readyCheck.expiresAt).getTime() / 1000);
        const mentionContent = uniqueFailedIds.map(discordId => `<@${discordId}>`).join(' ');
        const fallbackMessage = [
            mentionContent,
            `🚀 Ready check for **${readyCheck.activityTitle}** is active (DM fallback).`,
            `Use the **Yes/No** buttons in this thread (or \`/readycheck\`) before <t:${expiresTs}:R>.`,
        ].join('\n');
        const orgSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(readyCheck.organizationId);
        let deliveredFallbackMention = false;
        for (const settings of orgSettings) {
            const guildId = settings.guildId;
            const channelId = settings.eventSettings?.eventAnnouncementChannelId;
            if (!guildId || !channelId) {
                continue;
            }
            const posted = await this.tryPostThreadFallbackInGuild(client, readyCheck, guildId, channelId, fallbackMessage, uniqueFailedIds);
            if (posted) {
                deliveredFallbackMention = true;
                break;
            }
        }
        if (!deliveredFallbackMention) {
            logger_1.logger.warn('Ready check thread fallback unavailable; no fallback mentions posted', {
                readyCheckId: readyCheck.id,
                activityId: readyCheck.activityId,
                failedDiscordIds: uniqueFailedIds,
            });
        }
    }
    async tryPostThreadFallbackInGuild(client, readyCheck, guildId, channelId, fallbackMessage, mentionUserIds) {
        try {
            const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
            if (!guild) {
                return false;
            }
            const channel = guild.channels.cache.get(channelId) ??
                (await guild.channels.fetch(channelId).catch(() => null));
            if (!channel) {
                return false;
            }
            if (channel.type !== discord_js_1.ChannelType.GuildText &&
                channel.type !== discord_js_1.ChannelType.GuildAnnouncement) {
                return false;
            }
            const threadHost = channel;
            let thread = await this.findActivityDiscussionThread(threadHost, readyCheck.activityTitle);
            thread ??= await this.createFallbackEventThread(threadHost, readyCheck);
            if (!thread) {
                return false;
            }
            await thread.send({
                content: fallbackMessage,
                allowedMentions: { users: [...mentionUserIds] },
            });
            return true;
        }
        catch (error) {
            logger_1.logger.warn('Failed to post ready check thread fallback mention', {
                readyCheckId: readyCheck.id,
                activityId: readyCheck.activityId,
                guildId,
                channelId,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async notifyParticipantsViaDiscordWithThreadFallback(readyCheck, participants) {
        const client = this.getReadyCheckDiscordClient();
        if (!client) {
            return;
        }
        const recipientIds = participants
            .map(participant => participant.userId)
            .filter(userId => userId !== readyCheck.initiatedBy);
        if (recipientIds.length === 0) {
            return;
        }
        const linkedUsers = await this.userRepo
            .createQueryBuilder('user')
            .select(['user.id', 'user.discordId'])
            .where('user.id IN (:...recipientIds)', { recipientIds })
            .getMany();
        const discordByUserId = new Map(linkedUsers.map(user => [user.id, user.discordId]));
        const failedDiscordIds = new Set();
        const dmMessage = this.buildReadyCheckDmMessage(readyCheck);
        for (const participant of participants) {
            if (participant.userId === readyCheck.initiatedBy) {
                continue;
            }
            const discordId = discordByUserId.get(participant.userId);
            if (!discordId) {
                continue;
            }
            const shouldDeliverDiscord = await this.shouldDeliverDiscordActivityNotification(participant.userId);
            if (!shouldDeliverDiscord) {
                continue;
            }
            try {
                const discordUser = await client.users.fetch(discordId);
                await discordUser.send(dmMessage);
            }
            catch (error) {
                failedDiscordIds.add(discordId);
                logger_1.logger.warn('Ready check DM delivery failed; attempting thread fallback mention', {
                    readyCheckId: readyCheck.id,
                    activityId: readyCheck.activityId,
                    userId: participant.userId,
                    discordId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        if (failedDiscordIds.size > 0) {
            await this.postReadyCheckThreadFallbackMentions(client, readyCheck, [...failedDiscordIds]);
        }
    }
    isThreadChannel(channel) {
        if (!channel || typeof channel !== 'object' || !('type' in channel)) {
            return false;
        }
        const channelType = channel.type;
        return (channelType === discord_js_1.ChannelType.PublicThread ||
            channelType === discord_js_1.ChannelType.PrivateThread ||
            channelType === discord_js_1.ChannelType.AnnouncementThread);
    }
    formatParticipantList(names) {
        if (names.length === 0) {
            return '—';
        }
        const maxNames = 15;
        const lines = names.slice(0, maxNames).map(name => `• ${name}`);
        if (names.length > maxNames) {
            lines.push(`• +${names.length - maxNames} more`);
        }
        return lines.join('\n');
    }
    getReadyCheckStatusLabel(status) {
        switch (status) {
            case 'pending':
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'expired':
                return 'Expired';
            case 'cancelled':
            default:
                return 'Cancelled';
        }
    }
    getReadyCheckStatusColor(status, allReady) {
        switch (status) {
            case 'pending':
                return 0x3b82f6;
            case 'completed':
                return allReady ? 0x22c55e : 0xf59e0b;
            case 'cancelled':
                return 0xfb923c;
            case 'expired':
            default:
                return 0x6b7280;
        }
    }
    buildReadyCheckThreadEmbed(readyCheck) {
        const summary = this.calculateSummary(readyCheck);
        const responses = Object.values(readyCheck.responses);
        const readyNames = responses
            .filter(response => response.response === 'ready')
            .map(response => response.userName);
        const notReadyNames = responses
            .filter(response => response.response === 'not_ready')
            .map(response => response.userName);
        const pendingNames = responses
            .filter(response => response.response === 'pending')
            .map(response => response.userName);
        const expiresTs = Math.floor(new Date(readyCheck.expiresAt).getTime() / 1000);
        return new discord_js_1.EmbedBuilder()
            .setColor(this.getReadyCheckStatusColor(readyCheck.status, summary.allReady))
            .setTitle(`🚀 Ready Check: ${readyCheck.activityTitle}`)
            .setDescription(`${readyCheck.initiatedByName} initiated this ready check.`)
            .addFields({
            name: 'Status',
            value: this.getReadyCheckStatusLabel(readyCheck.status),
            inline: true,
        }, {
            name: 'Ready',
            value: `${summary.readyCount}/${readyCheck.totalParticipants}`,
            inline: true,
        }, {
            name: 'Not Ready',
            value: String(summary.notReadyCount),
            inline: true,
        }, {
            name: 'Pending',
            value: String(summary.pendingCount),
            inline: true,
        }, {
            name: 'Ends',
            value: `<t:${expiresTs}:R>`,
            inline: true,
        }, {
            name: 'Ready Participants',
            value: this.formatParticipantList(readyNames),
            inline: false,
        }, {
            name: 'Not Ready Participants',
            value: this.formatParticipantList(notReadyNames),
            inline: false,
        }, {
            name: 'Pending Participants',
            value: this.formatParticipantList(pendingNames),
            inline: false,
        })
            .setTimestamp();
    }
    buildReadyCheckThreadComponents(readyCheck) {
        const disabled = readyCheck.status !== 'pending';
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${exports.READY_CHECK_VOTE_READY_PREFIX}${readyCheck.activityId}`)
                .setLabel('Yes')
                .setEmoji('✅')
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setDisabled(disabled), new discord_js_1.ButtonBuilder()
                .setCustomId(`${exports.READY_CHECK_VOTE_NOT_READY_PREFIX}${readyCheck.activityId}`)
                .setLabel('No')
                .setEmoji('❌')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setDisabled(disabled)),
        ];
    }
    async fetchStoredThreadPanelMessage(client, readyCheck) {
        if (!readyCheck.threadPanel) {
            return null;
        }
        const channel = client.channels.cache.get(readyCheck.threadPanel.channelId) ??
            (await client.channels.fetch(readyCheck.threadPanel.channelId).catch(() => null));
        if (!this.isThreadChannel(channel)) {
            return null;
        }
        const message = await channel.messages
            .fetch(readyCheck.threadPanel.messageId)
            .catch(() => null);
        if (!message) {
            return null;
        }
        return { thread: channel, message };
    }
    async resolveReadyCheckThread(client, readyCheck) {
        if (readyCheck.threadPanel?.channelId) {
            const existingThread = client.channels.cache.get(readyCheck.threadPanel.channelId) ??
                (await client.channels.fetch(readyCheck.threadPanel.channelId).catch(() => null));
            if (this.isThreadChannel(existingThread)) {
                return existingThread;
            }
        }
        const orgSettings = await DiscordSettingsService_1.discordSettingsService.getOrganizationSettings(readyCheck.organizationId);
        for (const settings of orgSettings) {
            if (!settings.guildId || !settings.eventSettings?.eventAnnouncementChannelId) {
                continue;
            }
            const guild = client.guilds.cache.get(settings.guildId) ??
                (await client.guilds.fetch(settings.guildId).catch(() => null));
            if (!guild) {
                continue;
            }
            const hostChannel = guild.channels.cache.get(settings.eventSettings.eventAnnouncementChannelId) ??
                (await guild.channels
                    .fetch(settings.eventSettings.eventAnnouncementChannelId)
                    .catch(() => null));
            if (!hostChannel ||
                (hostChannel.type !== discord_js_1.ChannelType.GuildText &&
                    hostChannel.type !== discord_js_1.ChannelType.GuildAnnouncement)) {
                continue;
            }
            const threadHost = hostChannel;
            let thread = await this.findActivityDiscussionThread(threadHost, readyCheck.activityTitle);
            thread ??= await this.createFallbackEventThread(threadHost, readyCheck);
            if (thread) {
                return thread;
            }
        }
        return null;
    }
    async syncReadyCheckThreadPanel(readyCheck) {
        const client = this.getReadyCheckDiscordClient();
        if (!client) {
            return;
        }
        const storedPanel = await this.fetchStoredThreadPanelMessage(client, readyCheck);
        const thread = storedPanel?.thread ??
            (await this.resolveReadyCheckThread(client, readyCheck).catch(() => null));
        if (!thread) {
            return;
        }
        const embed = this.buildReadyCheckThreadEmbed(readyCheck);
        const components = this.buildReadyCheckThreadComponents(readyCheck);
        if (storedPanel?.message) {
            await storedPanel.message.edit({
                embeds: [embed],
                components,
            });
            return;
        }
        const panelMessage = await thread.send({
            embeds: [embed],
            components,
            allowedMentions: { parse: [] },
        });
        readyCheck.threadPanel = {
            channelId: thread.id,
            messageId: panelMessage.id,
            postedAt: new Date().toISOString(),
        };
        const ttlSeconds = readyCheck.status === 'pending'
            ? Math.max(60, Math.ceil((new Date(readyCheck.expiresAt).getTime() - Date.now()) / 1000) + 60)
            : 60;
        await redis_1.redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, ttlSeconds);
    }
    async getActiveReadyCheckState(activityId) {
        const readyCheckId = await redis_1.redisClient.get(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`);
        if (!readyCheckId) {
            return null;
        }
        const readyCheck = await redis_1.redisClient.get(`${REDIS_KEY_PREFIX}${readyCheckId}`);
        if (!readyCheck) {
            await redis_1.redisClient.del(`${ACTIVE_CHECK_KEY_PREFIX}${activityId}`);
            return null;
        }
        if (readyCheck.status === 'pending' && new Date(readyCheck.expiresAt) < new Date()) {
            await this.expireReadyCheck(readyCheck);
            return { ...readyCheck, status: 'expired' };
        }
        return readyCheck;
    }
    async isLeaderParticipant(activityId, userId) {
        const participant = await this.participantRepo.findOne({
            where: { activityId, userId },
        });
        if (!participant) {
            return false;
        }
        return ['leader', 'co_leader', 'commander'].includes(participant.role);
    }
    async expireReadyCheck(readyCheck) {
        readyCheck.status = 'expired';
        readyCheck.completedAt = new Date().toISOString();
        await redis_1.redisClient.set(`${REDIS_KEY_PREFIX}${readyCheck.id}`, readyCheck, 60);
        await redis_1.redisClient.del(`${ACTIVE_CHECK_KEY_PREFIX}${readyCheck.activityId}`);
        await this.syncReadyCheckThreadPanel(readyCheck).catch((error) => {
            logger_1.logger.warn('Ready check thread panel sync failed on expiration', {
                readyCheckId: readyCheck.id,
                activityId: readyCheck.activityId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        (0, activityWebSocketController_1.emitReadyCheckExpired)(readyCheck.organizationId, readyCheck.activityId, this.toPublicReadyCheck(readyCheck));
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.READY_CHECK_EXPIRED,
            activityId: readyCheck.activityId,
            activityTitle: readyCheck.activityTitle,
            activityType: Activity_1.ActivityType.OPERATION,
            organizationId: readyCheck.organizationId,
            performedById: 'system',
            performedByName: 'System',
            details: {
                readyCheckId: readyCheck.id,
                ...this.calculateSummary(readyCheck),
            },
        });
        logger_1.logger.info(`Ready check ${readyCheck.id} expired for activity ${readyCheck.activityId}`);
    }
    scheduleExpirationCheck(readyCheckId, activityId, durationSeconds) {
        const expirationTimer = setTimeout(async () => {
            try {
                const readyCheck = await redis_1.redisClient.get(`${REDIS_KEY_PREFIX}${readyCheckId}`);
                if (readyCheck?.status === 'pending') {
                    await this.expireReadyCheck(readyCheck);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error checking ready check expiration for ${readyCheckId}:`, error);
            }
        }, durationSeconds * 1000);
        if (typeof expirationTimer.unref === 'function') {
            expirationTimer.unref();
        }
    }
    calculateSummary(readyCheck) {
        const responses = Object.values(readyCheck.responses);
        const readyCount = responses.filter(r => r.response === 'ready').length;
        const notReadyCount = responses.filter(r => r.response === 'not_ready').length;
        const pendingCount = responses.filter(r => r.response === 'pending').length;
        return {
            readyCount,
            notReadyCount,
            pendingCount,
            allReady: readyCount === readyCheck.totalParticipants,
        };
    }
    toPublicReadyCheck(state) {
        const summary = this.calculateSummary(state);
        return {
            id: state.id,
            activityId: state.activityId,
            organizationId: state.organizationId,
            initiatedBy: state.initiatedBy,
            initiatedByName: state.initiatedByName,
            status: state.status,
            expiresAt: state.expiresAt,
            durationSeconds: state.durationSeconds,
            responses: Object.values(state.responses),
            totalParticipants: state.totalParticipants,
            readyCount: summary.readyCount,
            notReadyCount: summary.notReadyCount,
            pendingCount: summary.pendingCount,
            createdAt: state.createdAt,
            completedAt: state.completedAt,
        };
    }
}
exports.ReadyCheckService = ReadyCheckService;
//# sourceMappingURL=ReadyCheckService.js.map