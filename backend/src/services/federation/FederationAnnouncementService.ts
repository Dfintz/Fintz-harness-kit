import { ChannelType, EmbedBuilder, TextChannel } from 'discord.js';
import { Repository } from 'typeorm';

import { BotClientManager } from '../../bot/BotClientManager';
import { AppDataSource } from '../../data-source';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementTargetType,
} from '../../models/Announcement';
import { Federation } from '../../models/Federation';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationPermission, requireFederationViewAccess } from './federationPermissions';

/** Federation announcement audience scopes */
export type FederationAnnouncementAudience = 'all-members' | 'council' | 'public';

/** Data returned by the service */
export interface FederationAnnouncementData {
  id: string;
  federationId: string;
  title: string;
  content: string;
  targetAudience: FederationAnnouncementAudience;
  createdBy: string;
  createdByName: string | null;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
  pinnedAt: Date | null;
}

export interface FederationAnnouncementDiscordPostResult {
  announcement: FederationAnnouncementData;
  guildId: string;
  channelId: string;
  messageId: string;
}

/**
 * FederationAnnouncementService
 *
 * Manages federation-scoped announcements. Ambassadors with the 'announce'
 * permission can create announcements targeted at different audience tiers:
 *   - all-members: visible to all member org ambassadors
 *   - council: only council+ role ambassadors
 *   - public: visible to everyone (not scoped)
 *
 * Reuses the existing Announcement entity with federationId scoping.
 */
export class FederationAnnouncementService {
  private static instance: FederationAnnouncementService;
  private readonly announcementRepository: Repository<Announcement>;
  private readonly federationRepository: Repository<Federation>;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.announcementRepository = AppDataSource.getRepository(Announcement);
    this.federationRepository = AppDataSource.getRepository(Federation);
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationAnnouncementService {
    if (!FederationAnnouncementService.instance) {
      FederationAnnouncementService.instance = new FederationAnnouncementService();
    }
    return FederationAnnouncementService.instance;
  }

  // ─── Helper ────────────────────────────────────────────────

  private toData(entity: Announcement): FederationAnnouncementData {
    return {
      id: entity.id,
      federationId: entity.federationId ?? '',
      title: entity.title,
      content: entity.content,
      targetAudience: (entity.targetAudience as FederationAnnouncementAudience) ?? 'all-members',
      createdBy: entity.createdBy,
      createdByName: entity.createdByName ?? null,
      status: entity.status,
      createdAt: entity.createdAt,
      sentAt: entity.sentAt ?? null,
      pinnedAt: entity.pinnedAt ?? null,
    };
  }

  // ─── Permission Check ──────────────────────────────────────

  private async requireAnnouncePermission(federationId: string, userId: string): Promise<void> {
    return requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'announce',
      'Ambassador announce permission required'
    );
  }

  private async requireViewAccess(federationId: string, userId: string): Promise<void> {
    return requireFederationViewAccess(
      this.ambassadorService,
      federationId,
      userId,
      'announcements'
    );
  }

  // ─── CRUD ─────────────────────────────────────────────────

  /**
   * Create a federation announcement.
   */
  async createAnnouncement(
    federationId: string,
    userId: string,
    data: {
      title: string;
      content: string;
      targetAudience?: FederationAnnouncementAudience;
      createdByName?: string;
    }
  ): Promise<FederationAnnouncementData> {
    await this.requireAnnouncePermission(federationId, userId);

    if (!data.title?.trim() || data.title.trim().length < 3) {
      throw new ValidationError('Announcement title must be at least 3 characters');
    }
    if (!data.content?.trim() || data.content.trim().length < 10) {
      throw new ValidationError('Announcement content must be at least 10 characters');
    }

    const announcement = this.announcementRepository.create({
      // Use federationId as organizationId for tenant scoping
      organizationId: federationId,
      federationId,
      title: data.title.trim(),
      content: data.content.trim(),
      targetAudience: data.targetAudience ?? 'all-members',
      targetType: AnnouncementTargetType.ALL,
      status: AnnouncementStatus.SENT,
      createdBy: userId,
      createdByName: data.createdByName,
      sentAt: new Date(),
    });

    const saved = await this.announcementRepository.save(announcement);

    logger.info('Federation announcement created', {
      federationId,
      announcementId: saved.id,
      audience: data.targetAudience ?? 'all-members',
    });

    return this.toData(saved);
  }

  /**
   * List federation announcements.
   */
  async listAnnouncements(
    federationId: string,
    userId: string
  ): Promise<FederationAnnouncementData[]> {
    await this.requireViewAccess(federationId, userId);

    const announcements = await this.announcementRepository.find({
      where: { federationId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return announcements.map(a => this.toData(a));
  }

  /**
   * Get a single federation announcement.
   */
  async getAnnouncement(
    federationId: string,
    userId: string,
    announcementId: string
  ): Promise<FederationAnnouncementData> {
    await this.requireViewAccess(federationId, userId);

    const announcement = await this.announcementRepository.findOne({
      where: { id: announcementId, federationId },
    });

    if (!announcement) {
      throw new NotFoundError('Announcement', announcementId);
    }

    return this.toData(announcement);
  }

  /**
   * Delete a federation announcement (announce permission required).
   */
  async deleteAnnouncement(
    federationId: string,
    userId: string,
    announcementId: string
  ): Promise<void> {
    await this.requireAnnouncePermission(federationId, userId);

    const announcement = await this.announcementRepository.findOne({
      where: { id: announcementId, federationId },
    });

    if (!announcement) {
      throw new NotFoundError('Announcement', announcementId);
    }

    await this.announcementRepository.remove(announcement);

    logger.info('Federation announcement deleted', {
      federationId,
      announcementId,
    });
  }

  /**
   * Pin/unpin a federation announcement.
   */
  async togglePin(
    federationId: string,
    userId: string,
    announcementId: string
  ): Promise<FederationAnnouncementData> {
    await this.requireAnnouncePermission(federationId, userId);

    const announcement = await this.announcementRepository.findOne({
      where: { id: announcementId, federationId },
    });

    if (!announcement) {
      throw new NotFoundError('Announcement', announcementId);
    }

    if (announcement.pinnedAt) {
      announcement.pinnedAt = undefined;
      announcement.pinnedBy = undefined;
    } else {
      announcement.pinnedAt = new Date();
      announcement.pinnedBy = userId;
    }

    const saved = await this.announcementRepository.save(announcement);
    return this.toData(saved);
  }

  /**
   * Post an existing federation announcement to the federation's central Discord guild.
   */
  async postAnnouncementToDiscord(
    federationId: string,
    userId: string,
    announcementId: string,
    channelId: string
  ): Promise<FederationAnnouncementDiscordPostResult> {
    await this.requireAnnouncePermission(federationId, userId);

    const announcement = await this.announcementRepository.findOne({
      where: { id: announcementId, federationId },
    });

    if (!announcement) {
      throw new NotFoundError('Announcement', announcementId);
    }

    const federation = await this.federationRepository.findOne({ where: { id: federationId } });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
    }

    const guildId = federation.settings?.centralGuildId;
    if (!guildId) {
      throw new ValidationError('Federation central Discord guild is not configured');
    }

    const client = BotClientManager.getInstance().getClient();
    if (!client?.isReady()) {
      throw new ValidationError('Discord bot client is not connected');
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      throw new ValidationError('Target channel not found or not text-based');
    }
    if (!('guildId' in channel) || channel.guildId !== guildId) {
      throw new ValidationError('Target channel is not in the federation central Discord guild');
    }

    const embed = new EmbedBuilder()
      .setTitle(announcement.title)
      .setDescription(announcement.content)
      .setColor(0x5865f2)
      .setTimestamp();

    const sent = await (channel as TextChannel).send({ embeds: [embed] });
    if (channel.type === ChannelType.GuildAnnouncement) {
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

    announcement.status = AnnouncementStatus.SENT;
    announcement.sentAt = deliveredAt;
    announcement.deliveryResults = deliveryResults;
    announcement.targetType = AnnouncementTargetType.SINGLE;
    announcement.targetIds = [channelId];

    const saved = await this.announcementRepository.save(announcement);

    logger.info('Federation announcement posted to Discord', {
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

