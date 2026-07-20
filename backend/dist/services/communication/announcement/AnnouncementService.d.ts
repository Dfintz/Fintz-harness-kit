import { Client } from 'discord.js';
import { Announcement, AnnouncementEmbedConfig } from '../../../models/Announcement';
import { AnnouncementDelivery } from '../../../models/AnnouncementDelivery';
import { AnnouncementTemplate } from '../../../models/AnnouncementTemplate';
import type { AllianceDeliveryResult, AnnouncementFilters, AnnouncementStatusResult, CreateAnnouncementDTO, CreateTemplateDTO, DeliveryResult, EmbedPreview, GlobalBroadcastResult, MultiServerDeliveryResult, TemplateFilters, UpdateAnnouncementDTO, UpdateTemplateDTO } from './AnnouncementService.types';
export type { AllianceDeliveryResult, AnnouncementFilters, AnnouncementStatusResult, CreateAnnouncementDTO, CreateTemplateDTO, DeliveryResult, EmbedPreview, GlobalBroadcastResult, MultiServerDeliveryResult, TemplateFilters, UpdateAnnouncementDTO, UpdateTemplateDTO, } from './AnnouncementService.types';
export declare class AnnouncementService {
    private announcementRepository;
    private deliveryRepository;
    private readReceiptRepository;
    private templateRepository;
    private diplomacyRepository;
    private organizationRepository;
    private organizationMembershipRepository;
    private discordClient;
    constructor();
    setDiscordClient(client: Client): void;
    create(organizationId: string, dto: CreateAnnouncementDTO): Promise<Announcement>;
    getById(id: string): Promise<Announcement | null>;
    update(id: string, dto: UpdateAnnouncementDTO): Promise<Announcement>;
    delete(id: string, deletedBy: string): Promise<void>;
    list(organizationId: string, filters?: AnnouncementFilters, page?: number, limit?: number): Promise<{
        announcements: Announcement[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    preview(announcement: Announcement, userId?: string): Promise<EmbedPreview>;
    previewById(id: string): Promise<EmbedPreview>;
    private buildShortcodeContext;
    private buildEmbed;
    send(id: string, channelId: string): Promise<DeliveryResult>;
    cancel(id: string): Promise<Announcement>;
    getPendingDelivery(): Promise<Announcement[]>;
    getStats(organizationId: string): Promise<{
        total: number;
        draft: number;
        scheduled: number;
        sent: number;
        failed: number;
        cancelled: number;
    }>;
    sendMultiple(id: string, targetType: 'multiple', targetIds: string[]): Promise<MultiServerDeliveryResult>;
    schedule(id: string, scheduledAt: Date, targetIds?: string[]): Promise<void>;
    getStatus(id: string): Promise<AnnouncementStatusResult>;
    cancelScheduled(id: string): Promise<void>;
    retryFailed(id: string): Promise<MultiServerDeliveryResult>;
    getPendingDeliveries(): Promise<AnnouncementDelivery[]>;
    processScheduledDelivery(deliveryId: string): Promise<boolean>;
    private processDelivery;
    private delay;
    private tryCrosspost;
    getAlliedOrganizations(organizationId: string): Promise<string[]>;
    getDiscordGuildIdForOrg(organizationId: string): Promise<string | null>;
    sendToAlliance(id: string, sourceOrgId: string, _channelId: string): Promise<AllianceDeliveryResult>;
    sendToAllianceWithChannelResolution(id: string, sourceOrgId: string, preferredChannelName?: string): Promise<AllianceDeliveryResult>;
    createTemplate(organizationId: string | null, dto: CreateTemplateDTO, isPlatformAdmin?: boolean): Promise<AnnouncementTemplate>;
    getTemplateById(id: string): Promise<AnnouncementTemplate | null>;
    updateTemplate(id: string, dto: UpdateTemplateDTO, userId: string, isPlatformAdmin?: boolean): Promise<AnnouncementTemplate>;
    deleteTemplate(id: string, userId: string, isPlatformAdmin?: boolean): Promise<void>;
    listTemplates(organizationId: string, filters?: TemplateFilters, page?: number, limit?: number): Promise<{
        templates: AnnouncementTemplate[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    listGlobalTemplates(page?: number, limit?: number): Promise<{
        templates: AnnouncementTemplate[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    createFromTemplate(organizationId: string, templateId: string, overrides: {
        title?: string;
        content?: string;
        embedConfig?: AnnouncementEmbedConfig;
    } | undefined, createdBy: string, createdByName?: string): Promise<Announcement>;
    getAllConnectedGuilds(): Promise<string[]>;
    togglePin(id: string, userId: string): Promise<{
        pinned: boolean;
    }>;
    markRead(announcementId: string, userId: string): Promise<{
        readAt: Date;
    }>;
    sendGlobalBroadcast(id: string, confirmedBy: string, preferredChannelName?: string): Promise<GlobalBroadcastResult>;
    getGlobalBroadcastPreview(): Promise<{
        totalGuilds: number;
        guildNames: string[];
        estimatedTimeMinutes: number;
    }>;
}
//# sourceMappingURL=AnnouncementService.d.ts.map