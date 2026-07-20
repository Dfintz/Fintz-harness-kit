"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationAnnouncementService = void 0;
const discord_js_1 = require("discord.js");
const BotClientManager_1 = require("../../bot/BotClientManager");
const data_source_1 = require("../../data-source");
const Announcement_1 = require("../../models/Announcement");
const Federation_1 = require("../../models/Federation");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
class FederationAnnouncementService {
    static instance;
    announcementRepository;
    federationRepository;
    ambassadorService;
    constructor() {
        this.announcementRepository = data_source_1.AppDataSource.getRepository(Announcement_1.Announcement);
        this.federationRepository = data_source_1.AppDataSource.getRepository(Federation_1.Federation);
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationAnnouncementService.instance) {
            FederationAnnouncementService.instance = new FederationAnnouncementService();
        }
        return FederationAnnouncementService.instance;
    }
    toData(entity) {
        return {
            id: entity.id,
            federationId: entity.federationId ?? '',
            title: entity.title,
            content: entity.content,
            targetAudience: entity.targetAudience ?? 'all-members',
            createdBy: entity.createdBy,
            createdByName: entity.createdByName ?? null,
            status: entity.status,
            createdAt: entity.createdAt,
            sentAt: entity.sentAt ?? null,
            pinnedAt: entity.pinnedAt ?? null,
        };
    }
    async requireAnnouncePermission(federationId, userId) {
        return (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'announce', 'Ambassador announce permission required');
    }
    async requireViewAccess(federationId, userId) {
        return (0, federationPermissions_1.requireFederationViewAccess)(this.ambassadorService, federationId, userId, 'announcements');
    }
    async createAnnouncement(federationId, userId, data) {
        await this.requireAnnouncePermission(federationId, userId);
        if (!data.title?.trim() || data.title.trim().length < 3) {
            throw new apiErrors_1.ValidationError('Announcement title must be at least 3 characters');
        }
        if (!data.content?.trim() || data.content.trim().length < 10) {
            throw new apiErrors_1.ValidationError('Announcement content must be at least 10 characters');
        }
        const announcement = this.announcementRepository.create({
            organizationId: federationId,
            federationId,
            title: data.title.trim(),
            content: data.content.trim(),
            targetAudience: data.targetAudience ?? 'all-members',
            targetType: Announcement_1.AnnouncementTargetType.ALL,
            status: Announcement_1.AnnouncementStatus.SENT,
            createdBy: userId,
            createdByName: data.createdByName,
            sentAt: new Date(),
        });
        const saved = await this.announcementRepository.save(announcement);
        logger_1.logger.info('Federation announcement created', {
            federationId,
            announcementId: saved.id,
            audience: data.targetAudience ?? 'all-members',
        });
        return this.toData(saved);
    }
    async listAnnouncements(federationId, userId) {
        await this.requireViewAccess(federationId, userId);
        const announcements = await this.announcementRepository.find({
            where: { federationId },
            order: { createdAt: 'DESC' },
            take: 50,
        });
        return announcements.map(a => this.toData(a));
    }
    async getAnnouncement(federationId, userId, announcementId) {
        await this.requireViewAccess(federationId, userId);
        const announcement = await this.announcementRepository.findOne({
            where: { id: announcementId, federationId },
        });
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement', announcementId);
        }
        return this.toData(announcement);
    }
    async deleteAnnouncement(federationId, userId, announcementId) {
        await this.requireAnnouncePermission(federationId, userId);
        const announcement = await this.announcementRepository.findOne({
            where: { id: announcementId, federationId },
        });
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement', announcementId);
        }
        await this.announcementRepository.remove(announcement);
        logger_1.logger.info('Federation announcement deleted', {
            federationId,
            announcementId,
        });
    }
    async togglePin(federationId, userId, announcementId) {
        await this.requireAnnouncePermission(federationId, userId);
        const announcement = await this.announcementRepository.findOne({
            where: { id: announcementId, federationId },
        });
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement', announcementId);
        }
        if (announcement.pinnedAt) {
            announcement.pinnedAt = undefined;
            announcement.pinnedBy = undefined;
        }
        else {
            announcement.pinnedAt = new Date();
            announcement.pinnedBy = userId;
        }
        const saved = await this.announcementRepository.save(announcement);
        return this.toData(saved);
    }
    async postAnnouncementToDiscord(federationId, userId, announcementId, channelId) {
        await this.requireAnnouncePermission(federationId, userId);
        const announcement = await this.announcementRepository.findOne({
            where: { id: announcementId, federationId },
        });
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement', announcementId);
        }
        const federation = await this.federationRepository.findOne({ where: { id: federationId } });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        const guildId = federation.settings?.centralGuildId;
        if (!guildId) {
            throw new apiErrors_1.ValidationError('Federation central Discord guild is not configured');
        }
        const client = BotClientManager_1.BotClientManager.getInstance().getClient();
        if (!client?.isReady()) {
            throw new apiErrors_1.ValidationError('Discord bot client is not connected');
        }
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) {
            throw new apiErrors_1.ValidationError('Target channel not found or not text-based');
        }
        if (!('guildId' in channel) || channel.guildId !== guildId) {
            throw new apiErrors_1.ValidationError('Target channel is not in the federation central Discord guild');
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(announcement.title)
            .setDescription(announcement.content)
            .setColor(0x5865f2)
            .setTimestamp();
        const sent = await channel.send({ embeds: [embed] });
        if (channel.type === discord_js_1.ChannelType.GuildAnnouncement) {
            await sent.crosspost().catch(() => null);
        }
        const deliveredAt = new Date();
        const deliveryResults = Array.isArray(announcement.deliveryResults)
            ? [...announcement.deliveryResults]
            : [];
        deliveryResults.push({
            targetId: channelId,
            success: true,
            messageId: sent.id,
            deliveredAt,
        });
        announcement.status = Announcement_1.AnnouncementStatus.SENT;
        announcement.sentAt = deliveredAt;
        announcement.deliveryResults = deliveryResults;
        announcement.targetType = Announcement_1.AnnouncementTargetType.SINGLE;
        announcement.targetIds = [channelId];
        const saved = await this.announcementRepository.save(announcement);
        logger_1.logger.info('Federation announcement posted to Discord', {
            federationId,
            announcementId,
            guildId,
            channelId,
            messageId: sent.id,
        });
        return {
            announcement: this.toData(saved),
            guildId,
            channelId,
            messageId: sent.id,
        };
    }
}
exports.FederationAnnouncementService = FederationAnnouncementService;
//# sourceMappingURL=FederationAnnouncementService.js.map