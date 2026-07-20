"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TunnelService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const data_source_1 = require("../../data-source");
const Tunnel_1 = require("../../models/Tunnel");
const TunnelAnalyticsEntry_1 = require("../../models/TunnelAnalyticsEntry");
const TunnelBan_1 = require("../../models/TunnelBan");
const TunnelMessage_1 = require("../../models/TunnelMessage");
const logger_1 = require("../../utils/logger");
const query_1 = require("../../utils/query");
const redis_1 = require("../../utils/redis");
class TunnelService {
    static instance;
    tunnelRepository = null;
    messageRepository = null;
    banRepository = null;
    analyticsRepository = null;
    cache;
    cacheLoadedAt = new Map();
    static CACHE_FRESHNESS_MS = 60_000;
    initialized = false;
    analyticsData = new Map();
    hourlyActivity = new Map();
    analyticsFlushInterval = null;
    constructor() {
        this.cache = new Map();
        for (let i = 0; i < 24; i++) {
            this.hourlyActivity.set(i, 0);
        }
    }
    static getInstance() {
        if (!TunnelService.instance) {
            TunnelService.instance = new TunnelService();
        }
        return TunnelService.instance;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            this.tunnelRepository = data_source_1.AppDataSource.getRepository(Tunnel_1.Tunnel);
            this.messageRepository = data_source_1.AppDataSource.getRepository(TunnelMessage_1.TunnelMessage);
            this.banRepository = data_source_1.AppDataSource.getRepository(TunnelBan_1.TunnelBan);
            this.analyticsRepository = data_source_1.AppDataSource.getRepository(TunnelAnalyticsEntry_1.TunnelAnalyticsEntry);
            const tunnelCount = await (0, query_1.findInBatches)(this.getRepository(), {}, batch => {
                for (const tunnel of batch) {
                    this.cacheTunnel(tunnel);
                }
            });
            this.analyticsFlushInterval = setInterval(() => void this.persistAnalytics(), 60 * 60 * 1000);
            this.analyticsFlushInterval.unref();
            this.initialized = true;
            logger_1.logger.info(`TunnelService initialized with ${tunnelCount} tunnels from database`);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize TunnelService:', error);
            throw error;
        }
    }
    getRepository() {
        if (!this.tunnelRepository) {
            this.tunnelRepository = data_source_1.AppDataSource.getRepository(Tunnel_1.Tunnel);
            this.initialized = true;
        }
        return this.tunnelRepository;
    }
    getMessageRepository() {
        this.messageRepository ??= data_source_1.AppDataSource.getRepository(TunnelMessage_1.TunnelMessage);
        return this.messageRepository;
    }
    getBanRepository() {
        this.banRepository ??= data_source_1.AppDataSource.getRepository(TunnelBan_1.TunnelBan);
        return this.banRepository;
    }
    getAnalyticsRepository() {
        this.analyticsRepository ??= data_source_1.AppDataSource.getRepository(TunnelAnalyticsEntry_1.TunnelAnalyticsEntry);
        return this.analyticsRepository;
    }
    ensureInitialized() {
        if (!this.initialized) {
            this.tunnelRepository = data_source_1.AppDataSource.getRepository(Tunnel_1.Tunnel);
            this.initialized = true;
        }
    }
    cacheTunnel(tunnel) {
        this.cache.set(tunnel.id, tunnel);
        this.cacheLoadedAt.set(tunnel.id, Date.now());
    }
    async createTunnel(name, creatorGuildId, creatorChannelId, isPublic = true, password, options) {
        this.ensureInitialized();
        const { rateLimitConfig, organizationId, contentFilterEnabled = true, guildName, channelName, } = options ?? {};
        const id = this.generateTunnelId();
        const repository = this.getRepository();
        const inviteCode = await this.generateInviteCode();
        const hashedPassword = password ? await bcrypt_1.default.hash(password, 10) : undefined;
        const tunnel = repository.create({
            id,
            name,
            inviteCode,
            creatorGuildId,
            creatorChannelId,
            isPublic,
            password: hashedPassword,
            connectedChannels: [
                {
                    guildId: creatorGuildId,
                    channelId: creatorChannelId,
                    guildName,
                    channelName,
                    connectedAt: new Date(),
                },
            ],
            rateLimitConfig,
            contentFilterEnabled,
            allowBotMessages: true,
            maxConnectedServers: 0,
            organizationId,
        });
        const saved = await this.getRepository().save(tunnel);
        this.cache.set(id, saved);
        logger_1.logger.info(`Tunnel created: ${id} (${name}) with invite code ${inviteCode} by guild ${creatorGuildId}`);
        return this.toTunnelInterface(saved);
    }
    async getTunnel(tunnelId) {
        this.ensureInitialized();
        let tunnel = this.cache.get(tunnelId);
        if (!tunnel) {
            const found = await this.getRepository().findOne({ where: { id: tunnelId } });
            if (found) {
                tunnel = found;
                this.cache.set(tunnelId, tunnel);
            }
        }
        return tunnel ? this.toTunnelInterface(tunnel) : undefined;
    }
    getTunnelSync(tunnelId) {
        const tunnel = this.cache.get(tunnelId);
        return tunnel ? this.toTunnelInterface(tunnel) : undefined;
    }
    async listPublicTunnels() {
        this.ensureInitialized();
        const tunnels = await this.getRepository().find({ where: { isPublic: true } });
        return tunnels.map(t => this.toTunnelInterface(t));
    }
    async listGuildTunnels(guildId, organizationId) {
        this.ensureInitialized();
        const repository = this.getRepository();
        const qb = repository.createQueryBuilder('tunnel');
        if (organizationId) {
            qb.where('tunnel.organizationId = :organizationId', { organizationId })
                .orWhere('tunnel.creatorGuildId = :guildId', { guildId })
                .orWhere('tunnel.connectedChannels LIKE :guildPattern', {
                guildPattern: `%${guildId}%`,
            });
        }
        else {
            qb.where('tunnel.creatorGuildId = :guildId', { guildId }).orWhere('tunnel.connectedChannels LIKE :guildPattern', { guildPattern: `%${guildId}%` });
        }
        const allTunnels = await qb.getMany();
        return allTunnels
            .filter(t => t.organizationId === organizationId ||
            t.creatorGuildId === guildId ||
            t.connectedChannels.some(c => c.guildId === guildId))
            .map(t => this.toTunnelInterface(t));
    }
    async connectToTunnel(tunnelId, guildId, channelId, password, guildName, channelName) {
        this.ensureInitialized();
        const tunnel = await this.getRepository()
            .createQueryBuilder('tunnel')
            .addSelect('tunnel.password')
            .where('tunnel.id = :id', { id: tunnelId })
            .getOne();
        if (!tunnel) {
            throw new Error('Tunnel not found');
        }
        if (tunnel.password) {
            if (!password) {
                throw new Error('Invalid password');
            }
            const passwordMatch = await bcrypt_1.default.compare(password, tunnel.password);
            if (!passwordMatch) {
                throw new Error('Invalid password');
            }
        }
        const alreadyConnected = tunnel.connectedChannels.some(c => c.guildId === guildId && c.channelId === channelId);
        if (alreadyConnected) {
            throw new Error('Channel already connected to this tunnel');
        }
        if (tunnel.maxConnectedServers > 0 &&
            tunnel.connectedChannels.length >= tunnel.maxConnectedServers) {
            throw new Error(`This tunnel has reached its maximum of ${tunnel.maxConnectedServers} connected servers`);
        }
        tunnel.connectedChannels.push({
            guildId,
            channelId,
            guildName,
            channelName,
            connectedAt: new Date(),
        });
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        logger_1.logger.info(`Channel ${channelId} connected to tunnel ${tunnelId}`);
        return true;
    }
    async disconnectFromTunnel(tunnelId, guildId, channelId) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            throw new Error('Tunnel not found');
        }
        const initialLength = tunnel.connectedChannels.length;
        tunnel.connectedChannels = tunnel.connectedChannels.filter(c => !(c.guildId === guildId && c.channelId === channelId));
        if (tunnel.connectedChannels.length === 0) {
            await this.getRepository().delete(tunnelId);
            this.cache.delete(tunnelId);
            logger_1.logger.info(`Tunnel ${tunnelId} deleted (no connections remaining)`);
            return true;
        }
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        logger_1.logger.info(`Channel ${channelId} disconnected from tunnel ${tunnelId}`);
        return tunnel.connectedChannels.length < initialLength;
    }
    async deleteTunnel(tunnelId, guildId) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            throw new Error('Tunnel not found');
        }
        if (tunnel.creatorGuildId !== guildId) {
            throw new Error('Only the creator can delete this tunnel');
        }
        await this.getRepository().delete(tunnelId);
        this.cache.delete(tunnelId);
        logger_1.logger.info(`Tunnel ${tunnelId} deleted by guild ${guildId}`);
        return true;
    }
    getConnectedChannels(tunnelId, excludeChannelId) {
        const tunnel = this.cache.get(tunnelId);
        if (!tunnel) {
            return [];
        }
        if (excludeChannelId) {
            return tunnel.connectedChannels.filter(c => c.channelId !== excludeChannelId);
        }
        return tunnel.connectedChannels;
    }
    findCachedEntityByChannel(channelId) {
        for (const tunnel of this.cache.values()) {
            if (tunnel.connectedChannels.some(c => c.channelId === channelId)) {
                return tunnel;
            }
        }
        return undefined;
    }
    findTunnelByChannel(channelId) {
        const tunnel = this.findCachedEntityByChannel(channelId);
        return tunnel ? this.toTunnelInterface(tunnel) : undefined;
    }
    async refreshTunnelFromDb(tunnelId) {
        try {
            const fresh = await this.getRepository().findOne({ where: { id: tunnelId } });
            if (fresh) {
                this.cacheTunnel(fresh);
                return fresh;
            }
            this.cache.delete(tunnelId);
            this.cacheLoadedAt.delete(tunnelId);
            return undefined;
        }
        catch (error) {
            logger_1.logger.error(`Failed to refresh tunnel ${tunnelId} from DB:`, error);
            return this.cache.get(tunnelId);
        }
    }
    lastCacheRefresh = 0;
    static CACHE_REFRESH_INTERVAL_MS = 30_000;
    async findTunnelByChannelAsync(channelId) {
        const cached = this.findCachedEntityByChannel(channelId);
        if (cached) {
            const loadedAt = this.cacheLoadedAt.get(cached.id) ?? 0;
            if (Date.now() - loadedAt < TunnelService.CACHE_FRESHNESS_MS) {
                return this.toTunnelInterface(cached);
            }
            const refreshed = await this.refreshTunnelFromDb(cached.id);
            return refreshed ? this.toTunnelInterface(refreshed) : undefined;
        }
        const now = Date.now();
        if (now - this.lastCacheRefresh < TunnelService.CACHE_REFRESH_INTERVAL_MS) {
            return undefined;
        }
        try {
            this.lastCacheRefresh = now;
            let match;
            await (0, query_1.findInBatches)(this.getRepository(), {}, batch => {
                for (const tunnel of batch) {
                    this.cacheTunnel(tunnel);
                    if (!match && tunnel.connectedChannels.some(c => c.channelId === channelId)) {
                        match = tunnel;
                    }
                }
            });
            if (match) {
                return this.toTunnelInterface(match);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load tunnels from DB in findTunnelByChannelAsync:', error);
        }
        return undefined;
    }
    async updateWebhook(tunnelId, channelId, webhookUrl) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        const connection = tunnel.connectedChannels.find(c => c.channelId === channelId);
        if (connection) {
            connection.webhookUrl = webhookUrl;
            await this.getRepository().save(tunnel);
            this.cache.set(tunnelId, tunnel);
            return true;
        }
        return false;
    }
    async updateTunnel(tunnelId, updates) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return undefined;
        }
        const setFields = {};
        if (updates.name !== undefined) {
            setFields.name = updates.name;
        }
        if (updates.rateLimitConfig !== undefined) {
            setFields.rateLimitConfig = updates.rateLimitConfig;
        }
        if (updates.contentFilterEnabled !== undefined) {
            setFields.contentFilterEnabled = updates.contentFilterEnabled;
        }
        if (updates.allowBotMessages !== undefined) {
            setFields.allowBotMessages = updates.allowBotMessages;
        }
        if (updates.maxConnectedServers !== undefined) {
            setFields.maxConnectedServers = updates.maxConnectedServers;
        }
        if (Object.keys(setFields).length > 0) {
            await this.getRepository().update(tunnelId, setFields);
        }
        const updated = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (updated) {
            this.cache.set(tunnelId, updated);
            return this.toTunnelInterface(updated);
        }
        return this.toTunnelInterface(tunnel);
    }
    async updateName(tunnelId, name) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        tunnel.name = name;
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return true;
    }
    async setPublic(tunnelId, isPublic) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        tunnel.isPublic = isPublic;
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return true;
    }
    async regenerateInviteCode(tunnelId) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return null;
        }
        const newCode = await this.generateInviteCode();
        tunnel.inviteCode = newCode;
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return newCode;
    }
    async setPassword(tunnelId, password) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        if (password && password.length > 0) {
            tunnel.password = await bcrypt_1.default.hash(password, 10);
        }
        else {
            tunnel.password = undefined;
        }
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return true;
    }
    async updateRateLimitConfig(tunnelId, config) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        tunnel.rateLimitConfig = config;
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return true;
    }
    async toggleContentFilter(tunnelId, enabled) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        tunnel.contentFilterEnabled = enabled;
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return true;
    }
    getTunnelConfig(tunnelId) {
        const tunnel = this.cache.get(tunnelId);
        if (!tunnel) {
            return {
                rateLimitConfig: undefined,
                contentFilterEnabled: false,
            };
        }
        return {
            rateLimitConfig: tunnel.rateLimitConfig,
            contentFilterEnabled: tunnel.contentFilterEnabled,
        };
    }
    async refreshCache() {
        this.ensureInitialized();
        this.cache.clear();
        const tunnelCount = await (0, query_1.findInBatches)(this.getRepository(), {}, batch => {
            for (const tunnel of batch) {
                this.cache.set(tunnel.id, tunnel);
            }
        });
        logger_1.logger.info(`TunnelService cache refreshed with ${tunnelCount} tunnels`);
    }
    generateTunnelId() {
        return node_crypto_1.default.randomUUID();
    }
    async generateInviteCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const maxAttempts = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const bytes = node_crypto_1.default.randomBytes(6);
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars[bytes[i] % chars.length];
            }
            const existing = await this.getRepository().findOne({ where: { inviteCode: code } });
            if (!existing) {
                return code;
            }
        }
        return node_crypto_1.default.randomBytes(8).toString('base64url').substring(0, 8);
    }
    toTunnelInterface(entity) {
        return {
            id: entity.id,
            name: entity.name,
            inviteCode: entity.inviteCode ?? undefined,
            creatorGuildId: entity.creatorGuildId,
            creatorChannelId: entity.creatorChannelId,
            isPublic: entity.isPublic,
            password: entity.password,
            createdAt: entity.createdAt,
            connectedChannels: entity.connectedChannels,
            rateLimitConfig: entity.rateLimitConfig,
            contentFilterEnabled: entity.contentFilterEnabled,
            allowBotMessages: entity.allowBotMessages,
            maxConnectedServers: entity.maxConnectedServers,
            organizationId: entity.organizationId ?? undefined,
        };
    }
    recordMessageRelay(tunnelId, wasBlocked = false, userId, hasAttachments = false) {
        const now = new Date();
        const hour = now.getHours();
        const currentHourCount = this.hourlyActivity.get(hour) ?? 0;
        this.hourlyActivity.set(hour, currentHourCount + 1);
        let analytics = this.analyticsData.get(tunnelId);
        if (!analytics) {
            const tunnel = this.cache.get(tunnelId);
            analytics = {
                tunnelId,
                messagesRelayed: 0,
                messagesBlocked: 0,
                lastActivity: null,
                peakConnectionCount: tunnel?.connectedChannels.length ?? 0,
                totalUniqueGuilds: this.getUniqueGuildCount(tunnelId),
                attachmentsRelayed: 0,
                reactionsRelayed: 0,
                uniqueUserIds: new Set(),
            };
            this.analyticsData.set(tunnelId, analytics);
        }
        if (wasBlocked) {
            analytics.messagesBlocked++;
        }
        else {
            analytics.messagesRelayed++;
            if (hasAttachments) {
                analytics.attachmentsRelayed++;
            }
        }
        analytics.lastActivity = now;
        if (userId) {
            analytics.uniqueUserIds.add(userId);
        }
        const tunnel = this.cache.get(tunnelId);
        if (tunnel && tunnel.connectedChannels.length > analytics.peakConnectionCount) {
            analytics.peakConnectionCount = tunnel.connectedChannels.length;
        }
    }
    getTunnelAnalytics(tunnelId) {
        const analytics = this.analyticsData.get(tunnelId);
        if (analytics) {
            return { ...analytics };
        }
        const tunnel = this.cache.get(tunnelId);
        if (tunnel) {
            return {
                tunnelId,
                messagesRelayed: 0,
                messagesBlocked: 0,
                lastActivity: null,
                peakConnectionCount: tunnel.connectedChannels.length,
                totalUniqueGuilds: this.getUniqueGuildCount(tunnelId),
                attachmentsRelayed: 0,
                reactionsRelayed: 0,
                uniqueUserIds: new Set(),
            };
        }
        return null;
    }
    getSystemStats() {
        const tunnels = Array.from(this.cache.values());
        let publicCount = 0;
        let privateCount = 0;
        let totalConnections = 0;
        for (const tunnel of tunnels) {
            if (tunnel.isPublic) {
                publicCount++;
            }
            else {
                privateCount++;
            }
            totalConnections += tunnel.connectedChannels.length;
        }
        let totalMessagesRelayed = 0;
        let totalMessagesBlocked = 0;
        for (const analytics of this.analyticsData.values()) {
            totalMessagesRelayed += analytics.messagesRelayed;
            totalMessagesBlocked += analytics.messagesBlocked;
        }
        let mostActiveHour = 0;
        let maxHourlyMessages = 0;
        for (const [hour, count] of this.hourlyActivity.entries()) {
            if (count > maxHourlyMessages) {
                maxHourlyMessages = count;
                mostActiveHour = hour;
            }
        }
        const tunnelStats = tunnels.map(tunnel => {
            const analytics = this.analyticsData.get(tunnel.id);
            return {
                id: tunnel.id,
                name: tunnel.name,
                messagesRelayed: analytics?.messagesRelayed ?? 0,
                connectionCount: tunnel.connectedChannels.length,
            };
        });
        tunnelStats.sort((a, b) => b.messagesRelayed - a.messagesRelayed);
        const topTunnels = tunnelStats.slice(0, 10);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let activeTunnels = 0;
        for (const analytics of this.analyticsData.values()) {
            if (analytics.lastActivity && analytics.lastActivity > oneDayAgo) {
                activeTunnels++;
            }
        }
        return {
            totalTunnels: tunnels.length,
            activeTunnels,
            totalConnections,
            totalMessagesRelayed,
            totalMessagesBlocked,
            mostActiveHour,
            tunnelsByVisibility: {
                public: publicCount,
                private: privateCount,
            },
            topTunnels,
        };
    }
    getHourlyActivity() {
        return new Map(this.hourlyActivity);
    }
    resetAnalytics() {
        this.analyticsData.clear();
        for (let i = 0; i < 24; i++) {
            this.hourlyActivity.set(i, 0);
        }
        logger_1.logger.info('Tunnel analytics reset');
    }
    getUniqueGuildCount(tunnelId) {
        const tunnel = this.cache.get(tunnelId);
        if (!tunnel) {
            return 0;
        }
        const uniqueGuilds = new Set(tunnel.connectedChannels.map(c => c.guildId));
        return uniqueGuilds.size;
    }
    async findByInviteCode(code) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { inviteCode: code } });
        if (!tunnel) {
            return undefined;
        }
        this.cache.set(tunnel.id, tunnel);
        return this.toTunnelInterface(tunnel);
    }
    async connectByInviteCode(code, guildId, channelId, password, guildName, channelName) {
        const tunnel = await this.findByInviteCode(code);
        if (!tunnel) {
            throw new Error('Invalid invite code');
        }
        await this.connectToTunnel(tunnel.id, guildId, channelId, password, guildName, channelName);
        const updated = await this.getTunnel(tunnel.id);
        if (!updated) {
            throw new Error('Failed to retrieve tunnel after connecting');
        }
        return updated;
    }
    async saveMessage(data) {
        try {
            const repo = this.getMessageRepository();
            const entity = repo.create({
                tunnelId: data.tunnelId,
                authorId: data.authorId,
                authorName: data.authorName,
                authorAvatar: data.authorAvatar,
                sourceGuildId: data.sourceGuildId,
                sourceChannelId: data.sourceChannelId,
                discordMessageId: data.discordMessageId,
                content: data.content,
                attachments: data.attachments,
                embeds: data.embeds,
                stickerIds: data.stickerIds,
                replyToMessageId: data.replyToMessageId,
                isBot: data.isBot,
                wasBlocked: data.wasBlocked ?? false,
                blockReason: data.blockReason,
            });
            await repo.save(entity);
        }
        catch (error) {
            logger_1.logger.error('Failed to persist tunnel message:', error);
        }
    }
    async getMessageHistory(tunnelId, limit = 50, before) {
        this.ensureInitialized();
        const repo = this.getMessageRepository();
        const queryBuilder = repo
            .createQueryBuilder('msg')
            .where('msg.tunnelId = :tunnelId', { tunnelId })
            .andWhere('msg.wasBlocked = :blocked', { blocked: false });
        if (before) {
            queryBuilder.andWhere('msg.createdAt < :before', { before });
        }
        const messages = await queryBuilder
            .orderBy('msg.createdAt', 'DESC')
            .take(Math.min(limit, 100))
            .getMany();
        return messages.map(m => ({
            id: m.id,
            tunnelId: m.tunnelId,
            authorId: m.authorId,
            authorName: m.authorName,
            authorAvatar: m.authorAvatar,
            sourceGuildId: m.sourceGuildId,
            sourceChannelId: m.sourceChannelId,
            discordMessageId: m.discordMessageId,
            content: m.content,
            attachments: m.attachments,
            embeds: m.embeds,
            stickerIds: m.stickerIds,
            replyToMessageId: m.replyToMessageId,
            isBot: m.isBot,
            wasBlocked: m.wasBlocked,
            blockReason: m.blockReason,
            isEdited: m.isEdited,
            editedAt: m.editedAt,
            timestamp: m.createdAt,
        }));
    }
    async findByDiscordMessageId(discordMessageId) {
        const repo = this.getMessageRepository();
        return repo.findOne({ where: { discordMessageId } });
    }
    async updateMessageContent(discordMessageId, newContent) {
        const repo = this.getMessageRepository();
        await repo.update({ discordMessageId }, { content: newContent, isEdited: true, editedAt: new Date() });
    }
    static RELAY_KEY_PREFIX = 'tunnel:relay:';
    static RELAY_REVERSE_PREFIX = 'tunnel:relay-rev:';
    static RELAY_TTL = 3600;
    async storeRelayedMessageIds(discordMessageId, relayedIds, sourceChannelId) {
        if (Object.keys(relayedIds).length === 0) {
            return;
        }
        try {
            await redis_1.cache.set(`${TunnelService.RELAY_KEY_PREFIX}${discordMessageId}`, relayedIds, TunnelService.RELAY_TTL);
            const reverseValue = { originalId: discordMessageId, sourceChannelId: sourceChannelId ?? '' };
            await Promise.all(Object.values(relayedIds).map(relayedMsgId => redis_1.cache.set(`${TunnelService.RELAY_REVERSE_PREFIX}${relayedMsgId}`, reverseValue, TunnelService.RELAY_TTL)));
        }
        catch (error) {
            logger_1.logger.error('Failed to store relay IDs in Redis:', error);
        }
    }
    async getRelayedMessageIds(discordMessageId) {
        try {
            return await redis_1.cache.get(`${TunnelService.RELAY_KEY_PREFIX}${discordMessageId}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to get relay IDs from Redis:', error);
            return null;
        }
    }
    async getOriginalMessageId(relayedMessageId) {
        try {
            return await redis_1.cache.get(`${TunnelService.RELAY_REVERSE_PREFIX}${relayedMessageId}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to get reverse relay ID from Redis:', error);
            return null;
        }
    }
    async banUser(tunnelId, userId, username, reason, issuedBy, expiresAt) {
        const repo = this.getBanRepository();
        await repo.delete({ tunnelId, userId });
        const ban = repo.create({
            tunnelId,
            userId,
            username,
            type: 'ban',
            reason,
            issuedBy,
            expiresAt,
        });
        await repo.save(ban);
        logger_1.logger.info(`User ${userId} banned from tunnel ${tunnelId} by ${issuedBy}: ${reason}`);
    }
    async muteUser(tunnelId, userId, username, reason, issuedBy, expiresAt) {
        const repo = this.getBanRepository();
        await repo.delete({ tunnelId, userId });
        const mute = repo.create({
            tunnelId,
            userId,
            username,
            type: 'mute',
            reason,
            issuedBy,
            expiresAt,
        });
        await repo.save(mute);
        logger_1.logger.info(`User ${userId} muted in tunnel ${tunnelId} by ${issuedBy}: ${reason}`);
    }
    async unbanUser(tunnelId, userId) {
        const repo = this.getBanRepository();
        const result = await repo.delete({ tunnelId, userId });
        const removed = (result.affected ?? 0) > 0;
        if (removed) {
            logger_1.logger.info(`User ${userId} unbanned/unmuted from tunnel ${tunnelId}`);
        }
        return removed;
    }
    async isUserBanned(tunnelId, userId) {
        const repo = this.getBanRepository();
        const ban = await repo.findOne({
            where: { tunnelId, userId, type: 'ban' },
        });
        if (!ban) {
            return false;
        }
        if (ban.expiresAt && ban.expiresAt < new Date()) {
            await repo.delete({ id: ban.id });
            return false;
        }
        return true;
    }
    async isUserMuted(tunnelId, userId) {
        const repo = this.getBanRepository();
        const mute = await repo.findOne({
            where: { tunnelId, userId, type: 'mute' },
        });
        if (!mute) {
            return false;
        }
        if (mute.expiresAt && mute.expiresAt < new Date()) {
            await repo.delete({ id: mute.id });
            return false;
        }
        return true;
    }
    async listBans(tunnelId) {
        const repo = this.getBanRepository();
        return repo.find({
            where: { tunnelId },
            order: { createdAt: 'DESC' },
        });
    }
    async persistAnalytics() {
        try {
            const repo = this.getAnalyticsRepository();
            const now = new Date();
            const periodStart = new Date(now);
            periodStart.setMinutes(0, 0, 0);
            const entries = [];
            for (const [tunnelId, analytics] of this.analyticsData.entries()) {
                if (analytics.messagesRelayed === 0 && analytics.messagesBlocked === 0) {
                    continue;
                }
                const tunnel = this.cache.get(tunnelId);
                const entry = repo.create({
                    tunnelId,
                    periodStart,
                    messagesRelayed: analytics.messagesRelayed,
                    messagesBlocked: analytics.messagesBlocked,
                    uniqueUsers: analytics.uniqueUserIds.size,
                    peakConnections: tunnel?.connectedChannels.length ?? 0,
                    attachmentsRelayed: analytics.attachmentsRelayed,
                    reactionsRelayed: analytics.reactionsRelayed,
                });
                entries.push(entry);
            }
            if (entries.length > 0) {
                await repo.save(entries);
                logger_1.logger.info(`Persisted analytics for ${entries.length} tunnels`);
            }
            for (const analytics of this.analyticsData.values()) {
                analytics.messagesRelayed = 0;
                analytics.messagesBlocked = 0;
                analytics.attachmentsRelayed = 0;
                analytics.reactionsRelayed = 0;
                analytics.uniqueUserIds.clear();
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to persist tunnel analytics:', error);
        }
    }
    async getPersistedAnalytics(tunnelId, startDate, endDate) {
        const repo = this.getAnalyticsRepository();
        return repo
            .createQueryBuilder('a')
            .where('a.tunnelId = :tunnelId', { tunnelId })
            .andWhere('a.periodStart >= :startDate', { startDate })
            .andWhere('a.periodStart <= :endDate', { endDate })
            .orderBy('a.periodStart', 'ASC')
            .getMany();
    }
    async updateMaxConnectedServers(tunnelId, maxServers) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        tunnel.maxConnectedServers = maxServers;
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return true;
    }
    async toggleBotMessages(tunnelId, enabled) {
        this.ensureInitialized();
        const tunnel = await this.getRepository().findOne({ where: { id: tunnelId } });
        if (!tunnel) {
            return false;
        }
        tunnel.allowBotMessages = enabled;
        await this.getRepository().save(tunnel);
        this.cache.set(tunnelId, tunnel);
        return true;
    }
    destroy() {
        if (this.analyticsFlushInterval) {
            clearInterval(this.analyticsFlushInterval);
            this.analyticsFlushInterval = null;
        }
    }
}
exports.TunnelService = TunnelService;
//# sourceMappingURL=TunnelService.js.map