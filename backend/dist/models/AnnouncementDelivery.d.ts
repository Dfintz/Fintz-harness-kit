import { Announcement } from './Announcement';
export declare enum DeliveryStatus {
    PENDING = "pending",
    SCHEDULED = "scheduled",
    SENDING = "sending",
    DELIVERED = "delivered",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare const MAX_DELIVERY_RETRY_COUNT = 3;
export declare class AnnouncementDelivery {
    id: string;
    announcementId: string;
    announcement: Announcement;
    guildId: string;
    channelId?: string;
    status: DeliveryStatus;
    messageId?: string;
    retryCount: number;
    scheduledAt?: Date;
    deliveredAt?: Date;
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
    get isPending(): boolean;
    get isDelivered(): boolean;
    get isFailed(): boolean;
    get canRetry(): boolean;
}
//# sourceMappingURL=AnnouncementDelivery.d.ts.map