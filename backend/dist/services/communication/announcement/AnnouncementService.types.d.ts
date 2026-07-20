import type { EmbedBuilder } from 'discord.js';
import type { Announcement, AnnouncementDeliveryResult, AnnouncementEmbedConfig, AnnouncementStatus, AnnouncementTargetType } from '../../../models/Announcement';
import type { AnnouncementDelivery } from '../../../models/AnnouncementDelivery';
export interface CreateAnnouncementDTO {
    title: string;
    content: string;
    createdBy: string;
    createdByName?: string;
    embedConfig?: AnnouncementEmbedConfig;
    targetType?: AnnouncementTargetType;
    targetIds?: string[];
    scheduledAt?: Date;
}
export interface UpdateAnnouncementDTO {
    title?: string;
    content?: string;
    embedConfig?: AnnouncementEmbedConfig;
    targetType?: AnnouncementTargetType;
    targetIds?: string[];
    scheduledAt?: Date;
    status?: AnnouncementStatus;
}
export interface AnnouncementFilters {
    status?: AnnouncementStatus | AnnouncementStatus[];
    createdBy?: string;
    targetType?: AnnouncementTargetType;
}
export interface EmbedPreview {
    embed: EmbedBuilder;
    announcement: Announcement;
}
export interface DeliveryResult {
    announcementId: string;
    success: boolean;
    totalTargets: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    results: AnnouncementDeliveryResult[];
}
export interface MultiServerDeliveryResult {
    announcementId: string;
    success: boolean;
    totalServers: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    deliveries: AnnouncementDelivery[];
}
export interface AllianceDeliveryResult extends MultiServerDeliveryResult {
    allianceOrgs: string[];
    skippedOrgs: string[];
    skippedReasons: Record<string, string>;
}
export interface AnnouncementStatusResult {
    announcement: Announcement;
    deliveries: AnnouncementDelivery[];
    summary: {
        total: number;
        pending: number;
        delivered: number;
        failed: number;
        cancelled: number;
    };
}
export interface CreateTemplateDTO {
    name: string;
    title?: string;
    content: string;
    embedConfig?: AnnouncementEmbedConfig;
    isGlobal?: boolean;
    createdBy: string;
    createdByName?: string;
}
export interface UpdateTemplateDTO {
    name?: string;
    title?: string;
    content?: string;
    embedConfig?: AnnouncementEmbedConfig;
}
export interface TemplateFilters {
    isGlobal?: boolean;
    createdBy?: string;
}
export interface GlobalBroadcastResult extends MultiServerDeliveryResult {
    totalGuilds: number;
    reachableGuilds: number;
    skippedGuilds: string[];
    skippedReasons: Record<string, string>;
    confirmationRequired: boolean;
    confirmedBy?: string;
}
//# sourceMappingURL=AnnouncementService.types.d.ts.map