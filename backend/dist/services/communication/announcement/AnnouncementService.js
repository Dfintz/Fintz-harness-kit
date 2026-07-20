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
exports.AnnouncementService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../../data-source");
const AllianceDiplomacy_1 = require("../../../models/AllianceDiplomacy");
const Announcement_1 = require("../../../models/Announcement");
const AnnouncementDelivery_1 = require("../../../models/AnnouncementDelivery");
const AnnouncementReadReceipt_1 = require("../../../models/AnnouncementReadReceipt");
const AnnouncementTemplate_1 = require("../../../models/AnnouncementTemplate");
const Organization_1 = require("../../../models/Organization");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const apiErrors_1 = require("../../../utils/apiErrors");
const logger_1 = require("../../../utils/logger");
const DiscordSettingsService_1 = require("../../discord/DiscordSettingsService");
const EmbedBuilderService_1 = require("../../discord/EmbedBuilderService");
const RATE_LIMIT_DELAY_MS = 100;
const GLOBAL_BROADCAST_RATE_LIMIT_DELAY_MS = 1000;
class AnnouncementService {
    announcementRepository;
    deliveryRepository;
    readReceiptRepository;
    templateRepository;
    diplomacyRepository;
    organizationRepository;
    organizationMembershipRepository;
    discordClient = null;
    constructor() {
        this.announcementRepository = data_source_1.AppDataSource.getRepository(Announcement_1.Announcement);
        this.deliveryRepository = data_source_1.AppDataSource.getRepository(AnnouncementDelivery_1.AnnouncementDelivery);
        this.readReceiptRepository = data_source_1.AppDataSource.getRepository(AnnouncementReadReceipt_1.AnnouncementReadReceipt);
        this.templateRepository = data_source_1.AppDataSource.getRepository(AnnouncementTemplate_1.AnnouncementTemplate);
        this.diplomacyRepository = data_source_1.AppDataSource.getRepository(AllianceDiplomacy_1.AllianceDiplomacy);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.organizationMembershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    }
    setDiscordClient(client) {
        this.discordClient = client;
    }
    async create(organizationId, dto) {
        const announcement = this.announcementRepository.create({
            organizationId,
            title: dto.title,
            content: dto.content,
            createdBy: dto.createdBy,
            createdByName: dto.createdByName,
            embedConfig: dto.embedConfig,
            targetType: dto.targetType || Announcement_1.AnnouncementTargetType.SINGLE,
            targetIds: dto.targetIds,
            status: dto.scheduledAt ? Announcement_1.AnnouncementStatus.SCHEDULED : Announcement_1.AnnouncementStatus.DRAFT,
            scheduledAt: dto.scheduledAt,
        });
        const savedAnnouncement = await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Announcement created: ${savedAnnouncement.id} for org ${organizationId}`);
        return savedAnnouncement;
    }
    async getById(id) {
        return this.announcementRepository.findOne({
            where: { id },
        });
    }
    async update(id, dto) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new apiErrors_1.ConflictError('Cannot update a sent announcement');
        }
        if (dto.title !== undefined) {
            announcement.title = dto.title;
        }
        if (dto.content !== undefined) {
            announcement.content = dto.content;
        }
        if (dto.embedConfig !== undefined) {
            announcement.embedConfig = dto.embedConfig;
        }
        if (dto.targetType !== undefined) {
            announcement.targetType = dto.targetType;
        }
        if (dto.targetIds !== undefined) {
            announcement.targetIds = dto.targetIds;
        }
        if (dto.scheduledAt !== undefined) {
            announcement.scheduledAt = dto.scheduledAt;
            if (dto.scheduledAt && announcement.status === Announcement_1.AnnouncementStatus.DRAFT) {
                announcement.status = Announcement_1.AnnouncementStatus.SCHEDULED;
            }
        }
        if (dto.status !== undefined) {
            announcement.status = dto.status;
        }
        const updatedAnnouncement = await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Announcement updated: ${id}`);
        return updatedAnnouncement;
    }
    async delete(id, deletedBy) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        announcement.deletedAt = new Date();
        announcement.deletedBy = deletedBy;
        await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Announcement deleted: ${id}`);
    }
    async list(organizationId, filters = {}, page = 1, limit = 20) {
        const where = { organizationId };
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.createdBy) {
            where.createdBy = filters.createdBy;
        }
        if (filters.targetType) {
            where.targetType = filters.targetType;
        }
        const skip = (page - 1) * limit;
        const [announcements, total] = await this.announcementRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });
        return {
            announcements,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async preview(announcement, userId) {
        const context = await this.buildShortcodeContext(announcement.organizationId, userId);
        const embed = this.buildEmbed(announcement, context);
        return { embed, announcement };
    }
    async previewById(id) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        return this.preview(announcement);
    }
    async buildShortcodeContext(organizationId, userId) {
        try {
            if (userId) {
                const isMember = await this.organizationMembershipRepository.exists({
                    where: { organizationId, userId },
                });
                if (!isMember) {
                    throw new apiErrors_1.ForbiddenError('Access denied: User is not a member of this organization');
                }
            }
            const org = await this.organizationRepository.findOne({
                where: { id: organizationId },
            });
            if (!org) {
                logger_1.logger.warn(`Organization not found for shortcode context: ${organizationId}`);
                return {};
            }
            const memberCount = await this.organizationMembershipRepository.count({
                where: { organizationId },
            });
            return {
                organization: {
                    id: org.id,
                    name: org.name,
                    memberCount,
                },
            };
        }
        catch (err) {
            if (err instanceof apiErrors_1.ApiError) {
                throw err;
            }
            logger_1.logger.error('Failed to build shortcode context for announcement', err);
            return {};
        }
    }
    buildEmbed(announcement, context) {
        const embedService = EmbedBuilderService_1.EmbedBuilderService.getInstance();
        const embed = new discord_js_1.EmbedBuilder();
        const resolvedTitle = context
            ? embedService.renderWithContext(announcement.title, undefined, context).title
            : announcement.title;
        const resolvedDescription = context
            ? embedService.renderWithContext(undefined, announcement.content, context).description
            : announcement.content;
        embed.setTitle((0, shared_types_1.decodeHtmlEntities)(resolvedTitle || ''));
        embed.setDescription((0, shared_types_1.decodeHtmlEntities)(resolvedDescription || ''));
        const config = announcement.embedConfig;
        if (config) {
            if (config.color) {
                const colorInt = parseInt(config.color.replace('#', ''), 16);
                embed.setColor(colorInt);
            }
            if (config.thumbnailUrl) {
                embed.setThumbnail(config.thumbnailUrl);
            }
            if (config.imageUrl) {
                embed.setImage(config.imageUrl);
            }
            const footerText = context
                ? config.footerTextTemplate
                    ? embedService.resolveFooterText(config.footerTextTemplate, context)
                    : config.footerText
                : config.footerText;
            if (footerText) {
                embed.setFooter({
                    text: (0, shared_types_1.decodeHtmlEntities)(footerText),
                    iconURL: config.footerIconUrl,
                });
            }
            const authorName = context
                ? config.authorNameTemplate
                    ? embedService.resolveAuthorName(config.authorNameTemplate, context)
                    : config.authorName
                : config.authorName;
            if (authorName) {
                embed.setAuthor({
                    name: (0, shared_types_1.decodeHtmlEntities)(authorName),
                    iconURL: config.authorIconUrl,
                    url: config.authorUrl,
                });
            }
            if (config.timestamp) {
                embed.setTimestamp();
            }
            if (config.fields && config.fields.length > 0) {
                config.fields.forEach(field => {
                    const resolvedName = context && field.nameTemplate
                        ? embedService.resolveFieldText(field.nameTemplate, context)
                        : field.name;
                    const resolvedValue = context && field.valueTemplate
                        ? embedService.resolveFieldText(field.valueTemplate, context)
                        : field.value;
                    embed.addFields({
                        name: (0, shared_types_1.decodeHtmlEntities)(resolvedName || field.name),
                        value: (0, shared_types_1.decodeHtmlEntities)(resolvedValue || field.value),
                        inline: field.inline,
                    });
                });
            }
        }
        return embed;
    }
    async send(id, channelId) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new apiErrors_1.ConflictError('Announcement has already been sent');
        }
        if (!this.discordClient) {
            try {
                const { BotClientManager } = await Promise.resolve().then(() => __importStar(require('../../../bot/BotClientManager')));
                const client = BotClientManager.getInstance().getClient();
                if (client?.isReady()) {
                    this.discordClient = client;
                }
            }
            catch {
            }
        }
        if (!this.discordClient) {
            throw new apiErrors_1.ServiceUnavailableError('Discord client not configured');
        }
        announcement.status = Announcement_1.AnnouncementStatus.SENDING;
        await this.announcementRepository.save(announcement);
        const results = [];
        const context = await this.buildShortcodeContext(announcement.organizationId);
        const embed = this.buildEmbed(announcement, context);
        try {
            const channel = await this.discordClient.channels.fetch(channelId);
            if (!channel?.isTextBased()) {
                results.push({
                    targetId: channelId,
                    success: false,
                    error: 'Channel not found or not a text channel',
                });
            }
            else {
                const message = await channel.send({ embeds: [embed] });
                results.push({
                    targetId: channelId,
                    success: true,
                    messageId: message.id,
                    deliveredAt: new Date(),
                });
                await this.tryCrosspost(message);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.push({
                targetId: channelId,
                success: false,
                error: errorMessage,
            });
            logger_1.logger.error(`Failed to send announcement ${id} to channel ${channelId}:`, error);
        }
        const allSuccessful = results.every(r => r.success);
        announcement.status = allSuccessful ? Announcement_1.AnnouncementStatus.SENT : Announcement_1.AnnouncementStatus.FAILED;
        announcement.sentAt = new Date();
        announcement.deliveryResults = results;
        announcement.targetIds = [channelId];
        await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Announcement ${id} delivery completed: ${results.filter(r => r.success).length}/${results.length} successful`);
        return {
            announcementId: id,
            success: allSuccessful,
            totalTargets: results.length,
            successfulDeliveries: results.filter(r => r.success).length,
            failedDeliveries: results.filter(r => !r.success).length,
            results,
        };
    }
    async cancel(id) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new apiErrors_1.ConflictError('Cannot cancel a sent announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENDING) {
            throw new apiErrors_1.ConflictError('Cannot cancel an announcement that is currently being sent');
        }
        announcement.status = Announcement_1.AnnouncementStatus.CANCELLED;
        const updatedAnnouncement = await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Announcement cancelled: ${id}`);
        return updatedAnnouncement;
    }
    async getPendingDelivery() {
        const now = new Date();
        return this.announcementRepository
            .createQueryBuilder('announcement')
            .where('announcement.status = :status', { status: Announcement_1.AnnouncementStatus.SCHEDULED })
            .andWhere('announcement.scheduledAt <= :now', { now })
            .andWhere('announcement.deletedAt IS NULL')
            .getMany();
    }
    async getStats(organizationId) {
        const announcements = await this.announcementRepository.find({
            where: { organizationId },
        });
        return {
            total: announcements.length,
            draft: announcements.filter(a => a.status === Announcement_1.AnnouncementStatus.DRAFT).length,
            scheduled: announcements.filter(a => a.status === Announcement_1.AnnouncementStatus.SCHEDULED).length,
            sent: announcements.filter(a => a.status === Announcement_1.AnnouncementStatus.SENT).length,
            failed: announcements.filter(a => a.status === Announcement_1.AnnouncementStatus.FAILED).length,
            cancelled: announcements.filter(a => a.status === Announcement_1.AnnouncementStatus.CANCELLED).length,
        };
    }
    async sendMultiple(id, targetType, targetIds) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new apiErrors_1.ConflictError('Announcement has already been sent');
        }
        if (!targetIds || targetIds.length === 0) {
            throw new apiErrors_1.ValidationError('No target servers specified');
        }
        if (!this.discordClient) {
            throw new apiErrors_1.ServiceUnavailableError('Discord client not configured');
        }
        announcement.status = Announcement_1.AnnouncementStatus.SENDING;
        announcement.targetType = Announcement_1.AnnouncementTargetType.MULTIPLE;
        announcement.targetIds = targetIds;
        await this.announcementRepository.save(announcement);
        const deliveries = [];
        for (const channelId of targetIds) {
            const delivery = this.deliveryRepository.create({
                announcementId: id,
                guildId: channelId,
                channelId,
                status: AnnouncementDelivery_1.DeliveryStatus.PENDING,
            });
            const savedDelivery = await this.deliveryRepository.save(delivery);
            deliveries.push(savedDelivery);
        }
        const context = await this.buildShortcodeContext(announcement.organizationId);
        const embed = this.buildEmbed(announcement, context);
        let successCount = 0;
        let failCount = 0;
        for (const delivery of deliveries) {
            try {
                await this.processDelivery(delivery, embed);
                if (delivery.status === AnnouncementDelivery_1.DeliveryStatus.DELIVERED) {
                    successCount++;
                }
                else {
                    failCount++;
                }
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`Failed to process delivery ${delivery.id}:`, error);
            }
            await this.delay(RATE_LIMIT_DELAY_MS);
        }
        const allSuccessful = successCount === deliveries.length;
        const anySuccessful = successCount > 0;
        if (allSuccessful) {
            announcement.status = Announcement_1.AnnouncementStatus.SENT;
        }
        else if (anySuccessful) {
            announcement.status = Announcement_1.AnnouncementStatus.SENT;
        }
        else {
            announcement.status = Announcement_1.AnnouncementStatus.FAILED;
        }
        announcement.sentAt = new Date();
        await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Multi-server announcement ${id} completed: ${successCount}/${deliveries.length} successful`);
        return {
            announcementId: id,
            success: allSuccessful,
            totalServers: deliveries.length,
            successfulDeliveries: successCount,
            failedDeliveries: failCount,
            pendingDeliveries: 0,
            deliveries,
        };
    }
    async schedule(id, scheduledAt, targetIds) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new apiErrors_1.ConflictError('Cannot schedule a sent announcement');
        }
        if (scheduledAt <= new Date()) {
            throw new apiErrors_1.ValidationError('Scheduled time must be in the future');
        }
        announcement.scheduledAt = scheduledAt;
        announcement.status = Announcement_1.AnnouncementStatus.SCHEDULED;
        if (targetIds && targetIds.length > 0) {
            announcement.targetType =
                targetIds.length > 1 ? Announcement_1.AnnouncementTargetType.MULTIPLE : Announcement_1.AnnouncementTargetType.SINGLE;
            announcement.targetIds = targetIds;
            for (const channelId of targetIds) {
                const existingDelivery = await this.deliveryRepository.findOne({
                    where: { announcementId: id, channelId },
                });
                if (!existingDelivery) {
                    const delivery = this.deliveryRepository.create({
                        announcementId: id,
                        guildId: channelId,
                        channelId,
                        status: AnnouncementDelivery_1.DeliveryStatus.SCHEDULED,
                        scheduledAt,
                    });
                    await this.deliveryRepository.save(delivery);
                }
            }
        }
        await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Announcement ${id} scheduled for ${scheduledAt.toISOString()}`);
    }
    async getStatus(id) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        const deliveries = await this.deliveryRepository.find({
            where: { announcementId: id },
            order: { createdAt: 'ASC' },
        });
        const summary = {
            total: deliveries.length,
            pending: deliveries.filter(d => d.status === AnnouncementDelivery_1.DeliveryStatus.PENDING || d.status === AnnouncementDelivery_1.DeliveryStatus.SCHEDULED).length,
            delivered: deliveries.filter(d => d.status === AnnouncementDelivery_1.DeliveryStatus.DELIVERED).length,
            failed: deliveries.filter(d => d.status === AnnouncementDelivery_1.DeliveryStatus.FAILED).length,
            cancelled: deliveries.filter(d => d.status === AnnouncementDelivery_1.DeliveryStatus.CANCELLED).length,
        };
        return {
            announcement,
            deliveries,
            summary,
        };
    }
    async cancelScheduled(id) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new apiErrors_1.NotFoundError('Announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new apiErrors_1.ConflictError('Cannot cancel a sent announcement');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENDING) {
            throw new apiErrors_1.ConflictError('Cannot cancel an announcement that is currently being sent');
        }
        await this.deliveryRepository
            .createQueryBuilder()
            .update(AnnouncementDelivery_1.AnnouncementDelivery)
            .set({ status: AnnouncementDelivery_1.DeliveryStatus.CANCELLED })
            .where('announcementId = :id', { id })
            .andWhere('status IN (:...statuses)', {
            statuses: [AnnouncementDelivery_1.DeliveryStatus.PENDING, AnnouncementDelivery_1.DeliveryStatus.SCHEDULED],
        })
            .execute();
        announcement.status = Announcement_1.AnnouncementStatus.CANCELLED;
        await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Scheduled announcement ${id} cancelled`);
    }
    async retryFailed(id) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new Error('Announcement not found');
        }
        if (!this.discordClient) {
            throw new Error('Discord client not configured');
        }
        const failedDeliveries = await this.deliveryRepository.find({
            where: {
                announcementId: id,
                status: AnnouncementDelivery_1.DeliveryStatus.FAILED,
            },
        });
        const retriableDeliveries = failedDeliveries.filter(d => d.retryCount < AnnouncementDelivery_1.MAX_DELIVERY_RETRY_COUNT);
        if (retriableDeliveries.length === 0) {
            throw new Error('No retriable deliveries found');
        }
        const context = await this.buildShortcodeContext(announcement.organizationId);
        const embed = this.buildEmbed(announcement, context);
        let successCount = 0;
        let failCount = 0;
        for (const delivery of retriableDeliveries) {
            delivery.retryCount++;
            delivery.status = AnnouncementDelivery_1.DeliveryStatus.SENDING;
            await this.deliveryRepository.save(delivery);
            try {
                await this.processDelivery(delivery, embed);
                const updatedDelivery = await this.deliveryRepository.findOne({
                    where: { id: delivery.id },
                });
                if (updatedDelivery?.status === AnnouncementDelivery_1.DeliveryStatus.DELIVERED) {
                    successCount++;
                }
                else {
                    failCount++;
                }
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`Retry failed for delivery ${delivery.id}:`, error);
            }
            await this.delay(RATE_LIMIT_DELAY_MS);
        }
        const allDeliveries = await this.deliveryRepository.find({
            where: { announcementId: id },
        });
        const pendingCount = allDeliveries.filter(d => d.status === AnnouncementDelivery_1.DeliveryStatus.PENDING || d.status === AnnouncementDelivery_1.DeliveryStatus.SCHEDULED).length;
        logger_1.logger.info(`Retry for announcement ${id}: ${successCount}/${retriableDeliveries.length} succeeded`);
        return {
            announcementId: id,
            success: failCount === 0,
            totalServers: allDeliveries.length,
            successfulDeliveries: allDeliveries.filter(d => d.status === AnnouncementDelivery_1.DeliveryStatus.DELIVERED).length,
            failedDeliveries: allDeliveries.filter(d => d.status === AnnouncementDelivery_1.DeliveryStatus.FAILED).length,
            pendingDeliveries: pendingCount,
            deliveries: allDeliveries,
        };
    }
    async getPendingDeliveries() {
        const now = new Date();
        return this.deliveryRepository
            .createQueryBuilder('delivery')
            .leftJoinAndSelect('delivery.announcement', 'announcement')
            .where('delivery.status = :status', { status: AnnouncementDelivery_1.DeliveryStatus.SCHEDULED })
            .andWhere('delivery.scheduledAt <= :now', { now })
            .getMany();
    }
    async processScheduledDelivery(deliveryId) {
        const delivery = await this.deliveryRepository.findOne({
            where: { id: deliveryId },
            relations: ['announcement'],
        });
        if (!delivery) {
            throw new Error('Delivery not found');
        }
        if (!this.discordClient) {
            throw new Error('Discord client not configured');
        }
        const announcement = delivery.announcement ?? (await this.getById(delivery.announcementId));
        if (!announcement) {
            delivery.status = AnnouncementDelivery_1.DeliveryStatus.FAILED;
            delivery.errorMessage = 'Announcement not found';
            await this.deliveryRepository.save(delivery);
            return false;
        }
        const context = await this.buildShortcodeContext(announcement.organizationId);
        const embed = this.buildEmbed(announcement, context);
        await this.processDelivery(delivery, embed);
        const updatedDelivery = await this.deliveryRepository.findOne({
            where: { id: deliveryId },
        });
        return updatedDelivery?.status === AnnouncementDelivery_1.DeliveryStatus.DELIVERED;
    }
    async processDelivery(delivery, embed) {
        if (!this.discordClient) {
            throw new Error('Discord client not configured');
        }
        if (!delivery.channelId) {
            delivery.status = AnnouncementDelivery_1.DeliveryStatus.FAILED;
            delivery.errorMessage = 'No channel ID specified';
            await this.deliveryRepository.save(delivery);
            return;
        }
        delivery.status = AnnouncementDelivery_1.DeliveryStatus.SENDING;
        await this.deliveryRepository.save(delivery);
        try {
            const channel = await this.discordClient.channels.fetch(delivery.channelId);
            if (!channel?.isTextBased()) {
                delivery.status = AnnouncementDelivery_1.DeliveryStatus.FAILED;
                delivery.errorMessage = 'Channel not found or not a text channel';
                await this.deliveryRepository.save(delivery);
                return;
            }
            const message = await channel.send({ embeds: [embed] });
            delivery.status = AnnouncementDelivery_1.DeliveryStatus.DELIVERED;
            delivery.messageId = message.id;
            delivery.deliveredAt = new Date();
            delivery.errorMessage = undefined;
            await this.deliveryRepository.save(delivery);
            await this.tryCrosspost(message);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            delivery.status = AnnouncementDelivery_1.DeliveryStatus.FAILED;
            delivery.errorMessage = errorMessage;
            await this.deliveryRepository.save(delivery);
            logger_1.logger.error(`Delivery ${delivery.id} failed:`, error);
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async tryCrosspost(message) {
        try {
            if (message.channel.type !== discord_js_1.ChannelType.GuildAnnouncement) {
                return;
            }
            const guildId = message.guildId;
            if (!guildId) {
                return;
            }
            const allSettings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
            if (!allSettings || allSettings.length === 0) {
                return;
            }
            const hasAutoPublish = allSettings.some(s => s.notificationPreferences?.autoPublishAnnouncements === true ||
                s.eventSettings?.autoPublishAnnouncements === true);
            if (!hasAutoPublish) {
                return;
            }
            await message.crosspost();
        }
        catch (err) {
            logger_1.logger.warn('Failed to crosspost announcement message', {
                channelId: message.channelId,
                messageId: message.id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async getAlliedOrganizations(organizationId) {
        const relations = await this.diplomacyRepository.find({
            where: [
                { orgId1: organizationId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
                { orgId2: organizationId, status: AllianceDiplomacy_1.DiplomacyStatus.ACTIVE },
            ],
        });
        const alliedOrgIds = relations.map(rel => rel.orgId1 === organizationId ? rel.orgId2 : rel.orgId1);
        return [...new Set(alliedOrgIds)];
    }
    async getDiscordGuildIdForOrg(organizationId) {
        if (/^\d{17,19}$/.test(organizationId)) {
            return organizationId;
        }
        const org = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!org) {
            return null;
        }
        const metadata = org.metadata;
        const settings = org.settings;
        const discordGuildId = metadata?.discordGuildId ||
            metadata?.discordServerId ||
            settings?.discordGuildId ||
            null;
        return discordGuildId;
    }
    async sendToAlliance(id, sourceOrgId, _channelId) {
        logger_1.logger.warn('sendToAlliance is deprecated. Use sendToAllianceWithChannelResolution instead.');
        return this.sendToAllianceWithChannelResolution(id, sourceOrgId, 'announcements');
    }
    async sendToAllianceWithChannelResolution(id, sourceOrgId, preferredChannelName = 'announcements') {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new Error('Announcement not found');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new Error('Announcement has already been sent');
        }
        if (!this.discordClient) {
            throw new Error('Discord client not configured');
        }
        const alliedOrgIds = await this.getAlliedOrganizations(sourceOrgId);
        if (alliedOrgIds.length === 0) {
            throw new Error('No allied organizations found');
        }
        const targetChannels = [];
        const skippedOrgs = [];
        const skippedReasons = {};
        for (const orgId of alliedOrgIds) {
            const guildId = await this.getDiscordGuildIdForOrg(orgId);
            if (!guildId) {
                skippedOrgs.push(orgId);
                skippedReasons[orgId] = 'No Discord server linked';
                logger_1.logger.info(`Skipping org ${orgId}: No Discord server linked`);
                continue;
            }
            try {
                const guild = await this.discordClient.guilds.fetch(guildId);
                const channels = guild.channels.cache;
                let targetChannel = channels.find(ch => ch.isTextBased() && ch.name.toLowerCase().includes(preferredChannelName.toLowerCase()));
                if (!targetChannel) {
                    targetChannel = channels.find(ch => ch.isTextBased() && ch.name.toLowerCase().includes('general'));
                }
                if (!targetChannel) {
                    targetChannel = channels.find(ch => ch.isTextBased());
                }
                if (targetChannel) {
                    targetChannels.push(targetChannel.id);
                }
                else {
                    skippedOrgs.push(orgId);
                    skippedReasons[orgId] = 'No suitable text channel found in guild';
                    logger_1.logger.info(`Skipping org ${orgId}: No suitable text channel found`);
                }
            }
            catch (error) {
                skippedOrgs.push(orgId);
                skippedReasons[orgId] =
                    `Failed to access guild: ${error instanceof Error ? error.message : 'Unknown error'}`;
                logger_1.logger.error(`Failed to access guild for org ${orgId}:`, error);
            }
        }
        if (targetChannels.length === 0) {
            return {
                announcementId: id,
                success: false,
                totalServers: 0,
                successfulDeliveries: 0,
                failedDeliveries: 0,
                pendingDeliveries: 0,
                deliveries: [],
                allianceOrgs: alliedOrgIds,
                skippedOrgs,
                skippedReasons,
            };
        }
        const result = await this.sendMultiple(id, 'multiple', targetChannels);
        const updatedAnnouncement = await this.getById(id);
        if (updatedAnnouncement) {
            updatedAnnouncement.targetType = Announcement_1.AnnouncementTargetType.ALLIANCE;
            await this.announcementRepository.save(updatedAnnouncement);
        }
        return {
            ...result,
            allianceOrgs: alliedOrgIds,
            skippedOrgs,
            skippedReasons,
        };
    }
    async createTemplate(organizationId, dto, isPlatformAdmin = false) {
        if (dto.isGlobal && !isPlatformAdmin) {
            throw new Error('Only Platform Admins can create global templates');
        }
        const templateData = {
            name: dto.name,
            title: dto.title,
            content: dto.content,
            embedConfig: dto.embedConfig,
            isGlobal: dto.isGlobal || false,
            createdBy: dto.createdBy,
            createdByName: dto.createdByName,
        };
        if (!dto.isGlobal && organizationId) {
            templateData.organizationId = organizationId;
        }
        const template = this.templateRepository.create(templateData);
        const savedTemplate = await this.templateRepository.save(template);
        logger_1.logger.info(`Template created: ${savedTemplate.id} (global: ${savedTemplate.isGlobal})`);
        return savedTemplate;
    }
    async getTemplateById(id) {
        return this.templateRepository.findOne({
            where: { id, deletedAt: (0, typeorm_1.IsNull)() },
        });
    }
    async updateTemplate(id, dto, userId, isPlatformAdmin = false) {
        const template = await this.getTemplateById(id);
        if (!template) {
            throw new Error('Template not found');
        }
        if (!template.canBeModifiedBy(userId, isPlatformAdmin)) {
            throw new Error('You do not have permission to modify this template');
        }
        if (dto.name !== undefined) {
            template.name = dto.name;
        }
        if (dto.title !== undefined) {
            template.title = dto.title;
        }
        if (dto.content !== undefined) {
            template.content = dto.content;
        }
        if (dto.embedConfig !== undefined) {
            template.embedConfig = dto.embedConfig;
        }
        const updatedTemplate = await this.templateRepository.save(template);
        logger_1.logger.info(`Template updated: ${id}`);
        return updatedTemplate;
    }
    async deleteTemplate(id, userId, isPlatformAdmin = false) {
        const template = await this.getTemplateById(id);
        if (!template) {
            throw new Error('Template not found');
        }
        if (!template.canBeModifiedBy(userId, isPlatformAdmin)) {
            throw new Error('You do not have permission to delete this template');
        }
        template.deletedAt = new Date();
        template.deletedBy = userId;
        await this.templateRepository.save(template);
        logger_1.logger.info(`Template deleted: ${id}`);
    }
    async listTemplates(organizationId, filters = {}, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const queryBuilder = this.templateRepository
            .createQueryBuilder('template')
            .where('template.deletedAt IS NULL')
            .andWhere('(template.organizationId = :organizationId OR template.isGlobal = true)', {
            organizationId,
        });
        if (filters.isGlobal !== undefined) {
            queryBuilder.andWhere('template.isGlobal = :isGlobal', { isGlobal: filters.isGlobal });
        }
        if (filters.createdBy) {
            queryBuilder.andWhere('template.createdBy = :createdBy', { createdBy: filters.createdBy });
        }
        queryBuilder.orderBy('template.createdAt', 'DESC').skip(skip).take(limit);
        const [templates, total] = await queryBuilder.getManyAndCount();
        return {
            templates,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async listGlobalTemplates(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [templates, total] = await this.templateRepository.findAndCount({
            where: {
                isGlobal: true,
                deletedAt: (0, typeorm_1.IsNull)(),
            },
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });
        return {
            templates,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    async createFromTemplate(organizationId, templateId, overrides = {}, createdBy, createdByName) {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        if (!template.isAvailableTo(organizationId)) {
            throw new Error('This template is not available to your organization');
        }
        const dto = {
            title: overrides.title || template.title || template.name,
            content: overrides.content || template.content,
            embedConfig: overrides.embedConfig || template.embedConfig,
            createdBy,
            createdByName,
        };
        return this.create(organizationId, dto);
    }
    async getAllConnectedGuilds() {
        if (!this.discordClient) {
            throw new Error('Discord client not configured');
        }
        const guilds = this.discordClient.guilds.cache;
        return Array.from(guilds.keys());
    }
    async togglePin(id, userId) {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new Error('Announcement not found');
        }
        if (announcement.pinnedAt) {
            announcement.pinnedAt = undefined;
            announcement.pinnedBy = undefined;
        }
        else {
            announcement.pinnedAt = new Date();
            announcement.pinnedBy = userId;
        }
        await this.announcementRepository.save(announcement);
        const pinned = announcement.pinnedAt !== null && announcement.pinnedAt !== undefined;
        logger_1.logger.info(`Announcement ${id} ${pinned ? 'pinned' : 'unpinned'} by ${userId}`);
        return { pinned };
    }
    async markRead(announcementId, userId) {
        const announcement = await this.getById(announcementId);
        if (!announcement) {
            throw new Error('Announcement not found');
        }
        const existing = await this.readReceiptRepository.findOne({
            where: { announcementId, userId },
        });
        if (existing) {
            return { readAt: existing.readAt };
        }
        const receipt = this.readReceiptRepository.create({ announcementId, userId });
        const saved = await this.readReceiptRepository.save(receipt);
        logger_1.logger.info(`Announcement ${announcementId} marked read by ${userId}`);
        return { readAt: saved.readAt };
    }
    async sendGlobalBroadcast(id, confirmedBy, preferredChannelName = 'announcements') {
        const announcement = await this.getById(id);
        if (!announcement) {
            throw new Error('Announcement not found');
        }
        if (announcement.status === Announcement_1.AnnouncementStatus.SENT) {
            throw new Error('Announcement has already been sent');
        }
        if (!this.discordClient) {
            throw new Error('Discord client not configured');
        }
        const allGuildIds = await this.getAllConnectedGuilds();
        if (allGuildIds.length === 0) {
            throw new Error('No connected Discord servers found');
        }
        logger_1.logger.info(`Starting global broadcast ${id} to ${allGuildIds.length} guilds, confirmed by ${confirmedBy}`);
        announcement.status = Announcement_1.AnnouncementStatus.SENDING;
        announcement.targetType = Announcement_1.AnnouncementTargetType.ALL;
        await this.announcementRepository.save(announcement);
        const targetChannelsByGuild = new Map();
        const skippedGuilds = [];
        const skippedReasons = {};
        let reachableGuilds = 0;
        const GUILD_BATCH_SIZE = 5;
        for (let i = 0; i < allGuildIds.length; i += GUILD_BATCH_SIZE) {
            const batch = allGuildIds.slice(i, i + GUILD_BATCH_SIZE);
            await Promise.allSettled(batch.map(async (guildId) => {
                try {
                    const guild = await this.discordClient.guilds.fetch(guildId);
                    const channels = guild.channels.cache;
                    reachableGuilds++;
                    let targetChannel = channels.find(ch => ch.isTextBased() &&
                        ch.name.toLowerCase().includes(preferredChannelName.toLowerCase()));
                    if (!targetChannel) {
                        targetChannel = channels.find(ch => ch.isTextBased() && ch.name.toLowerCase().includes('general'));
                    }
                    if (!targetChannel) {
                        targetChannel = channels.find(ch => ch.isTextBased());
                    }
                    if (targetChannel) {
                        targetChannelsByGuild.set(targetChannel.id, guildId);
                    }
                    else {
                        skippedGuilds.push(guildId);
                        skippedReasons[guildId] = 'No suitable text channel found';
                        logger_1.logger.info(`Skipping guild ${guildId}: No suitable text channel found`);
                    }
                }
                catch (error) {
                    skippedGuilds.push(guildId);
                    skippedReasons[guildId] =
                        `Failed to access guild: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    logger_1.logger.error(`Failed to access guild ${guildId}:`, error);
                }
            }));
            if (i + GUILD_BATCH_SIZE < allGuildIds.length) {
                await this.delay(GLOBAL_BROADCAST_RATE_LIMIT_DELAY_MS);
            }
        }
        if (targetChannelsByGuild.size === 0) {
            announcement.status = Announcement_1.AnnouncementStatus.FAILED;
            await this.announcementRepository.save(announcement);
            return {
                announcementId: id,
                success: false,
                totalServers: 0,
                totalGuilds: allGuildIds.length,
                reachableGuilds,
                successfulDeliveries: 0,
                failedDeliveries: 0,
                pendingDeliveries: 0,
                deliveries: [],
                skippedGuilds,
                skippedReasons,
                confirmationRequired: true,
                confirmedBy,
            };
        }
        const deliveries = [];
        const context = await this.buildShortcodeContext(announcement.organizationId);
        const embed = this.buildEmbed(announcement, context);
        let successCount = 0;
        let failCount = 0;
        for (const [channelId, guildId] of targetChannelsByGuild) {
            const delivery = this.deliveryRepository.create({
                announcementId: id,
                guildId,
                channelId,
                status: AnnouncementDelivery_1.DeliveryStatus.PENDING,
            });
            const savedDelivery = await this.deliveryRepository.save(delivery);
            deliveries.push(savedDelivery);
            try {
                await this.processDelivery(savedDelivery, embed);
                if (savedDelivery.status === AnnouncementDelivery_1.DeliveryStatus.DELIVERED) {
                    successCount++;
                }
                else {
                    failCount++;
                }
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`Failed to process global delivery ${savedDelivery.id}:`, error);
            }
            await this.delay(GLOBAL_BROADCAST_RATE_LIMIT_DELAY_MS);
        }
        if (successCount > 0) {
            announcement.status = Announcement_1.AnnouncementStatus.SENT;
        }
        else {
            announcement.status = Announcement_1.AnnouncementStatus.FAILED;
        }
        announcement.sentAt = new Date();
        await this.announcementRepository.save(announcement);
        logger_1.logger.info(`Global broadcast ${id} completed: ${successCount}/${deliveries.length} successful`);
        return {
            announcementId: id,
            success: successCount === deliveries.length,
            totalServers: deliveries.length,
            totalGuilds: allGuildIds.length,
            reachableGuilds,
            successfulDeliveries: successCount,
            failedDeliveries: failCount,
            pendingDeliveries: 0,
            deliveries,
            skippedGuilds,
            skippedReasons,
            confirmationRequired: true,
            confirmedBy,
        };
    }
    async getGlobalBroadcastPreview() {
        if (!this.discordClient) {
            throw new Error('Discord client not configured');
        }
        const guilds = this.discordClient.guilds.cache;
        const guildNames = Array.from(guilds.values()).map(g => g.name);
        const SECONDS_PER_GUILD = 2;
        const estimatedTimeMinutes = Math.ceil((guilds.size * SECONDS_PER_GUILD) / 60);
        return {
            totalGuilds: guilds.size,
            guildNames,
            estimatedTimeMinutes,
        };
    }
}
exports.AnnouncementService = AnnouncementService;
//# sourceMappingURL=AnnouncementService.js.map