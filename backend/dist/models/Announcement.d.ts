import { TenantEntity } from './base/TenantEntity';
export declare enum AnnouncementTargetType {
    SINGLE = "single",
    MULTIPLE = "multiple",
    ALL = "all",
    ALLIANCE = "alliance"
}
export declare enum AnnouncementStatus {
    DRAFT = "draft",
    SCHEDULED = "scheduled",
    SENDING = "sending",
    SENT = "sent",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export interface AnnouncementEmbedConfig {
    color?: string;
    thumbnailUrl?: string;
    imageUrl?: string;
    footerText?: string;
    footerTextTemplate?: string;
    footerIconUrl?: string;
    authorName?: string;
    authorNameTemplate?: string;
    authorIconUrl?: string;
    authorUrl?: string;
    timestamp?: boolean;
    fields?: AnnouncementEmbedField[];
}
export interface AnnouncementEmbedField {
    name: string;
    nameTemplate?: string;
    value: string;
    valueTemplate?: string;
    inline?: boolean;
}
export interface AnnouncementDeliveryResult {
    targetId: string;
    success: boolean;
    error?: string;
    messageId?: string;
    deliveredAt?: Date;
}
export declare class Announcement extends TenantEntity {
    id: string;
    title: string;
    content: string;
    embedConfig?: AnnouncementEmbedConfig;
    targetType: AnnouncementTargetType;
    targetIds?: string[];
    status: AnnouncementStatus;
    createdBy: string;
    createdByName?: string;
    scheduledAt?: Date;
    sentAt?: Date;
    pinnedAt?: Date;
    pinnedBy?: string;
    deliveryResults?: AnnouncementDeliveryResult[];
    federationId?: string;
    targetAudience?: string;
    createdAt: Date;
    get isPending(): boolean;
    get isDelivered(): boolean;
    get totalTargets(): number;
    get successfulDeliveries(): number;
    get failedDeliveries(): number;
    get isPinned(): boolean;
}
//# sourceMappingURL=Announcement.d.ts.map