import { EmbedBuilder } from 'discord.js';
import { type Announcement, AnnouncementStatus } from '../../models/Announcement';
import { type AnnouncementTemplate } from '../../models/AnnouncementTemplate';
import { type AllianceDeliveryResult, type AnnouncementStatusResult } from '../../services/communication/announcement';
export declare function buildPreviewEmbed(title: string, content: string, config: {
    color?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    timestamp?: boolean;
}): EmbedBuilder;
export declare function getStatusEmoji(status: AnnouncementStatus): string;
export declare function buildAnnouncementCreatedEmbed(announcementId: string, createdByUsername: string): EmbedBuilder;
export declare function buildAnnouncementCreatedFromTemplateEmbed(announcementId: string, title: string): EmbedBuilder;
export declare function buildAllianceDeliveryResultEmbed(result: AllianceDeliveryResult): EmbedBuilder;
export declare function buildAnnouncementStatusEmbed(status: AnnouncementStatusResult): EmbedBuilder;
export declare function buildAnnouncementListEmbed(announcements: Announcement[], total: number): EmbedBuilder;
export declare function buildTemplatesPanelEmbed(): EmbedBuilder;
export declare function buildTemplatesListEmbed(templates: AnnouncementTemplate[], total: number): EmbedBuilder;
export declare function buildAnnouncementScheduledEmbed(announcementId: string, scheduledAt: Date, channelId: string): EmbedBuilder;
export declare function buildTemplateCreatedEmbed(templateId: string, templateName: string, createdByUsername: string): EmbedBuilder;
//# sourceMappingURL=announceEmbeds.d.ts.map