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
exports.SocialGroupService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const BotClientManager_1 = require("../../bot/BotClientManager");
const lfgEmbed_1 = require("../../bot/embeds/lfgEmbed");
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const LFGGroupHistory_1 = require("../../models/LFGGroupHistory");
const LFGReputationRating_1 = require("../../models/LFGReputationRating");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const logger_1 = require("../../utils/logger");
const ActivityService_1 = require("../activity/ActivityService");
const TenantService_1 = require("../base/TenantService");
const LFGSessionService_1 = require("./LFGSessionService");
class SocialGroupService extends TenantService_1.TenantService {
    historyRepository;
    posts = [];
    static instance;
    cleanupInterval;
    sessionService;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Activity_1.Activity));
        this.historyRepository = data_source_1.AppDataSource.getRepository(LFGGroupHistory_1.LFGGroupHistory);
        this.sessionService = LFGSessionService_1.lfgSessionService;
        this.cleanupInterval = setInterval(() => this.cleanupExpiredPosts(), 60000);
        this.cleanupInterval.unref();
    }
    static getInstance() {
        if (!SocialGroupService.instance) {
            SocialGroupService.instance = new SocialGroupService();
        }
        return SocialGroupService.instance;
    }
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
    }
    createPost(activity, description, creatorId, creatorName, maxPlayers, guildId, channelId, expirationMinutes = 60, options) {
        const id = `lfg-${Date.now()}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + expirationMinutes * 60000);
        const post = {
            id,
            activity,
            description,
            creatorId,
            creatorName,
            currentPlayers: 1,
            maxPlayers,
            members: [creatorId],
            createdAt: now,
            expiresAt,
            guildId,
            channelId,
            voiceChannelId: options?.voiceChannelId,
            isAutoLfg: options?.isAutoLfg,
            status: 'open',
            game: options?.game,
            isPublic: options?.isPublic,
        };
        this.posts.push(post);
        const orgId = this.getOrganizationIdForGuild(guildId) ?? `discord-guild-${guildId}`;
        try {
            void this.sessionService.createSession({
                hostUserId: creatorId,
                organizationId: orgId,
                activityType: activity,
                title: `${activity}: ${description}`,
                description,
                maxPlayers,
                minPlayers: 1,
                metadata: { guildId, channelId, originatedFrom: 'discord-lfg', lfgPostId: id, creatorName },
                tags: ['lfg', activity.toLowerCase()],
                ttlSeconds: expirationMinutes * 60,
            });
        }
        catch (e) {
            logger_1.logger.warn('Failed to persist LFG session to Redis', { error: String(e) });
        }
        return post;
    }
    getPost(postId) {
        return this.posts.find(p => p.id === postId);
    }
    async getActivePostsByGuild(guildId) {
        const now = new Date();
        const inMemoryPosts = this.posts.filter(p => p.guildId === guildId && p.status !== 'closed' && p.expiresAt > now);
        try {
            const guildSessions = await this.sessionService.getSessionsByGuild(guildId);
            if (!guildSessions || guildSessions.length === 0) {
                return inMemoryPosts;
            }
            const redisPosts = [];
            for (const session of guildSessions) {
                if (session.status === 'cancelled' || session.status === 'completed') {
                    continue;
                }
                const postId = session.metadata?.lfgPostId || session.id;
                if (inMemoryPosts.some(p => p.id === postId)) {
                    continue;
                }
                redisPosts.push({
                    id: postId,
                    activity: session.activityType,
                    description: session.description ?? session.title,
                    creatorId: session.hostUserId,
                    creatorName: session.metadata?.creatorName ?? '',
                    currentPlayers: session.currentPlayers?.length ?? 1,
                    maxPlayers: session.maxPlayers,
                    members: session.currentPlayers ?? [session.hostUserId],
                    createdAt: new Date(session.createdAt),
                    expiresAt: new Date(session.expiresAt),
                    guildId,
                    channelId: session.metadata?.channelId ?? '',
                    messageId: session.metadata?.messageId ?? undefined,
                    status: session.status === 'open' ? 'open' : session.status === 'full' ? 'full' : 'open',
                });
            }
            this.hydrateFromRedis(redisPosts);
            return [...inMemoryPosts, ...redisPosts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        catch (e) {
            logger_1.logger.warn('Failed to query Redis for LFG posts, using in-memory fallback', {
                error: e,
                guildId,
            });
            return inMemoryPosts;
        }
    }
    hydrateFromRedis(redisPosts) {
        for (const redisPost of redisPosts) {
            if (!this.posts.some(p => p.id === redisPost.id)) {
                this.posts.push(redisPost);
            }
        }
    }
    async getAllActivePosts() {
        const now = new Date();
        const inMemoryPosts = this.posts.filter(p => p.status !== 'closed' && p.expiresAt > now);
        try {
            const sessions = await this.sessionService.findOpenSessions({
                status: [LFGSessionService_1.LFGSessionStatus.OPEN, LFGSessionService_1.LFGSessionStatus.FULL, LFGSessionService_1.LFGSessionStatus.IN_PROGRESS],
            });
            if (!sessions || sessions.length === 0) {
                return inMemoryPosts;
            }
            const redisPosts = [];
            const seenIds = new Set();
            inMemoryPosts.forEach(p => seenIds.add(p.id));
            for (const session of sessions) {
                const postId = session.metadata?.lfgPostId || session.id;
                if (seenIds.has(postId)) {
                    continue;
                }
                seenIds.add(postId);
                redisPosts.push({
                    id: postId,
                    activity: session.activityType,
                    description: session.description ?? session.title,
                    creatorId: session.hostUserId,
                    creatorName: session.metadata?.creatorName ?? '',
                    currentPlayers: session.currentPlayers?.length ?? 1,
                    maxPlayers: session.maxPlayers,
                    members: session.currentPlayers ?? [session.hostUserId],
                    createdAt: new Date(session.createdAt),
                    expiresAt: new Date(session.expiresAt),
                    guildId: session.metadata?.guildId ?? '',
                    channelId: session.metadata?.channelId ?? '',
                    messageId: session.metadata?.messageId ?? undefined,
                    status: session.status === 'open' ? 'open' : session.status === 'full' ? 'full' : 'open',
                });
            }
            return [...inMemoryPosts, ...redisPosts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        catch (e) {
            logger_1.logger.warn('Failed to query Redis for LFG posts, using in-memory fallback', { error: e });
            return inMemoryPosts;
        }
    }
    joinPost(postId, userId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            throw new Error('LFG post not found');
        }
        if (post.status === 'closed') {
            throw new Error('This LFG post is closed');
        }
        if (post.status === 'full') {
            throw new Error('This group is already full');
        }
        if (post.members.includes(userId)) {
            throw new Error('You are already in this group');
        }
        const now = new Date();
        if (post.expiresAt <= now) {
            throw new Error('This LFG post has expired');
        }
        post.members.push(userId);
        post.currentPlayers = post.members.length;
        if (post.currentPlayers >= post.maxPlayers) {
            post.status = 'full';
        }
        return post;
    }
    leavePost(postId, userId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            throw new Error('LFG post not found');
        }
        if (!post.members.includes(userId)) {
            throw new Error('You are not in this group');
        }
        if (post.creatorId === userId) {
            throw new Error('Creator cannot leave. Use close instead');
        }
        post.members = post.members.filter(id => id !== userId);
        post.currentPlayers = post.members.length;
        if (post.status === 'full') {
            post.status = 'open';
        }
        return post;
    }
    closePost(postId, userId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            throw new Error('LFG post not found');
        }
        if (post.creatorId !== userId) {
            throw new Error('Only the creator can close this LFG post');
        }
        post.status = 'closed';
        this.closeRedisSession(postId).catch((e) => {
            logger_1.logger.debug('Failed to cancel Redis session for closed LFG post', {
                postId,
                error: String(e),
            });
        });
        if (post.autoCreatedVoiceChannel && post.voiceChannelId) {
            void this.deleteAutoCreatedVoiceChannel(post);
        }
        return post;
    }
    deletePost(postId) {
        const index = this.posts.findIndex(p => p.id === postId);
        if (index !== -1) {
            this.posts.splice(index, 1);
        }
    }
    setMessageId(postId, messageId) {
        const post = this.posts.find(p => p.id === postId);
        if (post) {
            post.messageId = messageId;
        }
        void this.persistMessageIdToRedis(postId, messageId);
    }
    async persistMessageIdToRedis(postId, messageId) {
        try {
            const sessions = await this.sessionService.findOpenSessions({});
            const session = sessions.find(s => s.metadata?.lfgPostId === postId);
            if (session) {
                await this.sessionService.updateSession(session.id, {
                    metadata: { ...session.metadata, messageId },
                });
            }
        }
        catch (e) {
            logger_1.logger.debug('Failed to persist messageId to Redis session', {
                postId,
                error: String(e),
            });
        }
    }
    async closeRedisSession(postId) {
        const sessions = await this.sessionService.findOpenSessions({});
        const session = sessions.find(s => s.metadata?.lfgPostId === postId);
        if (session) {
            await this.sessionService.updateSession(session.id, {
                status: LFGSessionService_1.LFGSessionStatus.CANCELLED,
            });
        }
    }
    clearAllPosts() {
        this.posts = [];
    }
    static toParticipantInfo(userId, post, options) {
        const isInitiator = userId === post.creatorId;
        return {
            userId,
            organizationId: undefined,
            username: options?.username || (isInitiator ? post.creatorName : userId),
            displayName: options?.displayName || (isInitiator ? post.creatorName : undefined),
            roles: [isInitiator ? shared_types_1.SystemRole.LFG_INITIATOR : shared_types_1.SystemRole.LFG_MEMBER],
            primaryRole: isInitiator ? 'initiator' : 'member',
            status: post.status === 'closed' ? 'completed' : 'active',
            joinedAt: post.createdAt,
            source: 'manual',
            metadata: {
                lfgPostId: post.id,
                activity: post.activity,
                guildId: post.guildId,
                channelId: post.channelId,
            },
        };
    }
    toParticipantInfo(userId, post, options) {
        return SocialGroupService.toParticipantInfo(userId, post, options);
    }
    cleanupExpiredPosts() {
        const now = new Date();
        const beforeCount = this.posts.length;
        this.markExpiredPostsAsClosed(now);
        const postsToDelete = this.removeStaleClosedPosts(now);
        for (const post of postsToDelete) {
            if (post.messageId && post.channelId) {
                void this.deleteExpiredMessage(post);
            }
            if (post.autoCreatedVoiceChannel && post.voiceChannelId) {
                void this.deleteAutoCreatedVoiceChannel(post);
            }
        }
        const removedCount = beforeCount - this.posts.length;
        if (removedCount > 0) {
            logger_1.logger.info(`🧹 Cleaned up ${removedCount} expired LFG posts`);
        }
    }
    markExpiredPostsAsClosed(now) {
        let client;
        for (const post of this.posts) {
            if (post.status === 'closed') {
                continue;
            }
            if (post.voiceChannelId && post.autoCreatedVoiceChannel) {
                client ??= this.getDiscordClient();
                if (!client) {
                    continue;
                }
                const vc = client.channels.cache.get(post.voiceChannelId);
                const vcMemberCount = vc instanceof discord_js_1.VoiceChannel ? vc.members.size : -1;
                if (vcMemberCount === 0 && now.getTime() - post.createdAt.getTime() >= 300_000) {
                    logger_1.logger.info('🔇 Auto-closing LFG post — voice channel is empty', {
                        postId: post.id,
                        activity: post.activity,
                    });
                    post.status = 'closed';
                    void this.finalizeClosedSession(post);
                    if (post.messageId && post.channelId) {
                        void this.deleteExpiredMessage(post);
                    }
                    void this.deleteAutoCreatedVoiceChannel(post);
                    continue;
                }
                if (vcMemberCount > 0 &&
                    post.expiresAt <= now &&
                    !post._extended) {
                    const originalDurationMs = post.expiresAt.getTime() - post.createdAt.getTime();
                    const extensionMs = Math.floor(originalDurationMs * 0.5);
                    post.expiresAt = new Date(now.getTime() + extensionMs);
                    post._extended = true;
                    logger_1.logger.info('⏱️ Extended LFG post — voice channel still active', {
                        postId: post.id,
                        extensionMinutes: Math.round(extensionMs / 60_000),
                        newExpiry: post.expiresAt.toISOString(),
                    });
                    continue;
                }
            }
            if (post.expiresAt <= now) {
                post.status = 'closed';
                void this.finalizeClosedSession(post);
                if (post.messageId && post.channelId) {
                    void this.deleteExpiredMessage(post);
                }
                if (post.autoCreatedVoiceChannel && post.voiceChannelId) {
                    void this.deleteAutoCreatedVoiceChannel(post);
                }
            }
        }
    }
    removeStaleClosedPosts(now) {
        const postsToDelete = [];
        this.posts = this.posts.filter(p => {
            if (p.status === 'closed') {
                const pastGrace = now.getTime() - p.expiresAt.getTime() >= 300000;
                if (pastGrace) {
                    postsToDelete.push(p);
                    return false;
                }
            }
            return true;
        });
        return postsToDelete;
    }
    async editExpiredMessage(post) {
        try {
            const client = this.getDiscordClient();
            if (!client) {
                return;
            }
            const channel = await client.channels.fetch(post.channelId).catch(() => null);
            if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
                return;
            }
            const messageId = post.messageId;
            if (!messageId) {
                return;
            }
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (!message) {
                return;
            }
            const embed = (0, lfgEmbed_1.buildLfgEmbed)(post);
            const buttons = (0, lfgEmbed_1.buildLfgButtons)(post.id, true);
            await message.edit({ embeds: [embed], components: [buttons] });
        }
        catch (error) {
            logger_1.logger.debug('Failed to edit expired LFG message', {
                postId: post.id,
                messageId: post.messageId,
                error: String(error),
            });
        }
    }
    async deleteExpiredMessage(post) {
        try {
            const client = this.getDiscordClient();
            if (!client) {
                return;
            }
            const channel = await client.channels.fetch(post.channelId).catch(() => null);
            if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
                return;
            }
            const messageId = post.messageId;
            if (!messageId) {
                return;
            }
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (!message) {
                return;
            }
            await message.delete();
            logger_1.logger.debug('🗑️ Deleted expired LFG message', {
                postId: post.id,
                messageId: post.messageId,
            });
        }
        catch (error) {
            logger_1.logger.debug('Failed to delete expired LFG message', {
                postId: post.id,
                messageId: post.messageId,
                error: String(error),
            });
        }
    }
    async deleteAutoCreatedVoiceChannel(post) {
        try {
            const client = this.getDiscordClient();
            if (!client) {
                return;
            }
            const vcId = post.voiceChannelId;
            if (!vcId) {
                return;
            }
            const vc = await client.channels.fetch(vcId).catch(() => null);
            if (!vc) {
                return;
            }
            await vc.delete('LFG post expired — auto-created voice channel removed');
            logger_1.logger.debug('🗑️ Deleted LFG voice channel', {
                postId: post.id,
                voiceChannelId: post.voiceChannelId,
            });
        }
        catch (error) {
            logger_1.logger.debug('Failed to delete LFG voice channel', {
                postId: post.id,
                voiceChannelId: post.voiceChannelId,
                error: String(error),
            });
        }
    }
    getDiscordClient() {
        try {
            return BotClientManager_1.BotClientManager.getInstance().getClient();
        }
        catch {
            return null;
        }
    }
    async finalizeClosedSession(post) {
        const flagged = post;
        if (flagged._finalized) {
            return;
        }
        flagged._finalized = true;
        if (post.members.length <= 1) {
            return;
        }
        try {
            const histories = await this.recordFromLFGPost(post, true);
            const sessionId = histories[0]?.id;
            if (!sessionId) {
                logger_1.logger.warn('finalizeClosedSession: recordFromLFGPost returned no histories', {
                    postId: post.id,
                    memberCount: post.members.length,
                });
                return;
            }
            const client = this.getDiscordClient();
            if (!client) {
                logger_1.logger.debug('finalizeClosedSession: Discord client unavailable — skipping DM prompts', {
                    postId: post.id,
                    sessionId,
                });
                return;
            }
            const guild = post.guildId ? (client.guilds.cache.get(post.guildId) ?? null) : null;
            const displayNameFor = async (userId) => {
                if (guild) {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            return member.displayName || member.user.username;
                        }
                    }
                    catch {
                    }
                }
                try {
                    const user = await client.users.fetch(userId);
                    return user.username;
                }
                catch {
                    return userId;
                }
            };
            for (const memberId of post.members) {
                try {
                    const recipient = await client.users.fetch(memberId);
                    const otherIds = post.members.filter(id => id !== memberId).slice(0, 5);
                    const targets = await Promise.all(otherIds.map(async (id) => ({
                        userId: id,
                        displayName: await displayNameFor(id),
                    })));
                    if (targets.length === 0) {
                        continue;
                    }
                    await recipient.send({
                        embeds: [(0, lfgEmbed_1.buildLfgDmRatingEmbed)(post, sessionId)],
                        components: [
                            ...(0, lfgEmbed_1.buildLfgDmRatingRows)(sessionId, targets),
                            (0, lfgEmbed_1.buildLfgDmDoneButton)(sessionId),
                        ],
                    });
                }
                catch (dmError) {
                    logger_1.logger.debug('finalizeClosedSession: failed to DM rating prompt', {
                        postId: post.id,
                        sessionId,
                        memberId,
                        error: String(dmError),
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('finalizeClosedSession: failed to finalize LFG session', {
                postId: post.id,
                memberCount: post.members.length,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }
    async recordSession(params) {
        const records = [];
        for (const userId of params.participantIds) {
            const history = this.historyRepository.create({
                lfgPostId: params.lfgPostId,
                activity: params.activity,
                description: params.description,
                creatorId: params.creatorId,
                creatorName: params.creatorName,
                participantIds: params.participantIds,
                participantCount: params.participantIds.length,
                guildId: params.guildId,
                channelId: params.channelId,
                wasSuccessful: params.wasSuccessful,
                durationMinutes: params.durationMinutes,
                completionNotes: params.completionNotes,
                userId,
            });
            records.push(await this.historyRepository.save(history));
        }
        logger_1.logger.info(`📝 Recorded ${records.length} LFG history entries for session ${params.lfgPostId}`);
        return records;
    }
    async recordFromLFGPost(post, wasSuccessful, durationMinutes, completionNote, submittedBy) {
        return this.recordSession({
            lfgPostId: post.id,
            activity: post.activity,
            description: post.description,
            creatorId: post.creatorId,
            creatorName: post.creatorName,
            participantIds: post.members,
            guildId: post.guildId,
            channelId: post.channelId,
            wasSuccessful,
            durationMinutes,
            completionNotes: completionNote
                ? {
                    submittedBy: submittedBy || post.creatorId,
                    note: completionNote,
                    timestamp: new Date(),
                }
                : undefined,
        });
    }
    async getUserHistory(userId, limit = 50) {
        return this.historyRepository
            .createQueryBuilder('history')
            .where('history.userId = :userId', { userId })
            .orderBy('history.completedAt', 'DESC')
            .limit(limit)
            .getMany();
    }
    async getUserHistoryByActivity(userId, activity, limit = 50) {
        return this.historyRepository
            .createQueryBuilder('history')
            .where('history.userId = :userId', { userId })
            .andWhere('history.activity = :activity', { activity })
            .orderBy('history.completedAt', 'DESC')
            .limit(limit)
            .getMany();
    }
    async getUserStats(userId) {
        const history = await this.getUserHistory(userId, 1000);
        if (history.length === 0) {
            return {
                totalSessions: 0,
                successfulSessions: 0,
                failedSessions: 0,
                successRate: 0,
                totalPlayersEncountered: 0,
            };
        }
        const successful = history.filter(h => h.wasSuccessful).length;
        const durationsWithData = history.filter(h => h.durationMinutes);
        const averageDuration = durationsWithData.length > 0
            ? durationsWithData.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) /
                durationsWithData.length
            : undefined;
        const activityCounts = {};
        history.forEach(h => {
            activityCounts[h.activity] = (activityCounts[h.activity] || 0) + 1;
        });
        const favoriteActivity = Object.entries(activityCounts).sort(([, a], [, b]) => b - a)[0]?.[0];
        const uniquePlayers = new Set();
        history.forEach(h => {
            h.participantIds.forEach(id => {
                if (id !== userId) {
                    uniquePlayers.add(id);
                }
            });
        });
        return {
            totalSessions: history.length,
            successfulSessions: successful,
            failedSessions: history.length - successful,
            successRate: Math.round((successful / history.length) * 100),
            averageDuration: averageDuration ? Math.round(averageDuration) : undefined,
            favoriteActivity,
            totalPlayersEncountered: uniquePlayers.size,
        };
    }
    async getUserActivityStats(userId) {
        const history = await this.getUserHistory(userId, 1000);
        const activityStats = {};
        history.forEach(h => {
            if (!activityStats[h.activity]) {
                activityStats[h.activity] = {
                    sessions: 0,
                    successful: 0,
                    averageRating: 0,
                };
            }
            activityStats[h.activity].sessions++;
            if (h.wasSuccessful) {
                activityStats[h.activity].successful++;
            }
        });
        Object.keys(activityStats).forEach(activity => {
            const stats = activityStats[activity];
            stats.averageRating = Math.round((stats.successful / stats.sessions) * 100);
        });
        return activityStats;
    }
    async getRecentSessions(guildId, limit = 20) {
        return this.historyRepository
            .createQueryBuilder('history')
            .where('history.guildId = :guildId', { guildId })
            .orderBy('history.completedAt', 'DESC')
            .limit(limit)
            .getMany();
    }
    async getSession(sessionId) {
        return this.historyRepository.findOne({ where: { id: sessionId } });
    }
    async getSharedSessions(userId1, userId2, limit = 50) {
        const user1Sessions = await this.getUserHistory(userId1, 500);
        return user1Sessions
            .filter(session => session.participantIds.includes(userId2))
            .slice(0, limit);
    }
    async findFrequentPositiveMatches(userId, guildId, minSessions = 3) {
        const sessions = await this.historyRepository.find({
            where: { userId, guildId },
            order: { completedAt: 'DESC' },
            take: 200,
        });
        const coPlayCounts = new Map();
        for (const session of sessions) {
            for (const participantId of session.participantIds) {
                if (participantId === userId) {
                    continue;
                }
                coPlayCounts.set(participantId, (coPlayCounts.get(participantId) ?? 0) + 1);
            }
        }
        const candidates = Array.from(coPlayCounts.entries())
            .filter(([, count]) => count >= minSessions)
            .sort(([, a], [, b]) => b - a);
        if (candidates.length === 0) {
            return [];
        }
        const ratingRepository = data_source_1.AppDataSource.getRepository(LFGReputationRating_1.LFGReputationRating);
        const results = [];
        for (const [candidateId, sessionCount] of candidates) {
            const ratingGiven = await ratingRepository.findOne({
                where: { userId: candidateId, raterId: userId, isPositive: true },
                order: { createdAt: 'DESC' },
            });
            const ratingReceived = await ratingRepository.findOne({
                where: { userId, raterId: candidateId, isPositive: true },
                order: { createdAt: 'DESC' },
            });
            results.push({
                userId: candidateId,
                sharedSessionCount: sessionCount,
                mutualPositive: !!(ratingGiven && ratingReceived),
            });
        }
        return results.filter(r => r.mutualPositive);
    }
    async cleanupOldHistory(daysOld = 180) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await this.historyRepository
            .createQueryBuilder()
            .delete()
            .where('completedAt < :cutoff', { cutoff: cutoffDate })
            .execute();
        logger_1.logger.info(`🧹 Cleaned up ${result.affected || 0} old LFG history records`);
        return result.affected || 0;
    }
    async findMatches(userId, preferences, criteria, organizationId) {
        const query = this.repository
            .createQueryBuilder('activity')
            .where('activity.status = :status', { status: Activity_1.ActivityStatus.OPEN })
            .andWhere('activity.maxParticipants > 0');
        if (organizationId) {
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (criteria.activityTypes.length > 0) {
            query.andWhere('activity.activityType IN (:...types)', { types: criteria.activityTypes });
        }
        if (criteria.location) {
            query.andWhere('activity.location = :location', { location: criteria.location });
        }
        if (criteria.timeRange) {
            query.andWhere('activity.scheduledStartDate BETWEEN :start AND :end', {
                start: criteria.timeRange.start,
                end: criteria.timeRange.end,
            });
        }
        const activities = await query.getMany();
        const matches = [];
        for (const activity of activities) {
            const matchScore = this.calculateMatchScore(activity, preferences, criteria);
            if (matchScore > 0) {
                const participantCount = activity.currentParticipants ?? 0;
                const availableSlots = activity.maxParticipants - participantCount;
                if (availableSlots > 0) {
                    matches.push({
                        activityId: activity.id,
                        matchScore,
                        reasons: this.getMatchReasons(activity, preferences, criteria),
                        activity,
                        availableSlots,
                    });
                }
            }
        }
        return matches.sort((a, b) => b.matchScore - a.matchScore);
    }
    calculateMatchScore(activity, preferences, criteria) {
        let score = 50;
        if (criteria.activityTypes.includes(activity.activityType)) {
            score += 20;
        }
        const activitySkill = activity.metadata?.skillLevel;
        if (activitySkill === preferences.skillLevel) {
            score += 15;
        }
        if (activity.voiceChannelId && preferences.communicationPreference !== 'text') {
            score += 10;
        }
        if (criteria.groupSize) {
            const participants = activity.currentParticipants ?? 0;
            if (participants >= criteria.groupSize.min && participants <= criteria.groupSize.max) {
                score += 10;
            }
        }
        return Math.max(0, Math.min(100, score));
    }
    getMatchReasons(activity, preferences, criteria) {
        const reasons = [];
        if (criteria.activityTypes.includes(activity.activityType)) {
            reasons.push('Activity type matches your preferences');
        }
        if (activity.metadata?.skillLevel === preferences.skillLevel) {
            reasons.push('Skill level is a good match');
        }
        if (activity.voiceChannelId) {
            reasons.push('Voice channel available');
        }
        const participantCount = activity.currentParticipants ?? 0;
        if (criteria.groupSize && participantCount >= criteria.groupSize.min) {
            reasons.push('Group has enough members');
        }
        return reasons;
    }
    async formalizeToActivity(lfgPostId) {
        const post = this.getPost(lfgPostId);
        if (!post) {
            throw new Error('LFG post not found');
        }
        const activityService = new ActivityService_1.ActivityService();
        const orgId = this.getOrganizationIdForGuild(post.guildId);
        const activity = await activityService.createActivity('', {
            title: `${post.activity}: ${post.description}`,
            description: post.description,
            activityType: Activity_1.ActivityType.LFG,
            creatorId: post.creatorId,
            creatorName: post.creatorName,
            organizationId: orgId,
            scheduledStartDate: new Date(),
            estimatedDuration: Math.floor((post.expiresAt.getTime() - new Date().getTime()) / 60000),
            maxParticipants: post.maxPlayers,
            minParticipants: 1,
            tags: [post.activity.toLowerCase(), 'lfg', 'casual'],
            metadata: {
                lfgActivity: post.activity,
                quickJoin: true,
                originatedFromLFG: true,
                lfgPostId: post.id,
            },
        });
        for (const memberId of post.members) {
            let canJoin = true;
            if (orgId) {
                try {
                    const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
                    const membership = await membershipRepo.findOne({
                        where: { userId: memberId, organizationId: orgId, isActive: true },
                    });
                    canJoin = !!membership;
                }
                catch (err) {
                    logger_1.logger.warn('Membership check failed during formalizeToActivity', { err });
                }
            }
            if (canJoin) {
                await activityService.joinActivity(activity.id, {
                    userId: memberId,
                    userName: memberId === post.creatorId ? post.creatorName : 'LFG Member',
                    role: memberId === post.creatorId ? Activity_1.ParticipantRole.LEADER : Activity_1.ParticipantRole.MEMBER,
                });
            }
        }
        await activityService.updateActivity(activity.id, {
            status: Activity_1.ActivityStatus.IN_PROGRESS,
        });
        logger_1.logger.info(`LFG post ${lfgPostId} formalized to activity ${activity.id}`);
        return activity;
    }
    async completeLFG(lfgPostId, wasSuccessful, createActivityRecord = false, recordHistory = true) {
        const post = this.getPost(lfgPostId);
        if (!post) {
            throw new Error('LFG post not found');
        }
        post.status = 'closed';
        const durationMinutes = Math.floor((new Date().getTime() - post.createdAt.getTime()) / 60000);
        if (recordHistory) {
            try {
                await this.recordFromLFGPost(post, wasSuccessful, durationMinutes);
                logger_1.logger.info(`Session history recorded for LFG ${lfgPostId}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to record session history for LFG ${lfgPostId}:`, error);
            }
        }
        if (createActivityRecord) {
            const activityService = new ActivityService_1.ActivityService();
            const activity = await this.formalizeToActivity(lfgPostId);
            await activityService.completeActivity(activity.id, {
                submittedBy: post.creatorId,
                submittedAt: new Date(),
                outcome: wasSuccessful ? 'success' : 'failure',
                participantCount: post.members.length,
                duration: durationMinutes,
                creditsEarned: 0,
                reputationEarned: wasSuccessful ? 10 : 0,
                notableEvents: [`LFG ${post.activity} session`],
            });
            logger_1.logger.info(`LFG post ${lfgPostId} completed and recorded as activity`);
        }
        else {
            logger_1.logger.info(`LFG post ${lfgPostId} completed (no activity record)`);
        }
    }
    async convertToTeam(lfgPostId, organizationId, teamName, teamType) {
        const post = this.getPost(lfgPostId);
        if (!post) {
            throw new Error('LFG post not found');
        }
        if (post.status === 'closed') {
            throw new Error('LFG post is already closed');
        }
        const orgId = organizationId || this.getOrganizationIdForGuild(post.guildId);
        if (!orgId) {
            throw new Error('Organization context required for team conversion');
        }
        const { TeamService } = await Promise.resolve().then(() => __importStar(require('../team/TeamService')));
        const teamService = new TeamService();
        const team = await teamService.createTeam(orgId, {
            name: teamName,
            description: `Formed from LFG group: ${post.activity} — ${post.description}`,
            type: teamType || 'squadron',
        });
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const eligibleMembers = [];
        for (const memberId of post.members) {
            try {
                const membership = await membershipRepo.findOne({
                    where: { userId: memberId, organizationId: orgId, isActive: true },
                });
                if (membership) {
                    eligibleMembers.push({
                        userId: memberId,
                        role: memberId === post.creatorId ? 'leader' : 'member',
                    });
                }
            }
            catch (err) {
                logger_1.logger.warn('Membership check failed during convertToTeam', { err, memberId });
            }
        }
        if (eligibleMembers.length > 0) {
            await teamService.bulkAddMembers(orgId, team.id, eligibleMembers);
        }
        post.status = 'closed';
        logger_1.logger.info(`LFG post ${lfgPostId} converted to team ${team.id}`, {
            organizationId: orgId,
            memberCount: eligibleMembers.length,
        });
        return { teamId: team.id, memberCount: eligibleMembers.length };
    }
    async convertToTeamFromUsers(guildId, memberIds, teamName, leaderId, teamType) {
        const orgId = this.getOrganizationIdForGuild(guildId);
        if (!orgId) {
            throw new Error('Organization context required — no guild-to-org mapping found');
        }
        const { TeamService } = await Promise.resolve().then(() => __importStar(require('../team/TeamService')));
        const teamService = new TeamService();
        const team = await teamService.createTeam(orgId, {
            name: teamName,
            description: 'Formed from frequent positive LFG sessions together',
            type: teamType || 'squadron',
        });
        const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const eligibleMembers = [];
        for (const memberId of memberIds) {
            try {
                const membership = await membershipRepo.findOne({
                    where: { userId: memberId, organizationId: orgId, isActive: true },
                });
                if (membership) {
                    eligibleMembers.push({
                        userId: memberId,
                        role: memberId === leaderId ? 'leader' : 'member',
                    });
                }
            }
            catch (err) {
                logger_1.logger.warn('Membership check failed during convertToTeamFromUsers', { err, memberId });
            }
        }
        if (eligibleMembers.length > 0) {
            await teamService.bulkAddMembers(orgId, team.id, eligibleMembers);
        }
        logger_1.logger.info(`Team ${team.id} created from suggestion`, {
            organizationId: orgId,
            memberCount: eligibleMembers.length,
            guildId,
        });
        return { teamId: team.id, memberCount: eligibleMembers.length };
    }
    getOrganizationIdForGuild(guildId) {
        if (!guildId) {
            return undefined;
        }
        try {
            const raw = process.env.GUILD_ORG_MAP;
            if (!raw) {
                return undefined;
            }
            const map = JSON.parse(raw);
            return map[guildId];
        }
        catch {
            return undefined;
        }
    }
}
exports.SocialGroupService = SocialGroupService;
//# sourceMappingURL=SocialGroupService.js.map