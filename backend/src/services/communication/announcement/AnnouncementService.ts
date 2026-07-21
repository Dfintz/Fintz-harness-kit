import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { ChannelType, Client, EmbedBuilder, type Message, TextChannel } from 'discord.js';
import { IsNull, Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { AllianceDiplomacy, DiplomacyStatus } from '../../../models/AllianceDiplomacy';
import {
  Announcement,
  AnnouncementDeliveryResult,
  AnnouncementEmbedConfig,
  AnnouncementStatus,
  AnnouncementTargetType,
} from '../../../models/Announcement';
import {
  AnnouncementDelivery,
  DeliveryStatus,
  MAX_DELIVERY_RETRY_COUNT,
} from '../../../models/AnnouncementDelivery';
import { AnnouncementReadReceipt } from '../../../models/AnnouncementReadReceipt';
import { AnnouncementTemplate } from '../../../models/AnnouncementTemplate';
import { Organization } from '../../../models/Organization';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import {
  ApiError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../utils/apiErrors';
import { logger } from '../../../utils/logger';
import { discordSettingsService } from '../../discord/DiscordSettingsService';
import { EmbedBuilderService, type ShortcodeContext } from '../../discord/EmbedBuilderService';

import type {
  AllianceDeliveryResult,
  AnnouncementFilters,
  AnnouncementStatusResult,
  CreateAnnouncementDTO,
  CreateTemplateDTO,
  DeliveryResult,
  EmbedPreview,
  GlobalBroadcastResult,
  MultiServerDeliveryResult,
  TemplateFilters,
  UpdateAnnouncementDTO,
  UpdateTemplateDTO,
} from './AnnouncementService.types';

// Discord API rate limit: 50 requests per second, but we'll be conservative
const RATE_LIMIT_DELAY_MS = 100; // 10 requests per second max

// Global broadcast rate limit: 1 request per second (extreme caution for platform-wide)
const GLOBAL_BROADCAST_RATE_LIMIT_DELAY_MS = 1000;

export type {
  AllianceDeliveryResult,
  AnnouncementFilters,
  AnnouncementStatusResult,
  CreateAnnouncementDTO,
  CreateTemplateDTO,
  DeliveryResult,
  EmbedPreview,
  GlobalBroadcastResult,
  MultiServerDeliveryResult,
  TemplateFilters,
  UpdateAnnouncementDTO,
  UpdateTemplateDTO,
} from './AnnouncementService.types';

/**
 * Announcement Service
 *
 * Handles announcement management including:
 * - Creating and updating announcements
 * - Generating embed previews
 * - Sending announcements to Discord servers
 * - Multi-server delivery with rate limiting (Phase 2)
 * - Scheduling with job queue (Phase 2)
 * - Delivery tracking per server (Phase 2)
 * - Retry logic for failed deliveries (Phase 2)
 * - Alliance-wide targeting (Phase 3)
 * - Announcement templates (Phase 4)
 * - Global broadcast with extreme rate limiting (Phase 4)
 */
export class AnnouncementService {
  private announcementRepository: Repository<Announcement>;
  private deliveryRepository: Repository<AnnouncementDelivery>;
  private readReceiptRepository: Repository<AnnouncementReadReceipt>;
  private templateRepository: Repository<AnnouncementTemplate>;
  private diplomacyRepository: Repository<AllianceDiplomacy>;
  private organizationRepository: Repository<Organization>;
  private organizationMembershipRepository: Repository<OrganizationMembership>;
  private discordClient: Client | null = null;

  constructor() {
    this.announcementRepository = AppDataSource.getRepository(Announcement);
    this.deliveryRepository = AppDataSource.getRepository(AnnouncementDelivery);
    this.readReceiptRepository = AppDataSource.getRepository(AnnouncementReadReceipt);
    this.templateRepository = AppDataSource.getRepository(AnnouncementTemplate);
    this.diplomacyRepository = AppDataSource.getRepository(AllianceDiplomacy);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.organizationMembershipRepository = AppDataSource.getRepository(OrganizationMembership);
  }

  /**
   * Set Discord client for sending announcements
   */
  public setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  /**
   * Create a new announcement
   */
  async create(organizationId: string, dto: CreateAnnouncementDTO): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      organizationId,
      title: dto.title,
      content: dto.content,
      createdBy: dto.createdBy,
      createdByName: dto.createdByName,
      embedConfig: dto.embedConfig,
      targetType: dto.targetType || AnnouncementTargetType.SINGLE,
      targetIds: dto.targetIds,
      status: dto.scheduledAt ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT,
      scheduledAt: dto.scheduledAt,
    });

    const savedAnnouncement = await this.announcementRepository.save(announcement);
    logger.info(`Announcement created: ${savedAnnouncement.id} for org ${organizationId}`);

    return savedAnnouncement;
  }

  /**
   * Get announcement by ID
   */
  async getById(id: string): Promise<Announcement | null> {
    return this.announcementRepository.findOne({
      where: { id },
    });
  }

  /**
   * Update an announcement
   */
  async update(id: string, dto: UpdateAnnouncementDTO): Promise<Announcement> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new ConflictError('Cannot update a sent announcement');
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
      if (dto.scheduledAt && announcement.status === AnnouncementStatus.DRAFT) {
        announcement.status = AnnouncementStatus.SCHEDULED;
      }
    }
    if (dto.status !== undefined) {
      announcement.status = dto.status;
    }

    const updatedAnnouncement = await this.announcementRepository.save(announcement);
    logger.info(`Announcement updated: ${id}`);

    return updatedAnnouncement;
  }

  /**
   * Delete an announcement
   */
  async delete(id: string, deletedBy: string): Promise<void> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    announcement.deletedAt = new Date();
    announcement.deletedBy = deletedBy;
    await this.announcementRepository.save(announcement);
    logger.info(`Announcement deleted: ${id}`);
  }

  /**
   * List announcements for an organization
   */
  async list(
    organizationId: string,
    filters: AnnouncementFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ announcements: Announcement[]; total: number; page: number; totalPages: number }> {
    const where: Record<string, unknown> = { organizationId };

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

  /**
   * Generate a preview of the announcement embed
   *
   * For previews, we resolve template variables using organization context
   * so users can see what the announcement will look like when sent.
   *
   * @param announcement - The announcement to preview
   * @param userId - Optional user ID for authorization check
   */
  async preview(announcement: Announcement, userId?: string): Promise<EmbedPreview> {
    const context = await this.buildShortcodeContext(announcement.organizationId, userId);
    const embed = this.buildEmbed(announcement, context);
    return { embed, announcement };
  }

  /**
   * Preview announcement by ID
   */
  async previewById(id: string): Promise<EmbedPreview> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }
    return this.preview(announcement);
  }

  /**
   * Build Discord embed from announcement
   */
  /**
   * Build ShortcodeContext from organization data for announcement templates
   *
   * @param organizationId - The organization ID
   * @param userId - Optional user ID; if provided, verifies user has access to organization (zero trust)
   * @returns ShortcodeContext with organization-scoped variables
   * @throws ForbiddenError if userId is provided but user is not member of organization
   */
  private async buildShortcodeContext(
    organizationId: string,
    userId?: string
  ): Promise<ShortcodeContext> {
    try {
      // Gate 4b: Multi-Tenant Isolation — Verify user has access if userId provided
      if (userId) {
        const isMember = await this.organizationMembershipRepository.exists({
          where: { organizationId, userId },
        });

        if (!isMember) {
          throw new ForbiddenError('Access denied: User is not a member of this organization');
        }
      }

      const org = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!org) {
        logger.warn(`Organization not found for shortcode context: ${organizationId}`);
        return {};
      }

      // Query actual member count from OrganizationMembership table
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
    } catch (err: unknown) {
      // Re-throw operational errors (authorization, not found)
      if (err instanceof ApiError) {
        throw err;
      }

      logger.error('Failed to build shortcode context for announcement', err);
      return {};
    }
  }

  /**
   *
   * If context is provided, resolves template variables in all text fields.
   * Prioritizes template fields (footerTextTemplate, authorNameTemplate) over plain fields for backward compatibility.
   *
   * @param announcement - The announcement entity
   * @param context - Optional ShortcodeContext for template variable resolution
   * @returns Discord.js EmbedBuilder
   */
  private buildEmbed(announcement: Announcement, context?: ShortcodeContext): EmbedBuilder {
    const embedService = EmbedBuilderService.getInstance();
    const embed = new EmbedBuilder();

    // Resolve title and description (with or without template variables)
    const resolvedTitle = context
      ? embedService.renderWithContext(announcement.title, undefined, context).title
      : announcement.title;
    const resolvedDescription = context
      ? embedService.renderWithContext(undefined, announcement.content, context).description
      : announcement.content;

    embed.setTitle(decodeHtmlEntities(resolvedTitle || ''));
    embed.setDescription(decodeHtmlEntities(resolvedDescription || ''));

    const config = announcement.embedConfig;
    if (config) {
      if (config.color) {
        // Convert hex color to integer
        const colorInt = parseInt(config.color.replace('#', ''), 16);
        embed.setColor(colorInt);
      }
      if (config.thumbnailUrl) {
        embed.setThumbnail(config.thumbnailUrl);
      }
      if (config.imageUrl) {
        embed.setImage(config.imageUrl);
      }

      // Resolve footer text (prioritize template if context provided)
      const footerText = context
        ? config.footerTextTemplate
          ? embedService.resolveFooterText(config.footerTextTemplate, context)
          : config.footerText
        : config.footerText;

      if (footerText) {
        embed.setFooter({
          text: decodeHtmlEntities(footerText),
          iconURL: config.footerIconUrl,
        });
      }

      // Resolve author name (prioritize template if context provided)
      const authorName = context
        ? config.authorNameTemplate
          ? embedService.resolveAuthorName(config.authorNameTemplate, context)
          : config.authorName
        : config.authorName;

      if (authorName) {
        embed.setAuthor({
          name: decodeHtmlEntities(authorName),
          iconURL: config.authorIconUrl,
          url: config.authorUrl,
        });
      }

      if (config.timestamp) {
        embed.setTimestamp();
      }

      // Resolve field names and values with template variable support
      if (config.fields && config.fields.length > 0) {
        config.fields.forEach(field => {
          // Prioritize template fields if context provided
          const resolvedName =
            context && field.nameTemplate
              ? embedService.resolveFieldText(field.nameTemplate, context)
              : field.name;
          const resolvedValue =
            context && field.valueTemplate
              ? embedService.resolveFieldText(field.valueTemplate, context)
              : field.value;

          embed.addFields({
            name: decodeHtmlEntities(resolvedName || field.name),
            value: decodeHtmlEntities(resolvedValue || field.value),
            inline: field.inline,
          });
        });
      }
    }

    return embed;
  }

  /**
   * Send announcement to a single Discord server
   */
  async send(id: string, channelId: string): Promise<DeliveryResult> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new ConflictError('Announcement has already been sent');
    }

    if (!this.discordClient) {
      try {
        const { BotClientManager } = await import('../../../bot/BotClientManager');
        const client = BotClientManager.getInstance().getClient();
        if (client?.isReady()) {
          this.discordClient = client;
        }
      } catch {
        // Best-effort fallback; keep existing error behavior if unavailable
      }
    }

    if (!this.discordClient) {
      throw new ServiceUnavailableError('Discord client not configured');
    }

    // Update status to sending
    announcement.status = AnnouncementStatus.SENDING;
    await this.announcementRepository.save(announcement);

    const results: AnnouncementDeliveryResult[] = [];

    // Build shortcode context for template variable resolution
    // Note: send() is typically called from controller; pass userId from request context if available
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
      } else {
        const message = await (channel as TextChannel).send({ embeds: [embed] });
        results.push({
          targetId: channelId,
          success: true,
          messageId: message.id,
          deliveredAt: new Date(),
        });
        await this.tryCrosspost(message);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        targetId: channelId,
        success: false,
        error: errorMessage,
      });
      logger.error(`Failed to send announcement ${id} to channel ${channelId}:`, error);
    }

    // Update announcement with results
    const allSuccessful = results.every(r => r.success);
    announcement.status = allSuccessful ? AnnouncementStatus.SENT : AnnouncementStatus.FAILED;
    announcement.sentAt = new Date();
    announcement.deliveryResults = results;
    announcement.targetIds = [channelId];
    await this.announcementRepository.save(announcement);

    logger.info(
      `Announcement ${id} delivery completed: ${results.filter(r => r.success).length}/${results.length} successful`
    );

    return {
      announcementId: id,
      success: allSuccessful,
      totalTargets: results.length,
      successfulDeliveries: results.filter(r => r.success).length,
      failedDeliveries: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * Cancel a scheduled announcement
   */
  async cancel(id: string): Promise<Announcement> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new ConflictError('Cannot cancel a sent announcement');
    }

    if (announcement.status === AnnouncementStatus.SENDING) {
      throw new ConflictError('Cannot cancel an announcement that is currently being sent');
    }

    announcement.status = AnnouncementStatus.CANCELLED;
    const updatedAnnouncement = await this.announcementRepository.save(announcement);
    logger.info(`Announcement cancelled: ${id}`);

    return updatedAnnouncement;
  }

  /**
   * Get announcements pending delivery (scheduled and due)
   */
  async getPendingDelivery(): Promise<Announcement[]> {
    const now = new Date();
    return this.announcementRepository
      .createQueryBuilder('announcement')
      .where('announcement.status = :status', { status: AnnouncementStatus.SCHEDULED })
      .andWhere('announcement.scheduledAt <= :now', { now })
      .andWhere('announcement.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Get announcement statistics for an organization
   */
  async getStats(organizationId: string): Promise<{
    total: number;
    draft: number;
    scheduled: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    const announcements = await this.announcementRepository.find({
      where: { organizationId },
    });

    return {
      total: announcements.length,
      draft: announcements.filter(a => a.status === AnnouncementStatus.DRAFT).length,
      scheduled: announcements.filter(a => a.status === AnnouncementStatus.SCHEDULED).length,
      sent: announcements.filter(a => a.status === AnnouncementStatus.SENT).length,
      failed: announcements.filter(a => a.status === AnnouncementStatus.FAILED).length,
      cancelled: announcements.filter(a => a.status === AnnouncementStatus.CANCELLED).length,
    };
  }

  // ========================================
  // Phase 2: Multi-Server & Scheduling
  // ========================================

  /**
   * Send announcement to multiple Discord servers (Phase 2)
   * Implements rate limiting to respect Discord API limits
   *
   * @param id - Announcement ID
   * @param targetType - 'multiple' for specific servers
   * @param targetIds - Array of channel IDs to send to
   */
  async sendMultiple(
    id: string,
    targetType: 'multiple',
    targetIds: string[]
  ): Promise<MultiServerDeliveryResult> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new ConflictError('Announcement has already been sent');
    }

    if (!targetIds || targetIds.length === 0) {
      throw new ValidationError('No target servers specified');
    }

    if (!this.discordClient) {
      throw new ServiceUnavailableError('Discord client not configured');
    }

    // Update announcement status and target info
    announcement.status = AnnouncementStatus.SENDING;
    announcement.targetType = AnnouncementTargetType.MULTIPLE;
    announcement.targetIds = targetIds;
    await this.announcementRepository.save(announcement);

    // Create delivery records for each target
    // Note: guildId is populated with channelId for now since the bot command provides channel IDs.
    // The guildId can be resolved from the channel when processing the delivery if needed.
    const deliveries: AnnouncementDelivery[] = [];
    for (const channelId of targetIds) {
      const delivery = this.deliveryRepository.create({
        announcementId: id,
        guildId: channelId, // Will be resolved to actual guildId when delivery is processed
        channelId,
        status: DeliveryStatus.PENDING,
      });
      const savedDelivery = await this.deliveryRepository.save(delivery);
      deliveries.push(savedDelivery);
    }

    // Process deliveries with rate limiting
    const context = await this.buildShortcodeContext(announcement.organizationId);
    const embed = this.buildEmbed(announcement, context);
    let successCount = 0;
    let failCount = 0;

    for (const delivery of deliveries) {
      try {
        await this.processDelivery(delivery, embed);
        if (delivery.status === DeliveryStatus.DELIVERED) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error: unknown) {
        failCount++;
        logger.error(`Failed to process delivery ${delivery.id}:`, error);
      }

      // Rate limiting delay between requests
      await this.delay(RATE_LIMIT_DELAY_MS);
    }

    // Update announcement status based on results
    const allSuccessful = successCount === deliveries.length;
    const anySuccessful = successCount > 0;

    if (allSuccessful) {
      announcement.status = AnnouncementStatus.SENT;
    } else if (anySuccessful) {
      // Partial success - mark as sent but with failed deliveries recorded
      announcement.status = AnnouncementStatus.SENT;
    } else {
      announcement.status = AnnouncementStatus.FAILED;
    }
    announcement.sentAt = new Date();
    await this.announcementRepository.save(announcement);

    logger.info(
      `Multi-server announcement ${id} completed: ${successCount}/${deliveries.length} successful`
    );

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

  /**
   * Schedule an announcement for future delivery (Phase 2)
   *
   * @param id - Announcement ID
   * @param scheduledAt - When to send the announcement
   * @param targetIds - Optional array of channel IDs for multi-server delivery
   */
  async schedule(id: string, scheduledAt: Date, targetIds?: string[]): Promise<void> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new ConflictError('Cannot schedule a sent announcement');
    }

    if (scheduledAt <= new Date()) {
      throw new ValidationError('Scheduled time must be in the future');
    }

    // Update announcement
    announcement.scheduledAt = scheduledAt;
    announcement.status = AnnouncementStatus.SCHEDULED;

    if (targetIds && targetIds.length > 0) {
      announcement.targetType =
        targetIds.length > 1 ? AnnouncementTargetType.MULTIPLE : AnnouncementTargetType.SINGLE;
      announcement.targetIds = targetIds;

      // Create delivery records for scheduled deliveries
      for (const channelId of targetIds) {
        const existingDelivery = await this.deliveryRepository.findOne({
          where: { announcementId: id, channelId },
        });

        if (!existingDelivery) {
          const delivery = this.deliveryRepository.create({
            announcementId: id,
            guildId: channelId,
            channelId,
            status: DeliveryStatus.SCHEDULED,
            scheduledAt,
          });
          await this.deliveryRepository.save(delivery);
        }
      }
    }

    await this.announcementRepository.save(announcement);
    logger.info(`Announcement ${id} scheduled for ${scheduledAt.toISOString()}`);
  }

  /**
   * Get detailed status of an announcement with delivery tracking (Phase 2)
   *
   * @param id - Announcement ID
   */
  async getStatus(id: string): Promise<AnnouncementStatusResult> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    const deliveries = await this.deliveryRepository.find({
      where: { announcementId: id },
      order: { createdAt: 'ASC' },
    });

    const summary = {
      total: deliveries.length,
      pending: deliveries.filter(
        d => d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.SCHEDULED
      ).length,
      delivered: deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
      failed: deliveries.filter(d => d.status === DeliveryStatus.FAILED).length,
      cancelled: deliveries.filter(d => d.status === DeliveryStatus.CANCELLED).length,
    };

    return {
      announcement,
      deliveries,
      summary,
    };
  }

  /**
   * Cancel a scheduled announcement (Phase 2 - enhanced)
   * Also cancels all pending deliveries
   *
   * @param id - Announcement ID
   */
  async cancelScheduled(id: string): Promise<void> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new ConflictError('Cannot cancel a sent announcement');
    }

    if (announcement.status === AnnouncementStatus.SENDING) {
      throw new ConflictError('Cannot cancel an announcement that is currently being sent');
    }

    // Cancel all pending/scheduled deliveries
    await this.deliveryRepository
      .createQueryBuilder()
      .update(AnnouncementDelivery)
      .set({ status: DeliveryStatus.CANCELLED })
      .where('announcementId = :id', { id })
      .andWhere('status IN (:...statuses)', {
        statuses: [DeliveryStatus.PENDING, DeliveryStatus.SCHEDULED],
      })
      .execute();

    // Update announcement status
    announcement.status = AnnouncementStatus.CANCELLED;
    await this.announcementRepository.save(announcement);

    logger.info(`Scheduled announcement ${id} cancelled`);
  }

  /**
   * Retry failed deliveries for an announcement (Phase 2)
   *
   * @param id - Announcement ID
   */
  async retryFailed(id: string): Promise<MultiServerDeliveryResult> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    if (!this.discordClient) {
      throw new Error('Discord client not configured');
    }

    // Get failed deliveries that haven't exceeded retry limit
    const failedDeliveries = await this.deliveryRepository.find({
      where: {
        announcementId: id,
        status: DeliveryStatus.FAILED,
      },
    });

    const retriableDeliveries = failedDeliveries.filter(
      d => d.retryCount < MAX_DELIVERY_RETRY_COUNT
    );

    if (retriableDeliveries.length === 0) {
      throw new Error('No retriable deliveries found');
    }

    const context = await this.buildShortcodeContext(announcement.organizationId);
    const embed = this.buildEmbed(announcement, context);
    let successCount = 0;
    let failCount = 0;

    for (const delivery of retriableDeliveries) {
      delivery.retryCount++;
      delivery.status = DeliveryStatus.SENDING;
      await this.deliveryRepository.save(delivery);

      try {
        await this.processDelivery(delivery, embed);
        // Refresh delivery status from database
        const updatedDelivery = await this.deliveryRepository.findOne({
          where: { id: delivery.id },
        });
        if (updatedDelivery?.status === DeliveryStatus.DELIVERED) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error: unknown) {
        failCount++;
        logger.error(`Retry failed for delivery ${delivery.id}:`, error);
      }

      // Rate limiting delay
      await this.delay(RATE_LIMIT_DELAY_MS);
    }

    // Refresh all deliveries for return
    const allDeliveries = await this.deliveryRepository.find({
      where: { announcementId: id },
    });

    const pendingCount = allDeliveries.filter(
      d => d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.SCHEDULED
    ).length;

    logger.info(
      `Retry for announcement ${id}: ${successCount}/${retriableDeliveries.length} succeeded`
    );

    return {
      announcementId: id,
      success: failCount === 0,
      totalServers: allDeliveries.length,
      successfulDeliveries: allDeliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
      failedDeliveries: allDeliveries.filter(d => d.status === DeliveryStatus.FAILED).length,
      pendingDeliveries: pendingCount,
      deliveries: allDeliveries,
    };
  }

  /**
   * Get deliveries pending execution (for scheduler job)
   */
  async getPendingDeliveries(): Promise<AnnouncementDelivery[]> {
    const now = new Date();
    return this.deliveryRepository
      .createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.announcement', 'announcement')
      .where('delivery.status = :status', { status: DeliveryStatus.SCHEDULED })
      .andWhere('delivery.scheduledAt <= :now', { now })
      .getMany();
  }

  /**
   * Process a single scheduled delivery by ID (for scheduler job)
   * This processes only the specific delivery, not all failed deliveries
   */
  async processScheduledDelivery(deliveryId: string): Promise<boolean> {
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

    // Get announcement for embed
    const announcement = delivery.announcement ?? (await this.getById(delivery.announcementId));
    if (!announcement) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.errorMessage = 'Announcement not found';
      await this.deliveryRepository.save(delivery);
      return false;
    }

    const context = await this.buildShortcodeContext(announcement.organizationId);
    const embed = this.buildEmbed(announcement, context);
    await this.processDelivery(delivery, embed);

    // Refresh delivery status
    const updatedDelivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
    });

    return updatedDelivery?.status === DeliveryStatus.DELIVERED;
  }

  /**
   * Process a single delivery (internal helper)
   */
  private async processDelivery(
    delivery: AnnouncementDelivery,
    embed: EmbedBuilder
  ): Promise<void> {
    if (!this.discordClient) {
      throw new Error('Discord client not configured');
    }

    if (!delivery.channelId) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.errorMessage = 'No channel ID specified';
      await this.deliveryRepository.save(delivery);
      return;
    }

    delivery.status = DeliveryStatus.SENDING;
    await this.deliveryRepository.save(delivery);

    try {
      const channel = await this.discordClient.channels.fetch(delivery.channelId);

      if (!channel?.isTextBased()) {
        delivery.status = DeliveryStatus.FAILED;
        delivery.errorMessage = 'Channel not found or not a text channel';
        await this.deliveryRepository.save(delivery);
        return;
      }

      const message = await (channel as TextChannel).send({ embeds: [embed] });
      delivery.status = DeliveryStatus.DELIVERED;
      delivery.messageId = message.id;
      delivery.deliveredAt = new Date();
      delivery.errorMessage = undefined;
      await this.deliveryRepository.save(delivery);
      await this.tryCrosspost(message);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      delivery.status = DeliveryStatus.FAILED;
      delivery.errorMessage = errorMessage;
      await this.deliveryRepository.save(delivery);
      logger.error(`Delivery ${delivery.id} failed:`, error);
    }
  }

  /**
   * Helper method for rate limiting delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Auto-publish (crosspost) a message if the channel is a Discord
   * announcement channel and the guild has auto-publish enabled in
   * notification preferences or event settings.
   */
  private async tryCrosspost(message: Message): Promise<void> {
    try {
      if (message.channel.type !== ChannelType.GuildAnnouncement) {
        return;
      }
      const guildId = message.guildId;
      if (!guildId) {
        return;
      }
      const allSettings = await discordSettingsService.getSettingsByGuildId(guildId);
      if (!allSettings || allSettings.length === 0) {
        return;
      }
      const hasAutoPublish = allSettings.some(
        s =>
          s.notificationPreferences?.autoPublishAnnouncements === true ||
          s.eventSettings?.autoPublishAnnouncements === true
      );
      if (!hasAutoPublish) {
        return;
      }
      await message.crosspost();
    } catch (err: unknown) {
      logger.warn('Failed to crosspost announcement message', {
        channelId: message.channelId,
        messageId: message.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ========================================
  // Phase 3: Alliance-Wide Targeting
  // ========================================

  /**
   * Get all allied organizations for a given organization (Phase 3)
   * Returns organizations that have active alliance relationships
   *
   * @param organizationId - The source organization ID (Discord guild ID)
   */
  async getAlliedOrganizations(organizationId: string): Promise<string[]> {
    // Find all active diplomacy relations where this org is involved
    const relations = await this.diplomacyRepository.find({
      where: [
        { orgId1: organizationId, status: DiplomacyStatus.ACTIVE },
        { orgId2: organizationId, status: DiplomacyStatus.ACTIVE },
      ],
    });

    // Extract the other organization IDs
    const alliedOrgIds = relations.map(rel =>
      rel.orgId1 === organizationId ? rel.orgId2 : rel.orgId1
    );

    // Return unique org IDs (in case of duplicate relationships)
    return [...new Set(alliedOrgIds)];
  }

  /**
   * Get Discord guild ID for an organization (Phase 3)
   * Organizations may have their Discord guild ID stored in their settings or metadata
   * If the organization ID is already a Discord guild ID, return it directly
   *
   * @param organizationId - The organization ID
   */
  async getDiscordGuildIdForOrg(organizationId: string): Promise<string | null> {
    // If the organizationId looks like a Discord guild ID (numeric snowflake), return it directly
    // Discord snowflakes are 17-19 digit numeric IDs
    if (/^\d{17,19}$/.test(organizationId)) {
      return organizationId;
    }

    // Otherwise, try to look up the organization to find its Discord guild ID
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!org) {
      return null;
    }

    // Check if there's a Discord guild ID in metadata or settings
    // Common patterns: metadata.discordGuildId, settings.discordGuildId
    // Using Record<string, unknown> access pattern for flexibility
    const metadata = org.metadata as Record<string, unknown>;
    const settings = org.settings as Record<string, unknown>;

    const discordGuildId =
      (metadata?.discordGuildId as string) ||
      (metadata?.discordServerId as string) ||
      (settings?.discordGuildId as string) ||
      null;

    return discordGuildId;
  }

  /**
   * Send announcement to all allied organizations (Phase 3)
   *
   * @deprecated Use sendToAllianceWithChannelResolution instead for proper channel discovery
   * This method is provided for backward compatibility but does not handle
   * cross-guild channel resolution. The channel ID passed must exist in all target guilds.
   *
   * @param id - Announcement ID
   * @param sourceOrgId - The source organization (Discord guild ID) initiating the announcement
   * @param _channelId - Ignored - use sendToAllianceWithChannelResolution for proper channel resolution
   */
  async sendToAlliance(
    id: string,
    sourceOrgId: string,
    _channelId: string
  ): Promise<AllianceDeliveryResult> {
    // Delegate to sendToAllianceWithChannelResolution which properly resolves channels
    logger.warn('sendToAlliance is deprecated. Use sendToAllianceWithChannelResolution instead.');
    return this.sendToAllianceWithChannelResolution(id, sourceOrgId, 'announcements');
  }

  /**
   * Send announcement to alliance with per-guild channel resolution (Phase 3)
   * This method attempts to find a suitable announcement channel in each allied guild
   *
   * @param id - Announcement ID
   * @param sourceOrgId - The source organization (Discord guild ID) initiating the announcement
   * @param preferredChannelName - Preferred channel name to look for (e.g., 'announcements', 'general')
   */
  async sendToAllianceWithChannelResolution(
    id: string,
    sourceOrgId: string,
    preferredChannelName: string = 'announcements'
  ): Promise<AllianceDeliveryResult> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new Error('Announcement has already been sent');
    }

    if (!this.discordClient) {
      throw new Error('Discord client not configured');
    }

    // Get all allied organizations
    const alliedOrgIds = await this.getAlliedOrganizations(sourceOrgId);

    if (alliedOrgIds.length === 0) {
      throw new Error('No allied organizations found');
    }

    // Resolve Discord guild IDs and find channels for all allied organizations
    const targetChannels: string[] = [];
    const skippedOrgs: string[] = [];
    const skippedReasons: Record<string, string> = {};

    for (const orgId of alliedOrgIds) {
      const guildId = await this.getDiscordGuildIdForOrg(orgId);

      if (!guildId) {
        skippedOrgs.push(orgId);
        skippedReasons[orgId] = 'No Discord server linked';
        logger.info(`Skipping org ${orgId}: No Discord server linked`);
        continue;
      }

      try {
        // Try to fetch the guild and find a suitable channel
        const guild = await this.discordClient.guilds.fetch(guildId);
        const channels = guild.channels.cache;

        // Look for a channel matching the preferred name
        let targetChannel = channels.find(
          ch =>
            ch.isTextBased() && ch.name.toLowerCase().includes(preferredChannelName.toLowerCase())
        );

        // Fall back to 'general' if no announcements channel found
        if (!targetChannel) {
          targetChannel = channels.find(
            ch => ch.isTextBased() && ch.name.toLowerCase().includes('general')
          );
        }

        // Fall back to first text channel
        if (!targetChannel) {
          targetChannel = channels.find(ch => ch.isTextBased());
        }

        if (targetChannel) {
          targetChannels.push(targetChannel.id);
        } else {
          skippedOrgs.push(orgId);
          skippedReasons[orgId] = 'No suitable text channel found in guild';
          logger.info(`Skipping org ${orgId}: No suitable text channel found`);
        }
      } catch (error: unknown) {
        skippedOrgs.push(orgId);
        skippedReasons[orgId] =
          `Failed to access guild: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(`Failed to access guild for org ${orgId}:`, error);
      }
    }

    if (targetChannels.length === 0) {
      // All orgs were skipped
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

    // Use sendMultiple to handle the actual delivery
    const result = await this.sendMultiple(id, 'multiple', targetChannels);

    // Update the announcement's target type to ALLIANCE after delivery
    // sendMultiple sets it to MULTIPLE, but we want to reflect alliance targeting
    const updatedAnnouncement = await this.getById(id);
    if (updatedAnnouncement) {
      updatedAnnouncement.targetType = AnnouncementTargetType.ALLIANCE;
      await this.announcementRepository.save(updatedAnnouncement);
    }

    return {
      ...result,
      allianceOrgs: alliedOrgIds,
      skippedOrgs,
      skippedReasons,
    };
  }

  // ========================================
  // Phase 4: Templates & Global Broadcast
  // ========================================

  /**
   * Create a new announcement template (Phase 4)
   *
   * @param organizationId - Organization ID (null for global templates)
   * @param dto - Template creation data
   * @param isPlatformAdmin - Whether the creator is a Platform Admin
   */
  async createTemplate(
    organizationId: string | null,
    dto: CreateTemplateDTO,
    isPlatformAdmin: boolean = false
  ): Promise<AnnouncementTemplate> {
    // Only Platform Admins can create global templates
    if (dto.isGlobal && !isPlatformAdmin) {
      throw new Error('Only Platform Admins can create global templates');
    }

    // Build template data
    const templateData: Partial<AnnouncementTemplate> = {
      name: dto.name,
      title: dto.title,
      content: dto.content,
      embedConfig: dto.embedConfig,
      isGlobal: dto.isGlobal || false,
      createdBy: dto.createdBy,
      createdByName: dto.createdByName,
    };

    // Set organizationId only if not global
    if (!dto.isGlobal && organizationId) {
      templateData.organizationId = organizationId;
    }

    const template = this.templateRepository.create(templateData);
    const savedTemplate = await this.templateRepository.save(template);
    logger.info(`Template created: ${savedTemplate.id} (global: ${savedTemplate.isGlobal})`);

    return savedTemplate;
  }

  /**
   * Get template by ID (Phase 4)
   */
  async getTemplateById(id: string): Promise<AnnouncementTemplate | null> {
    return this.templateRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  /**
   * Update an announcement template (Phase 4)
   *
   * @param id - Template ID
   * @param dto - Update data
   * @param userId - User performing the update
   * @param isPlatformAdmin - Whether the user is a Platform Admin
   */
  async updateTemplate(
    id: string,
    dto: UpdateTemplateDTO,
    userId: string,
    isPlatformAdmin: boolean = false
  ): Promise<AnnouncementTemplate> {
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
    logger.info(`Template updated: ${id}`);

    return updatedTemplate;
  }

  /**
   * Delete an announcement template (Phase 4)
   *
   * @param id - Template ID
   * @param userId - User performing the deletion
   * @param isPlatformAdmin - Whether the user is a Platform Admin
   */
  async deleteTemplate(
    id: string,
    userId: string,
    isPlatformAdmin: boolean = false
  ): Promise<void> {
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
    logger.info(`Template deleted: ${id}`);
  }

  /**
   * List templates available to an organization (Phase 4)
   * Includes both organization-specific and global templates
   *
   * @param organizationId - Organization ID to filter by
   * @param filters - Optional filters
   * @param page - Page number
   * @param limit - Results per page
   */
  async listTemplates(
    organizationId: string,
    filters: TemplateFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    templates: AnnouncementTemplate[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Build query to get org-specific templates OR global templates
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

  /**
   * List all global templates (Phase 4)
   * Available to all organizations
   */
  async listGlobalTemplates(
    page: number = 1,
    limit: number = 20
  ): Promise<{
    templates: AnnouncementTemplate[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [templates, total] = await this.templateRepository.findAndCount({
      where: {
        isGlobal: true,
        deletedAt: IsNull(),
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

  /**
   * Create an announcement from a template (Phase 4)
   *
   * @param organizationId - Organization creating the announcement
   * @param templateId - Template to use
   * @param overrides - Optional overrides for title/content
   * @param createdBy - User ID creating the announcement
   * @param createdByName - Username of creator
   */
  async createFromTemplate(
    organizationId: string,
    templateId: string,
    overrides: { title?: string; content?: string; embedConfig?: AnnouncementEmbedConfig } = {},
    createdBy: string,
    createdByName?: string
  ): Promise<Announcement> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    if (!template.isAvailableTo(organizationId)) {
      throw new Error('This template is not available to your organization');
    }

    const dto: CreateAnnouncementDTO = {
      title: overrides.title || template.title || template.name,
      content: overrides.content || template.content,
      embedConfig: overrides.embedConfig || template.embedConfig,
      createdBy,
      createdByName,
    };

    return this.create(organizationId, dto);
  }

  /**
   * Get all connected Discord guilds (Phase 4)
   * Used for global broadcast targeting
   */
  async getAllConnectedGuilds(): Promise<string[]> {
    if (!this.discordClient) {
      throw new Error('Discord client not configured');
    }

    // Get all guilds the bot is connected to
    const guilds = this.discordClient.guilds.cache;
    return Array.from(guilds.keys());
  }

  // ---------------------------------------------------------------------------
  // Pin / Unpin
  // ---------------------------------------------------------------------------

  /**
   * Pin an announcement (toggle: pins if unpinned, unpins if already pinned)
   */
  async togglePin(id: string, userId: string): Promise<{ pinned: boolean }> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    if (announcement.pinnedAt) {
      announcement.pinnedAt = undefined;
      announcement.pinnedBy = undefined;
    } else {
      announcement.pinnedAt = new Date();
      announcement.pinnedBy = userId;
    }

    await this.announcementRepository.save(announcement);
    const pinned = announcement.pinnedAt !== null && announcement.pinnedAt !== undefined;
    logger.info(`Announcement ${id} ${pinned ? 'pinned' : 'unpinned'} by ${userId}`);
    return { pinned };
  }

  // ---------------------------------------------------------------------------
  // Read tracking
  // ---------------------------------------------------------------------------

  /**
   * Record that a user has read an announcement.
   * Idempotent — duplicate calls for the same user+announcement are ignored.
   */
  async markRead(announcementId: string, userId: string): Promise<{ readAt: Date }> {
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
    logger.info(`Announcement ${announcementId} marked read by ${userId}`);
    return { readAt: saved.readAt };
  }

  /**
   * Send global broadcast to all connected Discord servers (Phase 4)
   * Requires Platform Admin permission and confirmation.
   * Uses extreme rate limiting to avoid Discord API issues.
   *
   * @param id - Announcement ID
   * @param confirmedBy - User ID who confirmed the broadcast (required)
   * @param preferredChannelName - Preferred channel name to look for
   */
  async sendGlobalBroadcast(
    id: string,
    confirmedBy: string,
    preferredChannelName: string = 'announcements'
  ): Promise<GlobalBroadcastResult> {
    const announcement = await this.getById(id);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    if (announcement.status === AnnouncementStatus.SENT) {
      throw new Error('Announcement has already been sent');
    }

    if (!this.discordClient) {
      throw new Error('Discord client not configured');
    }

    // Get all connected guilds
    const allGuildIds = await this.getAllConnectedGuilds();

    if (allGuildIds.length === 0) {
      throw new Error('No connected Discord servers found');
    }

    logger.info(
      `Starting global broadcast ${id} to ${allGuildIds.length} guilds, confirmed by ${confirmedBy}`
    );

    // Update announcement status
    announcement.status = AnnouncementStatus.SENDING;
    announcement.targetType = AnnouncementTargetType.ALL;
    await this.announcementRepository.save(announcement);

    // Resolve channels for each guild
    // Map<channelId, guildId> - stores channel ID as key, guild ID as value
    const targetChannelsByGuild: Map<string, string> = new Map();
    const skippedGuilds: string[] = [];
    const skippedReasons: Record<string, string> = {};
    let reachableGuilds = 0;

    // Process guilds in parallel batches of 5 instead of serial 1-second delays
    const GUILD_BATCH_SIZE = 5;

    for (let i = 0; i < allGuildIds.length; i += GUILD_BATCH_SIZE) {
      const batch = allGuildIds.slice(i, i + GUILD_BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async guildId => {
          try {
            const guild = await this.discordClient!.guilds.fetch(guildId);
            const channels = guild.channels.cache;
            reachableGuilds++;

            // Look for a channel matching the preferred name
            let targetChannel = channels.find(
              ch =>
                ch.isTextBased() &&
                ch.name.toLowerCase().includes(preferredChannelName.toLowerCase())
            );

            // Fall back to 'general' if no preferred channel found
            if (!targetChannel) {
              targetChannel = channels.find(
                ch => ch.isTextBased() && ch.name.toLowerCase().includes('general')
              );
            }

            // Fall back to first text channel
            if (!targetChannel) {
              targetChannel = channels.find(ch => ch.isTextBased());
            }

            if (targetChannel) {
              targetChannelsByGuild.set(targetChannel.id, guildId);
            } else {
              skippedGuilds.push(guildId);
              skippedReasons[guildId] = 'No suitable text channel found';
              logger.info(`Skipping guild ${guildId}: No suitable text channel found`);
            }
          } catch (error: unknown) {
            skippedGuilds.push(guildId);
            skippedReasons[guildId] =
              `Failed to access guild: ${error instanceof Error ? error.message : 'Unknown error'}`;
            logger.error(`Failed to access guild ${guildId}:`, error);
          }
        })
      ); // end Promise.allSettled batch

      // Rate limit between batches (not per guild) for Discord API compliance
      if (i + GUILD_BATCH_SIZE < allGuildIds.length) {
        await this.delay(GLOBAL_BROADCAST_RATE_LIMIT_DELAY_MS);
      }
    } // end for batch

    if (targetChannelsByGuild.size === 0) {
      announcement.status = AnnouncementStatus.FAILED;
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

    // Create delivery records with extreme rate limiting
    const deliveries: AnnouncementDelivery[] = [];
    const context = await this.buildShortcodeContext(announcement.organizationId);
    const embed = this.buildEmbed(announcement, context);
    let successCount = 0;
    let failCount = 0;

    for (const [channelId, guildId] of targetChannelsByGuild) {
      const delivery = this.deliveryRepository.create({
        announcementId: id,
        guildId,
        channelId,
        status: DeliveryStatus.PENDING,
      });
      const savedDelivery = await this.deliveryRepository.save(delivery);
      deliveries.push(savedDelivery);

      try {
        await this.processDelivery(savedDelivery, embed);
        if (savedDelivery.status === DeliveryStatus.DELIVERED) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error: unknown) {
        failCount++;
        logger.error(`Failed to process global delivery ${savedDelivery.id}:`, error);
      }

      // Extreme rate limiting for global broadcast
      await this.delay(GLOBAL_BROADCAST_RATE_LIMIT_DELAY_MS);
    }

    // Update announcement status based on results
    if (successCount > 0) {
      announcement.status = AnnouncementStatus.SENT;
    } else {
      announcement.status = AnnouncementStatus.FAILED;
    }
    announcement.sentAt = new Date();
    await this.announcementRepository.save(announcement);

    logger.info(
      `Global broadcast ${id} completed: ${successCount}/${deliveries.length} successful`
    );

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

  /**
   * Get global broadcast preview (Phase 4)
   * Returns information about what a global broadcast would target
   * without actually sending anything.
   */
  async getGlobalBroadcastPreview(): Promise<{
    totalGuilds: number;
    guildNames: string[];
    estimatedTimeMinutes: number;
  }> {
    if (!this.discordClient) {
      throw new Error('Discord client not configured');
    }

    const guilds = this.discordClient.guilds.cache;
    const guildNames = Array.from(guilds.values()).map(g => g.name);

    // Estimate time based on extreme rate limiting
    // 1 second delay (GLOBAL_BROADCAST_RATE_LIMIT_DELAY_MS) per guild during channel resolution
    // + 1 second delay per guild during message delivery
    // = approximately 2 seconds per guild
    const SECONDS_PER_GUILD = 2;
    const estimatedTimeMinutes = Math.ceil((guilds.size * SECONDS_PER_GUILD) / 60);

    return {
      totalGuilds: guilds.size,
      guildNames,
      estimatedTimeMinutes,
    };
  }
}
